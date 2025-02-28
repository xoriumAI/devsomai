"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send } from "lucide-react";
import { useWalletStore } from "@/store/wallet-store";
import { useToast } from "@/hooks/use-toast";

interface SendSolDialogProps {
  senderPublicKey: string;
  senderBalance: number;
}

export function SendSolDialog({ senderPublicKey, senderBalance }: SendSolDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { sendSOL, refreshBalances } = useWalletStore();
  const { toast } = useToast();

  const validateSolanaAddress = (address: string): boolean => {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  };

  const handleSend = async () => {
    if (!amount || !recipientAddress) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (!validateSolanaAddress(recipientAddress)) {
      toast({
        title: "Error",
        description: "Invalid Solana address",
        variant: "destructive",
      });
      return;
    }

    // Parse amount with high precision
    const amountNumber = Number(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    // Ensure we're using exact precision
    const exactAmount = parseFloat(amountNumber.toFixed(9));
    
    // Reserve 0.001 SOL for transaction fee
    const reserveForFee = 0.001;
    if (exactAmount + reserveForFee > senderBalance) {
      toast({
        title: "Error",
        description: `Insufficient balance. Please leave at least ${reserveForFee} SOL for the transaction fee`,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      await sendSOL(senderPublicKey, recipientAddress, exactAmount);
      
      toast({
        title: "Success",
        description: "Transaction sent successfully",
      });
      
      setOpen(false);
      setAmount("");
      setRecipientAddress("");
      
      // Schedule multiple balance refreshes to catch the update
      const refreshAttempts = [1000, 3000, 5000]; // 1s, 3s, 5s
      refreshAttempts.forEach(delay => {
        setTimeout(() => {
          refreshBalances().catch(console.error);
        }, delay);
      });
    } catch (error) {
      console.error('Error sending SOL:', error);
      // If the error message indicates a timeout but transaction might be successful
      if (error instanceof Error && error.message.includes('timeout')) {
        toast({
          title: "Transaction Status Unclear",
          description: "The transaction was sent but confirmation timed out. Your balance will update shortly if successful.",
          duration: 6000,
        });
        // Refresh balances after a delay
        setTimeout(() => {
          refreshBalances().catch(console.error);
        }, 5000);
      } else {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to send SOL",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isLoading) {
        setOpen(isOpen);
        if (!isOpen) {
          setAmount("");
          setRecipientAddress("");
        }
      }
    }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Send className="mr-2 h-4 w-4" />
          Send SOL
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send SOL</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Recipient Address</Label>
            <Input
              placeholder="Enter Solana wallet address"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label>Amount (SOL)</Label>
            <Input
              type="number"
              step="0.000000001"
              min="0"
              max={senderBalance - 0.001} // Subtract fee reserve from max amount
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isLoading}
            />
            <p 
              className="text-sm text-muted-foreground cursor-pointer hover:text-primary transition-colors"
              onClick={() => setAmount((senderBalance - 0.001).toFixed(9))} // Set max amount minus fee
              title="Click to set maximum amount"
            >
              Available balance: {senderBalance.toFixed(9)} SOL
            </p>
          </div>

          <Button 
            onClick={handleSend} 
            disabled={isLoading} 
            className="w-full"
          >
            {isLoading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending...
              </span>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send SOL
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}