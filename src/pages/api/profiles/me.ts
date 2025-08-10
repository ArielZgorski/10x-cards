/**
 * GET /api/profiles/me - Get current user profile
 * PUT /api/profiles/me - Update current user profile
 */

import { z } from 'zod';
import type { APIRoute } from 'astro';
import type { UpdateProfileCommand } from '../../../types';
import { getProfile, upsertProfile, validateTimezone, validateLocale } from '../../../lib/profile.service';

// Zod schema for profile updates
const UpdateProfileSchema = z.object({
  display_name: z.string().max(255).nullable().optional(),
  timezone: z.string().max(100).nullable().optional().refine(
    (tz) => !tz || validateTimezone(tz),
    'Invalid timezone'
  ),
  locale: z.string().max(20).nullable().optional().refine(
    (locale) => !locale || validateLocale(locale),
    'Invalid locale'
  ),
});

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

    // Get profile (or create if it doesn't exist)
    let profile = await getProfile(supabase, user.id);
    
    if (!profile) {
      // Create profile with default values
      profile = await upsertProfile(supabase, user.id, {});
    }

    const duration = Date.now() - startTime;
    console.log('Profile retrieved successfully', { 
      requestId, 
      userId: user.id, 
      duration 
    });

    return new Response(JSON.stringify(profile), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Error retrieving profile', { 
      requestId, 
      duration,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    return createErrorResponse(500, 'Internal server error');
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
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

    const validationResult = UpdateProfileSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      return createErrorResponse(400, `Validation error: ${errors}`);
    }

    const command: UpdateProfileCommand = validationResult.data;

    // Update profile
    const profile = await upsertProfile(supabase, user.id, command);

    const duration = Date.now() - startTime;
    console.log('Profile updated successfully', { 
      requestId, 
      userId: user.id, 
      duration 
    });

    return new Response(JSON.stringify(profile), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Error updating profile', { 
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
