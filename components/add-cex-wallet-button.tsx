"use client";

import * as React from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useWalletStore } from "@/store/wallet-store";
import { useToast } from "@/hooks/use-toast";

export function AddCEXWalletButton() {
  const [open, setOpen] = React.useState(false);
  const [publicKey, setPublicKey] = React.useState("");
  const [name, setName] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const { addCEXWallet } = useWalletStore();
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!publicKey) {
      toast({
        title: "Error",
        description: "Please enter an address",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      await addCEXWallet(publicKey, name);
      toast({
        title: "Success",
        description: "CEX wallet added successfully",
      });
      setOpen(false);
      setPublicKey("");
      setName("");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add CEX wallet",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value);
  const handlePublicKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => setPublicKey(e.target.value);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Building2 className="mr-2 h-4 w-4" aria-hidden="true" />
        Add CEX Wallet
      </Button>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isLoading) {
          setOpen(isOpen);
          if (!isOpen) {
            setPublicKey("");
            setName("");
          }
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add CEX Wallet</DialogTitle>
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
              <Input
                placeholder="Wallet Address"
                value={publicKey}
                onChange={handlePublicKeyChange}
                type="text"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Enter any wallet address from your CEX
              </p>
            </div>
            <Button 
              onClick={handleAdd} 
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
                  Adding...
                </span>
              ) : (
                "Add Wallet"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 