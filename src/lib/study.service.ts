/**
 * Study Service
 *
 * Handles business logic for study sessions, reviews, and statistics.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../database/types/database.types";
import type {
  ReviewDTO,
  CreateReviewCommand,
  StudyStatisticsDTO,
  UUID,
  CardDTO,
} from "../types";
import { calculateSM2, type SM2Card } from "./sm2.service";

type SupabaseClient = ReturnType<typeof createClient<Database>>;

/**
 * Create a review for a card and update SM-2 parameters
 */
export async function createReview(
  supabase: SupabaseClient,
  cardId: UUID,
  userId: UUID,
  command: CreateReviewCommand,
): Promise<{ review: ReviewDTO; card: CardDTO }> {
  // Get current card state
  const { data: cardData, error: cardError } = await supabase
    .from("cards")
    .select()
    .eq("id", cardId)
    .eq("user_id", userId)
    .single();

  if (cardError) {
    throw new Error(`Failed to get card: ${cardError.message}`);
  }

  // Create SM-2 calculation input
  const sm2Card: SM2Card = {
    repetitions_count: cardData.repetitions_count,
    ease_factor: parseFloat(cardData.ease_factor.toString()),
    interval_days: cardData.interval_days,
    last_reviewed_at: cardData.last_reviewed_at
      ? new Date(cardData.last_reviewed_at)
      : null,
    lapses_count: cardData.lapses_count,
  };

  // Calculate new SM-2 values
  const reviewDate = new Date();
  const sm2Result = calculateSM2(sm2Card, command.rating, reviewDate);

  // Start transaction to create review and update card
  const { data: reviewData, error: reviewError } = await supabase
    .from("reviews")
    .insert({
      card_id: cardId,
      user_id: userId,
      rating: command.rating,
      duration_ms: command.duration_ms || null,
      reviewed_at: reviewDate.toISOString(),
      // Store pre/post values for audit
      pre_ease_factor: sm2Card.ease_factor,
      post_ease_factor: sm2Result.ease_factor,
      pre_interval_days: sm2Card.interval_days,
      post_interval_days: sm2Result.interval_days,
      pre_repetitions_count: sm2Card.repetitions_count,
      post_repetitions_count: sm2Result.repetitions_count,
      pre_lapses_count: sm2Card.lapses_count,
      post_lapses_count: sm2Result.lapses_count,
    })
    .select()
    .single();

  if (reviewError) {
    throw new Error(`Failed to create review: ${reviewError.message}`);
  }

  // Update card with new SM-2 values
  const { data: updatedCardData, error: updateError } = await supabase
    .from("cards")
    .update({
      repetitions_count: sm2Result.repetitions_count,
      ease_factor: sm2Result.ease_factor,
      interval_days: sm2Result.interval_days,
      lapses_count: sm2Result.lapses_count,
      due_at: sm2Result.due_at.toISOString(),
      last_reviewed_at: reviewDate.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId)
    .eq("user_id", userId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update card: ${updateError.message}`);
  }

  return {
    review: mapReviewEntityToDTO(reviewData),
    card: mapCardEntityToDTO(updatedCardData),
  };
}

/**
 * Get user study statistics
 */
export async function getStudyStatistics(
  supabase: SupabaseClient,
  userId: UUID,
): Promise<StudyStatisticsDTO> {
  // Get cards statistics
  const { data: cardsData, error: cardsError } = await supabase
    .from("cards")
    .select("id, is_archived, due_at")
    .eq("user_id", userId);

  if (cardsError) {
    throw new Error(`Failed to get cards statistics: ${cardsError.message}`);
  }

  const cardsTotal = cardsData?.length || 0;
  const cardsArchived =
    cardsData?.filter((card) => card.is_archived).length || 0;
  const cardsDue =
    cardsData?.filter(
      (card) =>
        !card.is_archived &&
        (card.due_at === null || new Date(card.due_at) <= new Date()),
    ).length || 0;

  // Get AI statistics
  const { data: aiGenerationsData, error: aiGenError } = await supabase
    .from("ai_generations")
    .select("id")
    .eq("user_id", userId);

  if (aiGenError) {
    throw new Error(
      `Failed to get AI generations statistics: ${aiGenError.message}`,
    );
  }

  const { data: aiSuggestionsData, error: aiSugError } = await supabase
    .from("ai_suggestions")
    .select("id, status")
    .eq("user_id", userId);

  if (aiSugError) {
    throw new Error(
      `Failed to get AI suggestions statistics: ${aiSugError.message}`,
    );
  }

  const aiGenerationsTotal = aiGenerationsData?.length || 0;
  const aiSuggestionsTotal = aiSuggestionsData?.length || 0;
  const aiSuggestionsAccepted =
    aiSuggestionsData?.filter((s) => s.status === "accepted").length || 0;
  const aiAcceptanceRate =
    aiSuggestionsTotal > 0 ? aiSuggestionsAccepted / aiSuggestionsTotal : 0;

  // Get reviews statistics
  const { data: reviewsData, error: reviewsError } = await supabase
    .from("reviews")
    .select("id, reviewed_at")
    .eq("user_id", userId);

  if (reviewsError) {
    throw new Error(
      `Failed to get reviews statistics: ${reviewsError.message}`,
    );
  }

  const reviewsTotal = reviewsData?.length || 0;

  // Get last reviewed date
  const lastReviewedAt =
    reviewsData && reviewsData.length > 0
      ? reviewsData.sort(
          (a, b) =>
            new Date(b.reviewed_at).getTime() -
            new Date(a.reviewed_at).getTime(),
        )[0].reviewed_at
      : null;

  return {
    cards_total: cardsTotal,
    cards_archived: cardsArchived,
    cards_due: cardsDue,
    ai_generations_total: aiGenerationsTotal,
    ai_suggestions_total: aiSuggestionsTotal,
    ai_suggestions_accepted: aiSuggestionsAccepted,
    ai_acceptance_rate: aiAcceptanceRate,
    reviews_total: reviewsTotal,
    last_reviewed_at: lastReviewedAt,
  };
}

/**
 * Get study queue (cards due for review)
 */
export async function getStudyQueue(
  supabase: SupabaseClient,
  userId: UUID,
  options: {
    deck_id?: UUID;
    limit?: number;
  } = {},
): Promise<CardDTO[]> {
  const { deck_id, limit = 20 } = options;

  let query = supabase
    .from("cards")
    .select()
    .eq("user_id", userId)
    .eq("is_archived", false)
    .or("due_at.is.null,due_at.lte." + new Date().toISOString())
    .order("due_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (deck_id) {
    query = query.eq("deck_id", deck_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get study queue: ${error.message}`);
  }

  return data?.map(mapCardEntityToDTO) || [];
}

/**
 * Map database entity to DTO
 */
function mapReviewEntityToDTO(
  entity: Database["public"]["Tables"]["reviews"]["Row"],
): ReviewDTO {
  return {
    id: entity.id,
    card_id: entity.card_id,
    rating: entity.rating,
    duration_ms: entity.duration_ms,
    reviewed_at: entity.reviewed_at,
  };
}

/**
 * Map card database entity to DTO
 */
function mapCardEntityToDTO(
  entity: Database["public"]["Tables"]["cards"]["Row"],
): CardDTO {
  return {
    id: entity.id,
    deck_id: entity.deck_id,
    front: entity.front,
    back: entity.back,
    source: entity.source as "manual" | "ai",
    is_archived: entity.is_archived,
    language_code: entity.language_code,
    due_at: entity.due_at,
    last_reviewed_at: entity.last_reviewed_at,
    repetitions_count: entity.repetitions_count,
    lapses_count: entity.lapses_count,
    ease_factor: parseFloat(entity.ease_factor.toString()),
    interval_days: entity.interval_days,
    created_at: entity.created_at,
    updated_at: entity.updated_at,
  };
}
