import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createServerSupabaseClient } from '../../../db/supabase.client.ts';

export const prerender = false;

// Validation schema
const SignInSchema = z.object({
  email: z.string().email('Nieprawidłowy format email'),
  password: z.string().min(1, 'Hasło jest wymagane')
});

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = SignInSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(JSON.stringify({
        error: 'Błędne dane wejściowe',
        details: validationResult.error.errors.map(err => err.message)
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { email, password } = validationResult.data;
    
    // Create Supabase client
    const supabase = createServerSupabaseClient();
    
    // Attempt sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      // Map Supabase errors to user-friendly messages
      let errorMessage = 'Wystąpił błąd podczas logowania';
      
      switch (error.message) {
        case 'Invalid login credentials':
          errorMessage = 'Nieprawidłowy email lub hasło';
          break;
        case 'Email not confirmed':
          errorMessage = 'Email nie został potwierdzony';
          break;
        case 'Too many requests':
          errorMessage = 'Zbyt wiele prób logowania. Spróbuj ponownie za chwilę';
          break;
        default:
          if (error.message.includes('rate limit')) {
            errorMessage = 'Zbyt wiele prób. Spróbuj ponownie za chwilę';
          }
      }
      
      return new Response(JSON.stringify({
        error: errorMessage
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!data.session || !data.user) {
      return new Response(JSON.stringify({
        error: 'Nieprawidłowa odpowiedź serwera'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Set HTTP-only cookies for session management
    const { session, user } = data;
    // Compute cookie flags: cross-site embeds (e.g., iframe) require SameSite=None; Secure
    const originHeader = request.headers.get('origin') || '';
    let secure = import.meta.env.PROD;
    let sameSite: 'lax' | 'none' = 'lax';
    try {
      if (originHeader) {
        const originHost = new URL(originHeader).hostname;
        const serverHost = new URL(request.url).hostname;
        const isCrossSite = originHost !== serverHost;
        if (isCrossSite) {
          secure = true;
          sameSite = 'none';
        }
      }
    } catch {
      // ignore parsing errors, keep defaults
    }
    
    // Set access token cookie (expires with session)
    cookies.set('sb-access-token', session.access_token, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: session.expires_in,
      path: '/'
    });
    
    // Set refresh token cookie (longer expiry)
    if (session.refresh_token) {
      cookies.set('sb-refresh-token', session.refresh_token, {
        httpOnly: true,
        secure,
        sameSite,
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/'
      });
    }
    
    // Return user data and session info (without sensitive tokens)
    return new Response(JSON.stringify({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.user_metadata?.display_name || user.email?.split('@')[0]
      },
      session: {
        expires_at: session.expires_at,
        expires_in: session.expires_in
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Sign in error:', error);
    
    return new Response(JSON.stringify({
      error: 'Wystąpił nieoczekiwany błąd'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
