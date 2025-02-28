import { NextResponse } from 'next/server';
import { getWallet } from '@/lib/server-db';
import { decrypt } from '@/lib/encryption';

export async function GET(
  request: Request,
  { params }: { params: { publicKey: string } }
) {
  try {
    const wallet = await getWallet(params.publicKey);

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      );
    }

    if (!wallet.encryptedPrivateKey) {
      return NextResponse.json(
        { error: 'No private key available for this wallet' },
        { status: 400 }
      );
    }

    const privateKey = decrypt(wallet.encryptedPrivateKey);

    return NextResponse.json({
      privateKey,
    });
  } catch (error) {
    console.error('Error getting private key:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get private key' },
      { status: 500 }
    );
  }
} 