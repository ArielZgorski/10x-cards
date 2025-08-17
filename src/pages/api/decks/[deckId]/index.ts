/**
 * GET /api/decks/[deckId] - Get a specific deck
 * PUT /api/decks/[deckId] - Update a deck
 * DELETE /api/decks/[deckId] - Archive a deck (soft delete)
 */

import { z } from "zod";
import type { APIRoute } from "astro";
import type { UpdateDeckCommand } from "../../../../types";
import {
  getDeckById,
  updateDeck,
  archiveDeck,
} from "../../../../lib/deck.service";

// Zod schema for deck updates
const UpdateDeckSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).optional(),
  language_code: z.string().min(2).max(10).optional(),
  is_archived: z.boolean().optional(),
});

export const GET: APIRoute = async ({ request, locals, params }) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const deckId = params.deckId;
    if (!deckId) {
      return createErrorResponse(400, "Deck ID is required");
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

    // Get deck
    const deck = await getDeckById(supabase, deckId, user.id);

    if (!deck) {
      return createErrorResponse(404, "Deck not found");
    }

    const duration = Date.now() - startTime;
    console.log("Deck retrieved successfully", {
      requestId,
      userId: user.id,
      deckId,
      duration,
    });

    return new Response(JSON.stringify(deck), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Error retrieving deck", {
      requestId,
      duration,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return createErrorResponse(500, "Internal server error");
  }
};

export const PUT: APIRoute = async ({ request, locals, params }) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const deckId = params.deckId;
    if (!deckId) {
      return createErrorResponse(400, "Deck ID is required");
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

    // Parse and validate request body
    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch (error) {
      return createErrorResponse(400, "Invalid JSON in request body");
    }

    const validationResult = UpdateDeckSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      return createErrorResponse(400, `Validation error: ${errors}`);
    }

    const command: UpdateDeckCommand = validationResult.data;

    // Update deck
    const deck = await updateDeck(supabase, deckId, user.id, command);

    const duration = Date.now() - startTime;
    console.log("Deck updated successfully", {
      requestId,
      userId: user.id,
      deckId,
      duration,
    });

    return new Response(JSON.stringify(deck), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Error updating deck", {
      requestId,
      duration,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    if (error instanceof Error && error.message.includes("not found")) {
      return createErrorResponse(404, "Deck not found");
    }

    if (
      error instanceof Error &&
      (error.message.includes("duplicate") || error.message.includes("unique"))
    ) {
      return createErrorResponse(409, "Deck slug already exists");
    }

    return createErrorResponse(500, "Internal server error");
  }
};

export const DELETE: APIRoute = async ({ request, locals, params }) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const deckId = params.deckId;
    if (!deckId) {
      return createErrorResponse(400, "Deck ID is required");
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

    // Archive deck (soft delete)
    await archiveDeck(supabase, deckId, user.id);

    const duration = Date.now() - startTime;
    console.log("Deck archived successfully", {
      requestId,
      userId: user.id,
      deckId,
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
    console.error("Error archiving deck", {
      requestId,
      duration,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    if (error instanceof Error && error.message.includes("not found")) {
      return createErrorResponse(404, "Deck not found");
    }

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
