"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Building2 } from "lucide-react";
import { useWalletStore } from "@/store/wallet-store";
import { useToast } from "@/hooks/use-toast";

interface SendToCEXDialogProps {
  senderPublicKey: string;
  senderBalance: number;
}

export function SendToCEXDialog({ senderPublicKey, senderBalance }: SendToCEXDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedCEX, setSelectedCEX] = useState<string | null>(null);
  const { wallets, sendSOL, isLoading } = useWalletStore();
  const { toast } = useToast();

  const cexWallets = wallets.filter(w => w.groupName === 'cex' && !w.archived);

  const handleSetMaxAmount = () => {
    setAmount(senderBalance.toString());
  };

  const handleSend = async () => {
    if (!amount || !selectedCEX) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const amountNumber = parseFloat(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (amountNumber > senderBalance) {
      toast({
        title: "Error",
        description: "Insufficient balance",
        variant: "destructive",
      });
      return;
    }

    try {
      await sendSOL(senderPublicKey, selectedCEX, amountNumber);
      toast({
        title: "Success",
        description: "Funds sent successfully",
      });
      setOpen(false);
      setAmount("");
      setSelectedCEX(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send funds",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Building2 className="mr-2 h-4 w-4" />
          Send to CEX
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send to CEX Wallet</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>CEX Wallet</Label>
            <Select
              value={selectedCEX || undefined}
              onValueChange={setSelectedCEX}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a CEX wallet" />
              </SelectTrigger>
              <SelectContent>
                {cexWallets.map((wallet) => (
                  <SelectItem key={wallet.publicKey} value={wallet.publicKey}>
                    {wallet.name || wallet.publicKey.slice(0, 8) + "..."}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cexWallets.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No CEX wallets available. Add a CEX wallet first.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (SOL)</Label>
            <Input
              id="amount"
              type="number"
              step="0.000000001"
              min="0"
              max={senderBalance}
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p 
              className="text-sm text-muted-foreground cursor-pointer hover:text-primary transition-colors"
              onClick={handleSetMaxAmount}
              title="Click to set maximum amount"
            >
              Available balance: {senderBalance.toFixed(4)} SOL
            </p>
          </div>

          <Button 
            onClick={handleSend} 
            disabled={isLoading || !selectedCEX} 
            className="w-full"
          >
            {isLoading ? "Sending..." : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send to CEX
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}