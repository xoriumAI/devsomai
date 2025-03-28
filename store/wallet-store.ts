import { create } from 'zustand';
import { WalletGroup } from '@/lib/wallet';
import { Connection, PublicKey, Commitment } from '@solana/web3.js';
import { getSettings, loadSettings, getRateLimiter, switchNetwork as switchNetworkSetting } from '@/lib/settings';
import { Wallet, WalletSection, getUserSubscription } from '@/lib/supabase-db';
import { supabase } from '@/lib/supabase';

export interface WalletStore {
  wallets: Wallet[];
  sections: WalletSection[];
  isLoading: boolean;
  error: string | null;
  connection: Connection | null;
  isConnected: boolean;
  network: 'mainnet-beta' | 'devnet';
  userId: string | null;
  walletLimit: number | null;
  
  // Core functions
  setUserId: (userId: string | null) => void;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
  switchNetwork: (network: 'mainnet-beta' | 'devnet') => void;
  
  // Wallet operations
  createWallet: (name?: string, section?: string) => Promise<void>;
  importWallet: (privateKey: string, name?: string, section?: string) => Promise<void>;
  addCEXWallet: (publicKey: string, name?: string) => Promise<void>;
  loadWallets: () => Promise<void>;
  refreshBalances: () => Promise<void>;
  getPrivateKey: (publicKey: string) => Promise<string | null>;
  toggleArchive: (publicKey: string) => Promise<void>;
  deleteWallet: (publicKey: string) => Promise<void>;
  updateWalletBalance: (publicKey: string, balance: number) => void;
  
  // Section operations
  loadSections: () => Promise<void>;
  createSection: (name: string) => Promise<void>;
  
  // Utility functions
  getTotalBalance: (archived?: boolean) => number;
  sendSOL: (fromPublicKey: string, toPublicKey: string, amount: number) => Promise<void>;
  
  // Additional properties
  addWallet: (privateKey: string, publicKey: string, name?: string) => Promise<void>;
}

let autoRefreshInterval: NodeJS.Timeout | null = null;
let rpcConnection: Connection | null = null;
let wsSubscriptions: { [key: string]: number } = {};

export const useWalletStore = create<WalletStore>((set, get) => ({
  wallets: [],
  sections: [],
  isLoading: false,
  error: null,
  connection: null,
  isConnected: false,
  network: getSettings().network,
  userId: null,
  walletLimit: null,

  setUserId: (userId: string | null) => {
    set({ userId });
    if (userId) {
      get().loadWallets();
      get().loadSections();
      // Get subscription details to set wallet limit
      getUserSubscription(userId).then(subscription => {
        if (subscription?.tier?.walletLimit) {
          set({ walletLimit: subscription.tier.walletLimit });
        }
      }).catch(err => {
        console.error('Error loading subscription:', err);
      });
    } else {
      set({ wallets: [], sections: [] });
    }
  },

  updateWalletBalance: (publicKey: string, balance: number) => {
    const { wallets } = get();
    const updatedWallets = wallets.map(w => 
      w.publicKey === publicKey 
        ? { ...w, balance, updatedAt: new Date() }
        : w
    );
    set({ wallets: updatedWallets });
  },

  startAutoRefresh: () => {
    const settings = getSettings();
    
    // Clear any existing interval and subscriptions
    get().stopAutoRefresh();

    try {
      // Create RPC connection
      rpcConnection = new Connection(settings.rpc.http, {
        commitment: 'confirmed',
        wsEndpoint: settings.rpc.ws,
        confirmTransactionInitialTimeout: 60000,
      });

      set({ 
        connection: rpcConnection, 
        isConnected: true,
        network: settings.network
      });

      // Subscribe to account changes for all wallets
      const { wallets, updateWalletBalance } = get();
      
      wallets.forEach(wallet => {
        try {
          const pubkey = new PublicKey(wallet.publicKey);
          const subscriptionId = rpcConnection!.onAccountChange(
            pubkey,
            (account) => {
              const balance = account.lamports / 1e9; // Convert from lamports to SOL
              updateWalletBalance(wallet.publicKey, balance);
            },
            'confirmed'
          );
          wsSubscriptions[wallet.publicKey] = subscriptionId;
        } catch (error) {
          console.error(`Error subscribing to ${wallet.publicKey}:`, error);
        }
      });

      // Still do periodic refresh as a backup
      autoRefreshInterval = setInterval(() => {
        get().refreshBalances();
      }, settings.refreshInterval);

    } catch (error) {
      console.error("Error setting up auto-refresh:", error);
      set({ error: 'Failed to connect to Solana network' });
    }
  },

  stopAutoRefresh: () => {
    // Clear interval
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }

    // Remove all subscriptions
    const connection = rpcConnection;
    if (connection) {
      Object.values(wsSubscriptions).forEach(subscriptionId => {
        try {
          connection.removeAccountChangeListener(subscriptionId);
        } catch (error) {
          console.error('Error removing account listener:', error);
        }
      });
    }

    // Clear subscriptions and connection
    wsSubscriptions = {};
    rpcConnection = null;
    set({ connection: null, isConnected: false });
  },

  createWallet: async (name?: string, section?: string) => {
    const { userId } = get();
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    try {
      set({ isLoading: true, error: null });
      
      const response = await fetch('/api/wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          section,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create wallet');
      }

      await get().loadWallets();
    } catch (error) {
      console.error('Failed to create wallet:', error);
      set({ error: 'Failed to create wallet' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  importWallet: async (privateKey: string, name?: string, section?: string) => {
    const { userId } = get();
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    set({ isLoading: true });
    try {
      const response = await fetch('/api/wallet/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ privateKey, name, section }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to import wallet');
      }

      await get().loadWallets();
    } catch (error) {
      console.error('Error importing wallet:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  addCEXWallet: async (publicKey: string, name?: string) => {
    const { userId } = get();
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    try {
      set({ isLoading: true, error: null });
      
      const response = await fetch('/api/wallet/cex', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          publicKey,
          name,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add CEX wallet');
      }

      await get().loadWallets();
    } catch (error) {
      console.error('Failed to add CEX wallet:', error);
      set({ error: 'Failed to add CEX wallet' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  loadWallets: async () => {
    const { userId } = get();
    if (!userId) {
      return; // Not authenticated, don't attempt to load
    }
    
    try {
      set({ isLoading: true, error: null });
      console.log(`Fetching wallets for user ${userId}...`);
      
      const response = await fetch('/api/wallet');
      if (!response.ok) {
        throw new Error(`Failed to load wallets: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`Retrieved ${data.length} wallets from API`);
      
      // Log wallet groups to help with debugging
      const groups = data.reduce((acc: Record<string, number>, wallet: any) => {
        const group = wallet.groupName || 'unknown';
        acc[group] = (acc[group] || 0) + 1;
        return acc;
      }, {});
      
      console.log('Wallet groups:', groups);
      
      set({ wallets: data });

      // Start auto-refresh after loading wallets
      get().startAutoRefresh();
    } catch (error) {
      console.error('Error loading wallets:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to load wallets' });
    } finally {
      set({ isLoading: false });
    }
  },

  refreshBalances: async () => {
    const { userId } = get();
    if (!userId || !get().isConnected) {
      return;
    }
    
    try {
      console.log(`Refreshing wallet balances for user ${userId}...`);
      
      const response = await fetch('/api/wallet/refresh', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to refresh balances: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`Retrieved ${data.wallets?.length || 0} updated wallets`);
      
      set({ wallets: data.wallets });
    } catch (error) {
      console.error('Error refreshing balances:', error);
    }
  },

  getPrivateKey: async (publicKey: string) => {
    const { userId } = get();
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    try {
      const response = await fetch(`/api/wallet/${publicKey}/private-key`);
      
      if (!response.ok) {
        throw new Error('Failed to get private key');
      }

      const data = await response.json();
      return data.privateKey || '';
    } catch (error) {
      console.error('Failed to get private key:', error);
      return '';
    }
  },

  toggleArchive: async (publicKey: string) => {
    const { userId } = get();
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    try {
      set({ isLoading: true, error: null });
      const response = await fetch(`/api/wallet/${publicKey}/archive`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to toggle archive: ${response.statusText}`);
      }
      
      await get().loadWallets();
    } catch (error) {
      console.error('Error toggling archive:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to toggle archive' });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteWallet: async (publicKey: string) => {
    const { userId } = get();
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    try {
      set({ isLoading: true, error: null });
      const response = await fetch(`/api/wallet/${publicKey}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete wallet: ${response.statusText}`);
      }
      
      await get().loadWallets();
    } catch (error) {
      console.error('Error deleting wallet:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to delete wallet' });
    } finally {
      set({ isLoading: false });
    }
  },

  loadSections: async () => {
    const { userId } = get();
    if (!userId) {
      return;
    }
    
    try {
      set({ isLoading: true, error: null });
      const response = await fetch('/api/sections');
      if (!response.ok) {
        throw new Error(`Failed to load sections: ${response.statusText}`);
      }
      const data = await response.json();
      set({ sections: data });
    } catch (error) {
      console.error('Error loading sections:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to load sections' });
    } finally {
      set({ isLoading: false });
    }
  },

  createSection: async (name: string) => {
    const { userId } = get();
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    try {
      set({ isLoading: true, error: null });
      const response = await fetch('/api/sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create section: ${response.statusText}`);
      }
      
      await get().loadSections();
    } catch (error) {
      console.error('Error creating section:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to create section' });
    } finally {
      set({ isLoading: false });
    }
  },

  getTotalBalance: (archived?: boolean) => {
    const wallets = get().wallets;
    return wallets
      .filter(w => archived === undefined || w.archived === archived)
      .reduce((sum, wallet) => sum + wallet.balance, 0);
  },

  sendSOL: async (fromPublicKey: string, toPublicKey: string, amount: number) => {
    const { userId } = get();
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    try {
      set({ isLoading: true, error: null });
      const response = await fetch('/api/wallet/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromPublicKey,
          toPublicKey,
          amount,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send SOL');
      }

      // Reload wallets to get updated balances
      await get().loadWallets();
    } catch (error) {
      console.error('Failed to send SOL:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  switchNetwork: (network) => {
    switchNetworkSetting(network);
    set({ network });
    get().stopAutoRefresh(); // Stop refreshing on the current network
    get().loadWallets();     // Reload wallets for the new network
  },

  addWallet: async (privateKey: string, publicKey: string, name?: string) => {
    const { userId } = get();
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    try {
      set({ isLoading: true, error: null });
      const response = await fetch('/api/wallet/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          privateKey,
          publicKey,
          name,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add wallet');
      }

      await get().loadWallets();
    } catch (error) {
      console.error('Failed to add wallet:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to add wallet' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  }
}));