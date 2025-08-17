/**
 * DELETE /api/decks/[deckId]/hard - Permanently delete a deck and all its cards
 */

import type { APIRoute } from 'astro';
import { hardDeleteDeck } from '../../../../lib/deck.service';

export const DELETE: APIRoute = async ({ request, locals, params }) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const deckId = params.deckId;
    if (!deckId) {
      return createErrorResponse(400, 'Deck ID is required');
    }

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

    // Hard delete deck
    await hardDeleteDeck(supabase, deckId, user.id);

    const duration = Date.now() - startTime;
    console.log('Deck deleted permanently', { 
      requestId, 
      userId: user.id, 
      deckId,
      duration 
    });

    return new Response(null, {
      status: 204,
      headers: {
        'X-Request-ID': requestId,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Error deleting deck permanently', { 
      requestId, 
      duration,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });

    if (error instanceof Error && error.message.includes('not found')) {
      return createErrorResponse(404, 'Deck not found');
    }
    
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
