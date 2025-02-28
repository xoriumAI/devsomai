import { NextResponse } from 'next/server';
import { Connection, PublicKey, Transaction, SystemProgram, Keypair, LAMPORTS_PER_SOL, Commitment } from '@solana/web3.js';
import { getWallet, updateWalletBalance } from '@/lib/server-db';
import { decrypt } from '@/lib/encryption';
import { getSettings } from '@/lib/settings';
import bs58 from 'bs58';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function getWorkingConnection(): Promise<Connection> {
  // Get current network settings
  const settings = getSettings();
  const networkEndpoint = settings.rpc.http;
  
  console.log(`Connecting to ${settings.network} at ${networkEndpoint}`);
  
  return new Connection(networkEndpoint, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 60000
  });
}

async function retryOperation<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.warn(`Operation failed (attempt ${i + 1}/${retries}):`, lastError.message);
      
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
      }
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}

export async function POST(request: Request) {
  try {
    const { fromPublicKey, toPublicKey, amount } = await request.json();
    
    if (!fromPublicKey || !toPublicKey || amount === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Get sender's wallet
    const senderWallet = await getWallet(fromPublicKey);
    if (!senderWallet) {
      return NextResponse.json(
        { error: 'Sender wallet not found' },
        { status: 404 }
      );
    }

    if (!senderWallet.encryptedPrivateKey) {
      return NextResponse.json(
        { error: 'No private key available for sender wallet' },
        { status: 400 }
      );
    }

    try {
      // Get a working RPC connection
      const connection = await retryOperation(getWorkingConnection);
      
      // Convert amount to lamports
      const lamports = Math.round(amount * LAMPORTS_PER_SOL);
      
      // Get sender's private key
      const privateKey = decrypt(senderWallet.encryptedPrivateKey);
      const senderKeypair = Keypair.fromSecretKey(bs58.decode(privateKey));
      
      // Check sender's balance before proceeding
      const senderBalance = await connection.getBalance(senderKeypair.publicKey);
      
      // Calculate the fee (approximately 5000 lamports)
      const estimatedFee = 5000;
      const totalRequired = lamports + estimatedFee;
      
      if (senderBalance < totalRequired) {
        const settings = getSettings();
        return NextResponse.json(
          { 
            error: 'Insufficient balance', 
            details: {
              available: senderBalance / LAMPORTS_PER_SOL,
              required: amount,
              fee: estimatedFee / LAMPORTS_PER_SOL,
              total: totalRequired / LAMPORTS_PER_SOL,
              network: settings.network
            }
          },
          { status: 400 }
        );
      }
      
      // Validate recipient address
      const recipientPubkey = new PublicKey(toPublicKey);
      
      // Get latest blockhash with retry
      const { blockhash, lastValidBlockHeight } = await retryOperation(() => 
        connection.getLatestBlockhash('confirmed')
      );
      
      // Create transaction
      const transaction = new Transaction({
        feePayer: senderKeypair.publicKey,
        recentBlockhash: blockhash,
      }).add(
        SystemProgram.transfer({
          fromPubkey: senderKeypair.publicKey,
          toPubkey: recipientPubkey,
          lamports,
        })
      );

      // Sign and send transaction with retry
      const signature = await retryOperation(() =>
        connection.sendTransaction(transaction, [senderKeypair], {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        })
      );

      console.log('Transaction sent:', signature);

      // Wait for confirmation
      try {
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        });

        // Update balances
        const updatedSenderBalance = await connection.getBalance(senderKeypair.publicKey);
        await updateWalletBalance(fromPublicKey, updatedSenderBalance / LAMPORTS_PER_SOL);

        const recipientWallet = await getWallet(toPublicKey);
        if (recipientWallet) {
          const recipientBalance = await connection.getBalance(recipientPubkey);
          await updateWalletBalance(toPublicKey, recipientBalance / LAMPORTS_PER_SOL);
        }

        return NextResponse.json({ 
          signature,
          message: 'Transaction confirmed successfully'
        });
      } catch (error) {
        // Even if confirmation times out, the transaction might still be successful
        console.warn('Confirmation error:', error);
        return NextResponse.json({ 
          signature,
          message: 'Transaction sent but confirmation timed out. Balance will update shortly if successful.'
        });
      }
    } catch (error) {
      console.error('Transaction error:', error);
      
      // Extract more detailed error information if available
      let errorMessage = 'Transaction failed';
      let errorDetails = null;
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check for SendTransactionError with logs
        if ('transactionLogs' in error && Array.isArray(error.transactionLogs)) {
          errorDetails = {
            logs: error.transactionLogs,
            message: ('transactionMessage' in error ? (error as any).transactionMessage : errorMessage)
          };
          
          // Check for insufficient funds in logs
          if (error.transactionLogs.some(log => log.includes('insufficient lamports'))) {
            errorMessage = 'Insufficient balance for this transaction';
          }
        }
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: errorDetails
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error sending SOL:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send SOL' },
      { status: 500 }
    );
  }
} 