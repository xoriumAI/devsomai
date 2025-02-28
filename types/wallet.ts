export interface Wallet {
  publicKey: string;
  name?: string;
  balance: number;
  isArchived: boolean;
  createdAt: string;
  lastUpdated: string;
  group?: string;
} 