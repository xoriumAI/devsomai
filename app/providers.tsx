"use client";

import { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="solana-wallet-theme"
    >
      {children}
    </ThemeProvider>
  );
}