"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useWalletStore } from "@/store/wallet-store";
import { Loader2, AlertCircle, Check, Copy } from "lucide-react";
import { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, setAuthority, AuthorityType } from "@solana/spl-token";
import bs58 from "bs58";
import axios from "axios";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

// Add this import for metadata creation
import { createCreateMetadataAccountV3Instruction, DataV2 } from '@metaplex-foundation/mpl-token-metadata';

export function SplTokenCreator() {
  const { wallets, network, getPrivateKey } = useWalletStore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isDevnet, setIsDevnet] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenDescription, setTokenDescription] = useState("");
  const [tokenDecimals, setTokenDecimals] = useState("9");
  const [tokenSupply, setTokenSupply] = useState("1000000");
  const [selectedWallet, setSelectedWallet] = useState("");
  const [revokeMintAuthority, setRevokeMintAuthority] = useState(false);
  const [revokeFreezeAuthority, setRevokeFreezeAuthority] = useState(false);
  const [createdTokenInfo, setCreatedTokenInfo] = useState<{
    mintAddress: string;
    tokenAccount: string;
    txId: string;
    mintAuthorityRevoked: boolean;
    freezeAuthorityRevoked: boolean;
    name: string;
    symbol: string;
    description: string;
  } | null>(null);
  const userPreferenceRef = useRef<string | null>(null);

  // Check if we're on devnet
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

  // Reset form when switching networks
  useEffect(() => {
    setCreatedTokenInfo(null);
  }, [isDevnet]);

  // Only show non-archived wallets with private keys
  const eligibleWallets = wallets.filter(w => !w.archived && w.encryptedPrivateKey);

  const handleCreateToken = async () => {
    if (!selectedWallet) {
      toast({
        title: "Error",
        description: "Please select a wallet",
        variant: "destructive",
      });
      return;
    }

    if (!tokenName || !tokenSymbol) {
      toast({
        title: "Error",
        description: "Token name and symbol are required",
        variant: "destructive",
      });
      return;
    }

    const decimals = parseInt(tokenDecimals);
    if (isNaN(decimals) || decimals < 0 || decimals > 9) {
      toast({
        title: "Error",
        description: "Decimals must be a number between 0 and 9",
        variant: "destructive",
      });
      return;
    }

    const supply = parseFloat(tokenSupply);
    if (isNaN(supply) || supply <= 0) {
      toast({
        title: "Error",
        description: "Supply must be a positive number",
        variant: "destructive",
      });
      return;
    }

    // Double-check we're on devnet
    if (!isDevnet) {
      // If user has explicitly set to devnet in localStorage but our state doesn't reflect it
      if (userPreferenceRef.current === 'devnet') {
        setIsDevnet(true);
      } else {
        toast({
          title: "Error",
          description: "SPL token creation is only available on devnet",
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      // Get wallet private key
      const privateKeyString = await getPrivateKey(selectedWallet);
      if (!privateKeyString) {
        throw new Error("Failed to retrieve private key");
      }

      // Create connection to devnet
      const connection = new Connection(
        "https://api.devnet.solana.com",
        "confirmed"
      );

      // Create wallet keypair from private key
      const privateKeyBytes = bs58.decode(privateKeyString);
      const walletKeypair = Keypair.fromSecretKey(privateKeyBytes);

      toast({
        title: "Creating token",
        description: "Please wait while your token is being created...",
      });

      // Create new token mint
      const mintKeypair = Keypair.generate();
      console.log("Creating token mint...");
      const mintTx = await createMint(
        connection,
        walletKeypair,
        walletKeypair.publicKey,
        walletKeypair.publicKey,
        decimals,
        mintKeypair
      );

      console.log("Token mint created:", mintKeypair.publicKey.toString());
      console.log("Transaction signature:", mintTx);

      // Get or create associated token account
      console.log("Creating token account...");
      const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        walletKeypair,
        mintKeypair.publicKey,
        walletKeypair.publicKey
      );

      console.log("Token account created:", tokenAccount.address.toString());

      // Mint tokens to the wallet
      console.log("Minting tokens...");
      const mintToTx = await mintTo(
        connection,
        walletKeypair,
        mintKeypair.publicKey,
        tokenAccount.address,
        walletKeypair,
        supply * Math.pow(10, decimals)
      );

      console.log("Tokens minted, signature:", mintToTx);

      // Create metadata for the token
      console.log("Creating token metadata...");
      
      // Get the metadata account address
      const [metadataPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
          mintKeypair.publicKey.toBuffer(),
        ],
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
      );
      
      // Create the metadata transaction
      const metadataTx = new Transaction().add(
        createCreateMetadataAccountV3Instruction(
          {
            metadata: metadataPDA,
            mint: mintKeypair.publicKey,
            mintAuthority: walletKeypair.publicKey,
            payer: walletKeypair.publicKey,
            updateAuthority: walletKeypair.publicKey,
          },
          {
            createMetadataAccountArgsV3: {
              data: {
                name: tokenName,
                symbol: tokenSymbol,
                uri: "", // You could add a URI to a JSON file with more metadata
                sellerFeeBasisPoints: 0,
                creators: null,
                collection: null,
                uses: null,
              },
              isMutable: true,
              collectionDetails: null,
            },
          }
        )
      );
      
      // Send and confirm the metadata transaction
      const metadataTxId = await sendAndConfirmTransaction(
        connection,
        metadataTx,
        [walletKeypair]
      );
      
      console.log("Metadata created, signature:", metadataTxId);

      let mintAuthorityRevoked = false;
      let freezeAuthorityRevoked = false;

      // Revoke mint authority if selected
      if (revokeMintAuthority) {
        console.log("Revoking mint authority...");
        await setAuthority(
          connection,
          walletKeypair,
          mintKeypair.publicKey,
          walletKeypair,
          AuthorityType.MintTokens,
          null
        );
        console.log("Mint authority revoked");
        mintAuthorityRevoked = true;
      }

      // Revoke freeze authority if selected
      if (revokeFreezeAuthority) {
        console.log("Revoking freeze authority...");
        await setAuthority(
          connection,
          walletKeypair,
          mintKeypair.publicKey,
          walletKeypair,
          AuthorityType.FreezeAccount,
          null
        );
        console.log("Freeze authority revoked");
        freezeAuthorityRevoked = true;
      }

      // Set created token info
      setCreatedTokenInfo({
        mintAddress: mintKeypair.publicKey.toString(),
        tokenAccount: tokenAccount.address.toString(),
        txId: mintToTx,
        mintAuthorityRevoked,
        freezeAuthorityRevoked,
        name: tokenName,
        symbol: tokenSymbol,
        description: tokenDescription
      });

      toast({
        title: "Success",
        description: "SPL token created successfully with metadata!",
      });
    } catch (error) {
      console.error("Error creating SPL token:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create SPL token",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, description: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  // If not on devnet, show warning
  if (!isDevnet) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Create SPL Token</CardTitle>
          <CardDescription>Create your own SPL token on Solana</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Network Error</AlertTitle>
            <AlertDescription>
              SPL token creation is only available on devnet. Please switch to devnet to continue.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create SPL Token</CardTitle>
        <CardDescription>Create your own SPL token on Solana devnet</CardDescription>
      </CardHeader>
      <CardContent>
        {createdTokenInfo ? (
          <div className="space-y-4">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertTitle>Token Created Successfully!</AlertTitle>
              <AlertDescription>
                Your SPL token has been created on the Solana devnet.
                {createdTokenInfo.mintAuthorityRevoked && (
                  <p className="mt-2 text-sm">• Mint authority has been permanently revoked.</p>
                )}
                {createdTokenInfo.freezeAuthorityRevoked && (
                  <p className="text-sm">• Freeze authority has been permanently revoked.</p>
                )}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Token Name</Label>
              <Input value={createdTokenInfo.name} readOnly />
            </div>

            <div className="space-y-2">
              <Label>Token Symbol</Label>
              <Input value={createdTokenInfo.symbol} readOnly />
            </div>

            <div className="space-y-2">
              <Label>Token Mint Address</Label>
              <div className="flex items-center gap-2">
                <Input value={createdTokenInfo.mintAddress} readOnly />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(createdTokenInfo.mintAddress, "Token mint address copied")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Token Account</Label>
              <div className="flex items-center gap-2">
                <Input value={createdTokenInfo.tokenAccount} readOnly />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(createdTokenInfo.tokenAccount, "Token account address copied")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Transaction ID</Label>
              <div className="flex items-center gap-2">
                <Input value={createdTokenInfo.txId} readOnly />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(createdTokenInfo.txId, "Transaction ID copied")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="pt-4">
              <Button onClick={() => setCreatedTokenInfo(null)}>Create Another Token</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Devnet Only</AlertTitle>
              <AlertDescription>
                This will create an SPL token on the Solana devnet. These tokens are for testing only and have no real value.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="wallet">Select Wallet</Label>
              <select
                id="wallet"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedWallet}
                onChange={(e) => setSelectedWallet(e.target.value)}
                disabled={isLoading}
              >
                <option value="">Select a wallet</option>
                {eligibleWallets.map((wallet) => (
                  <option key={wallet.publicKey} value={wallet.publicKey}>
                    {wallet.name || wallet.publicKey.slice(0, 8) + '...'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tokenName">Token Name</Label>
              <Input
                id="tokenName"
                placeholder="My Token"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tokenSymbol">Token Symbol</Label>
              <Input
                id="tokenSymbol"
                placeholder="TKN"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                disabled={isLoading}
                maxLength={5}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tokenDescription">Token Description (Optional)</Label>
              <Textarea
                id="tokenDescription"
                placeholder="A description of your token"
                value={tokenDescription}
                onChange={(e) => setTokenDescription(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tokenDecimals">Decimals</Label>
                <Input
                  id="tokenDecimals"
                  type="number"
                  placeholder="9"
                  value={tokenDecimals}
                  onChange={(e) => setTokenDecimals(e.target.value)}
                  disabled={isLoading}
                  min="0"
                  max="9"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tokenSupply">Initial Supply</Label>
                <Input
                  id="tokenSupply"
                  type="number"
                  placeholder="1000000"
                  value={tokenSupply}
                  onChange={(e) => setTokenSupply(e.target.value)}
                  disabled={isLoading}
                  min="1"
                />
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="revokeMintAuthority" 
                  checked={revokeMintAuthority}
                  onCheckedChange={(checked) => setRevokeMintAuthority(checked === true)}
                  disabled={isLoading}
                />
                <Label 
                  htmlFor="revokeMintAuthority" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Revoke mint authority (prevents creating more tokens in the future)
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="revokeFreezeAuthority" 
                  checked={revokeFreezeAuthority}
                  onCheckedChange={(checked) => setRevokeFreezeAuthority(checked === true)}
                  disabled={isLoading}
                />
                <Label 
                  htmlFor="revokeFreezeAuthority" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Revoke freeze authority (prevents freezing token accounts in the future)
                </Label>
              </div>
            </div>

            <Button
              onClick={handleCreateToken}
              disabled={isLoading || !selectedWallet || !tokenName || !tokenSymbol}
              className="w-full mt-4"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Token...
                </>
              ) : (
                "Create SPL Token"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 