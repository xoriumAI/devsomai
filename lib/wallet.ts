"use client";

import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram, Commitment } from '@solana/web3.js';
import { withDB } from './db';
import bs58 from 'bs58';
import { getSettings } from './settings';

// Enhanced token bucket with dynamic rate adjustment
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private capacity: number;
  private refillRate: number;
  private readonly minRefillRate: number = 0.1; // 1 request per 10 seconds minimum
  private readonly maxRefillRate: number = 2; // 2 requests per second maximum
  private consecutiveFailures: number = 0;

  constructor(initialCapacity: number = 2, initialRate: number = 0.5) {
    this.capacity = initialCapacity;
    this.refillRate = initialRate;
    this.tokens = initialCapacity;
    this.lastRefill = Date.now();
  }

  async consume(tokens: number = 1): Promise<void> {
    await this.refill();
    
    if (this.tokens < tokens) {
      const waitTime = ((tokens - this.tokens) / this.refillRate) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      await this.refill();
    }
    
    this.tokens -= tokens;
  }

  handleSuccess() {
    this.consecutiveFailures = 0;
    // Gradually increase rate if we're succeeding
    if (this.refillRate < this.maxRefillRate) {
      this.refillRate = Math.min(this.maxRefillRate, this.refillRate * 1.2);
    }
  }

  handleFailure() {
    this.consecutiveFailures++;
    // Exponentially decrease rate on failures
    this.refillRate = Math.max(
      this.minRefillRate,
      this.refillRate * Math.pow(0.5, this.consecutiveFailures)
    );
    // Clear tokens to force immediate backoff
    this.tokens = 0;
  }

  private async refill(): Promise<void> {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + timePassed * this.refillRate
    );
    this.lastRefill = now;
  }
}

class RateLimitedConnection {
  private connection: Connection;
  private tokenBucket: TokenBucket;
  private requestQueue: Array<{
    operation: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  private processingQueue: boolean = false;
  private readonly maxQueueSize = 50;
  private readonly maxRetries = 7;
  private readonly baseDelay = 1000;
  private readonly maxDelay = 32000;

  constructor(endpoint: string, config?: any) {
    this.connection = new Connection(endpoint, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
      wsEndpoint: endpoint.replace('https://', 'wss://'),
      ...config,
    });
    this.tokenBucket = new TokenBucket(2, 0.5);
  }

  private calculateBackoff(retryCount: number): number {
    // Exponential backoff with jitter
    const delay = Math.min(
      this.maxDelay,
      this.baseDelay * Math.pow(2, retryCount) * (0.5 + Math.random() * 0.5)
    );
    return delay;
  }

  private async processQueue() {
    if (this.processingQueue) return;
    this.processingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue[0];
      let retryCount = 0;
      let lastError: Error | null = null;

      while (retryCount <= this.maxRetries) {
        try {
          await this.tokenBucket.consume(1);
          const result = await request.operation();
          this.tokenBucket.handleSuccess();
          request.resolve(result);
          this.requestQueue.shift();
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          
          if (error instanceof Error && error.message.includes('429')) {
            this.tokenBucket.handleFailure();
            if (retryCount === this.maxRetries) {
              break;
            }
            
            const delay = this.calculateBackoff(retryCount);
            console.warn(`Server responded with 429. Retrying after ${delay}ms delay...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            retryCount++;
            continue;
          }
          
          // Non-429 error, reject immediately
          request.reject(error);
          this.requestQueue.shift();
          break;
        }
      }

      if (retryCount > this.maxRetries && lastError) {
        request.reject(new Error('Max retries exceeded. Please try again later.'));
        this.requestQueue.shift();
      }
    }

    this.processingQueue = false;
  }

  private enqueueRequest<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.requestQueue.length >= this.maxQueueSize) {
        reject(new Error('Request queue is full. Please try again later.'));
        return;
      }

      this.requestQueue.push({ operation, resolve, reject });
      this.processQueue();
    });
  }

  async getBalance(publicKey: PublicKey): Promise<number> {
    return this.enqueueRequest(() => this.connection.getBalance(publicKey));
  }

  async requestAirdrop(publicKey: PublicKey, lamports: number): Promise<string> {
    return this.enqueueRequest(() => this.connection.requestAirdrop(publicKey, lamports));
  }

  async confirmTransaction(signature: string, commitment?: Commitment): Promise<void> {
    const result = await this.enqueueRequest(() => 
      this.connection.confirmTransaction(signature, commitment)
    );
    if (result.value.err) {
      throw new Error(`Transaction failed: ${result.value.err}`);
    }
  }

  async sendTransaction(transaction: Transaction, signers: Keypair[]): Promise<string> {
    return this.enqueueRequest(() => this.connection.sendTransaction(transaction, signers));
  }

  async getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    return this.enqueueRequest(() => this.connection.getLatestBlockhash());
  }

  async getFeeForMessage(message: Transaction | Uint8Array, commitment?: Commitment): Promise<number> {
    try {
      const messageBytes = message instanceof Transaction 
        ? message.compileMessage().serialize()
        : message;
        
      const response = await this.enqueueRequest(() => 
        this.connection.getFeeForMessage(messageBytes as any, commitment)
      );
      return response?.value ?? 5000; // Default to 5000 lamports if fee cannot be estimated
    } catch (error) {
      console.error('Error getting fee for message:', error);
      return 5000; // Default to 5000 lamports if error occurs
    }
  }
}

// Initialize connection with current network settings
const settings = getSettings();
const SOLANA_RPC_URL = settings.rpc.http;
const connection = new RateLimitedConnection(SOLANA_RPC_URL);

export type WalletGroup = 'main' | 'bundles' | 'sniper' | 'dev' | 'cex';

export const WALLET_GROUPS = [
  { id: 'main', name: 'Main Wallets' },
  { id: 'bundles', name: 'Bundle Wallets' },
  { id: 'sniper', name: 'Sniper Farming' },
  { id: 'dev', name: 'Dev' },
  { id: 'cex', name: 'CEX Wallets' },
] as const;

export function validatePrivateKey(privateKey: string): boolean {
  try {
    const secretKey = bs58.decode(privateKey);
    if (secretKey.length !== 64) {
      return false;
    }
    // Try to create a keypair to validate the key format
    Keypair.fromSecretKey(secretKey);
    return true;
  } catch (error) {
    console.error('Error validating private key:', error);
    return false;
  }
}

export async function generateWallet(name: string = 'New Wallet', group: WalletGroup = 'main') {
  try {
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toString();
    const privateKeyBase58 = bs58.encode(keypair.secretKey);
    
    const wallet = {
      publicKey,
      encryptedPrivateKey: privateKeyBase58,
      name: name || 'New Wallet',
      balance: 0,
      createdAt: new Date(),
      lastUpdated: new Date(),
      archived: false,
      group,
    };

    // Save to IndexedDB
    await withDB(async (db) => {
      await db.put('wallets', wallet);
    });

    return wallet;
  } catch (error) {
    console.error('Error generating wallet:', error);
    throw new Error('Failed to generate wallet');
  }
}

export async function addCEXWallet(publicKey: string, name: string = 'CEX Wallet') {
  try {
    // Validate the public key
    new PublicKey(publicKey);

    // Check if wallet already exists
    const existingWallet = await withDB(async (db) => {
      return db.get('wallets', publicKey);
    });

    if (existingWallet) {
      throw new Error('Wallet already exists');
    }

    const wallet = {
      publicKey,
      encryptedPrivateKey: '', // No private key for CEX wallets
      name: name || 'CEX Wallet',
      balance: 0,
      createdAt: new Date(),
      lastUpdated: new Date(),
      archived: false,
      group: 'cex' as const,
    };

    await withDB(async (db) => {
      await db.put('wallets', wallet);
    });

    return wallet;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Invalid wallet address');
  }
}

export async function importWallet(privateKey: string, name: string = 'Imported Wallet', group: WalletGroup = 'main') {
  if (!validatePrivateKey(privateKey)) {
    throw new Error('Invalid private key format');
  }

  try {
    const privateKeyBytes = bs58.decode(privateKey);
    const keypair = Keypair.fromSecretKey(privateKeyBytes);
    const publicKey = keypair.publicKey.toString();

    // Check if wallet already exists
    const existingWallet = await withDB(async (db) => {
      return db.get('wallets', publicKey);
    });

    if (existingWallet) {
      throw new Error('Wallet already exists');
    }

    const wallet = {
      publicKey,
      encryptedPrivateKey: privateKey,
      name: name || 'Imported Wallet',
      balance: 0,
      createdAt: new Date(),
      lastUpdated: new Date(),
      archived: false,
      group,
    };

    await withDB(async (db) => {
      await db.put('wallets', wallet);
    });

    return wallet;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Invalid private key');
  }
}

export async function getWallets() {
  return withDB(async (db) => {
    return db.getAll('wallets');
  });
}

export async function getWalletBalance(publicKey: string): Promise<number> {
  try {
    const pubKey = new PublicKey(publicKey);
    const lamports = await connection.getBalance(pubKey);
    return lamports / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    throw error;
  }
}

export async function updateWalletBalances(publicKeys: string[]) {
  try {
    const wallets = await withDB(async (db) => {
      return await Promise.all(
        publicKeys.map(publicKey => db.get('wallets', publicKey))
      );
    });

    const validWallets = wallets.filter(wallet => wallet !== undefined);

    await Promise.all(
      validWallets.map(async wallet => {
        if (!wallet) return;
        
        const balance = await getWalletBalance(wallet.publicKey);
        const updatedWallet = {
          ...wallet,
          balance,
          lastUpdated: new Date(),
        };

        await withDB(async (db) => {
          await db.put('wallets', updatedWallet);
        });
      })
    );
  } catch (error) {
    console.error('Error updating wallet balances:', error);
    throw error;
  }
}

export async function toggleWalletArchive(publicKey: string) {
  await withDB(async (db) => {
    const wallet = await db.get('wallets', publicKey);
    if (wallet) {
      await db.put('wallets', {
        ...wallet,
        archived: !wallet.archived,
        lastUpdated: new Date(),
      });
    }
  });
}

export function getPublicKeyFromPrivateKey(privateKey: string): string {
  const privateKeyBytes = bs58.decode(privateKey);
  const keypair = Keypair.fromSecretKey(privateKeyBytes);
  return keypair.publicKey.toString();
}

export async function sendSOL(fromPublicKey: string, toPublicKey: string, amount: number) {
  try {
    // Get sender's private key
    const senderWallet = await withDB(async (db) => {
      return await db.get('wallets', fromPublicKey);
    });

    if (!senderWallet) {
      throw new Error('Sender wallet not found');
    }

    // Convert amount to lamports with precise calculation
    const lamports = Math.round(amount * LAMPORTS_PER_SOL);
    if (lamports <= 0) {
      throw new Error('Invalid amount');
    }

    // Get current network settings
    const settings = getSettings();
    const networkEndpoint = settings.rpc.http;
    const networkName = settings.network;
    
    console.log(`Using ${networkName} at ${networkEndpoint} for transaction`);
    
    // Create connection with current network settings
    const connection = new Connection(networkEndpoint, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60000
    });

    // Create transaction
    const fromKeypair = Keypair.fromSecretKey(bs58.decode(senderWallet.encryptedPrivateKey));
    const toAddress = new PublicKey(toPublicKey);

    // Get the latest blockhash for transaction
    const { blockhash } = await connection.getLatestBlockhash();

    // Fixed transaction fee (5000 lamports = 0.000005 SOL)
    const LAMPORTS_PER_SIGNATURE = 5000;

    // Check if sender has enough balance including fee
    const senderBalance = await connection.getBalance(fromKeypair.publicKey);
    const totalRequired = lamports + LAMPORTS_PER_SIGNATURE;

    if (senderBalance < totalRequired) {
      const totalRequiredSOL = totalRequired / LAMPORTS_PER_SOL;
      throw new Error(`Insufficient balance. Need ${totalRequiredSOL.toFixed(9)} SOL (including fee)`);
    }

    // Create and sign transaction
    const transaction = new Transaction({ 
      recentBlockhash: blockhash,
      feePayer: fromKeypair.publicKey 
    }).add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toAddress,
        lamports,
      })
    );

    // Send and confirm transaction
    const signature = await connection.sendTransaction(transaction, [fromKeypair]);
    await connection.confirmTransaction(signature);

    // Update balances
    await updateWalletBalances([fromPublicKey, toPublicKey]);

    return signature;
  } catch (error) {
    console.error('Error sending SOL:', error);
    throw error;
  }
}