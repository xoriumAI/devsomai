"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWalletStore } from "@/store/wallet-store";
import { useToast } from "@/hooks/use-toast";
import { validatePrivateKey, WALLET_GROUPS, WalletGroup } from "@/lib/wallet";

export function ImportWalletButton() {
  const [open, setOpen] = React.useState(false);
  const [privateKey, setPrivateKey] = React.useState("");
  const [name, setName] = React.useState("");
  const [group, setGroup] = React.useState<WalletGroup>("main");
  const [isLoading, setIsLoading] = React.useState(false);
  const { importWallet } = useWalletStore();
  const { toast } = useToast();

  const handleImport = async () => {
    if (!privateKey) {
      toast({
        title: "Error",
        description: "Please enter a private key",
        variant: "destructive",
      });
      return;
    }

    if (!validatePrivateKey(privateKey)) {
      toast({
        title: "Error",
        description: "Invalid private key format. Please enter a valid base58-encoded private key",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      await importWallet(privateKey, name, group);
      toast({
        title: "Success",
        description: "Wallet imported successfully",
      });
      setOpen(false);
      setPrivateKey("");
      setName("");
      setGroup("main");
    } catch (error) {
      console.error('Error importing wallet:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to import wallet",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value);
  const handlePrivateKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => setPrivateKey(e.target.value);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Download className="mr-2 h-4 w-4" aria-hidden="true" />
        Import Wallet
      </Button>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isLoading) {
          setOpen(isOpen);
          if (!isOpen) {
            setPrivateKey("");
            setName("");
            setGroup("main");
          }
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Wallet Name (optional)"
                value={name}
                onChange={handleNameChange}
                type="text"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Select
                value={group}
                onValueChange={(value: WalletGroup) => setGroup(value)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {WALLET_GROUPS.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Private Key"
                value={privateKey}
                onChange={handlePrivateKeyChange}
                type="password"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Enter your base58-encoded private key
              </p>
            </div>
            <Button 
              onClick={handleImport} 
              type="button" 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Importing...
                </span>
              ) : (
                "Import"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 