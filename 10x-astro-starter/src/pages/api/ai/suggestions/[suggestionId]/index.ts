/**
 * PUT /api/ai/suggestions/[suggestionId] - Update a suggestion
 */

import { z } from 'zod';
import type { APIRoute } from 'astro';

// Zod schema for suggestion updates
const UpdateSuggestionSchema = z.object({
  front: z.string().min(1).max(2000).optional(),
  back: z.string().min(1).max(2000).optional(),
  status: z.enum(['edited', 'rejected']).optional(),
});

export const PUT: APIRoute = async ({ request, locals, params }) => {
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

    const validationResult = UpdateSuggestionSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      return createErrorResponse(400, `Validation error: ${errors}`);
    }

    const updates = validationResult.data;

    // Update suggestion
    const { data, error } = await supabase
      .from('ai_suggestions')
      .update(updates)
      .eq('id', suggestionId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return createErrorResponse(404, 'Suggestion not found');
      }
      throw new Error(`Failed to update suggestion: ${error.message}`);
    }

    const duration = Date.now() - startTime;
    console.log('Suggestion updated successfully', { 
      requestId, 
      userId: user.id, 
      suggestionId,
      duration 
    });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Error updating suggestion', { 
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
