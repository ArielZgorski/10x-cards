/**
 * GET /api/ai/generations/[generationId]/suggestions - List suggestions for a generation
 */

import { z } from 'zod';
import type { APIRoute } from 'astro';

// Zod schema for query parameters
const GetSuggestionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(['proposed', 'edited', 'accepted', 'rejected']).optional(),
});

export const GET: APIRoute = async ({ request, locals, params, url }) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const generationId = params.generationId;
    if (!generationId) {
      return createErrorResponse(400, 'Generation ID is required');
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

    // Verify generation exists and belongs to user
    const { data: generation, error: genError } = await supabase
      .from('ai_generations')
      .select('id')
      .eq('id', generationId)
      .eq('user_id', user.id)
      .single();

    if (genError) {
      if (genError.code === 'PGRST116') {
        return createErrorResponse(404, 'Generation not found');
      }
      throw new Error(`Failed to verify generation: ${genError.message}`);
    }

    // Parse query parameters
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const validationResult = GetSuggestionsQuerySchema.safeParse(queryParams);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      return createErrorResponse(400, `Query validation error: ${errors}`);
    }

    const { page, per_page, status } = validationResult.data;
    const offset = (page - 1) * per_page;

    // Get suggestions
    let query = supabase
      .from('ai_suggestions')
      .select('*', { count: 'exact' })
      .eq('generation_id', generationId)
      .eq('user_id', user.id);

    if (status) {
      query = query.eq('status', status);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + per_page - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to get suggestions: ${error.message}`);
    }

    const result = {
      items: data || [],
      total: count || 0,
      page,
      per_page
    };

    const duration = Date.now() - startTime;
    console.log('Suggestions retrieved successfully', { 
      requestId, 
      userId: user.id, 
      generationId,
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
    console.error('Error retrieving suggestions', { 
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
