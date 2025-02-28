import { NextResponse } from 'next/server';
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import { 
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createMintToInstruction
} from "@solana/spl-token";
import {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
  DataV2
} from '@metaplex-foundation/mpl-token-metadata';
import bs58 from 'bs58';
import { decrypt } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';

// Helper function to convert IPFS URI to HTTP URL
function ipfsToHttp(uri: string): string {
  if (!uri.startsWith('ipfs://')) return uri;
  const hash = uri.replace('ipfs://', '');
  return `https://gateway.pinata.cloud/ipfs/${hash}`;
}

export async function POST(req: Request) {
  try {
    const { 
      name, 
      symbol, 
      description, 
      metadataUri: initialMetadataUri, 
      walletPublicKey, 
      sendingMode,
      vanityTokenMint,
      decimals = 9,
      supply = 1000000000
    } = await req.json();

    let metadataUri = initialMetadataUri;

    // Log initial metadata URI
    console.log('Initial metadata URI:', metadataUri);

    // Input validation
    if (!name || !symbol || !metadataUri || !walletPublicKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate metadata URI format
    if (!initialMetadataUri.startsWith('ipfs://')) {
      return NextResponse.json(
        { error: 'Invalid metadata URI format. Must start with ipfs://' },
        { status: 400 }
      );
    }

    // Get current network settings
    const settings = getSettings();
    const networkEndpoint = settings.rpc.http;
    const networkName = settings.network;

    // Convert IPFS URI to HTTP URL for verification
    const metadataUrl = ipfsToHttp(initialMetadataUri);
    console.log('Verifying metadata at:', metadataUrl);

    // Verify metadata is accessible
    try {
      const response = await fetch(metadataUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.statusText}`);
      }
      const metadata = await response.json();
      if (!metadata.name || !metadata.symbol || !metadata.image) {
        throw new Error('Invalid metadata format');
      }
    } catch (error) {
      console.error('Metadata verification failed:', error);
      return NextResponse.json(
        { error: 'Failed to verify metadata accessibility' },
        { status: 400 }
      );
    }

    // Get wallet from database
    const wallet = await prisma.wallet.findUnique({
      where: { publicKey: walletPublicKey },
    });

    if (!wallet || !wallet.encryptedPrivateKey) {
      return NextResponse.json(
        { error: "Wallet not found or no private key available" },
        { status: 404 }
      );
    }

    // Decrypt private key and create keypair
    const privateKey = decrypt(wallet.encryptedPrivateKey);
    const payer = Keypair.fromSecretKey(bs58.decode(privateKey));

    // Connect to Solana using the current network settings
    console.log(`Connecting to ${networkName} at ${networkEndpoint}`);
    const connection = new Connection(networkEndpoint, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60000
    });

    // Check wallet balance
    const balance = await connection.getBalance(payer.publicKey);
    const requiredBalance = LAMPORTS_PER_SOL * 0.02; // Lower required balance to 0.02 SOL
    if (balance < requiredBalance) {
      return NextResponse.json(
        { error: `Insufficient SOL balance. Please add at least ${requiredBalance / LAMPORTS_PER_SOL} SOL to your wallet.` },
        { status: 400 }
      );
    }

    console.log('Creating mint account...');
    // Create mint account
    const mintAccount = Keypair.generate();

    // Get rent exemption amount
    const rentExemptAmount = await getMinimumBalanceForRentExemptMint(connection);

    // Create transaction
    const transaction = new Transaction();

    // Add create account instruction
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mintAccount.publicKey,
        space: MINT_SIZE,
        lamports: rentExemptAmount,
        programId: TOKEN_PROGRAM_ID
      })
    );

    // Add initialize mint instruction
    transaction.add(
      createInitializeMintInstruction(
        mintAccount.publicKey,
        decimals,
        payer.publicKey,
        payer.publicKey
      )
    );

    // Get associated token account
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mintAccount.publicKey,
      payer.publicKey
    );

    // Add create associated token account instruction
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        associatedTokenAddress,
        payer.publicKey,
        mintAccount.publicKey
      )
    );

    // Calculate mint amount with decimals
    const mintAmount = BigInt(Math.floor(supply * Math.pow(10, decimals)));

    // Add mint to instruction
    transaction.add(
      createMintToInstruction(
        mintAccount.publicKey,
        associatedTokenAddress,
        payer.publicKey,
        mintAmount
      )
    );

    // Create metadata account
    console.log('Creating metadata account...');
    const [metadataAddress] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintAccount.publicKey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    console.log('Creating metadata instruction with URI:', metadataUri);

    // Create metadata
    const tokenMetadata: DataV2 = {
      name,
      symbol,
      uri: metadataUri,
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null
    };
    
    // Add create metadata account instruction
    const createMetadataInstruction = createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataAddress,
        mint: mintAccount.publicKey,
        mintAuthority: payer.publicKey,
        payer: payer.publicKey,
        updateAuthority: payer.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data: tokenMetadata,
          isMutable: true,
          collectionDetails: null,
        },
      }
    );

    transaction.add(createMetadataInstruction);

    console.log('Sending transaction...');
    // Send transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer, mintAccount],
      {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      }
    );

    console.log('Transaction successful:', {
      signature,
      mintAddress: mintAccount.publicKey.toBase58(),
      metadataAddress: metadataAddress.toBase58(),
      finalMetadataUri: metadataUri,
      httpUrl: ipfsToHttp(metadataUri)
    });

    return NextResponse.json({
      success: true,
      mintAddress: mintAccount.publicKey.toBase58(),
      metadataAddress: metadataAddress.toBase58(),
      signature,
      metadataUri,
      httpUrl: ipfsToHttp(metadataUri),
      network: networkName
    });

  } catch (error) {
    console.error('Error creating token:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create token',
        details: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 