import { defineMiddleware } from 'astro:middleware';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../db/database.types.ts';

export const onRequest = defineMiddleware((context, next) => {
  const supabaseUrl = import.meta.env.SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.SUPABASE_KEY;
  const authHeader = context.request.headers.get('authorization') || undefined;

  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
  });

  context.locals.supabase = supabase;
  return next();
});