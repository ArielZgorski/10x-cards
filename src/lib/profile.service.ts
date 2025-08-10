/**
 * Profile Service
 * 
 * Handles business logic for user profile operations.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../db/database.types';
import type { ProfileDTO, UpdateProfileCommand, UUID } from '../types';

type SupabaseClient = ReturnType<typeof createClient<Database>>;

/**
 * Get user profile
 */
export async function getProfile(
  supabase: SupabaseClient,
  userId: UUID
): Promise<ProfileDTO | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select()
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Profile not found
    }
    throw new Error(`Failed to get profile: ${error.message}`);
  }

  return mapProfileEntityToDTO(data);
}

/**
 * Create or update user profile
 */
export async function upsertProfile(
  supabase: SupabaseClient,
  userId: UUID,
  command: UpdateProfileCommand
): Promise<ProfileDTO> {
  const updates: any = { id: userId };

  if (command.display_name !== undefined) updates.display_name = command.display_name;
  if (command.timezone !== undefined) updates.timezone = command.timezone;
  if (command.locale !== undefined) updates.locale = command.locale;

  const { data, error } = await supabase
    .from('profiles')
    .upsert(updates, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  return mapProfileEntityToDTO(data);
}

/**
 * Validate timezone string (basic IANA check)
 */
export function validateTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate locale string (basic BCP 47 check)
 */
export function validateLocale(locale: string): boolean {
  try {
    new Intl.Locale(locale);
    return true;
  } catch {
    return false;
  }
}

/**
 * Map database entity to DTO
 */
function mapProfileEntityToDTO(entity: Database['public']['Tables']['profiles']['Row']): ProfileDTO {
  return {
    id: entity.id,
    display_name: entity.display_name,
    timezone: entity.timezone,
    locale: entity.locale,
    created_at: entity.created_at,
    updated_at: entity.updated_at,
  };
}
