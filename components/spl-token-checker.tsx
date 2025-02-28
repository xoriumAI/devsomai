"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWalletStore } from "@/store/wallet-store";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Coins, Copy, Check, ExternalLink } from "lucide-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

// Import Metaplex for metadata
import { Metadata } from '@metaplex-foundation/mpl-token-metadata';

interface SplTokenCheckerProps {
  publicKey: string;
  walletName?: string;
}

interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  symbol?: string;
  name?: string;
}

export function SplTokenChecker({ publicKey, walletName }: SplTokenCheckerProps) {
  const { network } = useWalletStore();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchTokenBalances = async () => {
    try {
      setIsLoading(true);
      setTokenBalances([]);

      // Create connection based on current network
      const endpoint = network === 'devnet' 
        ? "https://api.devnet.solana.com" 
        : "https://api.mainnet-beta.solana.com";
      
      const connection = new Connection(endpoint, "confirmed");
      
      // Get token accounts
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        new PublicKey(publicKey),
        { programId: TOKEN_PROGRAM_ID }
      );

      // Filter and map token accounts
      const tokens: TokenBalance[] = [];
      
      for (const account of tokenAccounts.value) {
        const parsedInfo = account.account.data.parsed.info;
        const amount = parsedInfo.tokenAmount.uiAmount;
        
        // Only include tokens with non-zero balance
        if (amount > 0) {
          const tokenInfo: TokenBalance = {
            mint: parsedInfo.mint,
            amount: amount,
            decimals: parsedInfo.tokenAmount.decimals,
          };
          
          // Try to fetch metadata for this token
          try {
            // Get the metadata PDA for this mint
            const [metadataPDA] = PublicKey.findProgramAddressSync(
              [
                Buffer.from("metadata"),
                new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
                new PublicKey(parsedInfo.mint).toBuffer(),
              ],
              new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
            );
            
            // Fetch the account info
            const metadataAccount = await connection.getAccountInfo(metadataPDA);
            
            if (metadataAccount) {
              // Deserialize the metadata
              const metadata = Metadata.deserialize(metadataAccount.data);
              
              // Add metadata to token info
              if (metadata[0].data) {
                tokenInfo.name = metadata[0].data.name.replace(/\0/g, '');
                tokenInfo.symbol = metadata[0].data.symbol.replace(/\0/g, '');
              }
            }
          } catch (err) {
            console.log(`No metadata found for token ${parsedInfo.mint}`);
          }
          
          tokens.push(tokenInfo);
        }
      }

      // Sort tokens by amount (highest first)
      tokens.sort((a, b) => b.amount - a.amount);
      
      setTokenBalances(tokens);
      
      if (tokens.length === 0) {
        toast({
          title: "No SPL tokens found",
          description: "This wallet doesn't have any SPL tokens with non-zero balance",
        });
      }
    } catch (error) {
      console.error("Error fetching token balances:", error);
      toast({
        title: "Error",
        description: "Failed to fetch SPL token balances",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
      toast({
        title: "Copied!",
        description: "Address copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const openExplorer = (mintAddress: string) => {
    const baseUrl = network === 'devnet'
      ? 'https://explorer.solana.com/address/'
      : 'https://explorer.solana.com/address/';
    
    const url = `${baseUrl}${mintAddress}?cluster=${network}`;
    window.open(url, '_blank');
  };

  const handleOpenDialog = () => {
    setIsOpen(true);
    fetchTokenBalances();
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenDialog}
      >
        <Coins className="h-4 w-4 mr-2" />
        SPL Tokens
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>SPL Token Balances</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-sm">
                {walletName || publicKey.slice(0, 8) + '...'}
              </Label>
              <Button 
                variant="outline" 
                size="sm"
                onClick={fetchTokenBalances}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Coins className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : tokenBalances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No SPL tokens found in this wallet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {tokenBalances.map((token, index) => (
                  <Card key={index} className="overflow-hidden">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">
                              {token.name || token.symbol || "Unknown Token"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {token.amount.toFixed(token.decimals > 4 ? 4 : token.decimals)}
                              {token.symbol && ` ${token.symbol}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <p className="text-xs font-mono text-muted-foreground">
                              {token.mint.slice(0, 12)}...
                            </p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => copyToClipboard(token.mint, token.mint)}
                            >
                              {copied === token.mint ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => openExplorer(token.mint)}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 