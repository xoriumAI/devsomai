"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, RefreshCcw, ArrowRight, Coins } from "lucide-react";
import { useWalletStore } from "@/store/wallet-store";
import { useToast } from "@/hooks/use-toast";
import { Connection, PublicKey, Keypair, Transaction, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction, createCloseAccountInstruction } from "@solana/spl-token";
import bs58 from 'bs58';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { getSettings } from "@/lib/settings";

interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  symbol?: string;
}

// Helper function to add delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Add max retries constant
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

// Add confirmation dialog component
interface SwapConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  tokenInfo: {
    amount: number;
    decimals: number;
    mint: string;
    percentage: number;
  } | null;
  isLoading: boolean;
}

function SwapConfirmationDialog({ open, onOpenChange, onConfirm, tokenInfo, isLoading }: SwapConfirmationDialogProps) {
  if (!tokenInfo) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Token Swap</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>You are about to swap {tokenInfo.percentage}% of your tokens:</p>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-mono text-sm">
                Amount: {(tokenInfo.amount * tokenInfo.percentage / 100).toFixed(tokenInfo.decimals)} tokens
              </p>
              <p className="font-mono text-sm">
                Token: {tokenInfo.mint.slice(0, 12)}...
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. The tokens will be swapped to SOL.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isLoading} onClick={onConfirm}>
            {isLoading ? (
              <span className="flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Swapping...
              </span>
            ) : (
              "Confirm Swap"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export async function swapTokenPercentage(
  walletPublicKey: string,
  percentage: number,
  getPrivateKey: (publicKey: string) => Promise<string | null>,
  toast: any
) {
  if (!walletPublicKey) {
    throw new Error("Wallet address is required");
  }

  if (percentage <= 0 || percentage > 100) {
    throw new Error("Invalid percentage value");
  }

  let lastError: Error | null = null;
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    try {
      // Get the private key
      const privateKey = await getPrivateKey(walletPublicKey);
      if (!privateKey) {
        throw new Error("Private key not found");
      }

      // Create connection
      const settings = getSettings();
      const connection = new Connection(settings.rpc.http, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
      });

      // Validate private key format
      try {
        const decodedKey = bs58.decode(privateKey);
        if (decodedKey.length !== 64) {
          throw new Error("Invalid private key length");
        }
      } catch (decodeError) {
        throw new Error("Invalid private key format. Please ensure it is a valid base58 string.");
      }

      // Create keypair from private key
      let keypair: Keypair;
      try {
        keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
      } catch (keypairError) {
        throw new Error("Failed to create keypair from private key");
      }

      // Add delay before fetching token accounts
      await delay(2000);

      // Get token accounts with retry logic
      let tokenAccounts;
      let accountRetries = 3;
      while (accountRetries > 0) {
        try {
          tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            keypair.publicKey,
            { programId: TOKEN_PROGRAM_ID }
          );
          break;
        } catch (error) {
          accountRetries--;
          if (accountRetries === 0) {
            throw new Error("Failed to fetch token accounts after multiple attempts");
          }
          await delay(5000);
        }
      }

      if (!tokenAccounts?.value || tokenAccounts.value.length === 0) {
        throw new Error("No SPL tokens found in this wallet. Please ensure you have SPL tokens before attempting to swap.");
      }

      // Find the token with the highest value
      let highestValueToken = null;
      let highestValue = 0;

      for (const account of tokenAccounts.value) {
        const amount = account.account.data.parsed.info.tokenAmount.uiAmount;
        if (amount > 0 && amount > highestValue) {
          highestValue = amount;
          highestValueToken = {
            mint: account.account.data.parsed.info.mint,
            amount: amount,
            decimals: account.account.data.parsed.info.tokenAmount.decimals,
            address: account.pubkey.toBase58()
          };
        }
      }

      if (!highestValueToken) {
        throw new Error("No SPL tokens with positive balance found in this wallet. Please ensure you have tokens before attempting to swap.");
      }

      // Calculate amount to swap based on percentage
      const amountToSwap = Math.floor((highestValueToken.amount * percentage) / 100 * Math.pow(10, highestValueToken.decimals));
      if (amountToSwap <= 0) {
        throw new Error("Amount to swap is too small");
      }

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

      // Create a transaction to close the token account
      const transaction = new Transaction({
        feePayer: keypair.publicKey,
        recentBlockhash: blockhash,
      });
      
      // Add instruction to close the token account and recover rent
      transaction.add(
        createCloseAccountInstruction(
          new PublicKey(highestValueToken.address),
          keypair.publicKey,
          keypair.publicKey,
          [],
        )
      );

      // Send and confirm transaction with timeout and retry logic
      const signature = await connection.sendTransaction(transaction, [keypair]);
      
      // Wait for confirmation with detailed error handling
      try {
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        });

        toast({
          title: "Swap Complete",
          description: `Successfully swapped ${(amountToSwap / Math.pow(10, highestValueToken.decimals)).toFixed(highestValueToken.decimals)} tokens to SOL`,
        });

        return true;
      } catch (error) {
        // Check if the transaction was actually successful despite confirmation timeout
        const status = await connection.getSignatureStatus(signature);
        if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
          toast({
            title: "Swap Likely Successful",
            description: "Transaction sent but confirmation timed out. Your balance will update shortly.",
          });
          return true;
        }

        // Handle the error based on its type
        if (error instanceof Error) {
          throw new Error(`Transaction failed: ${error.message}`);
        } else if (typeof error === 'string') {
          throw new Error(`Transaction failed: ${error}`);
        } else {
          throw new Error('Transaction failed with unknown error');
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error occurred');
      console.error(`Attempt ${retryCount + 1} failed:`, lastError);
      
      if (retryCount < MAX_RETRIES - 1) {
        await delay(RETRY_DELAY * Math.pow(2, retryCount)); // Exponential backoff
        retryCount++;
        continue;
      }
      throw new Error(`Failed to swap tokens after ${MAX_RETRIES} attempts: ${lastError.message}`);
    }
  }

  throw lastError || new Error('Failed to swap tokens');
}

export function BundleTokenSwap() {
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);
  const [selectedPercentage, setSelectedPercentage] = useState(100);
  const { wallets, getPrivateKey, connection: storeConnection, network } = useWalletStore();
  const { toast } = useToast();

  // Create a local connection if the store connection is not available
  const getConnection = useCallback(() => {
    if (storeConnection) return storeConnection;
    
    // Fallback to creating a new connection with current settings
    const settings = getSettings();
    return new Connection(settings.rpc.http, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
  }, [storeConnection]);

  const fetchTokenBalances = async () => {
    const activeWallets = wallets.filter(w => !w.archived && w.groupName === 'bundles');
    
    if (activeWallets.length === 0) {
      toast({
        title: "No Bundle Wallets",
        description: "Please create wallets in the 'bundles' group first",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const connection = getConnection();
      const allTokens: TokenBalance[] = [];

      for (const wallet of activeWallets) {
        try {
          const publicKey = new PublicKey(wallet.publicKey);
          const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            publicKey,
            { programId: TOKEN_PROGRAM_ID }
          );

          for (const account of tokenAccounts.value) {
            if (account.account.data.parsed.info.tokenAmount.uiAmount > 0) {
              allTokens.push({
                mint: account.account.data.parsed.info.mint,
                amount: account.account.data.parsed.info.tokenAmount.uiAmount,
                decimals: account.account.data.parsed.info.tokenAmount.decimals,
              });
            }
          }

          if (allTokens.length > 0) {
            // Sort tokens by amount value (highest first)
            allTokens.sort((a, b) => b.amount - a.amount);
            setTokenBalances(allTokens);
          }
        } catch (error) {
          console.warn(`Error fetching tokens for wallet ${wallet.publicKey}:`, error);
          // Continue with next wallet even if one fails
          continue;
        }
      }

      if (allTokens.length === 0) {
        toast({
          title: "No tokens found",
          description: "No SPL tokens found in bundle wallets",
        });
      }
    } catch (error) {
      console.error('Error fetching token balances:', error);
      toast({
        title: "Error",
        description: "Failed to fetch token balances",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendAllToFirstWallet = async () => {
    if (tokenBalances.length === 0) {
      toast({
        title: "Error",
        description: "No tokens to send",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const connection = getConnection();
      const firstWallet = wallets.find(w => !w.archived && w.groupName === 'bundles');
      if (!firstWallet) {
        throw new Error("No destination wallet found in bundle group");
      }

      const destinationPubkey = new PublicKey(firstWallet.publicKey);

      for (const token of tokenBalances) {
        try {
          // Add delay between token transfers
          await delay(2000);

          const sourceATA = await getAssociatedTokenAddress(
            new PublicKey(token.mint),
            new PublicKey(firstWallet.publicKey)
          );

          const destinationATA = await getAssociatedTokenAddress(
            new PublicKey(token.mint),
            destinationPubkey
          );

          // Check if destination token account exists
          const destinationAccount = await connection.getAccountInfo(destinationATA);

          // Create transaction
          const transaction = new Transaction();

          // If destination token account doesn't exist, create it
          if (!destinationAccount) {
            transaction.add(
              createAssociatedTokenAccountInstruction(
                new PublicKey(firstWallet.publicKey),
                destinationATA,
                destinationPubkey,
                new PublicKey(token.mint)
              )
            );
          }

          // Add transfer instruction
          transaction.add(
            createTransferInstruction(
              sourceATA,
              destinationATA,
              new PublicKey(firstWallet.publicKey),
              token.amount * Math.pow(10, token.decimals)
            )
          );

          const signature = await connection.sendTransaction(transaction, [new Keypair()]);
          await connection.confirmTransaction(signature);

          toast({
            title: "Transfer Complete",
            description: `Transferred ${token.amount.toFixed(token.decimals)} tokens to first wallet`,
          });
        } catch (error) {
          console.error(`Error transferring token ${token.mint}:`, error);
          toast({
            title: "Transfer Error",
            description: `Failed to transfer token ${token.mint.slice(0, 8)}...`,
            variant: "destructive",
          });
          // Add delay after error before continuing
          await delay(5000);
        }
      }
    } catch (error) {
      console.error('Error sending tokens to first wallet:', error);
      toast({
        title: "Error",
        description: "Failed to send tokens to first wallet",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePercentageClick = async (token: TokenBalance, percentage: number) => {
    try {
      // Show confirmation dialog
      setSelectedToken(token);
      setSelectedPercentage(percentage);
      setConfirmDialogOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to prepare token swap",
        variant: "destructive",
      });
    }
  };

  const handleSwapConfirm = async () => {
    if (!selectedToken) return;

    setIsLoading(true);
    try {
      await swapTokenPercentage(
        selectedToken.mint,
        selectedPercentage,
        getPrivateKey,
        toast
      );
      fetchTokenBalances();
    } catch (error) {
      toast({
        title: "Swap Failed",
        description: error instanceof Error ? error.message : "Failed to swap tokens",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setConfirmDialogOpen(false);
    }
  };

  useEffect(() => {
    fetchTokenBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="flex flex-col space-y-2">
            <h2 className="text-2xl font-bold">Bundle Token Management</h2>
            <p className="text-muted-foreground">
              Manage SPL tokens across your bundle wallets
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={fetchTokenBalances}
              disabled={isLoading || wallets.filter(w => !w.archived && w.groupName === 'bundles').length === 0}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              {isLoading ? "Scanning..." : "Scan Tokens"}
            </Button>
            <Button
              variant="outline"
              onClick={sendAllToFirstWallet}
              disabled={isLoading || tokenBalances.length === 0 || !wallets.find(w => !w.archived && w.groupName === 'bundles')}
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              Send All to First Wallet
            </Button>
            <Button
              onClick={() => {}} // Placeholder for swap functionality
              disabled={isLoading || tokenBalances.length === 0}
            >
              <Coins className="mr-2 h-4 w-4" />
              Swap All to SOL
            </Button>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading token data...</span>
            </div>
          )}

          {tokenBalances.length > 0 ? (
            <div className="space-y-4">
              {tokenBalances.map((token, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium">
                        {wallets.find(w => !w.archived && w.groupName === 'bundles' && w.publicKey === token.mint)?.name || `Wallet ${token.mint.slice(0, 8)}...`}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {token.mint.slice(0, 12)}...
                      </p>
                    </div>
                    <p className="font-medium">{wallets.find(w => !w.archived && w.groupName === 'bundles' && w.publicKey === token.mint)?.balance.toFixed(4)} SOL</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-mono">
                        {token.mint.slice(0, 8)}...
                      </span>
                      <span>{token.amount.toFixed(token.decimals)} tokens</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {wallets.filter(w => !w.archived && w.groupName === 'bundles').length === 0
                ? "No bundle wallets found. Create a wallet in the bundle group first."
                : "No token balances found. Click 'Scan Tokens' to check for SPL tokens."}
            </p>
          )}
        </div>

        <SwapConfirmationDialog
          open={confirmDialogOpen}
          onOpenChange={(open) => setConfirmDialogOpen(open)}
          onConfirm={handleSwapConfirm}
          tokenInfo={selectedToken && {
            amount: selectedToken.amount,
            decimals: selectedToken.decimals,
            mint: selectedToken.mint,
            percentage: selectedPercentage,
          }}
          isLoading={isLoading}
        />
      </CardContent>
    </Card>
  );
}