// Shared DTOs and Command Models for the REST API
// These types are designed for use across backend API routes and frontend consumers.
// Where possible, fields and constraints mirror the database schema and API plan.

import type { Database } from "../database/types/database.types";

// ---------- Entity aliases (derive from DB schema) ----------

type DeckEntity = Database["public"]["decks"]["Row"];
type CardEntity = Database["public"]["cards"]["Row"];
type AIGenerationEntity = Database["public"]["ai_generations"]["Row"];
type AISuggestionEntity = Database["public"]["ai_suggestions"]["Row"];
type ReviewEntity = Database["public"]["reviews"]["Row"];
type StudySessionEntity = Database["public"]["study_sessions"]["Row"];
type ProfileEntity = Database["public"]["profiles"]["Row"];
type AuditFlashcardEditEntity =
  Database["public"]["audit_flashcard_edits"]["Row"];

// ---------- Common helpers ----------

/** RFC 3339 / ISO 8601 timestamp string */
export type ISODateTimeString = string;

/** UUID string */
export type UUID = string;

/** Generic paginated response wrapper */
export interface Paginated<TItem> {
  items: TItem[];
  page: number;
  perPage: number;
  total: number;
}

// ---------- 1. Authentication DTOs ----------
// Auth is managed by Supabase; no DB entity in `Database` for auth.users.

export interface RegisterUserCommand {
  email: string;
  password: string;
}

export interface RegisterUserResponseDTO {
  userId: UUID;
  email: string;
}

export interface LoginUserCommand {
  email: string;
  password: string;
}

export interface LoginResponseDTO {
  accessToken: string;
  refreshToken: string;
}

// ---------- 2. Profiles ----------
// Mirrors DB table `profiles` per plan.

export interface ProfileDTO {
  id: ProfileEntity["id"];
  display_name: ProfileEntity["display_name"];
  timezone: ProfileEntity["timezone"]; // IANA timezone
  locale: ProfileEntity["locale"]; // BCP 47 locale
  created_at: ProfileEntity["created_at"];
  updated_at: ProfileEntity["updated_at"];
}

export interface UpdateProfileCommand {
  display_name?: ProfileEntity["display_name"];
  timezone?: ProfileEntity["timezone"]; // validated as IANA
  locale?: ProfileEntity["locale"]; // validated as BCP 47
}

// ---------- 3. Decks ----------
// Database fields available: id, user_id, name, slug, language_code, is_archived, created_at, updated_at

export interface DeckDTO {
  id: DeckEntity["id"];
  name: DeckEntity["name"];
  slug: DeckEntity["slug"];
  language_code: DeckEntity["language_code"];
  is_archived: DeckEntity["is_archived"];
  created_at: DeckEntity["created_at"];
  updated_at: DeckEntity["updated_at"];
}

export interface GetDecksQueryParams {
  page?: number;
  per_page?: number;
  is_archived?: boolean;
  search?: string;
  sort?: "created_at" | "updated_at" | "name";
  order?: "asc" | "desc";
}

export type PaginatedDecksDTO = Paginated<DeckDTO>;

export interface CreateDeckCommand {
  name: DeckEntity["name"];
  slug?: DeckEntity["slug"];
  language_code?: DeckEntity["language_code"];
  is_archived?: DeckEntity["is_archived"];
}

export interface UpdateDeckCommand {
  name?: DeckEntity["name"];
  slug?: DeckEntity["slug"];
  language_code?: DeckEntity["language_code"];
  is_archived?: DeckEntity["is_archived"];
}

// ---------- 4. Cards ----------
// Database entity is `flashcards` with: id, user_id, deck_id, front, back, due_date, ease_factor, interval_days, repetition_count, etc.
// API plan uses `cards` and adds: source, is_archived, language_code, last_reviewed_at.

export interface CardDTO {
  id: CardEntity["id"];
  deck_id: CardEntity["deck_id"];
  front: CardEntity["front"];
  back: CardEntity["back"];
  source: CardEntity["source"];
  is_archived: CardEntity["is_archived"];
  language_code: CardEntity["language_code"];
  created_at: CardEntity["created_at"];
  updated_at: CardEntity["updated_at"];
  due_at: CardEntity["due_at"];
  last_reviewed_at: CardEntity["last_reviewed_at"];
  repetitions_count: CardEntity["repetitions_count"];
  lapses_count: CardEntity["lapses_count"];
  ease_factor: CardEntity["ease_factor"];
  interval_days: CardEntity["interval_days"];
}

export interface GetCardsQueryParams {
  page?: number;
  per_page?: number;
  is_archived?: boolean;
  source?: "manual" | "ai";
  due_before?: ISODateTimeString;
  sort?: "created_at" | "updated_at" | "due_at" | "interval_days";
  order?: "asc" | "desc";
}

export type PaginatedCardsDTO = Paginated<CardDTO>;

export interface CreateCardCommand {
  front: CardEntity["front"];
  back: CardEntity["back"];
  language_code?: CardEntity["language_code"];
}

export interface UpdateCardCommand {
  front?: CardEntity["front"];
  back?: CardEntity["back"];
  is_archived?: CardEntity["is_archived"];
  language_code?: CardEntity["language_code"];
}

// ---------- 5. Reviews (Study actions on cards) ----------
// Mirrors DB table `reviews` per plan.

export interface ReviewDTO {
  id: ReviewEntity["id"];
  card_id: ReviewEntity["card_id"];
  reviewed_at: ReviewEntity["reviewed_at"];
  rating: ReviewEntity["rating"];
  duration_ms: ReviewEntity["duration_ms"];
}

export interface CreateReviewCommand {
  rating: 0 | 1 | 2 | 3;
  duration_ms?: number; // >= 0
}

export interface CreateReviewResponseDTO {
  review: ReviewDTO;
  card: CardDTO; // updated SRS fields
}

// ---------- 6. AI Generations ----------
// Not present in current DB types; defined per API plan.

export interface AIGenerationDTO {
  id: AIGenerationEntity["id"];
  user_id: AIGenerationEntity["user_id"];
  source_text: string; // 1000..10000
  model: AIGenerationEntity["model"];
  prompt_version: AIGenerationEntity["prompt_version"];
  tokens_input: AIGenerationEntity["tokens_input"];
  tokens_output: AIGenerationEntity["tokens_output"];
  cost_usd: AIGenerationEntity["cost_usd"];
  status: string; // pending|running|succeeded|failed
  error: Record<string, unknown> | null;
  ai_metadata: Record<string, unknown> | null;
  created_at: ISODateTimeString;
  updated_at: ISODateTimeString;
}

export interface CreateAIGenerationCommand {
  source_text: string; // 1000..10000
  model?: string;
  prompt_version?: string;
}

export type PaginatedAIGenerationsDTO = Paginated<AIGenerationDTO>;

// ---------- 7. AI Suggestions ----------
// Mirrors DB table `ai_suggestions` per plan.

export type AISuggestionStatus =
  | "proposed"
  | "edited"
  | "accepted"
  | "rejected";

export interface AISuggestionDTO {
  id: AISuggestionEntity["id"];
  user_id: AISuggestionEntity["user_id"];
  generation_id: AISuggestionEntity["generation_id"];
  front: AISuggestionEntity["front"];
  back: AISuggestionEntity["back"];
  status: AISuggestionStatus;
  accepted_at: AISuggestionEntity["accepted_at"];
  card_id: AISuggestionEntity["card_id"];
  created_at: AISuggestionEntity["created_at"];
  updated_at: AISuggestionEntity["updated_at"];
}

export interface UpdateAISuggestionCommand {
  front?: AISuggestionEntity["front"];
  back?: AISuggestionEntity["back"];
  status?: Extract<AISuggestionStatus, "edited" | "rejected">;
}

export interface AcceptAISuggestionCommand {
  deck_id: UUID;
  language_code?: string | null;
}

export interface AcceptBatchSuggestionsCommand {
  suggestion_ids: UUID[]; // ≤ 100 per request
  deck_id: UUID;
}

// ---------- 8. Suggestion Sessions (maps to DB: suggestion_sessions) ----------

export interface SuggestionSessionDTO {
  id: UUID;
  user_id: UUID;
  deck_id: UUID;
  topic: string;
  difficulty_level: string | null;
  card_count: number;
  status: string;
  created_at: ISODateTimeString;
  completed_at: ISODateTimeString | null;
}

export interface CreateSuggestionSessionCommand {
  topic: string;
  difficulty_level?: string | null;
  card_count: number;
}

export interface GetAISuggestionsQueryParams {
  status?: AISuggestionStatus;
  page?: number;
  per_page?: number;
}

// ---------- 9. Study Sessions (optional feature) ----------

export interface StudySessionSummaryDTO {
  id: StudySessionEntity["id"];
  user_id: StudySessionEntity["user_id"];
  started_at: StudySessionEntity["started_at"];
  ended_at: StudySessionEntity["ended_at"];
  notes: StudySessionEntity["notes"];
  created_at: StudySessionEntity["created_at"];
  updated_at: StudySessionEntity["updated_at"];
}

export interface CreateStudySessionCommand {
  notes?: StudySessionEntity["notes"];
}

export interface EndStudySessionCommand {
  // no body; path param only
}

// ---------- 10. Study Queue ----------

export interface StudyQueueQueryParams {
  deck_id?: UUID;
  limit?: number; // default 20, max 100
}

// ---------- 11. Statistics ----------

export interface StudyStatisticsDTO {
  cards_total: number;
  cards_archived: number;
  cards_due: number;
  ai_generations_total: number;
  ai_suggestions_total: number;
  ai_suggestions_accepted: number;
  ai_acceptance_rate: number; // 0..1
  reviews_total: number;
  last_reviewed_at: ISODateTimeString | null;
}

// Legacy alias for backward compatibility
export type UserStatisticsDTO = StudyStatisticsDTO;

// ---------- 12. Audit (present in DB) ----------

export interface AuditFlashcardEditDTO {
  id: AuditFlashcardEditEntity["id"];
  flashcard_id: AuditFlashcardEditEntity["flashcard_id"];
  user_id: AuditFlashcardEditEntity["user_id"];
  field_name: AuditFlashcardEditEntity["field_name"];
  old_value: AuditFlashcardEditEntity["old_value"];
  new_value: AuditFlashcardEditEntity["new_value"];
  edited_at: AuditFlashcardEditEntity["edited_at"];
}
