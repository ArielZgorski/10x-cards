# REST API Plan

## 1. Resources
- **Profiles** → table: `profiles`
- **Decks** → table: `decks`
- **Cards** → table: `cards`
- **Reviews** → table: `reviews`
- **AI Generations** → table: `ai_generations`
- **AI Suggestions** → table: `ai_suggestions`
- **Study Sessions** (optional) → table: `study_sessions`
- **Auth** → Supabase Auth (registration, login, logout, user deletion)

Notes:
- All tables use UUID primary keys. RLS is enabled and enforces owner-only access via `auth.uid()`.
- Timestamps are UTC (`timestamptz`).
- Important DB constraints to reflect in validation:
  - `cards.front`/`cards.back`: 1–2000 chars; `cards.source` in `['manual','ai']`.
  - `ai_generations.source_text`: 1000–10000 chars.
  - `ai_suggestions.front`/`back`: 1–2000 chars; `status` in `['proposed','edited','accepted','rejected']`.
  - `reviews.rating`: integer in [0,3].
  - Soft-archive available on `decks.is_archived`, `cards.is_archived`.

Assumptions:
- Authentication uses Supabase JWT (client obtains it via Supabase Auth). API endpoints verify and forward the Supabase JWT; RLS enforces per-user data isolation.
- Account deletion is implemented server-side via service role. Deleting the user cascades to owned rows (`ON DELETE CASCADE`).
- For PRD/UI ratings potentially shown as 1–5, the API accepts `rating` in [0,3]; client maps UI scale to DB scale.

## 2. Endpoints

### 2.1 Authentication
Supabase Auth is the system of record. These endpoints are thin wrappers (optional) for the frontend; you may also call Supabase Auth directly from the client.

- POST /auth/register
  - Description: Register a new user (proxy to Supabase Auth sign-up)
  - Request:
  ```json
    { "email": "string", "password": "string" }
  ```
- Response (201):
  ```json
  { "userId": "uuid", "email": "string" }
  ```
  - Success: 201
  - Errors: 400 (validation), 409 (email in use), 500 (auth service error)

- POST /auth/login
  - Description: Authenticate user (proxy to Supabase Auth sign-in)
  - Request:
  ```json
    { "email": "string", "password": "string" }
  ```
- Response (200):
  ```json
    { "accessToken": "jwt", "refreshToken": "string" }
    ```
  - Success: 200
  - Errors: 401 (invalid credentials), 400 (validation), 500 (auth service error)

- POST /auth/logout
  - Description: Invalidate refresh token / session
  - Success: 204
  - Errors: 401 (unauthenticated)

- DELETE /users/me
  - Description: Deletes the authenticated user and cascades data (service role required server-side)
  - Success: 204
  - Errors: 401 (unauthenticated), 500 (deletion failure)

- GET /profiles/me
  - Description: Returns current profile
  - Response (200):
    ```json
    { "id": "uuid", "display_name": "string|null", "timezone": "string|null", "locale": "string|null", "created_at": "iso8601", "updated_at": "iso8601" }
    ```
  - Success: 200
  - Errors: 401

- PUT /profiles/me
  - Description: Update current profile
  - Request:
    ```json
    { "display_name?": "string|null", "timezone?": "IANA string|null", "locale?": "BCP47 string|null" }
    ```
  - Response (200): Updated profile
  - Success: 200
  - Errors: 400 (invalid timezone/locale), 401

Authentication requirements (apply to all endpoints below unless noted):
- Require `Authorization: Bearer <supabase_jwt>`
- Verify JWT signature and audience; use Supabase client with the incoming JWT to execute queries under RLS.

---

### 2.2 Decks
- GET /decks
  - Description: List user decks (non-archived by default)
  - Query:
    - `page` (int, default 1), `per_page` (int, default 20, max 100)
    - `is_archived` (boolean, default false)
    - `search` (string; matches `name` case-insensitive)
    - `sort` in [`created_at`,`updated_at`,`name`], `order` in [`asc`,`desc`] (defaults: `updated_at desc`)
- Response (200):
  ```json
    { "items": [ { "id": "uuid", "name": "string", "slug": "string", "language_code": "string|null", "is_archived": false, "created_at": "iso8601", "updated_at": "iso8601" } ], "page": 1, "per_page": 20, "total": 42 }
    ```
  - Success: 200
  - Errors: 401

- POST /decks
  - Description: Create a deck
  - Request:
  ```json
    { "name": "string", "slug?": "string", "language_code?": "string", "is_archived?": false }
  ```
  - Behavior: If `slug` missing, generate from `name`. Enforce unique `(user_id, slug)`.
  - Response (201): Deck object
  - Success: 201
  - Errors: 400 (validation), 409 (slug taken), 401

- GET /decks/{deckId}
  - Description: Retrieve a deck
- Response (200): Deck object
  - Success: 200
  - Errors: 404 (not found), 401

- PUT /decks/{deckId}
  - Description: Update mutable fields (`name`, `slug`, `language_code`, `is_archived`)
  - Request: same shape as POST (all optional)
- Response (200): Updated deck
  - Success: 200
  - Errors: 409 (slug conflict), 400 (validation), 404, 401

- DELETE /decks/{deckId}
  - Description: Soft delete by setting `is_archived = true` (idempotent)
  - Success: 204
  - Errors: 404, 401

- POST /decks/{deckId}/restore
  - Description: Un-archive a deck
  - Response (200): Deck
  - Success: 200
  - Errors: 404, 401

- DELETE /decks/{deckId}/hard
  - Description: Permanently delete a deck (cascades to cards)
  - Success: 204
  - Errors: 404, 401

---

### 2.3 Cards
- GET /decks/{deckId}/cards
  - Description: List cards in a deck
  - Query:
    - `page`, `per_page` (defaults 1/50, max 200)
    - `is_archived` (boolean, default false)
    - `source` in [`manual`,`ai`]
    - `due_before` (iso8601) to fetch due cards for study
    - `sort` in [`created_at`,`updated_at`,`due_at`,`interval_days`], `order` asc|desc
  - Response (200):
    ```json
    { "items": [ { "id": "uuid", "deck_id": "uuid", "front": "string", "back": "string", "source": "manual|ai", "is_archived": false, "language_code": "string|null", "due_at": "iso8601|null", "last_reviewed_at": "iso8601|null", "repetitions_count": 0, "lapses_count": 0, "ease_factor": 2.5, "interval_days": 0, "created_at": "iso8601", "updated_at": "iso8601" } ], "page": 1, "per_page": 50, "total": 123 }
    ```
  - Success: 200
  - Errors: 404 (deck not found), 401

- POST /decks/{deckId}/cards
  - Description: Create a card (manual or from accepted suggestion)
  - Request:
    ```json
    { "front": "string(1..2000)", "back": "string(1..2000)", "language_code?": "string" }
    ```
  - Response (201): Card object
  - Success: 201
  - Errors: 400 (validation), 404 (deck not found), 401

- GET /decks/{deckId}/cards/{cardId}
  - Description: Retrieve a card
  - Response (200): Card
  - Success: 200
  - Errors: 404, 401

- PUT /decks/{deckId}/cards/{cardId}
  - Description: Update card content/flags
  - Request:
  ```json
    { "front?": "string(1..2000)", "back?": "string(1..2000)", "is_archived?": boolean, "language_code?": "string" }
    ```
  - Response (200): Updated card
  - Success: 200
  - Errors: 400 (validation), 404, 401

- DELETE /decks/{deckId}/cards/{cardId}
  - Description: Permanently delete a card (PRD requires permanent deletion after user confirmation)
  - Success: 204
  - Errors: 404, 401

- POST /decks/{deckId}/cards/{cardId}/archive
  - Description: Archive a card (non-destructive)
  - Response (200): Card
  - Success: 200
  - Errors: 404, 401

- POST /decks/{deckId}/cards/{cardId}/restore
  - Description: Un-archive a card
  - Response (200): Card
  - Success: 200
  - Errors: 404, 401

---

### 2.4 AI Generations & Suggestions
Workflow: user submits `source_text` → `ai_generations` record created (status: pending) → background job calls OpenRouter model → suggestions stored in `ai_suggestions` (status: `proposed`) → user can edit/accept/reject; on accept, create `cards` row and set `ai_suggestions.card_id` + `status='accepted'` + `accepted_at`.

- POST /ai/generations
  - Description: Initiate AI generation from source text
  - Request:
    ```json
    { "source_text": "string(1000..10000)", "model?": "string", "prompt_version?": "string" }
    ```
  - Response (202):
    ```json
    { "generation_id": "uuid", "status": "pending" }
    ```
  - Success: 202
  - Errors: 400 (length constraints), 429 (rate limited), 401, 500 (provider failure)

- GET /ai/generations
  - Description: List user generations
  - Query: `page`, `per_page`, `status?`, `sort` in [`created_at`,`updated_at`], `order`
  - Response (200): Paginated list of generations
  - Success: 200
  - Errors: 401

- GET /ai/generations/{generationId}
  - Description: Retrieve generation with metadata
  - Response (200):
    ```json
    { "id": "uuid", "source_text": "string", "model": "string|null", "prompt_version": "string|null", "tokens_input": 0, "tokens_output": 0, "cost_usd": 0.0, "status": "string", "error": { }|null, "ai_metadata": { }|null, "created_at": "iso8601", "updated_at": "iso8601" }
    ```
  - Success: 200
  - Errors: 404, 401

- GET /ai/generations/{generationId}/suggestions
  - Description: List suggestions produced by a generation
  - Query: `status?` in [`proposed`,`edited`,`accepted`,`rejected`], `page`, `per_page`
  - Response (200): Paginated suggestions
  - Success: 200
  - Errors: 404, 401

- PUT /ai/suggestions/{suggestionId}
  - Description: Edit a suggestion’s `front`/`back` or set `status` to `edited`/`rejected`
  - Request:
  ```json
    { "front?": "string(1..2000)", "back?": "string(1..2000)", "status?": "edited|rejected" }
    ```
  - Response (200): Updated suggestion
  - Success: 200
  - Errors: 400 (validation), 404, 401

- POST /ai/suggestions/{suggestionId}/accept
  - Description: Accept suggestion and create a card in target deck
  - Request:
    ```json
    { "deck_id": "uuid", "language_code?": "string" }
    ```
  - Response (201):
    ```json
    { "suggestion": { "id": "uuid", "status": "accepted", "accepted_at": "iso8601", "card_id": "uuid" }, "card": { /* card object */ } }
    ```
  - Success: 201
  - Errors: 400 (already accepted/rejected), 404 (deck/suggestion not found), 409 (duplicate if unique rule enabled), 401

- POST /ai/generations/{generationId}/accept-batch
  - Description: Bulk-accept multiple suggestions into a deck
  - Request:
    ```json
    { "suggestion_ids": ["uuid", "uuid"], "deck_id": "uuid" }
    ```
  - Response (201):
    ```json
    { "created": [{ "suggestion_id": "uuid", "card_id": "uuid" }], "failed": [{ "suggestion_id": "uuid", "error": "string" }] }
    ```
  - Success: 201
  - Errors: 400 (empty/oversized batch), 404, 401

- DELETE /ai/generations/{generationId}
  - Description: Delete a generation and cascade suggestions
  - Success: 204
  - Errors: 404, 401

---

### 2.5 Study & Reviews
- GET /study/queue
  - Description: Fetch next due cards across all decks (or filtered by deck)
  - Query: `deck_id?` (uuid), `limit` (default 20, max 100)
  - Behavior: `WHERE user_id = auth.uid() AND is_archived = false AND (due_at IS NULL OR due_at <= now()) ORDER BY due_at NULLS LAST LIMIT :limit` (backed by index `(user_id, is_archived, due_at)`).
  - Response (200): Array of card objects
  - Success: 200
  - Errors: 401

- POST /cards/{cardId}/reviews
  - Description: Record a review for a card and update SRS fields (SM-2 compatible)
  - Request:
    ```json
    { "rating": 0, "duration_ms?": 1234 }
    ```
  - Response (201):
    ```json
    { "review": { "id": "uuid", "rating": 0, "duration_ms": 1234, "reviewed_at": "iso8601" }, "card": { /* updated card */ } }
    ```
  - Success: 201
  - Errors: 400 (rating out of range), 404 (card not found), 401

- POST /study-sessions
  - Description: Start a study session (optional feature)
  - Request:
  ```json
    { "notes?": "string" }
    ```
  - Response (201): Session object `{ id, started_at, ... }`
  - Success: 201
  - Errors: 401

- GET /study-sessions/{sessionId}
  - Description: Retrieve session
  - Response (200): Session object
  - Success: 200
  - Errors: 404, 401

- POST /study-sessions/{sessionId}/end
  - Description: Mark session as ended (`ended_at = now()`)
  - Response (200): Session
  - Success: 200
  - Errors: 404, 401

Note: If sessions are enabled, reviews may be augmented to record `session_id` via application logic (column can be added later if needed).

---

### 2.6 Statistics & Audit
- GET /me/statistics
  - Description: Aggregate metrics for the authenticated user
  - Response (200):
    ```json
    {
      "cards_total": 0,
      "cards_archived": 0,
      "cards_due": 0,
      "ai_generations_total": 0,
      "ai_suggestions_total": 0,
      "ai_suggestions_accepted": 0,
      "ai_acceptance_rate": 0.75,
      "reviews_total": 0,
      "last_reviewed_at": "iso8601|null"
    }
    ```
  - Success: 200
  - Errors: 401

- GET /decks/{deckId}/cards/{cardId}/audits
  - Description: Returns immutable edit history (if implemented; otherwise 501 Not Implemented)
  - Success: 501 in MVP

---

## 3. Authentication and Authorization
- Mechanism: Supabase Auth JWT in `Authorization: Bearer <token>`.
- Implementation details:
  - On each request, verify JWT and create a Supabase client scoped to the JWT for DB operations. RLS policies ensure the user can only access their rows (matching `user_id` or `id = auth.uid()` for `profiles`).
  - Service role key is only used server-side for privileged ops (e.g., account deletion, background AI jobs), never exposed to clients.
  - CORS: Restrict to app domains. Cookies are not required if using Authorization header.

Authorization rules (enforced by RLS):
- `profiles`: only owner can select/insert/update/delete where `id = auth.uid()`.
- `decks/cards/reviews/ai_generations/ai_suggestions/(study_sessions)`: only owner can select/insert/update/delete where `user_id = auth.uid()`.

Rate limiting & abuse protection:
- Global: 60 requests/min per user IP/user ID.
- AI generation: 5 requests per 5 minutes per user; size limits strictly enforced (1000–10000 chars).
- Bulk accept: limit `suggestion_ids` to ≤ 100 per request.

Background processing:
- AI generation POST enqueues a job; status transitions: `pending` → `running` → `succeeded|failed`. On success, suggestions are inserted in batch.

## 4. Validation and Business Logic

Validation (server-side; also mirror on client with Zod):
- Profiles:
  - `timezone`: valid IANA string, optional
  - `locale`: valid BCP 47 string, optional
- Decks:
  - `name`: non-empty string
  - `slug`: if provided, non-empty; enforce unique `(user_id, slug)`
  - `language_code`: optional, recommend 2-letter ISO 639-1
- Cards:
  - `front`, `back`: strings length 1–2000
  - `language_code`: optional
  - `is_archived`: boolean
- Reviews:
  - `rating`: integer in [0,3]
  - `duration_ms`: null or integer ≥ 0
- AI Generations:
  - `source_text`: string length 1000–10000
  - `model`, `prompt_version`: optional strings
- AI Suggestions:
  - `front`, `back`: strings length 1–2000
  - `status`: only `proposed|edited|accepted|rejected` transitions allowed
  - Accept requires `deck_id` and will set `accepted_at`, create `cards` row, and backfill `language_code` when provided
- Study Sessions (optional):
  - `notes`: optional string

Business logic:
- Deck deletion defaults to soft-archive (`is_archived = true`); hard delete endpoint provided.
- Card deletion is hard (PRD requirement). Archive/unarchive endpoints offer non-destructive alternatives for scheduling.
- AI suggestion acceptance creates a `cards` record tied to the user and target deck; sets suggestion to `accepted` and links `card_id`.
- Reviews update SRS fields on `cards` atomically within the same transaction:
  - Compute next `due_at`, update `last_reviewed_at`, `repetitions_count`, `lapses_count`, `ease_factor`, `interval_days` according to SM-2 rules.
- Statistics aggregate counts using indexed columns to keep queries efficient.

Errors & status codes (common):
- 200 OK, 201 Created, 202 Accepted (async jobs), 204 No Content
- 400 Bad Request (validation), 401 Unauthorized, 403 Forbidden (RLS denies), 404 Not Found, 409 Conflict (uniques), 422 Unprocessable (business rule), 429 Too Many Requests, 500 Internal Error

Security considerations:
- Enforce RLS on all DB access; never bypass with anon/public keys.
- Reject overlong inputs early to protect downstream AI costs.
- Audit logs are out-of-scope for MVP; consider Postgres logical decoding or triggers in future.
- PII/GDPR: implement user-driven deletion (`DELETE /users/me`) and export upon request (future endpoint).

Performance considerations:
- Use provided indexes:
  - `decks(user_id)`, `cards(user_id)`, `cards(deck_id)`, `cards(user_id,is_archived,due_at)`, `reviews(card_id,reviewed_at)`, `reviews(user_id,reviewed_at)`, `ai_generations(user_id,created_at)`, `ai_suggestions(user_id,status)`, `ai_suggestions(generation_id)`
- Paginate all list endpoints; cap `per_page`.
- Prefer `select count(*) over()` or a second lightweight count query for totals.
- Batch inserts/updates for AI suggestions and bulk-accept.

Implementation notes (Astro + Supabase + OpenRouter):
- API routes implemented in Astro endpoints. Use server-side Supabase client created from the incoming JWT for RLS-scoped queries.
- Background AI job can run via serverless function or queue; on completion, update `ai_generations.status` and insert `ai_suggestions`.
- OpenRouter: include `model`, `tokens` metadata in `ai_generations` rows; handle failures by populating `error` JSON.