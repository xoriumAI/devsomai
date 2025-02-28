"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSettings, testRPCConnection, testWSConnection } from "@/lib/settings";
import { useToast } from "@/hooks/use-toast";

interface ConnectionTest {
  latency: number | null;
  lastTested: Date | null;
  error: string | null;
}

interface Settings {
  rpc: {
    http: string;
    ws: string;
  };
}

export function ConnectionStatus() {
  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [rpcTest, setRpcTest] = useState<ConnectionTest>({
    latency: null,
    lastTested: null,
    error: null,
  });
  const [wsTest, setWsTest] = useState<ConnectionTest>({
    latency: null,
    lastTested: null,
    error: null,
  });

  useEffect(() => {
    // Load settings on client side only
    setSettings(getSettings());
  }, []);

  const handleTest = async () => {
    if (isTesting || !settings) return;
    setIsTesting(true);

    try {
      // Test RPC connection
      const rpcLatency = await testRPCConnection(settings.rpc.http);
      setRpcTest({
        latency: rpcLatency,
        lastTested: new Date(),
        error: null,
      });

      // Test WebSocket connection
      const wsLatency = await testWSConnection(settings.rpc.ws);
      setWsTest({
        latency: wsLatency,
        lastTested: new Date(),
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
      toast({
        title: "Connection Test Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    if (settings) {
      // Test connections once when settings are loaded
      handleTest();

      // Test connections every 5 minutes
      const interval = setInterval(() => {
        if (!isTesting) {
          handleTest();
        }
      }, 5 * 60 * 1000);

      return () => {
        clearInterval(interval);
      };
    }
  }, [settings]); // Run when settings are loaded

  const formatLatency = (latency: number | null) => {
    if (latency === null) return 'N/A';
    return `${latency.toFixed(0)}ms`;
  };

  const formatLastTested = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleTimeString();
  };

  if (!settings) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Connection Status</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            Loading settings...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Connection Status</CardTitle>
          <Button 
            variant="outline" 
            onClick={handleTest}
            disabled={isTesting}
          >
            {isTesting ? "Testing..." : "Test Connection"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-md border p-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">RPC:</span>
              <code className="text-sm">{settings.rpc.http}</code>
            </div>
            <div className="text-sm text-muted-foreground">
              {rpcTest.error ? (
                <span className="text-destructive">{rpcTest.error}</span>
              ) : (
                <>
                  Latency: {formatLatency(rpcTest.latency)}
                  <span className="mx-2">•</span>
                  Last tested: {formatLastTested(rpcTest.lastTested)}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-md border p-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">WebSocket:</span>
              <code className="text-sm">{settings.rpc.ws}</code>
            </div>
            <div className="text-sm text-muted-foreground">
              {wsTest.error ? (
                <span className="text-destructive">{wsTest.error}</span>
              ) : (
                <>
                  Latency: {formatLatency(wsTest.latency)}
                  <span className="mx-2">•</span>
                  Last tested: {formatLastTested(wsTest.lastTested)}
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 