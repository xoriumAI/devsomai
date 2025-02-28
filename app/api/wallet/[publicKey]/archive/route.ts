import { NextResponse } from 'next/server';
import { toggleWalletArchive } from '@/lib/server-db';

export async function POST(
  request: Request,
  { params }: { params: { publicKey: string } }
) {
  try {
    const wallet = await toggleWalletArchive(params.publicKey);
    
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(wallet);
  } catch (error) {
    console.error('Error toggling wallet archive:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to toggle wallet archive' },
      { status: 500 }
    );
  }
} 