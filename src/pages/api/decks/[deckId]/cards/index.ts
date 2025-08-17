/**
 * GET /api/decks/[deckId]/cards - List cards in a deck
 * POST /api/decks/[deckId]/cards - Create a new card
 */

import { z } from "zod";
import type { APIRoute } from "astro";
import type { CreateCardCommand } from "../../../../../types";
import {
  createCard,
  getCardsInDeck,
} from "../../../../../lib/flashcard.service";
import { getDeckById } from "../../../../../lib/deck.service";

// Zod schema for card creation
const CreateCardSchema = z.object({
  front: z
    .string()
    .min(1, "Front text is required")
    .max(2000, "Front text too long"),
  back: z
    .string()
    .min(1, "Back text is required")
    .max(2000, "Back text too long"),
  language_code: z.string().min(2).max(10).optional(),
});

// Zod schema for query parameters
const GetCardsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(200).optional().default(50),
  is_archived: z.coerce.boolean().optional().default(false),
  source: z.enum(["manual", "ai"]).optional(),
  due_before: z.string().datetime().optional(),
  sort: z
    .enum(["created_at", "updated_at", "due_at", "interval_days"])
    .optional()
    .default("created_at"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const GET: APIRoute = async ({ request, locals, params, url }) => {
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

    // Verify deck exists and belongs to user
    const deck = await getDeckById(supabase, deckId, user.id);
    if (!deck) {
      return createErrorResponse(404, "Deck not found");
    }

    // Parse query parameters
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const validationResult = GetCardsQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      return createErrorResponse(400, `Query validation error: ${errors}`);
    }

    const options = validationResult.data;

    // Get cards
    const result = await getCardsInDeck(supabase, deckId, user.id, options);

    const duration = Date.now() - startTime;
    console.log("Cards retrieved successfully", {
      requestId,
      userId: user.id,
      deckId,
      count: result.items.length,
      duration,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Error retrieving cards", {
      requestId,
      duration,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return createErrorResponse(500, "Internal server error");
  }
};

export const POST: APIRoute = async ({ request, locals, params }) => {
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

    // Verify deck exists and belongs to user
    const deck = await getDeckById(supabase, deckId, user.id);
    if (!deck) {
      return createErrorResponse(404, "Deck not found");
    }

    // Parse and validate request body
    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch (error) {
      return createErrorResponse(400, "Invalid JSON in request body");
    }

    const validationResult = CreateCardSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      return createErrorResponse(400, `Validation error: ${errors}`);
    }

    const command: CreateCardCommand = validationResult.data;

    // Create card
    const card = await createCard(supabase, deckId, user.id, command);

    const duration = Date.now() - startTime;
    console.log("Card created successfully", {
      requestId,
      userId: user.id,
      deckId,
      cardId: card.id,
      duration,
    });

    return new Response(JSON.stringify(card), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Error creating card", {
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
