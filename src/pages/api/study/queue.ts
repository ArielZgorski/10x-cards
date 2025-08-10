/**
 * GET /api/study/queue - Get cards due for study
 */

import { z } from 'zod';
import type { APIRoute } from 'astro';
import { getDueCards } from '../../../lib/flashcard.service';

// Zod schema for query parameters
const StudyQueueQuerySchema = z.object({
  deck_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const GET: APIRoute = async ({ request, locals, url }) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Authentication
    const supabase = locals.supabase;
    if (!supabase) {
      console.error('Supabase client not available', { requestId });
      return createErrorResponse(500, 'Internal server error');
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse(401, 'Authorization header required');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return createErrorResponse(401, 'Invalid or expired token');
    }

    // Parse query parameters
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const validationResult = StudyQueueQuerySchema.safeParse(queryParams);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      return createErrorResponse(400, `Query validation error: ${errors}`);
    }

    const { deck_id, limit } = validationResult.data;

    // Get due cards
    const cards = await getDueCards(supabase, user.id, { deck_id, limit });

    const duration = Date.now() - startTime;
    console.log('Study queue retrieved successfully', { 
      requestId, 
      userId: user.id, 
      deckId: deck_id,
      count: cards.length,
      duration 
    });

    return new Response(JSON.stringify(cards), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Error retrieving study queue', { 
      requestId, 
      duration,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    return createErrorResponse(500, 'Internal server error');
  }
};

/**
 * Helper function to create standardized error responses
 */
function createErrorResponse(
  status: number, 
  message: string, 
  additionalHeaders: Record<string, string> = {}
): Response {
  return new Response(
    JSON.stringify({ 
      error: message,
      status,
      timestamp: new Date().toISOString(),
    }), 
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...additionalHeaders,
      },
    }
  );
}
