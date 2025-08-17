/**
 * Deck Service
 * 
 * Handles business logic for deck CRUD operations and deck-related
 * database operations.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../db/database.types';
import type { DeckDTO, CreateDeckCommand, UpdateDeckCommand, UUID } from '../types';

type SupabaseClient = ReturnType<typeof createClient<Database>>;

/**
 * Generate slug from deck name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Ensure unique slug for user
 */
async function ensureUniqueSlug(
  supabase: SupabaseClient,
  userId: UUID,
  baseSlug: string,
  excludeId?: UUID
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    let query = supabase
      .from('decks')
      .select('id')
      .eq('user_id', userId)
      .eq('slug', slug);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query.single();

    if (error && error.code === 'PGRST116') {
      // No existing deck with this slug
      return slug;
    }

    if (error) {
      throw new Error(`Failed to check slug uniqueness: ${error.message}`);
    }

    // Slug exists, try with counter
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

/**
 * Create a new deck
 */
export async function createDeck(
  supabase: SupabaseClient,
  userId: UUID,
  command: CreateDeckCommand
): Promise<DeckDTO> {
  const baseSlug = command.slug || generateSlug(command.name);
  const uniqueSlug = await ensureUniqueSlug(supabase, userId, baseSlug);

  const { data, error } = await supabase
    .from('decks')
    .insert({
      user_id: userId,
      name: command.name,
      slug: uniqueSlug,
      language_code: command.language_code || null,
      is_archived: command.is_archived || false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create deck: ${error.message}`);
  }

  return mapDeckEntityToDTO(data);
}

/**
 * Get decks for a user with filtering and pagination
 */
export async function getDecks(
  supabase: SupabaseClient,
  userId: UUID,
  options: {
    page?: number;
    per_page?: number;
    is_archived?: boolean;
    search?: string;
    sort?: 'created_at' | 'updated_at' | 'name';
    order?: 'asc' | 'desc';
  } = {}
): Promise<{ items: DeckDTO[]; total: number; page: number; per_page: number }> {
  const {
    page = 1,
    per_page = 20,
    is_archived = false,
    search,
    sort = 'updated_at',
    order = 'desc'
  } = options;

  const limit = Math.min(per_page, 100);
  const offset = (page - 1) * limit;

  let query = supabase
    .from('decks')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_archived', is_archived);

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  query = query.order(sort, { ascending: order === 'asc' });
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to get decks: ${error.message}`);
  }

  return {
    items: (data || []).map(mapDeckEntityToDTO),
    total: count || 0,
    page,
    per_page: limit
  };
}

/**
 * Get a single deck by ID
 */
export async function getDeckById(
  supabase: SupabaseClient,
  deckId: UUID,
  userId: UUID
): Promise<DeckDTO | null> {
  const { data, error } = await supabase
    .from('decks')
    .select()
    .eq('id', deckId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get deck: ${error.message}`);
  }

  return mapDeckEntityToDTO(data);
}

/**
 * Update a deck
 */
export async function updateDeck(
  supabase: SupabaseClient,
  deckId: UUID,
  userId: UUID,
  command: UpdateDeckCommand
): Promise<DeckDTO> {
  const updates: any = {};

  if (command.name !== undefined) updates.name = command.name;
  if (command.language_code !== undefined) updates.language_code = command.language_code;
  if (command.is_archived !== undefined) updates.is_archived = command.is_archived;

  // Handle slug update
  if (command.slug !== undefined || command.name !== undefined) {
    const newSlug = command.slug || (command.name ? generateSlug(command.name) : undefined);
    if (newSlug) {
      updates.slug = await ensureUniqueSlug(supabase, userId, newSlug, deckId);
    }
  }

  const { data, error } = await supabase
    .from('decks')
    .update(updates)
    .eq('id', deckId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update deck: ${error.message}`);
  }

  return mapDeckEntityToDTO(data);
}

/**
 * Soft delete a deck (archive)
 */
export async function archiveDeck(
  supabase: SupabaseClient,
  deckId: UUID,
  userId: UUID
): Promise<void> {
  const { error } = await supabase
    .from('decks')
    .update({ is_archived: true })
    .eq('id', deckId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to archive deck: ${error.message}`);
  }
}

/**
 * Restore an archived deck
 */
export async function restoreDeck(
  supabase: SupabaseClient,
  deckId: UUID,
  userId: UUID
): Promise<DeckDTO> {
  return updateDeck(supabase, deckId, userId, { is_archived: false });
}

/**
 * Hard delete a deck and all its cards
 */
export async function hardDeleteDeck(
  supabase: SupabaseClient,
  deckId: UUID,
  userId: UUID
): Promise<void> {
  const { error } = await supabase
    .from('decks')
    .delete()
    .eq('id', deckId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete deck: ${error.message}`);
  }
}

/**
 * Map database entity to DTO
 */
function mapDeckEntityToDTO(entity: Database['public']['Tables']['decks']['Row']): DeckDTO {
  return {
    id: entity.id,
    name: entity.name,
    slug: entity.slug,
    language_code: entity.language_code,
    is_archived: entity.is_archived,
    created_at: entity.created_at,
    updated_at: entity.updated_at,
  };
}
