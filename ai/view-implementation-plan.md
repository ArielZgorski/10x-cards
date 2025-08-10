# API Endpoint Implementation Plan: POST /ai/generations

## 1. Przegląd punktu końcowego
- Purpose: Initiate an AI generation job from user-provided `source_text`. Returns an acknowledgment with a `generation_id` and initial `status = pending`.
- Business flow: Persist an `ai_generations` row under the authenticated user, enqueue background processing to call OpenRouter, then create related `ai_suggestions` rows. Users later list/review suggestions and accept into cards.
- Ownership & RLS: All rows are scoped by `user_id = auth.uid()` and protected by Supabase RLS.

## 2. Szczegóły żądania
- HTTP Method: POST
- URL Structure: `/api/ai/generations`
- Headers:
  - `Authorization: Bearer <supabase_jwt>` (required)
  - `Content-Type: application/json`
- Request Body (CreateAIGenerationCommand):
  ```json
  {
    "source_text": "string (1000..10000)",
    "model": "string (optional)",
    "prompt_version": "string (optional)"
  }
  ```
- Required parameters:
  - `source_text` (length 1000..10000)
- Optional parameters:
  - `model`, `prompt_version`

## 3. Wykorzystywane typy
- From `src/types.ts`:
  - `CreateAIGenerationCommand`
  - `AIGenerationDTO`
  - `UUID`, `ISODateTimeString`
- Internal response shape for this endpoint (202):
  ```ts
  type CreateAIGenerationAcceptedDTO = { generation_id: UUID; status: 'pending' };
  ```

## 3. Szczegóły odpowiedzi
- Success (202 Accepted):
  ```json
  { "generation_id": "uuid", "status": "pending" }
  ```
- Error codes:
  - 400: invalid input (schema/length)
  - 401: missing/invalid JWT
  - 429: rate limit exceeded
  - 500: server error (unexpected)

## 4. Przepływ danych
1. AuthN/AuthZ
   - Verify `Authorization` header; create a Supabase client from `context.locals.supabase` with user JWT (RLS enforced).
2. Validation
   - Validate body against Zod schema: `source_text` length [1000, 10000]; `model?`, `prompt_version?` as optional strings.
3. Rate limiting
   - Apply per-user limit (e.g., max 5 requests per 5 minutes). Strategy options:
     - Quick: track counts in memory (per-instance, non-distributed) with fallback to 429.
     - Durable: add `rate_limits` table or use a lightweight KV/Upstash. For MVP, implement in-memory with clear TODO for durable option.
4. Persist generation (status=pending)
   - Insert `ai_generations` row: `{ user_id: auth.uid, source_text, model, prompt_version, status: 'pending' }`.
   - Return `202` with `{ generation_id, status: 'pending' }`.
5. Background job
   - Enqueue async task with payload: `{ generation_id, user_id, model, prompt_version }`.
   - The worker (serverless/queue/cron) will:
     - Update `ai_generations.status` to `running`.
     - Call OpenRouter with prompt, track `tokens_input`, `tokens_output`, and `cost_usd` (if available in response headers/metadata).
      - On success, transform model output into a normalized list of suggestions `{front, back}` and bulk insert into `ai_suggestions` with `status='proposed'` and `user_id`.
     - Update `ai_generations.status` to `succeeded` and set `ai_metadata` as useful attribution (model, latency, etc.).
     - On failure, set `status='failed'` and write full error detail to `error` JSONB; retain `ai_metadata` if any.

## 5. Względy bezpieczeństwa
- Authentication: Require Supabase JWT; do not proceed without a valid token.
- Authorization: Use RLS by creating a Supabase client from `context.locals.supabase` with the incoming JWT; all DB operations are scoped.
- Input hard limits: enforce `source_text` length and optionally trim; reject binary or non-UTF-8 input.
- Abuse control: rate limit; optional idempotency via `Idempotency-Key` header (can be added later).
- Secrets: background worker uses service role key for OpenRouter callbacks only if needed; never expose service key to clients.
- Prompt safety: basic prompt-injection hygiene by constraining system prompts server-side; do not echo user secrets in prompts.
- CORS: restrict to app domains.

## 6. Obsługa błędów
- 400 Bad Request: invalid schema, out-of-range `source_text` length.
- 401 Unauthorized: missing/invalid token.
- 429 Too Many Requests: user exceeded generation rate limit.
- 500 Internal Server Error: unexpected exceptions.
- Background failure path:
  - Set `ai_generations.status='failed'` and `error` JSONB with diagnostic data (provider status, response body excerpt, request id, timing).
- Logging:
  - Server logs (console) with request id and user id.
  - Persisted error context in `ai_generations.error`.

## 7. Rozważania dotyczące wydajności
- Async processing: immediate 202 response; heavy work runs out-of-band.
- Bulk insert `ai_suggestions` in a single statement (values array) to reduce roundtrips.
- Index usage: `idx_ai_generations_user_created` supports listing; `ai_suggestions (user_id, status)` supports filtering later.
- Timeouts/retries: set OpenRouter HTTP timeout (e.g., 30s) and retry policy with jitter (e.g., 2 retries for transient 5xx).
- Payload size: reject inputs above 10k chars early.

## 8. Etapy wdrożenia
1. File structure
   - Create endpoint: `src/pages/api/ai/generations/index.ts` (Astro API route).
   - Create service module: `src/lib/ai/generation.service.ts` (business logic & OpenRouter integration).
   - Optional: `src/lib/rate-limit.ts` helper for per-user rate limiting.
2. Types & schemas
   - Reuse `CreateAIGenerationCommand` from `src/types.ts`.
   - Define Zod schema mirroring the DTO and DB constraints.
   - Define response type `{ generation_id: UUID; status: 'pending' }`.
3. Endpoint handler (index.ts)
   - Parse and validate JSON body using Zod.
   - Authenticate via `context.locals.supabase` (use JWT from headers).
   - Enforce rate limiting (return 429 on breach).
   - Insert into `ai_generations` with `status='pending'` using RLS-scoped client.
   - Schedule background job (see step 4) and return 202.
4. Background worker (generation.service.ts)
   - Expose `runAIGeneration({ generationId, userId, model, promptVersion })`.
   - Update generation to `running`.
   - Compose prompt (server-controlled system prompt + user `source_text`).
   - Call OpenRouter; capture token usage/costs if available.
   - Normalize outputs to `{ front, back }[]` and bulk insert into `ai_suggestions`.
   - Update generation to `succeeded` and write `ai_metadata`.
   - On error, set `failed` and persist error JSON.
5. Configuration
   - Ensure `SUPABASE_URL`, `SUPABASE_KEY` are present (client key). Service role for background tasks is read from secure server-side env only.
   - Add `OPENROUTER_API_KEY` env var for model calls.
6. Testing
   - Unit tests for validation and service-level transformation logic.
   - Integration tests: RLS checks, rate limit boundaries, end-to-end happy path.
7. Observability
   - Log structured entries with `generation_id`, `user_id`, latency, token counts, provider request id.
   - Optional metrics: counts of succeeded/failed generations.
8. Rollout
   - Deploy behind feature flag if needed.
   - Monitor rate of 429 and provider failures; tune limits accordingly.

## 9. Pseudocode (high-level)
```ts
// src/pages/api/ai/generations/index.ts
import { z } from 'zod';
import type { APIRoute } from 'astro';
import { ensureRateLimit } from '@/lib/rate-limit';
import { enqueueGeneration } from '@/lib/ai/generation.service';

const BodySchema = z.object({
  source_text: z.string().min(1000).max(10000),
  model: z.string().optional(),
  prompt_version: z.string().optional(),
});

export const POST: APIRoute = async ({ request, locals }) => {
  const supabase = locals.supabase; // use scoped client per project rules
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return new Response('Bad Request', { status: 400 });

  const user = await supabase.auth.getUser();
  if (!user.data.user) return new Response('Unauthorized', { status: 401 });

  const userId = user.data.user.id;
  const limited = await ensureRateLimit(userId, 'ai_generation');
  if (!limited.ok) return new Response('Too Many Requests', { status: 429 });

  const { source_text, model, prompt_version } = parsed.data;
  const { data, error } = await supabase
    .from('ai_generations')
    .insert({ user_id: userId, source_text, model, prompt_version, status: 'pending' })
    .select('id')
    .single();
  if (error) return new Response('Server Error', { status: 500 });

  enqueueGeneration({ generationId: data.id, userId, model, promptVersion: prompt_version });

  return new Response(JSON.stringify({ generation_id: data.id, status: 'pending' }), {
    status: 202,
    headers: { 'content-type': 'application/json' },
  });
};
```

```ts
// src/lib/ai/generation.service.ts
export async function enqueueGeneration(payload: { generationId: string; userId: string; model?: string; promptVersion?: string }) {
  // For MVP: fire-and-forget (no queue) with setTimeout; production: use a queue/worker
  setTimeout(() => runAIGeneration(payload).catch(() => {}), 0);
}

export async function runAIGeneration({ generationId, userId, model, promptVersion }: { generationId: string; userId: string; model?: string; promptVersion?: string }) {
  // 1) elevate to service role client for background write operations
  // 2) update ai_generations.status = 'running'
  // 3) call OpenRouter and gather results + token usage
  // 4) insert ai_suggestions in bulk
  // 5) update ai_generations.status = 'succeeded' and ai_metadata
  // 6) on error: set status='failed' and error json
}
```

