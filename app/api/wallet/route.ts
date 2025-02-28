import { NextResponse } from 'next/server';
import { getWallets, createWallet } from '@/lib/server-db';
import { generateKeyPair, encryptPrivateKey } from '@/lib/crypto';

export async function GET() {
  try {
    const wallets = await getWallets();
    console.log('Retrieved wallets:', wallets);
    return NextResponse.json(wallets);
  } catch (error) {
    console.error('Error getting wallets:', error);
    return NextResponse.json(
      { error: 'Failed to get wallets' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { name, group = 'main' } = await request.json();
    console.log('Creating wallet with name:', name, 'group:', group);
    
    // Generate new keypair
    const { publicKey, privateKey } = await generateKeyPair();
    console.log('Generated keypair with public key:', publicKey);
    
    // Encrypt private key
    const encryptedPrivateKey = await encryptPrivateKey(privateKey);
    console.log('Encrypted private key successfully');
    
    // Create wallet in database
    const wallet = await createWallet({
      publicKey,
      encryptedPrivateKey,
      name,
      group,
    });
    console.log('Created wallet in database:', wallet);
    
    if (!wallet) {
      throw new Error('Failed to create wallet');
    }

    return NextResponse.json(wallet);
  } catch (error) {
    console.error('Error creating wallet:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create wallet' },
      { status: 500 }
    );
  }
} 