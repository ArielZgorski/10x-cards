# AI Generations API

## POST /api/ai/generations

Initiates an AI generation job to create flashcard suggestions from source text.

### Authentication

Requires `Authorization: Bearer <supabase_jwt>` header.

### Request Body

```json
{
  "source_text": "string (1000-10000 characters)",
  "model": "string (optional)",
  "prompt_version": "string (optional)"
}
```

### Response

**Success (202 Accepted):**
```json
{
  "generation_id": "uuid",
  "status": "pending"
}
```

**Error (400 Bad Request):**
```json
{
  "error": "Validation error: source_text: Source text must be at least 1000 characters",
  "status": 400,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Error (401 Unauthorized):**
```json
{
  "error": "Authorization header required",
  "status": 401,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Error (429 Too Many Requests):**
```json
{
  "error": "Rate limit exceeded. Please try again later.",
  "status": 429,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Rate Limits

- 5 requests per 5 minutes per user for AI generation
- Headers include rate limit information:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining in current window
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

### Background Processing

The actual AI processing happens asynchronously. Check the generation status using:
- `GET /api/ai/generations/{generationId}` (to be implemented)
- `GET /api/ai/generations/{generationId}/suggestions` (to be implemented)

### Environment Variables Required

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
OPENROUTER_API_KEY=your_openrouter_api_key
```

### Example Usage

```javascript
const response = await fetch('/api/ai/generations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseJwt}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    source_text: 'Your source material here...' // Must be 1000-10000 chars
  }),
});

const result = await response.json();
console.log(result.generation_id); // Use this to check status later
```
