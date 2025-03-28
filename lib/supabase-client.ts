/**
 * Mock client-side Supabase client configuration
 * This file provides mock Supabase clients for the build to succeed
 */

// Mock client type
type SupabaseClient = {
  auth: {
    getSession: () => Promise<any>;
    refreshSession: () => Promise<any>;
    signInWithPassword: (credentials: any) => Promise<any>;
    signUp: (credentials: any) => Promise<any>;
    signOut: () => Promise<any>;
    resetPasswordForEmail: (email: string, options?: any) => Promise<any>;
    onAuthStateChange: (callback: any) => { data: { subscription: any } };
  }
};

/**
 * Create a mock client that satisfies TypeScript interfaces but doesn't use actual Supabase SDK
 */
function createMockClient(): SupabaseClient {
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      refreshSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
      signUp: async () => ({ data: { user: null, session: null }, error: null }),
      signOut: async () => ({ error: null }),
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      onAuthStateChange: () => ({ data: { subscription: null } })
    }
  };
}

// Create a singleton for the browser client
let browserClient: SupabaseClient | null = null;

/**
 * Get a Supabase client for use in browser components
 * Uses a mock implementation for the Docker build
 */
export function getSupabaseBrowser() {
  if (browserClient) return browserClient;
  
  // Create the mock client
  browserClient = createMockClient();
  
  return browserClient;
}

/**
 * Get a Supabase admin client with the service role
 * This returns a mock implementation for the Docker build
 */
export function getSupabaseAdmin() {
  return createMockClient();
}

// Default client export for backward compatibility
export const supabase = getSupabaseBrowser();

// Export types
export type User = any; 
export type Session = any; 