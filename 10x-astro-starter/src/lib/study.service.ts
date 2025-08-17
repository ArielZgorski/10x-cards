/**
 * Study Service
 * 
 * Handles business logic for study sessions, reviews, and statistics.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../db/database.types';
import type { ReviewDTO, CreateReviewCommand, StudyStatisticsDTO, UUID } from '../types';

type SupabaseClient = ReturnType<typeof createClient<Database>>;

/**
 * Create a review for a card
 */
export async function createReview(
  supabase: SupabaseClient,
  cardId: UUID,
  userId: UUID,
  command: CreateReviewCommand
): Promise<ReviewDTO> {
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      card_id: cardId,
      user_id: userId,
      rating: command.rating,
      duration_ms: command.duration_ms || null,
      reviewed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create review: ${error.message}`);
  }

  return mapReviewEntityToDTO(data);
}

/**
 * Get user study statistics
 */
export async function getStudyStatistics(
  supabase: SupabaseClient,
  userId: UUID
): Promise<StudyStatisticsDTO> {
  // Get cards statistics
  const { data: cardsStats, error: cardsError } = await supabase
    .rpc('get_user_cards_stats', { user_id_param: userId });

  if (cardsError) {
    throw new Error(`Failed to get cards statistics: ${cardsError.message}`);
  }

  // Get AI statistics
  const { data: aiStats, error: aiError } = await supabase
    .rpc('get_user_ai_stats', { user_id_param: userId });

  if (aiError) {
    throw new Error(`Failed to get AI statistics: ${aiError.message}`);
  }

  // Get reviews statistics
  const { data: reviewsStats, error: reviewsError } = await supabase
    .rpc('get_user_reviews_stats', { user_id_param: userId });

  if (reviewsError) {
    throw new Error(`Failed to get reviews statistics: ${reviewsError.message}`);
  }

  // Get last reviewed date
  const { data: lastReview, error: lastReviewError } = await supabase
    .from('reviews')
    .select('reviewed_at')
    .eq('user_id', userId)
    .order('reviewed_at', { ascending: false })
    .limit(1)
    .single();

  const lastReviewedAt = lastReviewError || !lastReview ? null : lastReview.reviewed_at;

  return {
    cards_total: cardsStats?.[0]?.total || 0,
    cards_archived: cardsStats?.[0]?.archived || 0,
    cards_due: cardsStats?.[0]?.due || 0,
    ai_generations_total: aiStats?.[0]?.generations_total || 0,
    ai_suggestions_total: aiStats?.[0]?.suggestions_total || 0,
    ai_suggestions_accepted: aiStats?.[0]?.suggestions_accepted || 0,
    ai_acceptance_rate: aiStats?.[0]?.acceptance_rate || 0,
    reviews_total: reviewsStats?.[0]?.total || 0,
    last_reviewed_at: lastReviewedAt,
  };
}

/**
 * Map database entity to DTO
 */
function mapReviewEntityToDTO(entity: Database['public']['Tables']['reviews']['Row']): ReviewDTO {
  return {
    id: entity.id,
    card_id: entity.card_id,
    rating: entity.rating,
    duration_ms: entity.duration_ms,
    reviewed_at: entity.reviewed_at,
  };
}
