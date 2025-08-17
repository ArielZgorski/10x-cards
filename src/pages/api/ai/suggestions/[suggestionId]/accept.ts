/**
 * POST /api/ai/suggestions/[suggestionId]/accept - Accept AI suggestion and create card
 */

import { z } from 'zod';
import type { APIRoute } from 'astro';
import { createCard } from '../../../../../lib/flashcard.service';

// Zod schema for accept suggestion request
const AcceptSuggestionSchema = z.object({
  deck_id: z.string().uuid(),
  language_code: z.string().max(10).optional(),
});

export const POST: APIRoute = async ({ request, locals, params }) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const suggestionId = params.suggestionId;
    if (!suggestionId) {
      return createErrorResponse(400, 'Suggestion ID is required');
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

    // Parse and validate request body
    const json = await request.json().catch(() => null);
    const validationResult = AcceptSuggestionSchema.safeParse(json);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      return createErrorResponse(400, `Validation error: ${errors}`);
    }

    const { deck_id, language_code } = validationResult.data;

    // Verify deck belongs to user
    const { data: deck, error: deckError } = await supabase
      .from('decks')
      .select('id, user_id, language_code')
      .eq('id', deck_id)
      .eq('user_id', user.id)
      .single();

    if (deckError || !deck) {
      return createErrorResponse(404, 'Deck not found');
    }

    // Get suggestion and verify it belongs to user and can be accepted
    const { data: suggestion, error: suggestionError } = await supabase
      .from('ai_suggestions')
      .select('id, front, back, status, user_id')
      .eq('id', suggestionId)
      .eq('user_id', user.id)
      .single();

    if (suggestionError || !suggestion) {
      return createErrorResponse(404, 'Suggestion not found');
    }

    if (suggestion.status === 'accepted') {
      return createErrorResponse(400, 'Suggestion already accepted');
    }

    if (suggestion.status === 'rejected') {
      return createErrorResponse(400, 'Cannot accept rejected suggestion');
    }

    // Create card from suggestion
    const card = await createCard(supabase, deck_id, user.id, {
      front: suggestion.front,
      back: suggestion.back,
      language_code: language_code || deck.language_code || null,
      source: 'ai' as const,
    });

    // Update suggestion to accepted and link to card
    const { data: updatedSuggestion, error: updateError } = await supabase
      .from('ai_suggestions')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        card_id: card.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', suggestionId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating suggestion after card creation', { 
        requestId, 
        suggestionId, 
        error: updateError 
      });
      // Note: Card was created but suggestion update failed
      // In production, this should be handled with better transaction management
    }

    const duration = Date.now() - startTime;
    console.log('Suggestion accepted successfully', { 
      requestId, 
      userId: user.id, 
      suggestionId,
      cardId: card.id,
      duration 
    });

    return new Response(JSON.stringify({
      suggestion: updatedSuggestion || {
        id: suggestionId,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        card_id: card.id,
      },
      card,
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Error accepting suggestion', { 
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