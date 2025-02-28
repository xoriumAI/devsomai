import { NextResponse } from 'next/server';
import { createWallet } from '@/lib/server-db';

export async function POST(request: Request) {
  try {
    const { publicKey, name } = await request.json();
    
    if (!publicKey) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Create wallet in database with empty encrypted private key since it's a CEX wallet
    const wallet = await createWallet({
      publicKey,
      encryptedPrivateKey: '',
      name,
      group: 'cex',
    });
    
    if (!wallet) {
      throw new Error('Failed to add CEX wallet');
    }

    return NextResponse.json(wallet);
  } catch (error) {
    console.error('Error adding CEX wallet:', error);
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { error: 'A wallet with this address already exists' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add CEX wallet' },
      { status: 500 }
    );
  }
} 