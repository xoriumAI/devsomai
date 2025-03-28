/**
 * Unified Supabase Client Architecture
 * 
 * This file provides a consistent interface for Supabase interactions across all environments:
 * - Client-side components
 * - Server components
 * - API routes
 * - Docker build environment
 * 
 * It handles proper environment variable loading and provides typed exports
 * to ensure consistency across the application.
 */

import { createClient } from '@supabase/supabase-js';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createServerComponentClient, createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Note: TypeScript types are exported from this file directly to avoid dependency issues
export type {
  User,
  Session,
  SupabaseClient,
  PostgrestError
} from '@supabase/supabase-js';

// Types for auth changes
export type AuthChangeEvent = 
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'PASSWORD_RECOVERY';

export interface AuthError {
  message: string;
  status?: number;
}

// Try to pre-load environment variables if we're in development
(function loadEnvVars() {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
      try {
        // Direct path loading
        const dotenv = require('dotenv');
        const path = require('path');
        const fs = require('fs');
        
        // Try to load from .env.local file first
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
          console.log('[supabase-unified] Loading environment variables from .env.local');
          dotenv.config({ path: envPath });
        }
      } catch (e) {
        console.log('[supabase-unified] Could not dynamically load dotenv, continuing with current env vars');
      }
    }
  } catch (e) {
    // Ignore any errors in non-Node environments
  }
})();

// Configuration with fallbacks
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://devsomain8n.lucidsro.com';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc0MzE2MDA4MCwiZXhwIjo0ODk4ODMzNjgwLCJyb2xlIjoiYW5vbiJ9.kqwFfG5Jmw4HasqGHwu17cFBruX4c_qZGS05iyurZco';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc0MzE2MDA4MCwiZXhwIjo0ODk4ODMzNjgwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.k90dfmi4jLGYe4SrQZPWEj34gIKBtKtbIcQh05JcVzs';

// Log environment status in development only
if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
  console.log('[supabase-unified] Environment status:');
  console.log(`- NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Using fallback'}`);
  console.log(`- NEXT_PUBLIC_SUPABASE_ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Using fallback'}`);
  console.log(`- SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Using fallback'}`);
}

// Warn if using fallbacks in non-development environments
if (process.env.NODE_ENV !== 'development' && 
   (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
  console.warn(`
    WARNING: Missing Supabase environment variables in ${process.env.NODE_ENV} environment!
    This may cause authentication or database access to fail.
  `);
}

// ==================== CLIENT-SIDE ====================

// Use a singleton pattern for the browser client
let browserClientInstance: ReturnType<typeof createClientComponentClient> | null = null;

/**
 * Get the Supabase client for use in browser components
 * Uses Next.js auth helpers optimized for client components
 */
export function getSupabaseClient() {
  if (typeof window === 'undefined') {
    throw new Error('getSupabaseClient should only be called from client components');
  }
  
  if (browserClientInstance) return browserClientInstance;
  
  browserClientInstance = createClientComponentClient({
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_ANON_KEY
  });
  
  return browserClientInstance;
}

// Export a singleton instance for direct imports (for backward compatibility)
export const supabase = typeof window !== 'undefined' ? getSupabaseClient() : null;

// ==================== SERVER-SIDE ====================

/**
 * Get the Supabase client for server components
 * This should be used in React Server Components
 */
export function getSupabaseServer() {
  if (typeof window !== 'undefined') {
    throw new Error('getSupabaseServer should only be called from server components');
  }
  
  return createServerComponentClient({ 
    cookies
  });
}

/**
 * Get the Supabase client for API route handlers
 * This should be used in Route Handlers (app dir) or API Routes (pages dir)
 */
export function getSupabaseRouteHandler() {
  if (typeof window !== 'undefined') {
    throw new Error('getSupabaseRouteHandler should only be called from route handlers');
  }
  
  const cookieStore = cookies();
  return createRouteHandlerClient({ 
    cookies: () => cookieStore
  });
}

// ==================== ADMIN CLIENT ====================

// Use a singleton pattern for the admin client
let adminClientInstance: ReturnType<typeof createClient> | null = null;

/**
 * Get a Supabase admin client with service role permissions
 * This has elevated permissions and should only be used server-side
 */
export function getSupabaseAdmin() {
  if (typeof window !== 'undefined') {
    throw new Error('getSupabaseAdmin should only be called from server-side code');
  }
  
  if (adminClientInstance) return adminClientInstance;
  
  adminClientInstance = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: 'supabase-admin-auth-token',
    }
  });
  
  return adminClientInstance;
}

// Export the admin instance for direct imports (for backward compatibility)
export const supabaseAdmin = typeof window === 'undefined' ? getSupabaseAdmin() : null; 