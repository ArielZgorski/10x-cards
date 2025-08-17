import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';

// According to auth-spec.md - use PUBLIC_ variables for client-side
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_KEY || import.meta.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// Client-side Supabase client for browser usage
export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

// Server-side Supabase client creator for API routes
export function createServerSupabaseClient(
  accessToken?: string
): SupabaseClient<Database> {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: accessToken 
        ? { Authorization: `Bearer ${accessToken}` }
        : {}
    }
  });
}

// Admin client for service operations (uses service role key)
export function createAdminSupabaseClient(): SupabaseClient<Database> {
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }
  
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

// Type exports for convenience
export type { Database, SupabaseClient };