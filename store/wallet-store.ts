import { create } from 'zustand';
import { WalletGroup } from '@/lib/wallet';
import { Connection, PublicKey, Commitment } from '@solana/web3.js';
import { getSettings, loadSettings, getRateLimiter, switchNetwork as switchNetworkSetting } from '@/lib/settings';

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

interface WalletStore {
  wallets: Wallet[];
  isLoading: boolean;
  error: string | null;
  connection: Connection | null;
  isConnected: boolean;
  network: 'mainnet-beta' | 'devnet';
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
  createWallet: (name?: string, group?: WalletGroup) => Promise<void>;
  importWallet: (privateKey: string, name?: string, group?: WalletGroup) => Promise<void>;
  addCEXWallet: (publicKey: string, name?: string) => Promise<void>;
  loadWallets: () => Promise<void>;
  refreshBalances: () => Promise<void>;
  getPrivateKey: (publicKey: string) => Promise<string | null>;
  toggleArchive: (publicKey: string) => Promise<void>;
  getTotalBalance: (archived?: boolean) => number;
  sendSOL: (fromPublicKey: string, toPublicKey: string, amount: number) => Promise<void>;
  updateWalletBalance: (publicKey: string, balance: number) => void;
  addWallet: (wallet: { publicKey: string; privateKey: string; name: string; groupName: string; }) => Promise<void>;
  switchNetwork: (network: 'mainnet-beta' | 'devnet') => void;
}

let autoRefreshInterval: NodeJS.Timeout | null = null;
let rpcConnection: Connection | null = null;
let wsSubscriptions: { [key: string]: number } = {};

export const useWalletStore = create<WalletStore>((set, get) => ({
  wallets: [],
  isLoading: false,
  error: null,
  connection: null,
  isConnected: false,
  network: getSettings().network,

  updateWalletBalance: (publicKey: string, balance: number) => {
    const { wallets } = get();
    const updatedWallets = wallets.map(w => 
      w.publicKey === publicKey 
        ? { ...w, balance, lastUpdated: new Date() }
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
          if (!rpcConnection) return;
          
          // Skip WebSocket subscription for CEX wallets
          if (wallet.groupName === 'cex') return;
          
          // Only create subscription if it doesn't exist
          if (!wsSubscriptions[wallet.publicKey]) {
            try {
              const pubkey = new PublicKey(wallet.publicKey);
              const subscriptionId = rpcConnection.onAccountChange(
                pubkey,
                (accountInfo) => {
                  const balanceInSOL = accountInfo.lamports / 1e9;
                  console.log(`Balance update received for ${wallet.publicKey}: ${balanceInSOL} SOL`);
                  updateWalletBalance(wallet.publicKey, balanceInSOL);
                },
                'confirmed'
              );
              
              wsSubscriptions[wallet.publicKey] = subscriptionId;
              console.log(`Subscribed to updates for ${wallet.publicKey}`);
            } catch (error) {
              console.error('Invalid Solana address for WebSocket subscription:', wallet.publicKey);
            }
          }
        } catch (error) {
          console.error('Error subscribing to wallet:', wallet.publicKey, error);
        }
      });

      // Initial balance fetch
      get().refreshBalances();
    } catch (error) {
      console.error('Error setting up connections:', error);
      set({ isConnected: false });
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

  createWallet: async (name?: string, group: WalletGroup = 'main') => {
    try {
      set({ isLoading: true, error: null });
      
      const response = await fetch('/api/wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          group,
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

  importWallet: async (privateKey: string, name?: string, group: WalletGroup = 'main') => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/wallet/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ privateKey, name, group }),
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
    try {
      set({ isLoading: true, error: null });
      const response = await fetch('/api/wallet');
      if (!response.ok) {
        throw new Error(`Failed to load wallets: ${response.statusText}`);
      }
      const data = await response.json();
      // Convert date strings to Date objects
      const wallets = data.map((wallet: any) => ({
        ...wallet,
        createdAt: new Date(wallet.createdAt),
        lastUpdated: new Date(wallet.lastUpdated),
      }));
      set({ wallets });

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
    try {
      set({ isLoading: true, error: null });
      const { wallets, updateWalletBalance } = get();
      if (!wallets.length) return;

      // Get rate limiter
      const limiter = getRateLimiter();
      
      // Process wallets in smaller batches
      const BATCH_SIZE = 3;
      for (let i = 0; i < wallets.length; i += BATCH_SIZE) {
        const batch = wallets.slice(i, i + BATCH_SIZE);
        
        // Process each batch in parallel, but with rate limiting
        await Promise.all(
          batch.map(async (wallet) => {
            // Skip balance check for CEX wallets as they need manual updates
            if (wallet.groupName === 'cex') return;

            while (!(await limiter.acquirePermit())) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            try {
              if (!rpcConnection) throw new Error('No RPC connection available');
              try {
                const pubkey = new PublicKey(wallet.publicKey);
                const balance = await rpcConnection.getBalance(pubkey);
                updateWalletBalance(wallet.publicKey, balance / 1e9);
              } catch (error) {
                console.error(`Invalid Solana address for balance check: ${wallet.publicKey}`);
              }
            } catch (error) {
              console.error(`Error fetching balance for ${wallet.publicKey}:`, error);
            } finally {
              limiter.releasePermit();
            }
          })
        );
        
        // Add a small delay between batches
        if (i + BATCH_SIZE < wallets.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error('Error in auto-refresh:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to refresh balances' });
    } finally {
      set({ isLoading: false });
    }
  },

  getPrivateKey: async (publicKey: string) => {
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

  getTotalBalance: (archived?: boolean) => {
    const wallets = get().wallets;
    return wallets
      .filter(w => archived === undefined || w.archived === archived)
      .reduce((sum, wallet) => sum + wallet.balance, 0);
  },

  sendSOL: async (fromPublicKey: string, toPublicKey: string, amount: number) => {
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

  addWallet: async (wallet: { publicKey: string; privateKey: string; name: string; groupName: string; }) => {
    try {
      set({ isLoading: true, error: null });
      
      const response = await fetch('/api/wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wallet),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add wallet');
      }

      await get().loadWallets();
    } catch (error) {
      console.error('Failed to add wallet:', error);
      set({ error: 'Failed to add wallet' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  switchNetwork: (network: 'mainnet-beta' | 'devnet') => {
    // Stop auto-refresh to disconnect current connections
    get().stopAutoRefresh();
    
    // Check if this is a user preference
    const isUserPreference = typeof window !== 'undefined' && 
      localStorage.getItem('user-network-preference') === network;
    
    // Make a server-side API call to switch network
    fetch('/api/settings/network', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ network, isUserPreference }),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to switch network on server');
      }
      return response.json();
    })
    .then(() => {
      console.log(`Network switched to ${network} on server (User preference: ${isUserPreference})`);
    })
    .catch(error => {
      console.error('Error switching network on server:', error);
    });
    
    // Update store state
    set({ network });
    
    // Restart auto-refresh with new network settings
    get().startAutoRefresh();
    
    // Refresh balances with new network
    get().refreshBalances();
  },
}));