"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useWalletStore } from "@/store/wallet-store";
import { Coins } from "lucide-react";
import axios from "axios";

interface AirdropButtonProps {
  publicKey: string;
  onSuccess?: () => void;
}

export function AirdropButton({ publicKey, onSuccess }: AirdropButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDevnet, setIsDevnet] = useState(false);
  const userPreferenceRef = useRef<string | null>(null);
  const { toast } = useToast();
  const { network, refreshBalances } = useWalletStore();
  
  // Check server-side network on mount and when network changes
  useEffect(() => {
    // Check if user preference is stored in localStorage
    if (typeof window !== 'undefined') {
      const storedPreference = localStorage.getItem('user-network-preference');
      if (storedPreference) {
        userPreferenceRef.current = storedPreference;
      }
    }
    
    const checkServerNetwork = async () => {
      try {
        // If user has explicitly set to devnet, use that
        if (userPreferenceRef.current === 'devnet') {
          setIsDevnet(true);
          return;
        }
        
        // Otherwise check server
        const response = await axios.get('/api/settings/network');
        setIsDevnet(response.data.network === 'devnet');
      } catch (error) {
        console.error('Error checking server network:', error);
        // Fallback to client-side network setting
        setIsDevnet(network === 'devnet');
      }
    };
    
    checkServerNetwork();
  }, [network]);
  
  // Only show on devnet
  if (!isDevnet) {
    return null;
  }

  const handleAirdrop = async () => {
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      
      // Double-check server-side network before making the request
      let isServerDevnet = false;
      
      // If user has explicitly set to devnet, assume we're on devnet
      if (userPreferenceRef.current === 'devnet') {
        isServerDevnet = true;
      } else {
        // Otherwise check with server
        const networkResponse = await axios.get('/api/settings/network');
        isServerDevnet = networkResponse.data.network === 'devnet';
      }
      
      if (!isServerDevnet) {
        throw new Error('Airdrops are only available on devnet. Please switch to devnet first.');
      }
      
      const response = await axios.post('/api/wallet/airdrop', {
        publicKey,
        amount: 1 // Request 1 SOL
      });
      
      toast({
        title: "Success",
        description: response.data.message || "Successfully requested SOL airdrop",
      });
      
      // Refresh balances to show new amount
      await refreshBalances();
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Airdrop error:', error);
      
      let errorMessage = "Failed to request airdrop";
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleAirdrop}
      disabled={isLoading}
    >
      <Coins className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? "Requesting..." : "Request SOL"}
    </Button>
  );
} 