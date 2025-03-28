import { generateKeyPair } from './crypto';
import { encrypt, decrypt } from './encryption';

// Types
export interface Wallet {
  id?: string;
  publicKey: string;
  encryptedPrivateKey?: string;
  name?: string;
  balance: number;
  sectionId?: string;
  userId?: string;
  archived: boolean;
  isCex?: boolean;
  network?: string;
  createdAt: Date | string;
  updatedAt?: Date | string;
  lastUpdated?: Date | string;
  groupName?: string;
  user_id?: string;
}

export interface WalletSection {
  id: string;
  name: string;
  userId?: string;
  orderIndex?: number;
  createdAt?: Date;
  updatedAt?: Date;
  user_id?: string;
}

export interface UserSubscription {
  id?: string;
  userId?: string;
  tierId?: string;
  status?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  tier?: SubscriptionTier;
}

export interface SubscriptionTier {
  id?: string;
  name: string;
  description?: string | null;
  priceMonthly?: number;
  priceYearly?: number;
  walletLimit: number;
  maxTransactionsPerDay?: number | null;
  features?: any;
  isActive?: boolean;
}

export interface Profile {
  id: string;
  username?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  subscriptionTier?: string;
  createdAt?: Date;
  updatedAt?: Date;
  userId?: string;
  subscription?: UserSubscription;
}

// Helper function to map database rows to interface types
function mapWallet(wallet: any): Wallet {
  return {
    id: wallet.id,
    publicKey: wallet.public_key || wallet.publicKey,
    encryptedPrivateKey: wallet.encrypted_private_key || wallet.encryptedPrivateKey,
    name: wallet.name,
    balance: Number(wallet.balance || 0),
    sectionId: wallet.section_id || wallet.sectionId,
    userId: wallet.user_id || wallet.userId,
    archived: !!wallet.archived,
    isCex: !!wallet.is_cex || !!wallet.isCex,
    network: wallet.network,
    createdAt: wallet.created_at ? new Date(wallet.created_at) : wallet.createdAt || new Date(),
    updatedAt: wallet.updated_at ? new Date(wallet.updated_at) : wallet.updatedAt,
    lastUpdated: wallet.last_updated ? new Date(wallet.last_updated) : wallet.lastUpdated || new Date(),
    groupName: wallet.group_name || wallet.groupName,
    user_id: wallet.user_id
  };
}

// Mock implementations that return hardcoded values
const mockDB = {
  wallets: [],
  sections: []
};

// Get user subscription with tier details
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  return {
    tier: {
      walletLimit: 100,
      name: 'Basic'
    }
  };
}

// Get all wallets for a user
export async function getWallets(userId: string): Promise<Wallet[]> {
  return [];
}

// Get a single wallet by its public key
export async function getWallet(publicKey: string, userId: string): Promise<Wallet | null> {
  return null;
}

// Create a new wallet
export async function createWallet(params: any): Promise<Wallet | null> {
  const wallet = {
    public_key: params.publicKey,
    encrypted_private_key: params.encryptedPrivateKey,
    name: params.name || null,
    section_id: params.sectionId || null,
    user_id: params.userId,
    is_cex: params.isCex || false,
    network: params.network || 'mainnet-beta',
    balance: 0,
    archived: false
  };
  
  return mapWallet(wallet);
}

// Generate a wallet with a random keypair
export async function generateWallet(params: any): Promise<Wallet> {
  const keyPair = await generateKeyPair();
  return {
    publicKey: keyPair.publicKey,
    balance: 0,
    archived: false,
    createdAt: new Date(),
    lastUpdated: new Date(),
    groupName: params.group || 'main',
    name: params.name
  };
}

// Update wallet balance
export async function updateWalletBalance(publicKey: string, balance: number, userId: string): Promise<Wallet | null> {
  return null;
}

// Toggle wallet archive status
export async function toggleWalletArchive(publicKey: string, userId: string): Promise<Wallet | null> {
  return null;
}

// Delete a wallet
export async function deleteWallet(publicKey: string, userId: string): Promise<void> {
  return;
}

// Get wallet sections for a user
export async function getWalletSections(userId: string): Promise<WalletSection[]> {
  return [];
}

// Create a wallet section
export async function createWalletSection(name: string, userId: string): Promise<WalletSection> {
  return {
    id: 'section-id',
    name,
    userId
  };
}

// Get user profile
export async function getUserProfile(userId: string): Promise<Profile | null> {
  return null;
}