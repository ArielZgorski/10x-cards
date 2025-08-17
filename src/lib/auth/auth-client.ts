/**
 * Client-side authentication helpers
 * Works with the cookie-based authentication system
 */

export interface User {
  id: string;
  email: string;
  display_name: string;
}

export interface Session {
  expires_at: number;
  expires_in: number;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

/**
 * Get current user session from server
 */
export async function getCurrentSession(): Promise<AuthState> {
  try {
    const response = await fetch('/api/auth/session', {
      credentials: 'include' // Include cookies
    });
    
    if (!response.ok) {
      return { user: null, session: null, loading: false };
    }
    
    const data = await response.json();
    return {
      user: data.user,
      session: data.session,
      loading: false
    };
  } catch (error) {
    console.error('Error getting session:', error);
    return { user: null, session: null, loading: false };
  }
}

/**
 * Make authenticated API request
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const defaultOptions: RequestInit = {
    credentials: 'include', // Include cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };
  
  const response = await fetch(url, defaultOptions);
  
  // If unauthorized, redirect to login
  if (response.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  
  return response;
}

/**
 * Sign in user
 */
export async function signIn(email: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> {
  try {
    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Login failed' };
    }
    
    return { success: true, user: data.user };
  } catch (error) {
    console.error('Sign in error:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Sign out user
 */
export async function signOut(): Promise<void> {
  try {
    await fetch('/api/auth/signout', {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.error('Sign out error:', error);
  } finally {
    // Always redirect to login
    window.location.href = '/login';
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getCurrentSession();
  return session.user !== null && session.session !== null;
}

/**
 * Require authentication - redirect to login if not authenticated
 */
export async function requireAuth(): Promise<User> {
  const session = await getCurrentSession();
  
  if (!session.user || !session.session) {
    window.location.href = '/login';
    throw new Error('Authentication required');
  }
  
  return session.user;
}
