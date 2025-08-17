/**
 * POST /api/ai/generations/[generationId]/accept-batch - Bulk accept suggestions
 */

import { z } from "zod";
import type { APIRoute } from "astro";
import { createCard } from "../../../../../lib/flashcard.service";

// Zod schema for batch accept request
const AcceptBatchSchema = z.object({
  suggestion_ids: z.array(z.string().uuid()).min(1).max(100),
  deck_id: z.string().uuid(),
  language_code: z.string().max(10).optional(),
});

export const POST: APIRoute = async ({ request, locals, params }) => {
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

    // Parse and validate request body
    const json = await request.json().catch(() => null);
    const validationResult = AcceptBatchSchema.safeParse(json);

    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      return createErrorResponse(400, `Validation error: ${errors}`);
    }

    const { suggestion_ids, deck_id, language_code } = validationResult.data;

    // Verify deck belongs to user
    const { data: deck, error: deckError } = await supabase
      .from("decks")
      .select("id, user_id, language_code")
      .eq("id", deck_id)
      .eq("user_id", user.id)
      .single();

    if (deckError || !deck) {
      return createErrorResponse(404, "Deck not found");
    }

    // Verify generation belongs to user
    const { data: generation, error: generationError } = await supabase
      .from("ai_generations")
      .select("id, user_id")
      .eq("id", generationId)
      .eq("user_id", user.id)
      .single();

    if (generationError || !generation) {
      return createErrorResponse(404, "Generation not found");
    }

    // Get suggestions to accept
    const { data: suggestions, error: suggestionsError } = await supabase
      .from("ai_suggestions")
      .select("id, front, back, status, generation_id")
      .in("id", suggestion_ids)
      .eq("user_id", user.id)
      .eq("generation_id", generationId);

    if (suggestionsError) {
      throw new Error(`Failed to get suggestions: ${suggestionsError.message}`);
    }

    const created: { suggestion_id: string; card_id: string }[] = [];
    const failed: { suggestion_id: string; error: string }[] = [];

    // Process each suggestion
    for (const suggestion of suggestions) {
      try {
        // Check if suggestion can be accepted
        if (suggestion.status === "accepted") {
          failed.push({
            suggestion_id: suggestion.id,
            error: "Already accepted",
          });
          continue;
        }

        if (suggestion.status === "rejected") {
          failed.push({
            suggestion_id: suggestion.id,
            error: "Cannot accept rejected suggestion",
          });
          continue;
        }

        // Create card from suggestion
        const card = await createCard(supabase, deck_id, user.id, {
          front: suggestion.front,
          back: suggestion.back,
          language_code: language_code || deck.language_code || null,
          source: "ai" as const,
        });

        // Update suggestion to accepted
        const { error: updateError } = await supabase
          .from("ai_suggestions")
          .update({
            status: "accepted",
            accepted_at: new Date().toISOString(),
            card_id: card.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", suggestion.id)
          .eq("user_id", user.id);

        if (updateError) {
          console.warn("Failed to update suggestion after card creation", {
            suggestionId: suggestion.id,
            cardId: card.id,
            error: updateError,
          });
          // Card was created but suggestion update failed
          // We still count this as successful since the card exists
        }

        created.push({
          suggestion_id: suggestion.id,
          card_id: card.id,
        });
      } catch (error) {
        failed.push({
          suggestion_id: suggestion.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Handle suggestions that weren't found
    const foundSuggestionIds = suggestions.map((s) => s.id);
    const notFoundIds = suggestion_ids.filter(
      (id) => !foundSuggestionIds.includes(id),
    );

    for (const id of notFoundIds) {
      failed.push({
        suggestion_id: id,
        error: "Suggestion not found",
      });
    }

    const duration = Date.now() - startTime;
    console.log("Batch accept completed", {
      requestId,
      userId: user.id,
      generationId,
      createdCount: created.length,
      failedCount: failed.length,
      duration,
    });

    return new Response(
      JSON.stringify({
        created,
        failed,
      }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
        },
      },
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Error in batch accept", {
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
