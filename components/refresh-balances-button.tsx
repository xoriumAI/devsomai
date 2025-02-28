"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWalletStore } from "@/store/wallet-store";
import { useToast } from "@/hooks/use-toast";

export function RefreshBalancesButton() {
  const { refreshBalances, isLoading } = useWalletStore();
  const { toast } = useToast();

  const handleRefresh = async () => {
    try {
      await refreshBalances();
      toast({
        title: "Success",
        description: "Wallet balances updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to refresh balances",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={isLoading}
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? "Refreshing..." : "Refresh Balances"}
    </Button>
  );
} 