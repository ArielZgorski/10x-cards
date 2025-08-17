import type { APIContext } from "astro";
import { createServerSupabaseClient } from "../../db/supabase.client.ts";

export interface AuthenticatedUser {
  id: string;
  email: string;
  display_name?: string;
}

export interface AuthResult {
  success: true;
  user: AuthenticatedUser;
}

export interface AuthError {
  success: false;
  error: string;
  status: number;
}

/**
 * Authenticate user from API request
 * Checks for access token in cookies or Authorization header
 */
export async function authenticateUser(
  context: APIContext,
): Promise<AuthResult | AuthError> {
  try {
    // Get access token from cookies or Authorization header
    const accessToken =
      context.cookies.get("sb-access-token")?.value ||
      context.request.headers.get("authorization")?.replace("Bearer ", "");

    if (!accessToken) {
      return {
        success: false,
        error: "Authentication required",
        status: 401,
      };
    }

    // Create Supabase client with access token
    const supabase = createServerSupabaseClient(accessToken);

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: "Invalid or expired token",
        status: 401,
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email!,
        display_name:
          user.user_metadata?.display_name || user.email?.split("@")[0],
      },
    };
  } catch (error) {
    console.error("Authentication error:", error);
    return {
      success: false,
      error: "Authentication failed",
      status: 500,
    };
  }
}

/**
 * Create authenticated Supabase client for API requests
 */
export async function createAuthenticatedSupabaseClient(
  context: APIContext,
): Promise<
  { success: true; supabase: any; user: AuthenticatedUser } | AuthError
> {
  const authResult = await authenticateUser(context);

  if (!authResult.success) {
    return authResult;
  }

  const accessToken =
    context.cookies.get("sb-access-token")?.value ||
    context.request.headers.get("authorization")?.replace("Bearer ", "");

  const supabase = createServerSupabaseClient(accessToken);

  return {
    success: true,
    supabase,
    user: authResult.user,
  };
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  status: number,
  message: string,
  additionalHeaders: Record<string, string> = {},
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
        "Content-Type": "application/json",
        ...additionalHeaders,
      },
    },
  );
}

/**
 * Middleware function to ensure authentication for API routes
 */
export async function requireAuth(
  context: APIContext,
  handler: (user: AuthenticatedUser, context: APIContext) => Promise<Response>,
): Promise<Response> {
  const authResult = await authenticateUser(context);

  if (!authResult.success) {
    return createErrorResponse(authResult.status, authResult.error);
  }

  return handler(authResult.user, context);
}
