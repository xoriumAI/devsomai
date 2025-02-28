import { NextResponse } from 'next/server';
import { getWallet } from '@/lib/server-db';
import pinataSDK from '@pinata/sdk';

const pinata = new pinataSDK(
  process.env.PINATA_API_KEY,
  process.env.PINATA_API_SECRET
);

// Helper function to convert gateway URL to IPFS URI
function convertToIPFSUri(url: string): string {
  if (url.startsWith('ipfs://')) return url;
  const ipfsGateways = [
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/'
  ];
  
  for (const gateway of ipfsGateways) {
    if (url.startsWith(gateway)) {
      return `ipfs://${url.replace(gateway, '')}`;
    }
  }
  return url;
}

export async function POST(request: Request) {
  try {
    const { metadata, walletPublicKey } = await request.json();
    
    console.log('Received metadata creation request:', {
      name: metadata.name,
      symbol: metadata.symbol,
      hasImage: !!metadata.image,
      walletPublicKey
    });

    if (!metadata.name || !metadata.symbol || !metadata.image) {
      return NextResponse.json(
        { error: 'Missing required metadata fields' },
        { status: 400 }
      );
    }

    if (!walletPublicKey) {
      return NextResponse.json(
        { error: 'Wallet public key is required' },
        { status: 404 }
      );
    }

    // Get wallet for payment
    const wallet = await getWallet(walletPublicKey);
    if (!wallet || !wallet.encryptedPrivateKey) {
      return NextResponse.json(
        { error: 'Wallet not found or no private key available' },
        { status: 404 }
      );
    }

    // Convert image URL to IPFS format
    const imageUri = convertToIPFSUri(metadata.image);
    console.log('Converted image URL to IPFS format:', imageUri);

    // Prepare metadata object
    const metadataObject = {
      name: metadata.name,
      symbol: metadata.symbol,
      description: metadata.description || '',
      image: imageUri,
      attributes: [],
      properties: {
        files: [{
          uri: imageUri,
          type: "image/png"
        }],
        category: "image"
      }
    };

    console.log('Uploading metadata to IPFS...', {
      name: metadata.name,
      symbol: metadata.symbol,
      imageUri
    });

    const startTime = Date.now();

    // Upload metadata to IPFS using Pinata
    const result = await pinata.pinJSONToIPFS(metadataObject, {
      pinataMetadata: {
        name: `${metadata.name}-metadata`,
      }
    });

    const uploadTime = Date.now() - startTime;

    // Create the final metadata URI
    const uri = `ipfs://${result.IpfsHash}`;

    console.log('Metadata upload successful:', {
      uri,
      uploadTime: `${uploadTime}ms`,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ uri });
  } catch (error) {
    console.error('Error creating metadata:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create metadata',
        details: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 