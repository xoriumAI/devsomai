"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWalletStore } from "@/store/wallet-store";
import { useToast } from "@/hooks/use-toast";
import { ConnectionStatus } from "@/components/connection-status";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { decrypt } from "@/lib/encryption";
import { useConnection } from "@/hooks/use-connection";
import { NetworkToggle } from "@/components/network-toggle";
import { DevnetNotice } from "@/components/devnet-notice";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function WalletDashboard() {
  const { wallets, getTotalBalance, getPrivateKey, loadWallets } = useWalletStore();
  const { toast } = useToast();
  const { isConnected } = useConnection();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Memoize filtered wallets to prevent unnecessary recalculations
  const { activeWallets, archivedWallets } = useMemo(() => ({
    activeWallets: wallets.filter(w => !w.archived),
    archivedWallets: wallets.filter(w => w.archived),
  }), [wallets]);

  // Memoize balance calculations
  const { totalBalance, activeBalance, archivedBalance, averageBalance } = useMemo(() => ({
    totalBalance: getTotalBalance(),
    activeBalance: getTotalBalance(false),
    archivedBalance: getTotalBalance(true),
    averageBalance: wallets.length > 0 ? getTotalBalance() / wallets.length : 0
  }), [wallets, getTotalBalance]);

  const handleBackupWallets = async (archivedOnly: boolean) => {
    try {
      // Group wallets by their groupName, filtering by archived status
      const groupedWallets = wallets
        .filter(w => w.archived === archivedOnly && w.encryptedPrivateKey) // Filter by archived status and skip CEX wallets
        .reduce((acc, wallet) => {
          const group = wallet.groupName || 'main';
          if (!acc[group]) acc[group] = [];
          acc[group].push(wallet);
          return acc;
        }, {} as Record<string, typeof wallets>);

      const backupContent: string[] = [];
      let totalExported = 0;

      // Process each group
      for (const [group, groupWallets] of Object.entries(groupedWallets)) {
        if (groupWallets.length === 0) continue;

        // Add group header
        backupContent.push(`\n${group} wallets:`);
        
        // Process wallets in the group
        for (const wallet of groupWallets) {
          try {
            const privateKey = await getPrivateKey(wallet.publicKey);
            if (privateKey) {
              backupContent.push(`${wallet.publicKey}:${privateKey}`);
              totalExported++;
            }
          } catch (error) {
            console.error(`Failed to decrypt wallet ${wallet.publicKey}:`, error);
            continue;
          }
        }
      }

      if (totalExported === 0) {
        toast({
          title: "No wallets to backup",
          description: `No ${archivedOnly ? 'archived' : 'active'} wallets with private keys found`,
          variant: "destructive",
        });
        return;
      }

      const blob = new Blob([backupContent.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${archivedOnly ? 'archived' : 'active'}-wallets-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Backup successful",
        description: `${totalExported} ${archivedOnly ? 'archived' : 'active'} wallets exported successfully`,
      });
    } catch (error) {
      console.error('Error backing up wallets:', error);
      toast({
        title: "Error",
        description: `Failed to backup ${archivedOnly ? 'archived' : 'active'} wallets`,
        variant: "destructive",
      });
    }
  };

  const handleDeleteArchivedWallets = async () => {
    try {
      const archivedWallets = wallets.filter(w => w.archived);
      if (archivedWallets.length === 0) {
        toast({
          title: "No wallets to delete",
          description: "No archived wallets found",
          variant: "destructive",
        });
        return;
      }

      let successCount = 0;
      let failedCount = 0;

      // Show initial progress toast
      toast({
        title: "Deleting wallets",
        description: `Deleting ${archivedWallets.length} archived wallets...`,
      });

      // Delete each archived wallet
      for (const wallet of archivedWallets) {
        try {
          const response = await fetch(`/api/wallet/${wallet.publicKey}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            const error = await response.json();
            console.error(`Failed to delete wallet ${wallet.publicKey}:`, error);
            failedCount++;
            continue;
          }

          successCount++;
        } catch (error) {
          console.error(`Failed to delete wallet ${wallet.publicKey}:`, error);
          failedCount++;
        }
      }

      // Refresh the wallet list
      await loadWallets();

      // Show final status
      if (successCount > 0) {
        toast({
          title: "Success",
          description: `Successfully deleted ${successCount} archived wallets${failedCount > 0 ? ` (${failedCount} failed)` : ''}`,
        });
      } else {
        toast({
          title: "Error",
          description: `Failed to delete any wallets (${failedCount} failed)`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting archived wallets:', error);
      toast({
        title: "Error",
        description: "Failed to delete archived wallets",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-bold">Dashboard</h2>
          <NetworkToggle />
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            onClick={() => handleBackupWallets(false)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Backup Active Wallets
          </Button>
          <Button
            variant="outline"
            onClick={() => handleBackupWallets(true)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Backup Archived Wallets
          </Button>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete Archived Wallets
          </Button>
        </div>
      </div>

      <DevnetNotice />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Archived Wallets</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all archived wallets.
              Please make sure you have backed up any important wallets before proceeding.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleDeleteArchivedWallets();
                setShowDeleteConfirm(false);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Archived Wallets
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className={!isConnected ? 'opacity-50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            {!isConnected && (
              <span className="text-xs text-muted-foreground">Disconnected</span>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBalance.toFixed(4)} SOL</div>
            <p className="text-xs text-muted-foreground">
              Across {wallets.length} wallets
            </p>
          </CardContent>
        </Card>

        <Card className={!isConnected ? 'opacity-50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Wallets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeBalance.toFixed(4)} SOL</div>
            <p className="text-xs text-muted-foreground">
              {activeWallets.length} active wallets
            </p>
          </CardContent>
        </Card>

        <Card className={!isConnected ? 'opacity-50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Archived Wallets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{archivedBalance.toFixed(4)} SOL</div>
            <p className="text-xs text-muted-foreground">
              {archivedWallets.length} archived wallets
            </p>
          </CardContent>
        </Card>

        <Card className={!isConnected ? 'opacity-50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {averageBalance.toFixed(4)} SOL
            </div>
            <p className="text-xs text-muted-foreground">
              Per wallet
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ConnectionStatus />
      </div>
    </div>
  );
}