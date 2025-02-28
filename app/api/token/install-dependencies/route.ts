import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST() {
  try {
    // Create a temporary directory for downloads
    const tempDir = path.join(process.cwd(), 'temp');
    await execAsync(`mkdir -Force "${tempDir}"`);

    try {
      // Download Solana installer for Windows
      console.log('Downloading Solana installer...');
      await execAsync(
        `Invoke-WebRequest -Uri "https://release.solana.com/stable/solana-install-init-x86_64-pc-windows-msvc.exe" -OutFile "${path.join(tempDir, 'solana-installer.exe')}"`
      );

      // Install Solana CLI
      console.log('Installing Solana CLI...');
      await execAsync(`"${path.join(tempDir, 'solana-installer.exe')}" stable`);

      // Add Solana to PATH
      const userProfile = process.env.USERPROFILE;
      if (!userProfile) {
        throw new Error('USERPROFILE environment variable is not set');
      }
      const solanaPath = path.join(userProfile, '.local', 'share', 'solana', 'install', 'active_release', 'bin');
      process.env.PATH = `${process.env.PATH};${solanaPath}`;

      // Install Rust (required for spl-token)
      console.log('Installing Rust...');
      await execAsync(
        `Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile "${path.join(tempDir, 'rustup-init.exe')}"`
      );
      await execAsync(`"${path.join(tempDir, 'rustup-init.exe')}" -y`);

      // Add Cargo to PATH
      const cargoPath = path.join(userProfile, '.cargo', 'bin');
      process.env.PATH = `${process.env.PATH};${cargoPath}`;

      // Install spl-token CLI
      console.log('Installing spl-token CLI...');
      await execAsync('cargo install spl-token-cli');

      // Clean up
      await execAsync(`Remove-Item -Recurse -Force "${tempDir}"`);

      return NextResponse.json({ 
        success: true,
        message: 'Dependencies installed successfully'
      });
    } finally {
      // Ensure cleanup happens even if installation fails
      try {
        await execAsync(`Remove-Item -Recurse -Force "${tempDir}"`);
      } catch (error) {
        console.error('Error cleaning up:', error);
      }
    }
  } catch (error) {
    console.error('Error installing dependencies:', error);
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 