import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Buffer } from 'buffer';

const CHUNK_SIZE = 900; // Maximum data size per transaction

export async function uploadToSolana(
  connection: Connection,
  payer: Keypair,
  data: Buffer
): Promise<string> {
  console.log('Starting Solana upload process...');
  console.log(`Data size: ${data.length} bytes`);

  try {
    // Check payer balance first
    const balance = await connection.getBalance(payer.publicKey);
    console.log(`Payer balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    if (balance < LAMPORTS_PER_SOL * 0.1) { // Require at least 0.1 SOL
      throw new Error(`Insufficient balance. Required: 0.1 SOL, Current: ${balance / LAMPORTS_PER_SOL} SOL`);
    }

    // Create a new account to store the data
    console.log('Generating storage account...');
    const storageAccount = Keypair.generate();
    const space = data.length;
    
    // Calculate rent exemption
    console.log('Calculating rent exemption...');
    const rentExemption = await connection.getMinimumBalanceForRentExemption(space);
    console.log(`Required rent exemption: ${rentExemption / LAMPORTS_PER_SOL} SOL`);
    
    // Create transaction to allocate storage
    console.log('Creating account transaction...');
    const createAccountIx = SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: storageAccount.publicKey,
      lamports: rentExemption,
      space: space,
      programId: SystemProgram.programId
    });

    // Create data upload instruction
    console.log('Creating data upload instruction...');
    const dataIx = new TransactionInstruction({
      keys: [
        { pubkey: storageAccount.publicKey, isSigner: true, isWritable: true },
        { pubkey: payer.publicKey, isSigner: true, isWritable: true }
      ],
      programId: SystemProgram.programId,
      data: Buffer.from(data)
    });

    // Get recent blockhash
    console.log('Getting recent blockhash...');
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    
    // Combine instructions into a single transaction
    const transaction = new Transaction()
      .add(createAccountIx)
      .add(dataIx);
    
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer.publicKey;

    // Get estimated fee
    console.log('Estimating transaction fee...');
    const fee = await connection.getFeeForMessage(transaction.compileMessage());
    console.log(`Estimated fee: ${fee} lamports`);

    // Send and confirm transaction
    console.log('Sending transaction...');
    const signature = await connection.sendTransaction(
      transaction,
      [payer, storageAccount],
      { 
        preflightCommitment: 'confirmed',
        maxRetries: 3
      }
    );
    
    console.log('Waiting for confirmation...', signature);
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log('Transaction confirmed successfully!');
    
    // Verify the data was written
    console.log('Verifying storage account...');
    const accountInfo = await connection.getAccountInfo(storageAccount.publicKey);
    if (!accountInfo) {
      throw new Error('Storage account not found after creation');
    }

    console.log('Upload completed successfully!');
    return `solana://${storageAccount.publicKey.toString()}`;
  } catch (error) {
    console.error('Detailed upload error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
} 