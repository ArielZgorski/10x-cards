/**
 * GET /api/decks - List user decks
 * POST /api/decks - Create a new deck
 */

import { z } from 'zod';
import type { APIRoute } from 'astro';
import type { CreateDeckCommand } from '../../../types';
import { createDeck, getDecks } from '../../../lib/deck.service';

// Zod schema for deck creation
const CreateDeckSchema = z.object({
  name: z.string().min(1, 'Deck name is required').max(255, 'Deck name too long'),
  slug: z.string().min(1).max(255).optional(),
  language_code: z.string().min(2).max(10).optional(),
  is_archived: z.boolean().optional().default(false),
});

// Zod schema for query parameters
const GetDecksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(20),
  is_archived: z.coerce.boolean().optional().default(false),
  search: z.string().optional(),
  sort: z.enum(['created_at', 'updated_at', 'name']).optional().default('updated_at'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
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
    const validationResult = GetDecksQuerySchema.safeParse(queryParams);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      return createErrorResponse(400, `Query validation error: ${errors}`);
    }

    const options = validationResult.data;

    // Get decks
    const result = await getDecks(supabase, user.id, options);

    const duration = Date.now() - startTime;
    console.log('Decks retrieved successfully', { 
      requestId, 
      userId: user.id, 
      count: result.items.length,
      duration 
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Error retrieving decks', { 
      requestId, 
      duration,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    return createErrorResponse(500, 'Internal server error');
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
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

    // Parse and validate request body
    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch (error) {
      return createErrorResponse(400, 'Invalid JSON in request body');
    }

    const validationResult = CreateDeckSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      return createErrorResponse(400, `Validation error: ${errors}`);
    }

    const command: CreateDeckCommand = validationResult.data;

    // Create deck
    const deck = await createDeck(supabase, user.id, command);

    const duration = Date.now() - startTime;
    console.log('Deck created successfully', { 
      requestId, 
      userId: user.id, 
      deckId: deck.id,
      duration 
    });

    return new Response(JSON.stringify(deck), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Error creating deck', { 
      requestId, 
      duration,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });

    if (error instanceof Error && error.message.includes('duplicate') || error.message.includes('unique')) {
      return createErrorResponse(409, 'Deck slug already exists');
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
