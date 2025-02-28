"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Filter, RefreshCw, Eye, EyeOff, Copy, Check, Archive, ArchiveRestore, Plus, Wallet, Send } from "lucide-react";
import { useWalletStore } from "@/store/wallet-store";
import { validatePrivateKey, WALLET_GROUPS, WalletGroup } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { CreateWalletDialog } from "./create-wallet-dialog";
import { BundleTokenSwap } from "./bundle-token-swap";
import { CEXWalletDialog } from "./cex-wallet-dialog";
import { SendToCEXDialog } from "./send-to-cex-dialog";
import { SendSolDialog } from "./send-sol-dialog";
import { swapTokenPercentage } from "./bundle-token-swap";

export function WalletList() {
  const { wallets, isLoading, refreshBalances, getPrivateKey, toggleArchive, loadWallets, stopAutoRefresh } = useWalletStore();
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [createWalletGroup, setCreateWalletGroup] = useState<WalletGroup | null>(null);
  const [activeGroup, setActiveGroup] = useState<WalletGroup>('main');
  const { toast } = useToast();

  useEffect(() => {
    console.log('Loading wallets...');
    loadWallets().catch(error => {
      console.error('Failed to load wallets:', error);
      toast({
        title: "Error",
        description: "Failed to load wallets",
        variant: "destructive",
      });
    });

    // Clean up auto-refresh when component unmounts
    return () => {
      stopAutoRefresh();
    };
  }, [loadWallets, stopAutoRefresh, toast]);

  const handleShowPrivateKey = async (publicKey: string) => {
    const key = await getPrivateKey(publicKey);
    if (key && validatePrivateKey(key)) {
      setPrivateKey(key);
      setSelectedWallet(publicKey);
    }
  };

  const copyToClipboard = async (text: string, walletId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(walletId);
      setTimeout(() => setCopied(null), 2000);
      toast({
        title: "Copied!",
        description: "Wallet address copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handlePercentageClick = async (wallet: any, percentage: number) => {
    try {
      const success = await swapTokenPercentage(wallet.publicKey, percentage, getPrivateKey, toast);
      if (success) {
        toast({
          title: "Success",
          description: `Initiated ${percentage}% swap of highest value token to SOL`,
        });
        // Refresh balances after successful swap
        await refreshBalances();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to swap tokens",
        variant: "destructive",
      });
    }
  };

  const filteredWallets = wallets.filter(wallet => {
    const matchesSearch = wallet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         wallet.publicKey.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesArchived = wallet.archived === showArchived;
    const matchesGroup = wallet.groupName === activeGroup;
    return matchesSearch && matchesArchived && matchesGroup;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>{showArchived ? 'Archived Wallets' : 'Active Wallets'}</CardTitle>
          <div className="space-x-2">
            {activeGroup === 'cex' && <CEXWalletDialog />}
            <Button
              variant="outline"
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? (
                <>
                  <ArchiveRestore className="mr-2 h-4 w-4" />
                  Show Active
                </>
              ) : (
                <>
                  <Archive className="mr-2 h-4 w-4" />
                  Show Archived
                </>
              )}
            </Button>
            <Button variant="outline" onClick={refreshBalances} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Group Navigation */}
        <div className="flex gap-2 mt-4 mb-2 overflow-x-auto pb-2">
          {WALLET_GROUPS.map(group => (
            <Button
              key={group.id}
              variant={activeGroup === group.id ? "default" : "outline"}
              onClick={() => setActiveGroup(group.id)}
              className="min-w-[120px]"
            >
              <Wallet className="mr-2 h-4 w-4" />
              {group.name}
            </Button>
          ))}
        </div>

        {/* Show BundleTokenSwap only for the bundles group */}
        {activeGroup === 'bundles' && <BundleTokenSwap />}

        <div className="flex space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search wallets..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {activeGroup !== 'cex' && (
            <Button
              onClick={() => setCreateWalletGroup(activeGroup)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Wallet
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {filteredWallets.length === 0 ? (
            <Card className="col-span-2 bg-muted/50">
              <CardContent className="p-6">
                <div className="flex flex-col items-center justify-center text-center space-y-2">
                  <Wallet className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No wallets in this group
                  </p>
                  {activeGroup === 'cex' ? (
                    <CEXWalletDialog />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCreateWalletGroup(activeGroup)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Wallet
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredWallets.map((wallet) => (
              <Card key={wallet.publicKey} className="bg-card hover:bg-muted/50 transition-colors">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{wallet.name || 'Unnamed Wallet'}</h4>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-mono text-muted-foreground">
                            {wallet.publicKey.slice(0, 12)}...
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(wallet.publicKey, wallet.publicKey)}
                          >
                            {copied === wallet.publicKey ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <p className="font-medium">{wallet.balance.toFixed(4)} SOL</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last updated: {new Date(wallet.lastUpdated).toLocaleString()}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {/* Percentage buttons for bundle wallets */}
                      {activeGroup === 'bundles' && (
                        <div className="flex gap-2 w-full mb-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handlePercentageClick(wallet, 100)}
                          >
                            100%
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handlePercentageClick(wallet, 75)}
                          >
                            75%
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handlePercentageClick(wallet, 50)}
                          >
                            50%
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handlePercentageClick(wallet, 25)}
                          >
                            25%
                          </Button>
                        </div>
                      )}
                      {activeGroup === 'sniper' && (
                        <SendToCEXDialog
                          senderPublicKey={wallet.publicKey}
                          senderBalance={wallet.balance}
                        />
                      )}
                      {activeGroup !== 'cex' && (
                        <>
                          <SendSolDialog
                            senderPublicKey={wallet.publicKey}
                            senderBalance={wallet.balance}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShowPrivateKey(wallet.publicKey)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleArchive(wallet.publicKey)}
                      >
                        {wallet.archived ? (
                          <ArchiveRestore className="h-4 w-4" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </CardContent>

      {/* Private Key Dialog */}
      <Dialog open={!!selectedWallet} onOpenChange={() => {
        setSelectedWallet(null);
        setShowPrivateKey(false);
        setPrivateKey(null);
        setCopied(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wallet Private Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium">Private Key</p>
                <div className="space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                  >
                    {showPrivateKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  {showPrivateKey && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => privateKey && copyToClipboard(privateKey, 'private-key')}
                      className="text-muted-foreground"
                    >
                      {copied === 'private-key' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-sm font-mono break-all">
                {showPrivateKey ? privateKey : '••••••••••••••••••••••••••••••••'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-destructive font-medium">
                ⚠️ Security Warning
              </p>
              <p className="text-sm text-muted-foreground">
                This is your wallet's private key. Never share it with anyone. Anyone with access to this key will have full control over your wallet and funds.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Wallet Dialog */}
      {createWalletGroup && (
        <CreateWalletDialog
          open={true}
          onOpenChange={() => setCreateWalletGroup(null)}
          defaultGroup={createWalletGroup}
        />
      )}
    </Card>
  );
}