"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Search, Filter, RefreshCw, Eye, EyeOff, Copy, Check, Archive, ArchiveRestore, Plus, Wallet, Send, Trash2, Edit, Save, MoreVertical } from "lucide-react";
import { useWalletStore } from "@/store/wallet-store";
import { validatePrivateKey, WALLET_GROUPS, WalletGroup } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { CreateWalletDialog } from "./create-wallet-dialog";
import { BundleTokenSwap } from "./bundle-token-swap";
import { CEXWalletDialog } from "./cex-wallet-dialog";
import { SendToCEXDialog } from "./send-to-cex-dialog";
import { SendSolDialog } from "./send-sol-dialog";
import { swapTokenPercentage } from "./bundle-token-swap";
import { AirdropButton } from "./airdrop-button";
import { SplTokenChecker } from "./spl-token-checker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Define client wallet type to match what the API returns
interface ClientWallet {
  publicKey: string;
  encryptedPrivateKey: string;
  name: string;
  balance: number;
  lastUpdated: Date | string;
  createdAt: Date | string;
  archived: boolean;
  groupName: string;
  isCex?: boolean;
}

export function WalletList() {
  const { wallets, isLoading, refreshBalances, getPrivateKey, toggleArchive, loadWallets, stopAutoRefresh, userId } = useWalletStore();
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [createWalletGroup, setCreateWalletGroup] = useState<WalletGroup | null>(null);
  const [activeGroup, setActiveGroup] = useState<WalletGroup>('main');
  const [walletToDelete, setWalletToDelete] = useState<string | null>(null);
  const [groupRenameOpen, setGroupRenameOpen] = useState<boolean>(false);
  const [groupToRename, setGroupToRename] = useState<WalletGroup | null>(null);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [customGroupNames, setCustomGroupNames] = useState<Record<string, string>>({});
  const [groupToDelete, setGroupToDelete] = useState<WalletGroup | null>(null);
  const [deleteGroupDialogOpen, setDeleteGroupDialogOpen] = useState<boolean>(false);
  const [deletedGroups, setDeletedGroups] = useState<string[]>([]);
  const { toast } = useToast();

  // Helper to get the user-specific storage key
  const getGroupNamesStorageKey = (): string => {
    return userId ? `wallet-group-names-${userId}` : 'wallet-group-names';
  };

  // Helper to get the user-specific deleted groups storage key
  const getDeletedGroupsStorageKey = (): string => {
    return userId ? `deleted-wallet-groups-${userId}` : 'deleted-wallet-groups';
  };

  // Load custom group names from localStorage with user-specific key
  useEffect(() => {
    if (!userId) return; // Only load if we have a user ID
    
    const storageKey = getGroupNamesStorageKey();
    console.log(`Loading wallet group names for user: ${userId} with key: ${storageKey}`);
    
    const savedCustomNames = localStorage.getItem(storageKey);
    if (savedCustomNames) {
      try {
        setCustomGroupNames(JSON.parse(savedCustomNames));
      } catch (error) {
        console.error('Error loading custom group names:', error);
      }
    } else {
      // Clear existing names if no saved preferences for this user
      setCustomGroupNames({});
    }

    // Load deleted groups
    const deletedGroupsKey = getDeletedGroupsStorageKey();
    const savedDeletedGroups = localStorage.getItem(deletedGroupsKey);
    if (savedDeletedGroups) {
      try {
        setDeletedGroups(JSON.parse(savedDeletedGroups));
        console.log(`Loaded deleted groups for user: ${userId}:`, JSON.parse(savedDeletedGroups));
      } catch (error) {
        console.error('Error loading deleted groups:', error);
      }
    } else {
      setDeletedGroups([]);
    }
  }, [userId]);

  // Save custom group names to localStorage with user-specific key
  useEffect(() => {
    if (!userId || Object.keys(customGroupNames).length === 0) return;
    
    const storageKey = getGroupNamesStorageKey();
    console.log(`Saving wallet group names for user: ${userId} with key: ${storageKey}`);
    
    localStorage.setItem(storageKey, JSON.stringify(customGroupNames));
  }, [customGroupNames, userId]);

  // Save deleted groups to localStorage
  useEffect(() => {
    if (!userId || deletedGroups.length === 0) return;
    
    const storageKey = getDeletedGroupsStorageKey();
    console.log(`Saving deleted groups for user: ${userId} with key: ${storageKey}`, deletedGroups);
    
    localStorage.setItem(storageKey, JSON.stringify(deletedGroups));
  }, [deletedGroups, userId]);

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

  const handleDeleteWallet = async (publicKey: string) => {
    try {
      // Instead of using deleteWallet from the store, call the API directly
      const response = await fetch(`/api/wallet/${publicKey}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete wallet: ${response.statusText}`);
      }
      
      // Refresh the wallet list after deletion
      await loadWallets();
      
      toast({
        title: "Success",
        description: "Wallet has been permanently deleted",
      });
    } catch (error) {
      console.error('Error deleting wallet:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete wallet",
        variant: "destructive",
      });
    }
  };

  const handleRenameClick = (groupId: WalletGroup) => {
    setGroupToRename(groupId);
    const originalGroup = WALLET_GROUPS.find(g => g.id === groupId);
    const currentName = customGroupNames[groupId] || originalGroup?.name || '';
    setNewGroupName(currentName);
    setGroupRenameOpen(true);
  };

  const handleSaveGroupName = () => {
    if (groupToRename && newGroupName.trim()) {
      setCustomGroupNames({
        ...customGroupNames,
        [groupToRename]: newGroupName.trim()
      });
      setGroupRenameOpen(false);
      setGroupToRename(null);
      
      toast({
        title: "Group Renamed",
        description: "Group name updated successfully",
      });
    }
  };

  const handleDeleteClick = (groupId: WalletGroup) => {
    if (groupId === 'main' || groupId === 'bundles') {
      toast({
        title: "Protected Wallet Group",
        description: "Main Wallets and Bundle Wallets groups cannot be deleted.",
        variant: "destructive"
      });
      return;
    }
    
    setGroupToDelete(groupId);
    setDeleteGroupDialogOpen(true);
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    
    try {
      console.log(`Attempting to delete group: ${groupToDelete}`);
      
      // Get all wallets in this group
      const groupWallets = (wallets as unknown as ClientWallet[]).filter(
        wallet => wallet.groupName === groupToDelete && !wallet.archived
      );
      
      console.log(`Found ${groupWallets.length} wallets to delete in group: ${groupToDelete}`);
      
      // First archive all wallets in the group
      for (const wallet of groupWallets) {
        console.log(`Archiving wallet: ${wallet.publicKey}`);
        await toggleArchive(wallet.publicKey);
      }
      
      // Then delete the archived wallets
      for (const wallet of groupWallets) {
        console.log(`Deleting wallet: ${wallet.publicKey}`);
        await handleDeleteWallet(wallet.publicKey);
      }
      
      // Remove custom name if exists
      if (customGroupNames[groupToDelete]) {
        console.log(`Removing custom name for group: ${groupToDelete}`);
        const updatedNames = { ...customGroupNames };
        delete updatedNames[groupToDelete];
        setCustomGroupNames(updatedNames);
      }
      
      // Add group to deleted groups list
      console.log(`Adding ${groupToDelete} to deleted groups list`);
      setDeletedGroups(prev => [...prev, groupToDelete]);
      
      // Switch to main group
      setActiveGroup('main');
      
      toast({
        title: "Group Deleted",
        description: `The group "${getGroupDisplayName(groupToDelete)}" and all its wallets have been deleted.`,
      });
      
      // Refresh wallet list
      await loadWallets();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete group",
        variant: "destructive",
      });
    } finally {
      setDeleteGroupDialogOpen(false);
      setGroupToDelete(null);
    }
  };

  const getGroupDisplayName = (groupId: string): string => {
    if (customGroupNames[groupId]) {
      return customGroupNames[groupId];
    }
    const group = WALLET_GROUPS.find(g => g.id === groupId);
    return group ? group.name : groupId;
  };

  // Check if the group should have standard wallet features (like main and dev)
  const hasStandardWalletFeatures = (group: WalletGroup): boolean => {
    return group === 'main' || group === 'dev';
  };

  const filteredWallets = (wallets as unknown as ClientWallet[]).filter(wallet => {
    const matchesSearch = (wallet.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
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
          {WALLET_GROUPS
            .filter(group => !deletedGroups.includes(group.id)) // Filter out deleted groups
            .map(group => (
            <div key={group.id} className="flex items-center">
              <Button
                variant={activeGroup === group.id ? "default" : "outline"}
                onClick={() => setActiveGroup(group.id as WalletGroup)}
                className="min-w-[120px] relative"
              >
                <Wallet className="mr-2 h-4 w-4" />
                {getGroupDisplayName(group.id)}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 ml-1 px-0"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleRenameClick(group.id as WalletGroup)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Rename Group
                  </DropdownMenuItem>
                  {group.id !== 'main' && group.id !== 'bundles' && (
                    <DropdownMenuItem 
                      onClick={() => handleDeleteClick(group.id as WalletGroup)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Group
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
                      {/* SPL Token Checker for all wallets */}
                      <SplTokenChecker 
                        publicKey={wallet.publicKey}
                        walletName={wallet.name}
                      />
                      {hasStandardWalletFeatures(activeGroup) && (
                        <>
                          <SendSolDialog
                            senderPublicKey={wallet.publicKey}
                            senderBalance={wallet.balance}
                          />
                          <AirdropButton 
                            publicKey={wallet.publicKey} 
                            onSuccess={refreshBalances}
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
                      {/* Always show Send SOL for non-CEX wallets */}
                      {!hasStandardWalletFeatures(activeGroup) && activeGroup !== 'cex' && activeGroup !== 'sniper' && activeGroup !== 'bundles' && (
                        <>
                          <SendSolDialog
                            senderPublicKey={wallet.publicKey}
                            senderBalance={wallet.balance}
                          />
                          <AirdropButton 
                            publicKey={wallet.publicKey} 
                            onSuccess={refreshBalances}
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
                      {/* Add delete button only for archived wallets */}
                      {wallet.archived && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => setWalletToDelete(wallet.publicKey)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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
                This is your wallet&apos;s private key. Never share it with anyone. Anyone with access to this key will have full control over your wallet and funds.
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

      {/* Delete Wallet Confirmation Dialog */}
      <Dialog open={!!walletToDelete} onOpenChange={(isOpen) => {
        if (!isOpen) setWalletToDelete(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Wallet</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete your wallet from the database.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-muted rounded-lg text-center">
            <p className="text-destructive font-medium">Are you sure you want to delete this wallet?</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalletToDelete(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (walletToDelete) {
                  handleDeleteWallet(walletToDelete);
                  setWalletToDelete(null);
                }
              }}
            >
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add the Rename Group Dialog */}
      <Dialog open={groupRenameOpen} onOpenChange={setGroupRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Wallet Group</DialogTitle>
            <DialogDescription>
              Enter a new name for this wallet group.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Enter new group name"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveGroupName}>
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirmation Dialog */}
      <Dialog open={deleteGroupDialogOpen} onOpenChange={setDeleteGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the group and all its wallets from the database.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-muted rounded-lg text-center">
            <p className="text-destructive font-medium">Are you sure you want to delete this group?</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGroupDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteGroup}
            >
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}