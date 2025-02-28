"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WalletDashboard } from "@/components/wallet-dashboard";
import { WalletList } from "@/components/wallet-list";
import { ChatInterface } from "@/components/chat-interface";
import { TokenLaunch } from "@/components/token-launch";
import { CreateWalletDialog } from "@/components/create-wallet-dialog";
import { LayoutDashboard, Wallet, MessageSquare, Coins } from "lucide-react";
import { useWalletStore } from "@/store/wallet-store";
import { ThemeToggle } from "@/components/theme-toggle";
import { CreateWalletButton } from "@/components/create-wallet-button";
import { ImportWalletButton } from "@/components/import-wallet-button";
import { AddCEXWalletButton } from "@/components/add-cex-wallet-button";
import { RefreshBalancesButton } from "@/components/refresh-balances-button";

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="container mx-auto p-4 space-y-4">
      <header className="flex justify-between items-center py-6">
        <div>
          <h1 className="text-3xl font-bold">Solana Wallet Manager</h1>
          <p className="text-muted-foreground">Secure and efficient wallet management</p>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <CreateWalletDialog />
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="wallets">
            <Wallet className="mr-2 h-4 w-4" />
            Wallets
          </TabsTrigger>
          <TabsTrigger value="token-launch">
            <Coins className="mr-2 h-4 w-4" />
            Token Launch
          </TabsTrigger>
          <TabsTrigger value="chat">
            <MessageSquare className="mr-2 h-4 w-4" />
            Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" asChild>
          <div className={activeTab === "dashboard" ? "block" : "hidden"}>
            <WalletDashboard />
          </div>
        </TabsContent>

        <TabsContent value="wallets" asChild>
          <div className={activeTab === "wallets" ? "block" : "hidden"}>
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">Wallets</h1>
              <div className="flex items-center gap-2">
                <RefreshBalancesButton />
                <CreateWalletButton />
                <ImportWalletButton />
                <AddCEXWalletButton />
              </div>
            </div>
            <WalletList />
          </div>
        </TabsContent>

        <TabsContent value="token-launch" asChild>
          <div className={activeTab === "token-launch" ? "block" : "hidden"}>
            <TokenLaunch />
          </div>
        </TabsContent>

        <TabsContent value="chat" asChild>
          <div className={activeTab === "chat" ? "block" : "hidden"}>
            <ChatInterface />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}