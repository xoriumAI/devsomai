"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useWalletStore } from "@/store/wallet-store";
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import { 
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createMintToInstruction
} from "@solana/spl-token";
import bs58 from "bs58";
import { decrypt } from "@/lib/encryption";

const MODES = [
  { value: "experimental", label: "Experimental" },
  { value: "standard", label: "Standard" },
];

const SENDING_MODES = [
  { value: "jito", label: "jito" },
  { value: "standard", label: "Standard" },
];

const ENDPOINTS = {
  mainnet: "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
};

export function TokenLaunch() {
  const [mode, setMode] = useState("experimental");
  const [sendingMode, setSendingMode] = useState("jito");
  const [vanityTokenMint, setVanityTokenMint] = useState(true);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");
  const [launchDelay, setLaunchDelay] = useState("5000");
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { wallets } = useWalletStore();
  const { toast } = useToast();

  const activeWallets = wallets.filter(w => !w.archived && w.encryptedPrivateKey && w.groupName === 'dev');

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "Error",
          description: "Image size must be less than 5MB",
          variant: "destructive",
        });
        return;
      }

      // Create a new File object with proper type
      const imageFile = new File([file], file.name, {
        type: file.type || 'image/png'
      });

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(imageFile);
      setImageFile(imageFile);
    }
  };

  const uploadImageToIPFS = async (file: File, walletPublicKey: string): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('wallet', walletPublicKey);

      const response = await fetch('/api/upload/ipfs', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload image to Solana storage');
      }

      const data = await response.json();
      
      if (!data.url || !data.url.startsWith('solana://')) {
        throw new Error('Invalid storage URL returned');
      }
      
      return data.url;
    } catch (error) {
      console.error('Image upload error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to upload image');
    }
  };

  const createMetadata = async (imageUrl: string, walletPublicKey: string) => {
    try {
      const metadata = {
        name,
        symbol,
        description,
        image: imageUrl,
        external_url: website,
        properties: {
          files: [{ uri: imageUrl, type: "image/png" }],
          category: "image",
        },
        links: {
          twitter,
          telegram,
          website,
        },
      };

      const response = await fetch('/api/metadata/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata,
          walletPublicKey,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create metadata');
      }

      const data = await response.json();
      
      if (!data.uri || !data.uri.startsWith('solana://')) {
        throw new Error('Invalid metadata URI returned');
      }

      return data.uri;
    } catch (error) {
      console.error('Metadata creation error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create metadata');
    }
  };

  const handleCreateToken = async () => {
    if (!name || !symbol || !imageFile) {
      toast({
        title: "Error",
        description: "Please fill in all required fields and upload an image",
        variant: "destructive",
      });
      return;
    }

    if (activeWallets.length === 0) {
      toast({
        title: "Error",
        description: "No active development wallet available. Please create a wallet in the 'dev' group first.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);

      // Add artificial delay if specified
      if (parseInt(launchDelay) > 0) {
        await new Promise(resolve => setTimeout(resolve, parseInt(launchDelay)));
      }

      // Upload image to Pinata
      const imageUrl = await uploadImageToIPFS(imageFile, activeWallets[0].publicKey);
      console.log('Image uploaded:', imageUrl);
      
      // Create and upload metadata
      const metadataUri = await createMetadata(imageUrl, activeWallets[0].publicKey);
      console.log('Metadata created:', metadataUri);

      // Create token
      const response = await fetch("/api/token/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          symbol,
          description,
          metadataUri,
          walletPublicKey: activeWallets[0].publicKey,
          network: mode === "experimental" ? ENDPOINTS.devnet : ENDPOINTS.mainnet,
          sendingMode,
          vanityTokenMint,
          decimals: 9, // Standard decimals for Solana tokens
          supply: 1000000000, // Initial supply of 1 billion tokens
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create token");
      }

      const data = await response.json();
      console.log('Token created:', data);

      toast({
        title: "Success",
        description: `Token created successfully! Mint address: ${data.mintAddress}`,
      });

      // Reset form
      handleClear();
    } catch (error) {
      console.error("Error creating token:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create token",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setName("");
    setSymbol("");
    setDescription("");
    setTwitter("");
    setTelegram("");
    setWebsite("");
    setLaunchDelay("5000");
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Manage Launch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  {MODES.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sending Mode</Label>
              <Select value={sendingMode} onValueChange={setSendingMode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sending mode" />
                </SelectTrigger>
                <SelectContent>
                  {SENDING_MODES.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Vanity Token Mint</Label>
              <Switch
                checked={vanityTokenMint}
                onCheckedChange={setVanityTokenMint}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Token Name</Label>
            <Input
              placeholder="Fortune And Greed"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label>Token Symbol</Label>
            <Input
              placeholder="GREED"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label>Token Description</Label>
            <Input
              placeholder="Is greed still good?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Twitter</Label>
              <Input
                placeholder="https://x.com/search?q="
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label>Telegram</Label>
              <Input
                placeholder="Telegram link"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                placeholder="Website URL"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Launch Delay (ms)</Label>
            <Input
              type="number"
              min="0"
              placeholder="5000"
              value={launchDelay}
              onChange={(e) => setLaunchDelay(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageUpload}
              disabled={isLoading}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="w-full bg-secondary hover:bg-secondary/90"
            >
              {imageFile ? 'Change Image' : 'Upload Image'}
            </Button>
            {imagePreview && (
              <div className="mt-2">
                <img
                  src={imagePreview}
                  alt="Token preview"
                  className="max-w-full h-auto rounded-lg"
                  style={{ maxHeight: '200px' }}
                />
              </div>
            )}
          </div>

          {mode === "experimental" && (
            <Alert>
              <AlertTitle>Experimental Mode</AlertTitle>
              <AlertDescription>
                You are in experimental mode. Tokens will be created on the Devnet.
                Make sure you have enough devnet SOL.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-between gap-4">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleClear}
              disabled={isLoading}
            >
              Clear
            </Button>

            <Button
              className="flex-1"
              onClick={handleCreateToken}
              disabled={isLoading}
            >
              {isLoading ? "Creating..." : "Save"}
            </Button>

            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleClear}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 