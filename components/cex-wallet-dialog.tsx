"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Plus } from "lucide-react";
import { useWalletStore } from "@/store/wallet-store";
import { useToast } from "@/hooks/use-toast";
import { PublicKey } from "@solana/web3.js";

export function CEXWalletDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const { addCEXWallet, isLoading } = useWalletStore();
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!address) {
      toast({
        title: "Error",
        description: "Please enter a wallet address",
        variant: "destructive",
      });
      return;
    }

    try {
      // Validate the address is a valid Solana public key
      new PublicKey(address);
      
      await addCEXWallet(address, name);
      toast({
        title: "Success",
        description: "CEX wallet added successfully",
      });
      setOpen(false);
      setName("");
      setAddress("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Invalid Solana wallet address",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Building2 className="mr-2 h-4 w-4" />
          Add CEX Wallet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add CEX Wallet</DialogTitle>
          <DialogDescription>
            Add a CEX wallet address for tracking purposes. Only the public address is stored.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Wallet Name</Label>
            <Input
              id="name"
              placeholder="e.g., Binance Hot Wallet"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Wallet Address</Label>
            <Input
              id="address"
              placeholder="Enter Solana wallet address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Enter the public address of your CEX wallet
            </p>
          </div>
          <Button onClick={handleAdd} disabled={isLoading} className="w-full">
            {isLoading ? "Adding..." : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Wallet
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}