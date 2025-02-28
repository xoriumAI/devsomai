"use client";

import { useWalletStore } from "@/store/wallet-store";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { AirdropButton } from "./airdrop-button";
import { useEffect, useState, useRef } from "react";
import axios from "axios";

export function DevnetNotice() {
  const { network, wallets } = useWalletStore();
  const [isDevnet, setIsDevnet] = useState(false);
  const userPreferenceRef = useRef<string | null>(null);
  
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

  // Find the first non-archived wallet to use for airdrop
  const firstWallet = wallets.find(w => !w.archived && w.encryptedPrivateKey);
  
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Devnet Mode Active</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <p>
          You are currently in Devnet mode. Any transactions will use test SOL, not real funds.
        </p>
        {firstWallet && (
          <div className="flex items-center gap-2 mt-2">
            <span>Need test SOL?</span>
            <AirdropButton 
              publicKey={firstWallet.publicKey} 
            />
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
} 