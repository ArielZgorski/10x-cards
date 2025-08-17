/**
 * POST /api/ai/suggestions/[suggestionId]/accept - Accept a suggestion and create a card
 */

import { z } from 'zod';
import type { APIRoute } from 'astro';
import { getDeckById } from '../../../../../lib/deck.service';

// Zod schema for accepting suggestions
const AcceptSuggestionSchema = z.object({
  deck_id: z.string().uuid('Invalid deck ID format'),
  language_code: z.string().min(2).max(10).optional(),
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
    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch (error) {
      return createErrorResponse(400, 'Invalid JSON in request body');
    }

    const validationResult = AcceptSuggestionSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      return createErrorResponse(400, `Validation error: ${errors}`);
    }

    const { deck_id, language_code } = validationResult.data;

    // Verify deck exists and belongs to user
    const deck = await getDeckById(supabase, deck_id, user.id);
    if (!deck) {
      return createErrorResponse(404, 'Deck not found');
    }

    // Get suggestion and verify it's not already accepted/rejected
    const { data: suggestion, error: suggestionError } = await supabase
      .from('ai_suggestions')
      .select()
      .eq('id', suggestionId)
      .eq('user_id', user.id)
      .single();

    if (suggestionError) {
      if (suggestionError.code === 'PGRST116') {
        return createErrorResponse(404, 'Suggestion not found');
      }
      throw new Error(`Failed to get suggestion: ${suggestionError.message}`);
    }

    if (suggestion.status === 'accepted' || suggestion.status === 'rejected') {
      return createErrorResponse(400, `Suggestion is already ${suggestion.status}`);
    }

    // Start transaction: create card and update suggestion
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .insert({
        user_id: user.id,
        deck_id,
        front: suggestion.front,
        back: suggestion.back,
        language_code: language_code || suggestion.language_code || null,
        source: 'ai',
      })
      .select()
      .single();

    if (cardError) {
      throw new Error(`Failed to create card: ${cardError.message}`);
    }

    // Update suggestion status
    const { data: updatedSuggestion, error: updateError } = await supabase
      .from('ai_suggestions')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        card_id: card.id,
      })
      .eq('id', suggestionId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      // Try to clean up the created card
      await supabase.from('cards').delete().eq('id', card.id);
      throw new Error(`Failed to update suggestion: ${updateError.message}`);
    }

    const result = {
      suggestion: updatedSuggestion,
      card: {
        id: card.id,
        deck_id: card.deck_id,
        front: card.front,
        back: card.back,
        source: card.source,
        is_archived: card.is_archived,
        language_code: card.language_code,
        due_at: card.due_at,
        last_reviewed_at: card.last_reviewed_at,
        repetitions_count: card.repetitions_count,
        lapses_count: card.lapses_count,
        ease_factor: card.ease_factor,
        interval_days: card.interval_days,
        created_at: card.created_at,
        updated_at: card.updated_at,
      }
    };

    const duration = Date.now() - startTime;
    console.log('Suggestion accepted successfully', { 
      requestId, 
      userId: user.id, 
      suggestionId,
      cardId: card.id,
      duration 
    });

    return new Response(JSON.stringify(result), {
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
