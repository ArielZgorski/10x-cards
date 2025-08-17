/// <reference types="astro/client" />

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database/types/database.types.ts";

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient<Database>;
    }
  }
}

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  readonly OPENROUTER_API_KEY: string;
  readonly DEFAULT_OPENROUTER_MODEL?: string;
  readonly APP_REFERER?: string;
  readonly APP_TITLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
