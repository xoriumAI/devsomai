import { NextResponse } from 'next/server';
import { getSettings, switchNetwork } from '@/lib/settings';

// GET endpoint to retrieve current network settings
export async function GET() {
  try {
    const settings = getSettings();
    return NextResponse.json({
      network: settings.network,
      rpc: settings.rpc
    });
  } catch (error) {
    console.error('Error getting network settings:', error);
    return NextResponse.json(
      { error: 'Failed to get network settings' },
      { status: 500 }
    );
  }
}

// POST endpoint to switch network
export async function POST(request: Request) {
  try {
    const { network, isUserPreference = false } = await request.json();
    
    if (!network || (network !== 'mainnet-beta' && network !== 'devnet')) {
      return NextResponse.json(
        { error: 'Invalid network. Must be "mainnet-beta" or "devnet"' },
        { status: 400 }
      );
    }
    
    console.log(`Switching network on server to: ${network} (User preference: ${isUserPreference})`);
    
    // Store the fact that this is a user preference in the response
    const updatedSettings = switchNetwork(network);
    
    return NextResponse.json({
      success: true,
      network: updatedSettings.network,
      rpc: updatedSettings.rpc,
      isUserPreference
    });
  } catch (error) {
    console.error('Error switching network:', error);
    return NextResponse.json(
      { error: 'Failed to switch network' },
      { status: 500 }
    );
  }
} 