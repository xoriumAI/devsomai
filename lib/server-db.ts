import Database from 'better-sqlite3';
import path from 'path';

interface Wallet {
  publicKey: string;
  encryptedPrivateKey: string;
  name: string;
  balance: number;
  createdAt: Date;
  lastUpdated: Date;
  archived: boolean;
  groupName: string;
}

interface WalletRow {
  publicKey: string;
  encryptedPrivateKey: string;
  name: string;
  balance: number;
  createdAt: string;
  lastUpdated: string;
  archived: number;
  groupName: string;
}

const dbPath = path.join(process.cwd(), 'wallets.db');
console.log('Opening database at:', dbPath);
const db = new Database(dbPath);

// Initialize database
console.log('Initializing database schema...');
db.exec(`
  CREATE TABLE IF NOT EXISTS wallets (
    publicKey TEXT PRIMARY KEY,
    encryptedPrivateKey TEXT,
    name TEXT,
    balance REAL DEFAULT 0,
    createdAt TEXT,
    lastUpdated TEXT,
    archived INTEGER DEFAULT 0,
    groupName TEXT DEFAULT 'main'
  )
`);
console.log('Database schema initialized');

export async function getWallets(): Promise<Wallet[]> {
  console.log('Getting all wallets...');
  const stmt = db.prepare('SELECT * FROM wallets');
  const wallets = stmt.all().map((wallet: unknown) => {
    const row = wallet as WalletRow;
    return {
      ...row,
      archived: Boolean(row.archived),
      createdAt: new Date(row.createdAt),
      lastUpdated: new Date(row.lastUpdated),
    };
  });
  console.log('Retrieved wallets:', wallets);
  return wallets;
}

export async function getWallet(publicKey: string): Promise<Wallet | null> {
  console.log('Getting wallet with public key:', publicKey);
  const stmt = db.prepare('SELECT * FROM wallets WHERE publicKey = ?');
  const wallet = stmt.get(publicKey) as WalletRow | undefined;
  if (wallet) {
    const result = {
      ...wallet,
      archived: Boolean(wallet.archived),
      createdAt: new Date(wallet.createdAt),
      lastUpdated: new Date(wallet.lastUpdated),
    };
    console.log('Found wallet:', result);
    return result;
  }
  console.log('Wallet not found');
  return null;
}

export async function createWallet(wallet: {
  publicKey: string;
  encryptedPrivateKey: string;
  name: string;
  group?: string;
}): Promise<Wallet | null> {
  console.log('Creating wallet:', wallet);
  const stmt = db.prepare(`
    INSERT INTO wallets (publicKey, encryptedPrivateKey, name, createdAt, lastUpdated, groupName)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const now = new Date().toISOString();
  const params = [
    wallet.publicKey,
    wallet.encryptedPrivateKey,
    wallet.name,
    now,
    now,
    wallet.group || 'main'
  ];
  console.log('Executing insert with params:', params);
  
  try {
    stmt.run(...params);
    console.log('Insert successful');
    return getWallet(wallet.publicKey);
  } catch (error) {
    console.error('Error creating wallet:', error);
    throw error;
  }
}

export async function updateWalletBalance(publicKey: string, balance: number): Promise<Wallet | null> {
  console.log('Updating balance for wallet:', publicKey, 'to:', balance);
  const stmt = db.prepare(`
    UPDATE wallets 
    SET balance = ?, lastUpdated = ?
    WHERE publicKey = ?
  `);
  
  const now = new Date().toISOString();
  stmt.run(balance, now, publicKey);
  console.log('Balance update successful');
  return getWallet(publicKey);
}

export async function toggleWalletArchive(publicKey: string): Promise<Wallet | null> {
  console.log('Toggling archive status for wallet:', publicKey);
  const stmt = db.prepare(`
    UPDATE wallets 
    SET archived = NOT archived, lastUpdated = ?
    WHERE publicKey = ?
  `);
  
  const now = new Date().toISOString();
  stmt.run(now, publicKey);
  console.log('Archive toggle successful');
  return getWallet(publicKey);
}

export async function deleteWallet(publicKey: string): Promise<void> {
  console.log('Deleting wallet:', publicKey);
  const stmt = db.prepare('DELETE FROM wallets WHERE publicKey = ?');
  stmt.run(publicKey);
  console.log('Wallet deleted successfully');
} 