"use client";

import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface WalletDB extends DBSchema {
  wallets: {
    key: string;
    value: {
      publicKey: string;
      encryptedPrivateKey: string;
      name: string;
      balance: number;
      createdAt: Date;
      lastUpdated: Date;
      archived: boolean;
      group: string;
    };
    indexes: { 
      'by-name': string;
    };
  };
}

let db: IDBPDatabase<WalletDB> | null = null;
let dbInitPromise: Promise<IDBPDatabase<WalletDB>> | null = null;

export async function initDB() {
  if (typeof window === 'undefined') return null;
  if (db) return db;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = openDB<WalletDB>('solana-wallet-manager', 7, {
    upgrade(database, oldVersion, newVersion) {
      // If old version exists, delete it and recreate
      if (database.objectStoreNames.contains('wallets')) {
        database.deleteObjectStore('wallets');
      }

      // Create wallets store
      const walletStore = database.createObjectStore('wallets', { keyPath: 'publicKey' });
      walletStore.createIndex('by-name', 'name');
    },
    blocked() {
      console.warn('Database upgrade blocked. Please close other tabs using this application.');
    },
    blocking() {
      if (db) db.close();
      db = null;
      dbInitPromise = null;
    },
    terminated() {
      db = null;
      dbInitPromise = null;
    },
  });

  try {
    db = await dbInitPromise;
    return db;
  } catch (error) {
    db = null;
    dbInitPromise = null;
    throw error;
  }
}

export async function getDB() {
  if (typeof window === 'undefined') return null;
  if (!db) {
    db = await initDB();
  }
  return db;
}

export async function withDB<T>(
  operation: (db: IDBPDatabase<WalletDB>) => Promise<T>,
  retries = 3
): Promise<T> {
  if (typeof window === 'undefined') throw new Error('Cannot use IndexedDB on the server');
  
  try {
    const database = await getDB();
    if (!database) throw new Error('Failed to initialize database');
    return await operation(database);
  } catch (error) {
    if (retries > 0 && error instanceof Error && 
       (error.name === 'InvalidStateError' || error.name === 'TransactionInactiveError')) {
      db = null;
      dbInitPromise = null;
      return withDB(operation, retries - 1);
    }
    throw error;
  }
}

export async function getWallets() {
  return withDB(async (db) => {
    return db.getAll('wallets');
  });
}