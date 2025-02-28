import { useEffect, useState } from 'react';
import { useWalletStore } from '@/store/wallet-store';

export function useConnection() {
  const { isConnected } = useWalletStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset error when connection status changes
    if (isConnected) {
      setError(null);
    }
  }, [isConnected]);

  return {
    isConnected,
    isLoading,
    error,
    setError,
    setIsLoading
  };
} 