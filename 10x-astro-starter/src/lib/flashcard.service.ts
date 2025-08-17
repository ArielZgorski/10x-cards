/**
 * Flashcard Service
 * 
 * Handles business logic for flashcard/card CRUD operations, SRS calculations,
 * and card-related database operations.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../db/database.types';
import type { CardDTO, CreateCardCommand, UpdateCardCommand, UUID } from '../types';

type SupabaseClient = ReturnType<typeof createClient<Database>>;

/**
 * Create a new card in a deck
 */
export async function createCard(
  supabase: SupabaseClient,
  deckId: UUID,
  userId: UUID,
  command: CreateCardCommand
): Promise<CardDTO> {
  const { data, error } = await supabase
    .from('cards')
    .insert({
      user_id: userId,
      deck_id: deckId,
      front: command.front,
      back: command.back,
      language_code: command.language_code || null,
      source: 'manual',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create card: ${error.message}`);
  }

  return mapCardEntityToDTO(data);
}

/**
 * Get cards in a deck with filtering and pagination
 */
export async function getCardsInDeck(
  supabase: SupabaseClient,
  deckId: UUID,
  userId: UUID,
  options: {
    page?: number;
    per_page?: number;
    is_archived?: boolean;
    source?: 'manual' | 'ai';
    due_before?: string;
    sort?: 'created_at' | 'updated_at' | 'due_at' | 'interval_days';
    order?: 'asc' | 'desc';
  } = {}
): Promise<{ items: CardDTO[]; total: number; page: number; per_page: number }> {
  const {
    page = 1,
    per_page = 50,
    is_archived = false,
    source,
    due_before,
    sort = 'created_at',
    order = 'desc'
  } = options;

  const limit = Math.min(per_page, 200);
  const offset = (page - 1) * limit;

  let query = supabase
    .from('cards')
    .select('*', { count: 'exact' })
    .eq('deck_id', deckId)
    .eq('user_id', userId)
    .eq('is_archived', is_archived);

  if (source) {
    query = query.eq('source', source);
  }

  if (due_before) {
    query = query.lte('due_at', due_before);
  }

  query = query.order(sort, { ascending: order === 'asc' });
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to get cards: ${error.message}`);
  }

  return {
    items: (data || []).map(mapCardEntityToDTO),
    total: count || 0,
    page,
    per_page: limit
  };
}

/**
 * Get a single card by ID
 */
export async function getCardById(
  supabase: SupabaseClient,
  deckId: UUID,
  cardId: UUID,
  userId: UUID
): Promise<CardDTO | null> {
  const { data, error } = await supabase
    .from('cards')
    .select()
    .eq('id', cardId)
    .eq('deck_id', deckId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get card: ${error.message}`);
  }

  return mapCardEntityToDTO(data);
}

/**
 * Update a card
 */
export async function updateCard(
  supabase: SupabaseClient,
  deckId: UUID,
  cardId: UUID,
  userId: UUID,
  command: UpdateCardCommand
): Promise<CardDTO> {
  const updates: any = {};
  
  if (command.front !== undefined) updates.front = command.front;
  if (command.back !== undefined) updates.back = command.back;
  if (command.is_archived !== undefined) updates.is_archived = command.is_archived;
  if (command.language_code !== undefined) updates.language_code = command.language_code;

  const { data, error } = await supabase
    .from('cards')
    .update(updates)
    .eq('id', cardId)
    .eq('deck_id', deckId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update card: ${error.message}`);
  }

  return mapCardEntityToDTO(data);
}

/**
 * Delete a card permanently
 */
export async function deleteCard(
  supabase: SupabaseClient,
  deckId: UUID,
  cardId: UUID,
  userId: UUID
): Promise<void> {
  const { error } = await supabase
    .from('cards')
    .delete()
    .eq('id', cardId)
    .eq('deck_id', deckId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete card: ${error.message}`);
  }
}

/**
 * Archive a card
 */
export async function archiveCard(
  supabase: SupabaseClient,
  deckId: UUID,
  cardId: UUID,
  userId: UUID
): Promise<CardDTO> {
  return updateCard(supabase, deckId, cardId, userId, { is_archived: true });
}

/**
 * Restore an archived card
 */
export async function restoreCard(
  supabase: SupabaseClient,
  deckId: UUID,
  cardId: UUID,
  userId: UUID
): Promise<CardDTO> {
  return updateCard(supabase, deckId, cardId, userId, { is_archived: false });
}

/**
 * Get cards due for study
 */
export async function getDueCards(
  supabase: SupabaseClient,
  userId: UUID,
  options: {
    deck_id?: UUID;
    limit?: number;
  } = {}
): Promise<CardDTO[]> {
  const { deck_id, limit = 20 } = options;
  const maxLimit = Math.min(limit, 100);

  let query = supabase
    .from('cards')
    .select()
    .eq('user_id', userId)
    .eq('is_archived', false)
    .or('due_at.is.null,due_at.lte.' + new Date().toISOString());

  if (deck_id) {
    query = query.eq('deck_id', deck_id);
  }

  query = query
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(maxLimit);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get due cards: ${error.message}`);
  }

  return (data || []).map(mapCardEntityToDTO);
}

/**
 * Calculate next SRS values using SM-2 algorithm
 */
export function calculateSRSUpdate(
  rating: number,
  currentEaseFactor: number,
  currentInterval: number,
  currentRepetitions: number,
  currentLapses: number
): {
  easeFactor: number;
  intervalDays: number;
  repetitionsCount: number;
  lapsesCount: number;
  dueAt: Date;
} {
  let newEaseFactor = currentEaseFactor;
  let newInterval = currentInterval;
  let newRepetitions = currentRepetitions;
  let newLapses = currentLapses;

  if (rating >= 3) {
    // Correct response
    if (newRepetitions === 0) {
      newInterval = 1;
    } else if (newRepetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(newInterval * newEaseFactor);
    }
    newRepetitions += 1;
  } else {
    // Incorrect response
    newRepetitions = 0;
    newInterval = 1;
    newLapses += 1;
  }

  // Update ease factor (SM-2 formula)
  newEaseFactor = newEaseFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
  newEaseFactor = Math.max(1.3, newEaseFactor);

  // Calculate due date
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + newInterval);

  return {
    easeFactor: Math.round(newEaseFactor * 100) / 100,
    intervalDays: newInterval,
    repetitionsCount: newRepetitions,
    lapsesCount: newLapses,
    dueAt
  };
}

/**
 * Update card SRS fields after review
 */
export async function updateCardAfterReview(
  supabase: SupabaseClient,
  cardId: UUID,
  userId: UUID,
  rating: number
): Promise<CardDTO> {
  // Get current card data
  const { data: currentCard, error: fetchError } = await supabase
    .from('cards')
    .select()
    .eq('id', cardId)
    .eq('user_id', userId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to get card for review: ${fetchError.message}`);
  }

  // Calculate new SRS values
  const srsUpdate = calculateSRSUpdate(
    rating,
    currentCard.ease_factor,
    currentCard.interval_days,
    currentCard.repetitions_count,
    currentCard.lapses_count
  );

  // Update card with new SRS values
  const { data, error } = await supabase
    .from('cards')
    .update({
      due_at: srsUpdate.dueAt.toISOString(),
      last_reviewed_at: new Date().toISOString(),
      ease_factor: srsUpdate.easeFactor,
      interval_days: srsUpdate.intervalDays,
      repetitions_count: srsUpdate.repetitionsCount,
      lapses_count: srsUpdate.lapsesCount,
    })
    .eq('id', cardId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update card after review: ${error.message}`);
  }

  return mapCardEntityToDTO(data);
}

/**
 * Map database entity to DTO
 */
function mapCardEntityToDTO(entity: Database['public']['Tables']['cards']['Row']): CardDTO {
  return {
    id: entity.id,
    deck_id: entity.deck_id,
    front: entity.front,
    back: entity.back,
    source: entity.source as 'manual' | 'ai',
    is_archived: entity.is_archived,
    language_code: entity.language_code,
    due_at: entity.due_at,
    last_reviewed_at: entity.last_reviewed_at,
    repetitions_count: entity.repetitions_count,
    lapses_count: entity.lapses_count,
    ease_factor: entity.ease_factor,
    interval_days: entity.interval_days,
    created_at: entity.created_at,
    updated_at: entity.updated_at,
  };
}
