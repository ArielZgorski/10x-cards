/**
 * GET /api/ai/generations/[generationId] - Get a specific AI generation
 * DELETE /api/ai/generations/[generationId] - Delete a generation and its suggestions
 */

import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request, locals, params }) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const generationId = params.generationId;
    if (!generationId) {
      return createErrorResponse(400, "Generation ID is required");
    }

    // Authentication
    const supabase = locals.supabase;
    if (!supabase) {
      console.error("Supabase client not available", { requestId });
      return createErrorResponse(500, "Internal server error");
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return createErrorResponse(401, "Authorization header required");
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return createErrorResponse(401, "Invalid or expired token");
    }

    // Get generation
    const { data, error } = await supabase
      .from("ai_generations")
      .select()
      .eq("id", generationId)
      .eq("user_id", user.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return createErrorResponse(404, "Generation not found");
      }
      throw new Error(`Failed to get generation: ${error.message}`);
    }

    const duration = Date.now() - startTime;
    console.log("Generation retrieved successfully", {
      requestId,
      userId: user.id,
      generationId,
      duration,
    });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Error retrieving generation", {
      requestId,
      duration,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return createErrorResponse(500, "Internal server error");
  }
};

export const DELETE: APIRoute = async ({ request, locals, params }) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const generationId = params.generationId;
    if (!generationId) {
      return createErrorResponse(400, "Generation ID is required");
    }

    // Authentication
    const supabase = locals.supabase;
    if (!supabase) {
      console.error("Supabase client not available", { requestId });
      return createErrorResponse(500, "Internal server error");
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return createErrorResponse(401, "Authorization header required");
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return createErrorResponse(401, "Invalid or expired token");
    }

    // Delete generation (will cascade to suggestions)
    const { error } = await supabase
      .from("ai_generations")
      .delete()
      .eq("id", generationId)
      .eq("user_id", user.id);

    if (error) {
      throw new Error(`Failed to delete generation: ${error.message}`);
    }

    const duration = Date.now() - startTime;
    console.log("Generation deleted successfully", {
      requestId,
      userId: user.id,
      generationId,
      duration,
    });

    return new Response(null, {
      status: 204,
      headers: {
        "X-Request-ID": requestId,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Error deleting generation", {
      requestId,
      duration,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return createErrorResponse(500, "Internal server error");
  }
};

/**
 * Helper function to create standardized error responses
 */
function createErrorResponse(
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
