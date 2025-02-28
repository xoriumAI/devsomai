import { NextResponse } from 'next/server';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getWallet, updateWalletBalance } from '@/lib/server-db';
import { getSettings, switchNetwork } from '@/lib/settings';

// Maximum amount of SOL to airdrop (2 SOL)
const MAX_AIRDROP_AMOUNT = 2;

export async function POST(request: Request) {
  try {
    const { publicKey, amount = 1 } = await request.json();
    
    if (!publicKey) {
      return NextResponse.json(
        { error: 'Wallet public key is required' },
        { status: 400 }
      );
    }

    // Get current network settings
    const settings = getSettings();
    console.log('Current network settings:', settings.network);
    
    // Only allow airdrops on devnet
    if (settings.network !== 'devnet') {
      console.log('Airdrop rejected: Not on devnet');
      
      // If client thinks we're on devnet but server doesn't, try to sync
      return NextResponse.json(
        { error: 'Airdrops are only available on devnet. Please refresh the page and try again.' },
        { status: 400 }
      );
    }

    // Validate the wallet exists
    const wallet = await getWallet(publicKey);
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      );
    }

    // Limit airdrop amount
    const solAmount = Math.min(Number(amount), MAX_AIRDROP_AMOUNT);
    const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);

    // Create connection to devnet
    console.log(`Connecting to ${settings.network} at ${settings.rpc.http}`);
    const connection = new Connection(settings.rpc.http, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000
    });

    // Request airdrop
    console.log(`Requesting airdrop of ${solAmount} SOL to ${publicKey}`);
    const signature = await connection.requestAirdrop(
      new PublicKey(publicKey),
      lamports
    );

    console.log('Airdrop requested:', signature);

    // Wait for confirmation
    console.log('Waiting for confirmation...');
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
    await connection.confirmTransaction({
      blockhash,
      lastValidBlockHeight,
      signature
    });

    console.log('Airdrop confirmed');

    // Update wallet balance
    const newBalance = await connection.getBalance(new PublicKey(publicKey));
    await updateWalletBalance(publicKey, newBalance / LAMPORTS_PER_SOL);

    return NextResponse.json({
      success: true,
      signature,
      amount: solAmount,
      message: `Successfully airdropped ${solAmount} SOL to your wallet`
    });
  } catch (error) {
    console.error('Airdrop error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to request airdrop',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 