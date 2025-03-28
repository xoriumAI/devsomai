// Mock supabase client for TypeScript compatibility
// This is a placeholder to make the build succeed

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

// Create a mock supabase client
const createMockClient = (): SupabaseClient => {
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
};

// Export a mock factory function
export function getSupabaseClient() {
  return createMockClient();
}

// Export a mock client instance
export const supabase = createMockClient();

// Export types
export type User = any;
export type Session = any;