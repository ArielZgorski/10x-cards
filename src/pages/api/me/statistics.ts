/**
 * GET /api/me/statistics - Get user statistics
 */

import type { APIRoute } from 'astro';
import { getStudyStatistics } from '../../../lib/study.service';

export const GET: APIRoute = async ({ request, locals }) => {
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

    // Get statistics
    const statistics = await getStudyStatistics(supabase, user.id);

    const duration = Date.now() - startTime;
    console.log('Statistics retrieved successfully', { 
      requestId, 
      userId: user.id, 
      duration 
    });

    return new Response(JSON.stringify(statistics), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Error retrieving statistics', { 
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
