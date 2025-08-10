/**
 * GET /api/decks/[deckId]/cards/[cardId] - Get a specific card
 * PUT /api/decks/[deckId]/cards/[cardId] - Update a card
 * DELETE /api/decks/[deckId]/cards/[cardId] - Permanently delete a card
 */

import { z } from 'zod';
import type { APIRoute } from 'astro';
import type { UpdateCardCommand } from '../../../../../../types';
import { getCardById, updateCard, deleteCard } from '../../../../../../lib/flashcard.service';
import { getDeckById } from '../../../../../../lib/deck.service';

// Zod schema for card updates
const UpdateCardSchema = z.object({
  front: z.string().min(1).max(2000).optional(),
  back: z.string().min(1).max(2000).optional(),
  is_archived: z.boolean().optional(),
  language_code: z.string().min(2).max(10).optional(),
});

export const GET: APIRoute = async ({ request, locals, params }) => {
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

    // Get card
    const card = await getCardById(supabase, deckId, cardId, user.id);
    
    if (!card) {
      return createErrorResponse(404, 'Card not found');
    }

    const duration = Date.now() - startTime;
    console.log('Card retrieved successfully', { 
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
    console.error('Error retrieving card', { 
      requestId, 
      duration,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    return createErrorResponse(500, 'Internal server error');
  }
};

export const PUT: APIRoute = async ({ request, locals, params }) => {
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

    // Parse and validate request body
    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch (error) {
      return createErrorResponse(400, 'Invalid JSON in request body');
    }

    const validationResult = UpdateCardSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      return createErrorResponse(400, `Validation error: ${errors}`);
    }

    const command: UpdateCardCommand = validationResult.data;

    // Update card
    const card = await updateCard(supabase, deckId, cardId, user.id, command);

    const duration = Date.now() - startTime;
    console.log('Card updated successfully', { 
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
    console.error('Error updating card', { 
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

export const DELETE: APIRoute = async ({ request, locals, params }) => {
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

    // Delete card permanently
    await deleteCard(supabase, deckId, cardId, user.id);

    const duration = Date.now() - startTime;
    console.log('Card deleted successfully', { 
      requestId, 
      userId: user.id, 
      deckId,
      cardId,
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
    console.error('Error deleting card', { 
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
