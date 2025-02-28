import { NextResponse } from 'next/server';
import { deleteWallet } from '@/lib/server-db';

export async function DELETE(
  request: Request,
  { params }: { params: { publicKey: string } }
) {
  try {
    await deleteWallet(params.publicKey);
    return NextResponse.json({ message: 'Wallet deleted successfully' });
  } catch (error) {
    console.error('Error deleting wallet:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete wallet' },
      { status: 500 }
    );
  }
} 