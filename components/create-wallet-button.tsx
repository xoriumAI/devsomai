"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useWalletStore } from "@/store/wallet-store";
import { useToast } from "@/hooks/use-toast";

export function CreateWalletButton() {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const { createWallet } = useWalletStore();
  const { toast } = useToast();

  const handleCreate = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      await createWallet(name);
      toast({
        title: "Success",
        description: "Wallet created successfully",
      });
      setOpen(false);
      setName("");
    } catch (error) {
      console.error('Error creating wallet:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create wallet",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        Create Wallet
      </Button>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!loading) {
          setOpen(isOpen);
          if (!isOpen) {
            setName("");
          }
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Wallet Name (optional)"
                value={name}
                onChange={handleNameChange}
                disabled={loading}
              />
            </div>
            <Button 
              onClick={handleCreate} 
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </span>
              ) : (
                "Create Wallet"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 