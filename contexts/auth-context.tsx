"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  Session,
  AuthError
} from '@supabase/supabase-js';
import { getSupabaseBrowser } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null; data: { user: User | null } }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Use a consistent supabase client
  const supabaseClient = getSupabaseBrowser();

  // Function to refresh the session
  const refreshSession = async () => {
    console.log("Manually refreshing auth session...");
    try {
      setIsLoading(true);
      
      // Get current session
      const { data: { session: currentSession }, error } = await supabaseClient.auth.getSession();
      
      if (error) {
        console.error("Error refreshing session:", error);
        return;
      }
      
      console.log("Refreshed session:", currentSession ? "exists" : "null");
      
      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
        console.log("User set from refreshed session:", currentSession.user.id);
      } else {
        // Try to refresh the session if it doesn't exist
        const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();
        
        if (refreshError) {
          console.error("Error during session refresh:", refreshError);
          return;
        }
        
        if (refreshData.session && refreshData.user) {
          setSession(refreshData.session);
          setUser(refreshData.user);
          console.log("User set from refreshed token:", refreshData.user.id);
        } else {
          setSession(null);
          setUser(null);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize auth state from Supabase
  useEffect(() => {
    console.log("Initializing auth state...");
    
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        
        // Get initial session
        const { data: { session: initialSession } } = await supabaseClient.auth.getSession();
        console.log("Initial session:", initialSession ? "exists" : "null");
        
        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          console.log("User set from initial session:", initialSession.user.id);
        } else {
          // Try to refresh the session if it doesn't exist
          try {
            const { data: refreshData } = await supabaseClient.auth.refreshSession();
            
            if (refreshData && refreshData.session && refreshData.user) {
              setSession(refreshData.session);
              setUser(refreshData.user);
              console.log("User set from refreshed token:", refreshData.user.id);
            } else {
              setSession(null);
              setUser(null);
            }
          } catch (refreshError) {
            console.error("Error during initial session refresh:", refreshError);
            setSession(null);
            setUser(null);
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeAuth();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      (event, newSession) => {
        console.log("Auth state change event:", event);
        console.log("New session:", newSession ? `exists for ${newSession.user.id}` : "null");
        
        if (newSession) {
          setSession(newSession);
          setUser(newSession.user);
          console.log("User state updated from auth change event");
        } else {
          setSession(null);
          setUser(null);
          console.log("User state cleared from auth change event");
        }
        
        // Handle sign in and sign out events
        if (event === 'SIGNED_IN' && newSession) {
          console.log("SIGNED_IN event detected with user:", newSession.user.id);
          console.log("Redirecting to dashboard...");
          
          // Force a router refresh and redirect with a delay to ensure state is updated
          setTimeout(() => {
            router.refresh();
            router.push('/dashboard');
            console.log("Navigation to dashboard triggered");
          }, 100);
        } else if (event === 'SIGNED_OUT') {
          console.log("SIGNED_OUT event detected");
          console.log("Redirecting to signin...");
          
          // Force a router refresh and redirect
          setTimeout(() => {
            router.refresh();
            router.push('/auth/signin');
            console.log("Navigation to signin triggered");
          }, 100);
        }
        
        setIsLoading(false);
      }
    );
    
    // Custom event listener for manual refresh
    const handleRefreshSession = () => {
      console.log("Custom refresh session event received");
      refreshSession();
    };
    
    window.addEventListener('supabase.auth.refreshSession', handleRefreshSession);

    return () => {
      // Check if subscription exists before trying to unsubscribe
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
      window.removeEventListener('supabase.auth.refreshSession', handleRefreshSession);
    };
  }, [router, supabaseClient]);

  const signIn = async (email: string, password: string) => {
    console.log("Sign in request with email:", email);
    setIsLoading(true);
    
    try {
      // Direct Supabase client login
      const { data, error } = await supabaseClient.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      console.log("Sign in response:", error ? `Error: ${error.message}` : "Success");
      
      if (error) {
        setIsLoading(false);
        return { error };
      }
      
      console.log("Sign in successful, session:", data.session ? "exists" : "null");
      console.log("User from sign in:", data.user?.id);
      
      // Manually update our state since sometimes the onAuthStateChange can be delayed
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        
        // Force a router refresh to update auth state in middleware
        console.log("Forcing navigation to dashboard after sign in");
        
        // Directly navigate to dashboard with a delay for state updates
        setTimeout(() => {
          router.refresh();
          router.push('/dashboard');
          console.log("Dashboard redirect triggered from signIn function");
        }, 500);
      }
      
      return { error: null };
    } catch (error) {
      console.error("Exception during sign in:", error);
      setIsLoading(false);
      return { error: error as AuthError };
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    console.log("Sign up request with email:", email);
    setIsLoading(true);
    
    try {
      const result = await supabaseClient.auth.signUp({ email, password });
      console.log("Sign up result:", result.error ? "error" : "success");
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    console.log("Sign out request");
    setIsLoading(true);
    
    try {
      // First, manually clear auth state before the API call
      setUser(null);
      setSession(null);
      
      // Call Supabase signOut
      const { error } = await supabaseClient.auth.signOut();
      if (error) {
        console.error("Error during sign out:", error);
        throw error;
      }

      console.log("Sign out successful");
      
      // Force a router refresh and redirect
      console.log("Forcing navigation to signin after sign out");
      
      // Clear any auth cookies or local storage
      document.cookie = "supabase-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "sb-access-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "sb-refresh-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      localStorage.removeItem("supabase.auth.token");
      localStorage.removeItem("supabase-auth-token-v2");
      
      // Hard navigate to sign in page after a short delay
      setTimeout(() => {
        router.refresh();
        router.push('/auth/signin');
        console.log("Signin redirect triggered from signOut function");
      }, 100);
    } catch (error) {
      console.error("Exception during sign out:", error);
      
      // Even on error, attempt to redirect to signin
      setTimeout(() => {
        router.refresh();
        router.push('/auth/signin');
      }, 100);
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    console.log("Reset password request for email:", email);
    setIsLoading(true);
    
    try {
      const result = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      console.log("Reset password result:", result.error ? "error" : "success");
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    session,
    isLoading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 