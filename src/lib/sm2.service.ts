/**
 * SM-2 Spaced Repetition Algorithm Service
 * 
 * Implements the SM-2 algorithm for calculating card scheduling.
 * Based on: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 */

export interface SM2Card {
  repetitions_count: number;
  ease_factor: number;
  interval_days: number;
  last_reviewed_at: Date | null;
  lapses_count: number;
}

export interface SM2Result {
  repetitions_count: number;
  ease_factor: number;
  interval_days: number;
  due_at: Date;
  lapses_count: number;
}

/**
 * Calculate next review date using SM-2 algorithm
 * 
 * @param card Current card state
 * @param rating Quality of response (0-3)
 *   - 0: complete blackout, incorrect
 *   - 1: incorrect, but remembered on second thought  
 *   - 2: correct response, but with hesitation
 *   - 3: perfect response
 * @param reviewDate Date of the review (defaults to now)
 * @returns Updated card parameters
 */
export function calculateSM2(
  card: SM2Card, 
  rating: number, 
  reviewDate: Date = new Date()
): SM2Result {
  // Validate rating
  if (rating < 0 || rating > 3 || !Number.isInteger(rating)) {
    throw new Error('Rating must be an integer between 0 and 3');
  }

  let { repetitions_count, ease_factor, interval_days, lapses_count } = card;

  // If quality < 2, reset repetitions and increase lapses
  if (rating < 2) {
    repetitions_count = 0;
    interval_days = 1;
    lapses_count += 1;
  } else {
    // Correct response (rating >= 2)
    repetitions_count += 1;

    // Calculate new interval
    if (repetitions_count === 1) {
      interval_days = 1;
    } else if (repetitions_count === 2) {
      interval_days = 6;
    } else {
      interval_days = Math.round(interval_days * ease_factor);
    }

    // Update ease factor
    ease_factor = ease_factor + (0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02));
    
    // Minimum ease factor is 1.3
    if (ease_factor < 1.3) {
      ease_factor = 1.3;
    }
  }

  // Calculate due date
  const due_at = new Date(reviewDate);
  due_at.setDate(due_at.getDate() + interval_days);

  return {
    repetitions_count,
    ease_factor: Math.round(ease_factor * 100) / 100, // Round to 2 decimal places
    interval_days,
    due_at,
    lapses_count,
  };
}

/**
 * Check if a card is due for review
 */
export function isCardDue(card: { due_at: Date | null }): boolean {
  if (!card.due_at) {
    return true; // New cards are always due
  }
  
  return new Date() >= card.due_at;
}

/**
 * Get next due cards for study session
 */
export function sortCardsByPriority(cards: Array<{ due_at: Date | null; interval_days: number }>): typeof cards {
  return cards.sort((a, b) => {
    // New cards (due_at is null) come first
    if (!a.due_at && !b.due_at) return 0;
    if (!a.due_at) return -1;
    if (!b.due_at) return 1;
    
    // Then sort by due date
    const dueDateComparison = a.due_at.getTime() - b.due_at.getTime();
    if (dueDateComparison !== 0) return dueDateComparison;
    
    // For cards due on the same date, prioritize shorter intervals (more difficult cards)
    return a.interval_days - b.interval_days;
  });
}

/**
 * Calculate statistics for a set of cards
 */
export function calculateStudyStats(cards: Array<{ 
  due_at: Date | null; 
  repetitions_count: number;
  is_archived: boolean;
}>): {
  total: number;
  new: number;
  due: number;
  learning: number;
  mastered: number;
} {
  const activeCards = cards.filter(card => !card.is_archived);
  const now = new Date();
  
  return {
    total: activeCards.length,
    new: activeCards.filter(card => !card.due_at).length,
    due: activeCards.filter(card => card.due_at && card.due_at <= now).length,
    learning: activeCards.filter(card => card.repetitions_count > 0 && card.repetitions_count < 4).length,
    mastered: activeCards.filter(card => card.repetitions_count >= 4).length,
  };
}

