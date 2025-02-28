import { NextResponse } from 'next/server';
import { createWallet } from '@/lib/server-db';
import { Keypair } from '@solana/web3.js';
import { encrypt } from '@/lib/encryption';
import bs58 from 'bs58';

export async function POST(request: Request) {
  try {
    const { privateKey, name, group = 'main' } = await request.json();

    if (!privateKey) {
      return NextResponse.json(
        { error: 'Private key is required' },
        { status: 400 }
      );
    }

    // Decode and validate private key
    let keypair: Keypair;
    try {
      const privateKeyBytes = bs58.decode(privateKey);
      keypair = Keypair.fromSecretKey(privateKeyBytes);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid private key format' },
        { status: 400 }
      );
    }

    // Encrypt private key
    const encryptedPrivateKey = await encrypt(privateKey);

    // Create wallet in database
    const wallet = await createWallet({
      publicKey: keypair.publicKey.toBase58(),
      encryptedPrivateKey,
      name: name || `Wallet ${Math.floor(Math.random() * 1000)}`,
      group,
    });

    return NextResponse.json({ wallet });
  } catch (error) {
    console.error('Error importing wallet:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import wallet' },
      { status: 500 }
    );
  }
} 