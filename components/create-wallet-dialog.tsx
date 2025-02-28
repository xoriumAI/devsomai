"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWalletStore } from "@/store/wallet-store";
import { useToast } from "@/hooks/use-toast";
import { WALLET_GROUPS, WalletGroup } from "@/lib/wallet";

interface CreateWalletDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultGroup?: WalletGroup;
}

export function CreateWalletDialog({ 
  open: controlledOpen, 
  onOpenChange: setControlledOpen,
  defaultGroup = 'main'
}: CreateWalletDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [group, setGroup] = React.useState<WalletGroup>(defaultGroup);
  const [isLoading, setIsLoading] = React.useState(false);
  const { createWallet } = useWalletStore();
  const { toast } = useToast();

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : open;
  const onOpenChange = isControlled ? setControlledOpen : setOpen;

  const handleCreate = async () => {
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      await createWallet(name, group);
      toast({
        title: "Success",
        description: "Wallet created successfully",
      });
      onOpenChange?.(false);
      setName("");
      setGroup(defaultGroup);
    } catch (error) {
      console.error('Error creating wallet:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create wallet",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value);

  return (
    <>
      {!isControlled && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Create Wallet
        </Button>
      )}
      <Dialog 
        open={isOpen} 
        onOpenChange={(newOpen) => {
          if (!isLoading) {
            onOpenChange?.(newOpen);
            if (!newOpen) {
              setName("");
              setGroup(defaultGroup);
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Wallet Name (optional)"
                value={name}
                onChange={handleNameChange}
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
            <Button 
              onClick={handleCreate} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
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