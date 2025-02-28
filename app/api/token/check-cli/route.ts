import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  try {
    const { stdout } = await execAsync('solana --version');
    return NextResponse.json({ 
      installed: true,
      version: stdout.trim()
    });
  } catch (error) {
    return NextResponse.json({ 
      installed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 