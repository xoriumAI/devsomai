import { NextResponse } from 'next/server';
import { getWallets, updateWalletBalance } from '@/lib/server-db';
import { Connection, PublicKey } from '@solana/web3.js';

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com');

export async function POST() {
  try {
    const wallets = await getWallets();
    
    // Update balances in parallel
    await Promise.all(
      wallets.map(async (wallet) => {
        try {
          const balance = await connection.getBalance(new PublicKey(wallet.publicKey));
          await updateWalletBalance(wallet.publicKey, balance / 1e9); // Convert lamports to SOL
        } catch (error) {
          console.error(`Error updating balance for ${wallet.publicKey}:`, error);
        }
      })
    );
    
    // Get updated wallets
    const updatedWallets = await getWallets();
    return NextResponse.json(updatedWallets);
  } catch (error) {
    console.error('Error refreshing balances:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refresh balances' },
      { status: 500 }
    );
  }
} 