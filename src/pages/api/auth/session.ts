import type { APIRoute } from 'astro';
import { createServerSupabaseClient } from '../../../db/supabase.client.ts';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    // Get access token from cookies or Authorization header
    const accessTokenFromCookie = cookies.get('sb-access-token')?.value;
    const accessTokenFromHeader = request.headers.get('authorization')?.replace('Bearer ', '');
    let tokenToUse = accessTokenFromCookie || accessTokenFromHeader || '';
    
    // If access token missing but refresh token available, try to refresh session
    if (!tokenToUse) {
      const refreshToken = cookies.get('sb-refresh-token')?.value;
      if (refreshToken) {
        const supabaseForRefresh = createServerSupabaseClient();
        const { data: refreshData, error: refreshError } = await supabaseForRefresh.auth.refreshSession({
          refresh_token: refreshToken
        });
        if (!refreshError && refreshData.session) {
          tokenToUse = refreshData.session.access_token;
          // Re-issue cookies with new tokens
          cookies.set('sb-access-token', refreshData.session.access_token, {
            httpOnly: true,
            secure: import.meta.env.PROD,
            sameSite: 'lax',
            maxAge: refreshData.session.expires_in,
            path: '/'
          });
          if (refreshData.session.refresh_token) {
            cookies.set('sb-refresh-token', refreshData.session.refresh_token, {
              httpOnly: true,
              secure: import.meta.env.PROD,
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 30,
              path: '/'
            });
          }
        }
      }
    }

    // If no valid token at this point, return null state
    if (!tokenToUse) {
      return new Response(JSON.stringify({
        user: null,
        session: null
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create Supabase client with token (fresh or original)
    const supabase = createServerSupabaseClient(tokenToUse);

    // Validate token by fetching user using the Bearer token
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      // Clear invalid cookies
      cookies.delete('sb-access-token', { path: '/' });
      cookies.delete('sb-refresh-token', { path: '/' });
      
      return new Response(JSON.stringify({
        user: null,
        session: null
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Derive session expiry info from JWT (access token)
    let expiresAt = 0;
    let expiresIn = 0;
    try {
      const token = tokenToUse || '';
      const [, payloadB64] = token.split('.');
      if (payloadB64) {
        const payloadJson = Buffer.from(payloadB64, 'base64').toString('utf8');
        const payload = JSON.parse(payloadJson) as { exp?: number };
        if (payload.exp) {
          expiresAt = payload.exp;
          expiresIn = Math.max(payload.exp - Math.floor(Date.now() / 1000), 0);
        }
      }
    } catch {
      // If decoding fails, leave defaults (0) – not critical for auth state
    }

    // Return user and derived session data
    return new Response(JSON.stringify({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.user_metadata?.display_name || user.email?.split('@')[0]
      },
      session: {
        expires_at: expiresAt,
        expires_in: expiresIn
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Session check error:', error);
    
    // Clear cookies on error
    cookies.delete('sb-access-token', { path: '/' });
    cookies.delete('sb-refresh-token', { path: '/' });
    
    return new Response(JSON.stringify({
      user: null,
      session: null
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
