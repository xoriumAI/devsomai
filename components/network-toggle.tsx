"use client";

import { useState, useEffect, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { getSettings } from "@/lib/settings";
import { useToast } from "@/hooks/use-toast";
import { useWalletStore } from "@/store/wallet-store";
import { Badge } from "@/components/ui/badge";
import axios from "axios";

export function NetworkToggle() {
  const [isDevnet, setIsDevnet] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const userPreferenceRef = useRef<string | null>(null);
  const { toast } = useToast();
  const { network, switchNetwork } = useWalletStore();

  // Initialize state from store and check server-side network
  useEffect(() => {
    // Check if user preference is stored in localStorage
    if (typeof window !== 'undefined') {
      const storedPreference = localStorage.getItem('user-network-preference');
      if (storedPreference) {
        userPreferenceRef.current = storedPreference;
      }
    }

    const checkNetworkSync = async () => {
      try {
        // Get client-side settings
        const clientSettings = getSettings();
        setIsDevnet(clientSettings.network === 'devnet');
        
        // Check server-side settings
        const response = await axios.get('/api/settings/network');
        const serverNetwork = response.data.network;
        
        // If there's a mismatch, sync with server ONLY if user hasn't explicitly set a preference
        // or if the user preference matches the server network
        if (clientSettings.network !== serverNetwork) {
          console.log(`Network mismatch: client=${clientSettings.network}, server=${serverNetwork}`);
          
          // If user has explicitly set to devnet, keep it as devnet
          if (userPreferenceRef.current === 'devnet' && serverNetwork !== 'devnet') {
            console.log('User prefers devnet, syncing server to match client');
            // Update server to match client preference
            await axios.post('/api/settings/network', { 
              network: 'devnet',
              isUserPreference: true 
            });
          } else {
            // Otherwise, update client to match server
            console.log('Syncing client to match server');
            switchNetwork(serverNetwork);
            setIsDevnet(serverNetwork === 'devnet');
          }
        }
      } catch (error) {
        console.error('Error checking network sync:', error);
      }
    };
    
    checkNetworkSync();
  }, [network, switchNetwork]);

  const handleToggle = async (checked: boolean) => {
    if (isSwitching) return;
    
    try {
      setIsSwitching(true);
      
      // Switch network using the new API endpoint
      const networkValue = checked ? 'devnet' : 'mainnet-beta';
      
      // Store user preference
      if (typeof window !== 'undefined') {
        localStorage.setItem('user-network-preference', networkValue);
        userPreferenceRef.current = networkValue;
      }
      
      // Show toast before switching
      toast({
        title: "Network Changing",
        description: `Switching to ${checked ? 'Devnet' : 'Mainnet'} - page will reload`,
      });
      
      // Call the API to switch network on server-side
      await axios.post('/api/settings/network', { 
        network: networkValue,
        isUserPreference: true
      });
      
      // Update client-side store
      switchNetwork(networkValue);
      
      // Force reload after a short delay to ensure settings are applied
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Error switching network:', error);
      
      let errorMessage = "Failed to switch network";
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
      
      setIsSwitching(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <Switch 
        id="network-toggle" 
        checked={isDevnet}
        onCheckedChange={handleToggle}
        disabled={isSwitching}
      />
      <Label htmlFor="network-toggle" className="cursor-pointer">
        Network: 
      </Label>
      <Badge variant={isDevnet ? "outline" : "default"}>
        {isSwitching ? "Switching..." : (isDevnet ? "Devnet" : "Mainnet")}
      </Badge>
    </div>
  );
} 