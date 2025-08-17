import type { APIRoute } from 'astro';
import { createServerSupabaseClient } from '../../../db/supabase.client.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Get access token from cookies or Authorization header
    const accessToken = cookies.get('sb-access-token')?.value || 
                       request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (accessToken) {
      // Create Supabase client with access token
      const supabase = createServerSupabaseClient(accessToken);
      
      // Sign out from Supabase (invalidates the token)
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Supabase signout error:', error);
        // Continue to clear cookies even if Supabase signout fails
      }
    }
    
    // Clear auth cookies
    cookies.delete('sb-access-token', { path: '/' });
    cookies.delete('sb-refresh-token', { path: '/' });
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Zostałeś wylogowany'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Sign out error:', error);
    
    // Even if there's an error, clear cookies
    cookies.delete('sb-access-token', { path: '/' });
    cookies.delete('sb-refresh-token', { path: '/' });
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Zostałeś wylogowany'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
