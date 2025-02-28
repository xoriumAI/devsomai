"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, Download, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { useToast } from "@/hooks/use-toast";
import { useWalletStore } from "@/store/wallet-store";

// Create connection with better timeout and commitment settings
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC_URL, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
});

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  maxRetries: 3,
  baseDelay: 3000,
  maxDelay: 10000,
  batchSize: 1,
  transactionsPerWallet: 5,
  delayBetweenRequests: 2000,
};

// Token bucket for rate limiting
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number;

  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async consume(tokens: number = 1): Promise<void> {
    this.refill();
    if (this.tokens < tokens) {
      const waitTime = ((tokens - this.tokens) / this.refillRate) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.refill();
    }
    this.tokens -= tokens;
  }

  private refill() {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + timePassed * this.refillRate);
    this.lastRefill = now;
  }
}

// Create token bucket for rate limiting (2 requests per second)
const rateLimiter = new TokenBucket(2, 0.5);

export function TransactionHistory() {
  const [transactions, setTransactions] = useState<ParsedTransactionWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { wallets } = useWalletStore();
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get only active wallets
  const activeWallets = wallets.filter(w => !w.archived);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchWalletTransactions = useCallback(async (publicKey: string, retryCount = 0): Promise<ParsedTransactionWithMeta[]> => {
    try {
      await rateLimiter.consume();
      const signatures = await connection.getSignaturesForAddress(
        new PublicKey(publicKey),
        { limit: RATE_LIMIT_CONFIG.transactionsPerWallet }
      );

      await sleep(RATE_LIMIT_CONFIG.delayBetweenRequests);

      const txs: ParsedTransactionWithMeta[] = [];
      for (const sig of signatures) {
        if (abortControllerRef.current?.signal.aborted) break;
        
        try {
          await rateLimiter.consume();
          const tx = await connection.getParsedTransaction(sig.signature);
          if (tx) txs.push(tx);
          await sleep(RATE_LIMIT_CONFIG.delayBetweenRequests);
        } catch (error) {
          console.warn(`Error fetching transaction ${sig.signature}:`, error);
          if (error instanceof Error && error.message.includes('429')) {
            await sleep(RATE_LIMIT_CONFIG.baseDelay);
          }
        }
      }

      return txs;
    } catch (error) {
      if (error instanceof Error && error.message.includes('429')) {
        if (retryCount >= RATE_LIMIT_CONFIG.maxRetries) {
          console.warn(`Rate limit exceeded for wallet ${publicKey}`);
          return [];
        }
        await sleep(RATE_LIMIT_CONFIG.baseDelay * Math.pow(2, retryCount));
        return fetchWalletTransactions(publicKey, retryCount + 1);
      }
      console.warn(`Error fetching transactions for wallet ${publicKey}:`, error);
      return [];
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    if (activeWallets.length === 0) return;

    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);
    setProgress({ current: 0, total: activeWallets.length });
    const allTransactions: ParsedTransactionWithMeta[] = [];

    try {
      for (let i = 0; i < activeWallets.length; i += RATE_LIMIT_CONFIG.batchSize) {
        if (abortControllerRef.current.signal.aborted) break;

        const batch = activeWallets.slice(i, i + RATE_LIMIT_CONFIG.batchSize);
        
        for (const wallet of batch) {
          if (abortControllerRef.current.signal.aborted) break;

          try {
            const walletTxs = await fetchWalletTransactions(wallet.publicKey);
            allTransactions.push(...walletTxs);
          } catch (error) {
            console.warn(`Error fetching transactions for wallet ${wallet.publicKey}:`, error);
          } finally {
            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
          }

          await sleep(RATE_LIMIT_CONFIG.delayBetweenRequests);
        }
      }

      if (!abortControllerRef.current.signal.aborted) {
        // Sort transactions by timestamp
        allTransactions.sort((a, b) => {
          const timeA = a.blockTime || 0;
          const timeB = b.blockTime || 0;
          return timeB - timeA;
        });

        setTransactions(allTransactions);

        if (allTransactions.length === 0) {
          setError('No transactions found for active wallets.');
        }
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError('Failed to fetch transactions. Please try again later.');
    } finally {
      if (!abortControllerRef.current.signal.aborted) {
        setIsLoading(false);
        setProgress({ current: 0, total: 0 });
      }
    }
  }, [activeWallets, fetchWalletTransactions]);

  useEffect(() => {
    if (activeWallets.length > 0) {
      fetchTransactions();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [activeWallets.length, fetchTransactions]);

  const formatAmount = (amount: number) => {
    return (amount / 1e9).toFixed(4);
  };

  const getTransactionType = (tx: ParsedTransactionWithMeta) => {
    const instructions = tx.transaction.message.instructions;
    if (instructions.length === 0) return "Unknown";
    
    const firstInstruction = instructions[0];
    if ('program' in firstInstruction) {
      return firstInstruction.program || "Unknown";
    }
    return "Unknown";
  };

  const getWalletName = (publicKey: string) => {
    const wallet = activeWallets.find(w => w.publicKey === publicKey);
    return wallet?.name || publicKey.slice(0, 8) + "...";
  };

  const filteredTransactions = transactions.filter(tx => {
    if (!tx) return false;
    const signature = tx.transaction.signatures[0];
    const searchLower = searchTerm.toLowerCase();
    return (
      signature.toLowerCase().includes(searchLower) ||
      getTransactionType(tx).toLowerCase().includes(searchLower) ||
      getWalletName(tx.transaction.message.accountKeys[0].toString()).toLowerCase().includes(searchLower)
    );
  });

  const exportTransactions = () => {
    const csv = [
      ['Signature', 'Type', 'Amount (SOL)', 'Wallet', 'Time', 'Status'].join(','),
      ...filteredTransactions.map(tx => [
        tx.transaction.signatures[0],
        getTransactionType(tx),
        formatAmount(tx.meta?.fee || 0),
        getWalletName(tx.transaction.message.accountKeys[0].toString()),
        new Date(tx.blockTime! * 1000).toLocaleString(),
        tx.meta?.err ? 'Failed' : 'Success'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transactions.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Transaction History</CardTitle>
          <Button variant="outline" onClick={exportTransactions} disabled={transactions.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by signature, type, or wallet..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button 
            variant="outline" 
            onClick={fetchTransactions} 
            disabled={isLoading || activeWallets.length === 0}
          >
            <Filter className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          {isLoading ? (
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Loading transactions... ({progress.current}/{progress.total} wallets)
                </p>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500"
                  style={{ 
                    width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` 
                  }}
                />
              </div>
            </div>
          ) : error ? (
            <div className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <p className="text-sm">{error}</p>
              </div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-4">
              <p className="text-sm text-muted-foreground">
                {activeWallets.length === 0 
                  ? "No active wallets found. Create a wallet to view transaction history."
                  : "No transactions found for active wallets."}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredTransactions.map((tx) => (
                <div key={tx.transaction.signatures[0]} className="p-4 hover:bg-muted/50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{getTransactionType(tx)}</h3>
                      <p className="text-sm font-mono text-muted-foreground">
                        {tx.transaction.signatures[0].slice(0, 16)}...
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Wallet: {getWalletName(tx.transaction.message.accountKeys[0].toString())}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(tx.blockTime! * 1000).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right space-y-2">
                      <p className={`font-medium ${tx.meta?.err ? 'text-destructive' : ''}`}>
                        {formatAmount(tx.meta?.fee || 0)} SOL
                      </p>
                      <p className={`text-sm ${tx.meta?.err ? 'text-destructive' : 'text-green-500'}`}>
                        {tx.meta?.err ? 'Failed' : 'Success'}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(
                          `https://explorer.solana.com/tx/${tx.transaction.signatures[0]}?cluster=devnet`,
                          '_blank'
                        )}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View on Explorer
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}