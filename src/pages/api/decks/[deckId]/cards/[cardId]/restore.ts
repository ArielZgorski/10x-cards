/**
 * POST /api/decks/[deckId]/cards/[cardId]/restore - Restore an archived card
 */

import type { APIRoute } from 'astro';
import { restoreCard } from '../../../../../../lib/flashcard.service';
import { getDeckById } from '../../../../../../lib/deck.service';

export const POST: APIRoute = async ({ request, locals, params }) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const { deckId, cardId } = params;
    if (!deckId || !cardId) {
      return createErrorResponse(400, 'Deck ID and Card ID are required');
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

    // Verify deck exists and belongs to user
    const deck = await getDeckById(supabase, deckId, user.id);
    if (!deck) {
      return createErrorResponse(404, 'Deck not found');
    }

    // Restore card
    const card = await restoreCard(supabase, deckId, cardId, user.id);

    const duration = Date.now() - startTime;
    console.log('Card restored successfully', { 
      requestId, 
      userId: user.id, 
      deckId,
      cardId,
      duration 
    });

    return new Response(JSON.stringify(card), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Error restoring card', { 
      requestId, 
      duration,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });

    if (error instanceof Error && error.message.includes('not found')) {
      return createErrorResponse(404, 'Card not found');
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
