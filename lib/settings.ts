export interface Settings {
  rpc: {
    http: string;
    ws: string;
  };
  refreshInterval: number;
  rateLimit: {
    maxRequestsPerSecond: number;
    maxRequestsPerMinute: number;
    maxConcurrentRequests: number;
  };
  network: 'mainnet-beta' | 'devnet';
}

// Default settings
const defaultSettings: Settings = {
  rpc: {
    http: 'https://api.mainnet-beta.solana.com',  // Changed to official Solana RPC
    ws: 'wss://api.mainnet-beta.solana.com',
  },
  refreshInterval: 10000,
  rateLimit: {
    maxRequestsPerSecond: 2,
    maxRequestsPerMinute: 50,
    maxConcurrentRequests: 3
  },
  network: 'mainnet-beta'
};

// Fallback RPC endpoints with rate limits
export const FALLBACK_ENDPOINTS = [
  {
    http: 'https://api.mainnet-beta.solana.com',
    ws: 'wss://api.mainnet-beta.solana.com',
    rateLimit: { maxRequestsPerSecond: 2, maxRequestsPerMinute: 80 }
  },
  {
    http: 'https://solana-api.projectserum.com',
    ws: 'wss://solana-api.projectserum.com',
    rateLimit: { maxRequestsPerSecond: 5, maxRequestsPerMinute: 150 }
  },
  {
    http: 'https://rpc.ankr.com/solana',
    ws: 'wss://rpc.ankr.com/solana/ws',
    rateLimit: { maxRequestsPerSecond: 3, maxRequestsPerMinute: 100 }
  }
];

// Devnet endpoints
export const DEVNET_ENDPOINTS = [
  {
    http: 'https://api.devnet.solana.com',
    ws: 'wss://api.devnet.solana.com',
    rateLimit: { maxRequestsPerSecond: 4, maxRequestsPerMinute: 100 }
  }
];

// Event emitter for settings changes
const settingsChangeCallbacks: ((settings: Settings) => void)[] = [];

export function onSettingsChange(callback: (settings: Settings) => void) {
  settingsChangeCallbacks.push(callback);
  return () => {
    const index = settingsChangeCallbacks.indexOf(callback);
    if (index > -1) {
      settingsChangeCallbacks.splice(index, 1);
    }
  };
}

// Rate limiter implementation
class RateLimiter {
  private requests: number[] = [];
  private concurrentRequests: number = 0;
  private readonly settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  async acquirePermit(): Promise<boolean> {
    const now = Date.now();
    // Remove old requests
    this.requests = this.requests.filter(time => now - time < 60000);
    
    // Check rate limits
    if (
      this.concurrentRequests >= this.settings.rateLimit.maxConcurrentRequests ||
      this.requests.filter(time => now - time < 1000).length >= this.settings.rateLimit.maxRequestsPerSecond ||
      this.requests.length >= this.settings.rateLimit.maxRequestsPerMinute
    ) {
      return false;
    }

    this.requests.push(now);
    this.concurrentRequests++;
    return true;
  }

  releasePermit() {
    this.concurrentRequests = Math.max(0, this.concurrentRequests - 1);
  }
}

// Global rate limiter instance
let rateLimiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!rateLimiter) {
    rateLimiter = new RateLimiter(loadSettings());
  }
  return rateLimiter;
}

// Test RPC connection and measure latency
export async function testRPCConnection(endpoint: string): Promise<number> {
  const start = performance.now();
  let lastError: Error | null = null;
  
  // Try the main endpoint first
  try {
    const result = await testSingleEndpoint(endpoint);
    return result;
  } catch (error) {
    lastError = error instanceof Error ? error : new Error('Unknown error');
    
    // If we get a rate limit error, try fallback endpoints
    if (lastError.message.includes('rate limit')) {
      for (const fallback of FALLBACK_ENDPOINTS) {
        if (fallback.http === endpoint) continue; // Skip if it's the same as the failed endpoint
        
        try {
          const result = await testSingleEndpoint(fallback.http);
          // If fallback succeeds, suggest using this endpoint instead
          throw new Error(`Current endpoint is rate limited. Try using ${fallback.http} instead.`);
        } catch (fallbackError) {
          if (!(fallbackError instanceof Error) || !fallbackError.message.includes('rate limit')) {
            // If it's not a rate limit error, continue trying other fallbacks
            continue;
          }
        }
      }
    }
    
    // If we get here, all endpoints failed or original error wasn't rate limiting
    throw lastError;
  }
}

async function testSingleEndpoint(endpoint: string): Promise<number> {
  const limiter = getRateLimiter();
  
  while (!(await limiter.acquirePermit())) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  try {
    const start = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getHealth',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      throw new Error('RPC rate limit exceeded. Please try a different endpoint or wait a moment.');
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || 'RPC request failed');
    }

    const end = performance.now();
    return end - start;
  } catch (error) {
    throw error;
  } finally {
    limiter.releasePermit();
  }
}

// Test WebSocket connection and measure latency
export async function testWSConnection(endpoint: string): Promise<number> {
  let lastError: Error | null = null;
  
  // Try the main endpoint first
  try {
    const result = await testSingleWSEndpoint(endpoint);
    return result;
  } catch (error) {
    lastError = error instanceof Error ? error : new Error('Unknown error');
    
    // If we get a rate limit error, try fallback endpoints
    if (lastError.message.includes('rate limit')) {
      for (const fallback of FALLBACK_ENDPOINTS) {
        if (fallback.ws === endpoint) continue; // Skip if it's the same as the failed endpoint
        
        try {
          const result = await testSingleWSEndpoint(fallback.ws);
          // If fallback succeeds, suggest using this endpoint instead
          throw new Error(`Current endpoint is rate limited. Try using ${fallback.ws} instead.`);
        } catch (fallbackError) {
          if (!(fallbackError instanceof Error) || !fallbackError.message.includes('rate limit')) {
            // If it's not a rate limit error, continue trying other fallbacks
            continue;
          }
        }
      }
    }
    
    // If we get here, all endpoints failed or original error wasn't rate limiting
    throw lastError;
  }
}

async function testSingleWSEndpoint(endpoint: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    let ws: WebSocket | null = null;
    let timeoutId: NodeJS.Timeout;
    
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        ws.close();
        ws = null;
      }
    };

    try {
      ws = new WebSocket(endpoint);
    } catch (error) {
      cleanup();
      reject(new Error('Invalid WebSocket URL'));
      return;
    }
    
    // Set a 10 second timeout for the entire test
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('WebSocket connection timeout'));
    }, 10000);

    ws.onopen = () => {
      try {
        if (!ws) return;
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getHealth',
        }));
      } catch (error) {
        cleanup();
        reject(new Error('Failed to send WebSocket test message'));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error && data.error.code === -32005) {
          cleanup();
          reject(new Error('WebSocket rate limit exceeded'));
          return;
        }
        const end = performance.now();
        cleanup();
        resolve(end - start);
      } catch (error) {
        cleanup();
        reject(new Error('Invalid WebSocket response'));
      }
    };

    ws.onerror = () => {
      cleanup();
      reject(new Error('WebSocket connection failed'));
    };

    ws.onclose = (event) => {
      if (!event.wasClean) {
        cleanup();
        reject(new Error('WebSocket connection closed unexpectedly'));
      }
    };
  });
}

// Load settings from localStorage if available
export function loadSettings(): Settings {
  if (typeof window === 'undefined') return serverSettings || defaultSettings;
  
  try {
    const savedSettings = localStorage.getItem('wallet-manager-settings');
    if (savedSettings) {
      return { ...defaultSettings, ...JSON.parse(savedSettings) };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  
  return defaultSettings;
}

// Server-side settings storage
let serverSettings: Settings | null = null;

// Get current settings
export function getSettings(): Settings {
  // For server-side code
  if (typeof window === 'undefined') {
    return serverSettings || defaultSettings;
  }
  
  // For client-side code
  return loadSettings();
}

// Update the switchNetwork function to also update server-side settings
export function switchNetwork(network: 'mainnet-beta' | 'devnet') {
  const settings = getSettings();
  
  // If already on the selected network, do nothing
  if (settings.network === network) return settings;
  
  // Get appropriate endpoints for the selected network
  let endpoint;
  if (network === 'devnet') {
    endpoint = DEVNET_ENDPOINTS[0];
  } else {
    endpoint = FALLBACK_ENDPOINTS[0];
  }
  
  // Create updated settings
  const updatedSettings = {
    ...settings,
    network,
    rpc: {
      http: endpoint.http,
      ws: endpoint.ws,
    }
  };
  
  // Update server-side settings
  serverSettings = updatedSettings;
  
  // Update client-side settings if in browser
  if (typeof window !== 'undefined') {
    localStorage.setItem('wallet-manager-settings', JSON.stringify(updatedSettings));
    
    // Force a reload of the page to ensure all components use the new network
    window.location.reload();
  }
  
  // Notify all listeners of the network change
  settingsChangeCallbacks.forEach(callback => callback(updatedSettings));
  
  return updatedSettings;
}

// Update saveSettings to also update server-side settings
export function saveSettings(settings: Partial<Settings>) {
  if (typeof window === 'undefined') {
    // Server-side: update server settings
    serverSettings = { ...(serverSettings || defaultSettings), ...settings };
    return serverSettings;
  }
  
  try {
    const currentSettings = loadSettings();
    const newSettings = { ...currentSettings, ...settings };
    localStorage.setItem('wallet-manager-settings', JSON.stringify(newSettings));
    
    // Also update server-side settings
    serverSettings = newSettings;
    
    // Notify all listeners of the settings change
    settingsChangeCallbacks.forEach(callback => callback(newSettings));
    
    return newSettings;
  } catch (error) {
    console.error('Error saving settings:', error);
    return loadSettings();
  }
}

// Update RPC endpoints
export function updateRPCEndpoints(http: string, ws?: string) {
  const wsEndpoint = ws || http.replace('https://', 'wss://');
  return saveSettings({
    rpc: {
      http,
      ws: wsEndpoint,
    },
  });
} 