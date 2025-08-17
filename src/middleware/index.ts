import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database/types/database.types.ts";

export const onRequest = defineMiddleware((context, next) => {
  // DISABLED - No auth middleware
  return next();
});
