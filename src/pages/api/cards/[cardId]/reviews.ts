/**
 * POST /api/cards/[cardId]/reviews - Create a review for a card and update SRS fields
 */

import { z } from "zod";
import type { APIRoute } from "astro";
import { createReview } from "../../../../lib/study.service";
import type { CreateReviewCommand } from "../../../../types";

// Zod schema for review creation
const CreateReviewSchema = z.object({
  rating: z.number().int().min(0).max(3, "Rating must be between 0 and 3"),
  duration_ms: z.number().int().min(0).optional(),
});

export const POST: APIRoute = async ({ request, locals, params }) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const cardId = params.cardId;
    if (!cardId) {
      return createErrorResponse(400, "Card ID is required");
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

    // Verify card exists and belongs to user
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id, user_id")
      .eq("id", cardId)
      .eq("user_id", user.id)
      .single();

    if (cardError) {
      if (cardError.code === "PGRST116") {
        return createErrorResponse(404, "Card not found");
      }
      throw new Error(`Failed to verify card: ${cardError.message}`);
    }

    // Parse and validate request body
    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch (error) {
      return createErrorResponse(400, "Invalid JSON in request body");
    }

    const validationResult = CreateReviewSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      return createErrorResponse(400, `Validation error: ${errors}`);
    }

    const { rating, duration_ms } = validationResult.data;

    // Create review and update card with SM-2
    const result = await createReview(supabase, cardId, user.id, {
      rating,
      duration_ms,
    });

    const duration = Date.now() - startTime;
    console.log("Review created successfully", {
      requestId,
      userId: user.id,
      cardId,
      reviewId: result.review.id,
      rating,
      duration,
    });

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Error creating review", {
      requestId,
      duration,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    if (error instanceof Error && error.message.includes("not found")) {
      return createErrorResponse(404, "Card not found");
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
