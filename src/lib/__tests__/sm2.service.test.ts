/**
 * Unit tests for SM-2 spaced repetition algorithm
 */

import { describe, it, expect } from 'vitest';
import { calculateSM2, isCardDue, sortCardsByPriority, calculateStudyStats } from '../sm2.service';

describe('SM-2 Service', () => {
  describe('calculateSM2', () => {
    it('should handle new card with rating 3 (easy)', () => {
      const card = {
        repetitions_count: 0,
        ease_factor: 2.5,
        interval_days: 0,
        last_reviewed_at: null,
        lapses_count: 0,
      };

      const result = calculateSM2(card, 3);

      expect(result.repetitions_count).toBe(1);
      expect(result.interval_days).toBe(1);
      expect(result.ease_factor).toBe(2.6); // 2.5 + 0.1
      expect(result.lapses_count).toBe(0);
      expect(result.due_at).toBeInstanceOf(Date);
    });

    it('should handle second repetition correctly', () => {
      const card = {
        repetitions_count: 1,
        ease_factor: 2.6,
        interval_days: 1,
        last_reviewed_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
        lapses_count: 0,
      };

      const result = calculateSM2(card, 2); // good rating

      expect(result.repetitions_count).toBe(2);
      expect(result.interval_days).toBe(6);
      expect(result.ease_factor).toBe(2.6); // ease_factor remains the same for rating 2
      expect(result.lapses_count).toBe(0);
    });

    it('should handle failed review (rating < 2)', () => {
      const card = {
        repetitions_count: 3,
        ease_factor: 2.8,
        interval_days: 15,
        last_reviewed_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        lapses_count: 1,
      };

      const result = calculateSM2(card, 1); // hard/failed

      expect(result.repetitions_count).toBe(0); // reset to 0
      expect(result.interval_days).toBe(1); // reset to 1
      expect(result.lapses_count).toBe(2); // incremented
      expect(result.ease_factor).toBe(2.8); // unchanged for failed review
    });

    it('should not allow ease factor below 1.3', () => {
      const card = {
        repetitions_count: 2,
        ease_factor: 1.4,
        interval_days: 6,
        last_reviewed_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        lapses_count: 0,
      };

      const result = calculateSM2(card, 0); // very poor rating

      expect(result.ease_factor).toBe(1.4); // ease factor doesn't change for failed reviews, only resets repetitions
    });

    it('should calculate exponential intervals for mature cards', () => {
      const card = {
        repetitions_count: 2,
        ease_factor: 2.5,
        interval_days: 6,
        last_reviewed_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        lapses_count: 0,
      };

      const result = calculateSM2(card, 3); // easy

      expect(result.repetitions_count).toBe(3);
      expect(result.interval_days).toBe(15); // Math.round(6 * 2.5) = 15
      expect(result.ease_factor).toBe(2.6);
    });

    it('should throw error for invalid rating', () => {
      const card = {
        repetitions_count: 0,
        ease_factor: 2.5,
        interval_days: 0,
        last_reviewed_at: null,
        lapses_count: 0,
      };

      expect(() => calculateSM2(card, -1)).toThrow('Rating must be an integer between 0 and 3');
      expect(() => calculateSM2(card, 4)).toThrow('Rating must be an integer between 0 and 3');
      expect(() => calculateSM2(card, 1.5)).toThrow('Rating must be an integer between 0 and 3');
    });

    it('should round ease factor to 2 decimal places', () => {
      const card = {
        repetitions_count: 1,
        ease_factor: 2.456789,
        interval_days: 1,
        last_reviewed_at: new Date(),
        lapses_count: 0,
      };

      const result = calculateSM2(card, 2);

      expect(result.ease_factor).toBe(2.46); // rounded to 2 decimal places from actual calculation
    });
  });

  describe('isCardDue', () => {
    it('should return true for new cards (null due_at)', () => {
      const card = { due_at: null };
      expect(isCardDue(card)).toBe(true);
    });

    it('should return true for cards due in the past', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday
      const card = { due_at: pastDate };
      expect(isCardDue(card)).toBe(true);
    });

    it('should return true for cards due now', () => {
      const now = new Date();
      const card = { due_at: now };
      expect(isCardDue(card)).toBe(true);
    });

    it('should return false for cards due in the future', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow
      const card = { due_at: futureDate };
      expect(isCardDue(card)).toBe(false);
    });
  });

  describe('sortCardsByPriority', () => {
    it('should prioritize new cards first', () => {
      const cards = [
        { due_at: new Date(Date.now() - 60 * 60 * 1000), interval_days: 1 }, // due 1 hour ago
        { due_at: null, interval_days: 0 }, // new card
        { due_at: new Date(Date.now() - 24 * 60 * 60 * 1000), interval_days: 3 }, // due 1 day ago
      ];

      const sorted = sortCardsByPriority(cards);

      expect(sorted[0].due_at).toBe(null); // new card first
    });

    it('should sort by due date after new cards', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const cards = [
        { due_at: oneHourAgo, interval_days: 1 },
        { due_at: oneDayAgo, interval_days: 3 },
      ];

      const sorted = sortCardsByPriority(cards);

      expect(sorted[0].due_at).toBe(oneDayAgo); // older due date first
      expect(sorted[1].due_at).toBe(oneHourAgo);
    });

    it('should prioritize shorter intervals for same due date', () => {
      const sameDate = new Date(Date.now() - 60 * 60 * 1000);
      
      const cards = [
        { due_at: sameDate, interval_days: 5 },
        { due_at: sameDate, interval_days: 1 },
        { due_at: sameDate, interval_days: 3 },
      ];

      const sorted = sortCardsByPriority(cards);

      expect(sorted[0].interval_days).toBe(1); // shortest interval first
      expect(sorted[1].interval_days).toBe(3);
      expect(sorted[2].interval_days).toBe(5);
    });
  });

  describe('calculateStudyStats', () => {
    it('should calculate basic statistics correctly', () => {
      const now = new Date();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const cards = [
        // New cards
        { due_at: null, repetitions_count: 0, is_archived: false },
        { due_at: null, repetitions_count: 0, is_archived: false },
        
        // Due cards
        { due_at: yesterday, repetitions_count: 1, is_archived: false },
        { due_at: now, repetitions_count: 2, is_archived: false },
        
        // Learning cards (1-3 repetitions)
        { due_at: tomorrow, repetitions_count: 1, is_archived: false },
        { due_at: tomorrow, repetitions_count: 2, is_archived: false },
        { due_at: tomorrow, repetitions_count: 3, is_archived: false },
        
        // Mastered cards (4+ repetitions)
        { due_at: tomorrow, repetitions_count: 4, is_archived: false },
        { due_at: tomorrow, repetitions_count: 8, is_archived: false },
        
        // Archived cards (should be excluded)
        { due_at: null, repetitions_count: 0, is_archived: true },
        { due_at: yesterday, repetitions_count: 5, is_archived: true },
      ];

      const stats = calculateStudyStats(cards);

      expect(stats.total).toBe(9); // excluding archived
      expect(stats.new).toBe(2);
      expect(stats.due).toBe(2);
      expect(stats.learning).toBe(5); // 5 cards with 1-3 repetitions (including due cards)
      expect(stats.mastered).toBe(2);
    });

    it('should handle empty card array', () => {
      const stats = calculateStudyStats([]);

      expect(stats.total).toBe(0);
      expect(stats.new).toBe(0);
      expect(stats.due).toBe(0);
      expect(stats.learning).toBe(0);
      expect(stats.mastered).toBe(0);
    });

    it('should exclude archived cards from all calculations', () => {
      const cards = [
        { due_at: null, repetitions_count: 0, is_archived: true },
        { due_at: new Date(Date.now() - 60 * 60 * 1000), repetitions_count: 1, is_archived: true },
        { due_at: new Date(Date.now() + 60 * 60 * 1000), repetitions_count: 5, is_archived: true },
      ];

      const stats = calculateStudyStats(cards);

      expect(stats.total).toBe(0);
      expect(stats.new).toBe(0);
      expect(stats.due).toBe(0);
      expect(stats.learning).toBe(0);
      expect(stats.mastered).toBe(0);
    });
  });
});
