import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWalletStore } from "@/store/wallet-store";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload } from "lucide-react";

export function WalletGroup({ groupName, title }: { groupName: string; title: string }) {
  const { wallets, getPrivateKey, addWallet } = useWalletStore();
  const { toast } = useToast();
  const groupWallets = wallets.filter(w => w.groupName === groupName && !w.archived);

  const handleExportWallets = async () => {
    try {
      const backupContent = [];
      
      for (const wallet of groupWallets) {
        if (!wallet.encryptedPrivateKey) continue; // Skip CEX wallets
        
        try {
          const privateKey = await getPrivateKey(wallet.publicKey);
          if (privateKey) {
            backupContent.push(`${wallet.publicKey}:${privateKey}`);
          }
        } catch (error) {
          console.error(`Failed to decrypt wallet ${wallet.publicKey}:`, error);
          continue;
        }
      }

      if (backupContent.length === 0) {
        toast({
          title: "No wallets to export",
          description: "No wallets with private keys found in this group",
          variant: "destructive",
        });
        return;
      }

      const blob = new Blob([backupContent.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${groupName}-wallets-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: `${backupContent.length} wallets exported successfully`,
      });
    } catch (error) {
      console.error('Error exporting wallets:', error);
      toast({
        title: "Error",
        description: "Failed to export wallets",
        variant: "destructive",
      });
    }
  };

  const handleImportWallets = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.txt';
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
          const content = event.target?.result as string;
          const lines = content.split('\n').filter(line => line.trim());
          
          let importedCount = 0;
          let errorCount = 0;

          for (const line of lines) {
            try {
              const [publicKey, privateKey] = line.split(':');
              if (!publicKey || !privateKey) {
                errorCount++;
                continue;
              }

              // Check if wallet already exists
              const exists = wallets.some(w => w.publicKey === publicKey);
              if (exists) {
                errorCount++;
                continue;
              }

              await addWallet({
                publicKey,
                privateKey,
                name: `Imported ${publicKey.slice(0, 4)}...`,
                groupName,
              });
              
              importedCount++;
            } catch (error) {
              console.error('Error importing wallet:', error);
              errorCount++;
            }
          }

          toast({
            title: "Import complete",
            description: `Successfully imported ${importedCount} wallets${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
            variant: importedCount > 0 ? "default" : "destructive",
          });
        };

        reader.readAsText(file);
      };

      input.click();
    } catch (error) {
      console.error('Error importing wallets:', error);
      toast({
        title: "Error",
        description: "Failed to import wallets",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title} ({groupWallets.length})
        </CardTitle>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportWallets}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportWallets}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* ... rest of existing content ... */}
      </CardContent>
    </Card>
  );
} 