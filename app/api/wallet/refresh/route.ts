import { NextResponse } from 'next/server';
import { getWallets, updateWalletBalance } from '@/lib/server-db';
import { Connection, PublicKey } from '@solana/web3.js';
import { getSettings } from '@/lib/settings';

export async function POST() {
  try {
    const wallets = await getWallets();
    
    // Get current network settings
    const settings = getSettings();
    const networkEndpoint = settings.rpc.http;
    const networkName = settings.network;
    
    console.log(`Refreshing wallet balances on ${networkName} at ${networkEndpoint}`);
    const connection = new Connection(networkEndpoint, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60000
    });
    
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
    return NextResponse.json({
      wallets: updatedWallets,
      network: networkName
    });
  } catch (error) {
    console.error('Error refreshing balances:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refresh balances' },
      { status: 500 }
    );
  }
} 