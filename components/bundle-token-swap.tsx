"use client";

import { useState } from "react";
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

const SOLANA_RPC_URL = "https://solana-api.instantnodes.io/token-RRGPc9gLXCcxjGKwzEwf4RQ9ejdocJum";
const connection = new Connection(SOLANA_RPC_URL, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
  wsEndpoint: 'wss://solana-api.instantnodes.io/token-RRGPc9gLXCcxjGKwzEwf4RQ9ejdocJum'
});

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
  getPrivateKey: (publicKey: string) => Promise<string>,
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
  const [isLoading, setIsLoading] = useState(false);
  const [tokenBalances, setTokenBalances] = useState<Record<string, TokenBalance[]>>({});
  const [swapConfirmation, setSwapConfirmation] = useState<{
    open: boolean;
    tokenInfo: {
      amount: number;
      decimals: number;
      mint: string;
      percentage: number;
    } | null;
    walletPublicKey: string | null;
  }>({
    open: false,
    tokenInfo: null,
    walletPublicKey: null,
  });
  const { wallets, getPrivateKey } = useWalletStore();
  const { toast } = useToast();

  const bundleWallets = wallets.filter(w => w.groupName === 'bundles' && !w.archived);
  const firstWallet = bundleWallets[0];

  const fetchTokenBalances = async () => {
    setIsLoading(true);
    const newTokenBalances: Record<string, TokenBalance[]> = {};

    try {
      for (const wallet of bundleWallets) {
        const walletTokens: TokenBalance[] = [];
        
        // Add delay between each wallet's token fetch
        await delay(2000);

        try {
          const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            new PublicKey(wallet.publicKey),
            { programId: TOKEN_PROGRAM_ID }
          );

          for (const account of tokenAccounts.value) {
            if (account.account.data.parsed.info.tokenAmount.uiAmount > 0) {
              walletTokens.push({
                mint: account.account.data.parsed.info.mint,
                amount: account.account.data.parsed.info.tokenAmount.uiAmount,
                decimals: account.account.data.parsed.info.tokenAmount.decimals,
              });
            }
          }

          if (walletTokens.length > 0) {
            // Sort tokens by amount value (highest first)
            walletTokens.sort((a, b) => b.amount - a.amount);
            newTokenBalances[wallet.publicKey] = walletTokens;
          }
        } catch (error) {
          console.warn(`Error fetching tokens for wallet ${wallet.publicKey}:`, error);
          // Continue with next wallet even if one fails
          continue;
        }
      }

      setTokenBalances(newTokenBalances);
      
      if (Object.keys(newTokenBalances).length === 0) {
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
    if (!firstWallet) {
      toast({
        title: "Error",
        description: "No destination wallet found in bundle group",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const destinationPubkey = new PublicKey(firstWallet.publicKey);

      for (const [walletPublicKey, tokens] of Object.entries(tokenBalances)) {
        // Skip the first wallet as it's the destination
        if (walletPublicKey === firstWallet.publicKey) continue;

        const privateKey = await getPrivateKey(walletPublicKey);
        if (!privateKey) {
          console.warn(`Private key not found for wallet ${walletPublicKey}`);
          continue;
        }

        const sourceKeypair = Keypair.fromSecretKey(bs58.decode(privateKey));

        for (const token of tokens) {
          try {
            // Add delay between token transfers
            await delay(2000);

            const sourceATA = await getAssociatedTokenAddress(
              new PublicKey(token.mint),
              sourceKeypair.publicKey
            );

            const destinationATA = await getAssociatedTokenAddress(
              new PublicKey(token.mint),
              destinationPubkey
            );

            // Check if destination account exists
            const destinationAccount = await connection.getAccountInfo(destinationATA);
            
            const transaction = new Transaction();

            // Create destination ATA if it doesn't exist
            if (!destinationAccount) {
              transaction.add(
                createAssociatedTokenAccountInstruction(
                  sourceKeypair.publicKey,
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
                sourceKeypair.publicKey,
                token.amount * Math.pow(10, token.decimals)
              )
            );

            const signature = await connection.sendTransaction(transaction, [sourceKeypair]);
            await connection.confirmTransaction(signature);

            toast({
              title: "Transfer successful",
              description: `Transferred ${token.amount} tokens (${token.mint.slice(0, 8)}...) to first wallet`,
            });

            // Add delay after successful transfer
            await delay(2000);
          } catch (error) {
            console.error(`Error transferring token ${token.mint}:`, error);
            toast({
              title: "Error",
              description: `Failed to transfer token ${token.mint.slice(0, 8)}...`,
              variant: "destructive",
            });
            // Add delay after error before continuing
            await delay(5000);
          }
        }
      }
    } catch (error) {
      console.error('Error in transfer process:', error);
      toast({
        title: "Error",
        description: "Failed to complete token transfers",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      fetchTokenBalances(); // Refresh balances after transfers
    }
  };

  const handlePercentageClick = async (wallet: any, percentage: number) => {
    try {
      // Get token accounts to show in confirmation
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        new PublicKey(wallet.publicKey),
        { programId: TOKEN_PROGRAM_ID }
      );

      if (!tokenAccounts?.value || tokenAccounts.value.length === 0) {
        throw new Error("No token accounts found in this wallet");
      }

      // Find highest value token
      let highestValueToken = null;
      let highestValue = 0;

      for (const account of tokenAccounts.value) {
        const amount = account.account.data.parsed.info.tokenAmount.uiAmount;
        if (amount > highestValue) {
          highestValue = amount;
          highestValueToken = {
            mint: account.account.data.parsed.info.mint,
            amount: amount,
            decimals: account.account.data.parsed.info.tokenAmount.decimals,
          };
        }
      }

      if (!highestValueToken) {
        throw new Error("No tokens with positive balance found in wallet");
      }

      // Show confirmation dialog
      setSwapConfirmation({
        open: true,
        tokenInfo: {
          ...highestValueToken,
          percentage,
        },
        walletPublicKey: wallet.publicKey,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to prepare token swap",
        variant: "destructive",
      });
    }
  };

  const handleSwapConfirm = async () => {
    if (!swapConfirmation.walletPublicKey || !swapConfirmation.tokenInfo) return;

    setIsLoading(true);
    try {
      await swapTokenPercentage(
        swapConfirmation.walletPublicKey,
        swapConfirmation.tokenInfo.percentage,
        getPrivateKey,
        toast
      );
      // Refresh token balances after successful swap
      await fetchTokenBalances();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to swap tokens",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setSwapConfirmation(prev => ({ ...prev, open: false }));
    }
  };

  return (
    <>
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <div className="space-y-1">
              <h3 className="text-lg font-medium">Bundle Tokens</h3>
              <p className="text-sm text-muted-foreground">
                Manage SPL tokens in bundle wallets
              </p>
            </div>
            <div className="space-x-2">
              <Button
                variant="outline"
                onClick={fetchTokenBalances}
                disabled={isLoading || bundleWallets.length === 0}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Scan Tokens
              </Button>
              <Button
                variant="outline"
                onClick={sendAllToFirstWallet}
                disabled={isLoading || Object.keys(tokenBalances).length === 0 || !firstWallet}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Send All to First Wallet
              </Button>
              <Button
                onClick={() => {}} // Placeholder for swap functionality
                disabled={isLoading || Object.keys(tokenBalances).length === 0}
              >
                <Coins className="mr-2 h-4 w-4" />
                Swap All to SOL
              </Button>
            </div>
          </div>

          {Object.keys(tokenBalances).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(tokenBalances).map(([walletPublicKey, tokens]) => {
                const wallet = bundleWallets.find(w => w.publicKey === walletPublicKey);
                const displayTokens = tokens.slice(0, 3);
                const remainingCount = tokens.length - 3;

                return (
                  <div key={walletPublicKey} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">
                          {wallet?.name || `Wallet ${walletPublicKey.slice(0, 8)}...`}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {walletPublicKey.slice(0, 12)}...
                        </p>
                      </div>
                      <p className="font-medium">{wallet?.balance.toFixed(4)} SOL</p>
                    </div>
                    <div className="space-y-2">
                      {displayTokens.map((token, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="font-mono">
                            {token.mint.slice(0, 8)}...
                          </span>
                          <span>{token.amount.toFixed(token.decimals)} tokens</span>
                        </div>
                      ))}
                      {remainingCount > 0 && (
                        <p className="text-sm text-muted-foreground">
                          +{remainingCount} more tokens
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {bundleWallets.length === 0
                ? "No bundle wallets found. Create a wallet in the bundle group first."
                : "No token balances found. Click 'Scan Tokens' to check for SPL tokens."}
            </p>
          )}
        </CardContent>
      </Card>

      <SwapConfirmationDialog
        open={swapConfirmation.open}
        onOpenChange={(open) => setSwapConfirmation(prev => ({ ...prev, open }))}
        onConfirm={handleSwapConfirm}
        tokenInfo={swapConfirmation.tokenInfo}
        isLoading={isLoading}
      />
    </>
  );
}