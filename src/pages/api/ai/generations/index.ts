/**
 * POST /api/ai/generations
 *
 * Initiate an AI generation job from user-provided source text.
 * Returns an acknowledgment with generation_id and status = pending.
 *
 * The actual AI processing happens asynchronously in the background.
 */

import { z } from "zod";
import type { APIRoute } from "astro";
import type { CreateAIGenerationCommand, UUID } from "../../../../types";
import { ensureRateLimit } from "../../../../lib/rate-limit";
import { enqueueGeneration } from "../../../../lib/ai/generation.service";
import {
  requireAuth,
  createErrorResponse,
} from "../../../../lib/auth/auth-helpers";

export const prerender = false;

// Response type for this endpoint
interface CreateAIGenerationAcceptedDTO {
  generation_id: UUID;
  status: "pending";
}

// Zod schema for request validation
const CreateAIGenerationSchema = z.object({
  source_text: z
    .string()
    .min(1000, "Source text must be at least 1000 characters")
    .max(10000, "Source text must not exceed 10000 characters")
    .refine((val) => val.trim().length >= 1000, {
      message:
        "Source text must contain at least 1000 non-whitespace characters",
    }),
  model: z
    .string()
    .optional()
    .refine((val) => !val || val.trim().length > 0, {
      message: "Model must be a non-empty string if provided",
    }),
  prompt_version: z
    .string()
    .optional()
    .refine((val) => !val || val.trim().length > 0, {
      message: "Prompt version must be a non-empty string if provided",
    }),
});

/**
 * POST handler for AI generation requests
 */
export const POST: APIRoute = async (context) => {
  return requireAuth(context, async (user, { request, locals }) => {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      const userId = user.id;
      const supabase = locals.supabase;

      console.log("AI generation request initiated", {
        requestId,
        userId,
        userAgent: request.headers.get("user-agent")?.substring(0, 100),
      });

      // 2. Parse and validate request body
      let requestBody: unknown;
      try {
        requestBody = await request.json();
      } catch (error) {
        console.warn("Invalid JSON in request body", {
          requestId,
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return createErrorResponse(400, "Invalid JSON in request body");
      }

      const validationResult = CreateAIGenerationSchema.safeParse(requestBody);
      if (!validationResult.success) {
        const errors = validationResult.error.errors
          .map((err) => `${err.path.join(".")}: ${err.message}`)
          .join(", ");

        console.warn("Request validation failed", {
          requestId,
          userId,
          errors,
          sourceTextLength: (requestBody as any)?.source_text?.length,
        });

        return createErrorResponse(400, `Validation error: ${errors}`);
      }

      const { source_text, model, prompt_version } = validationResult.data;

      // 3. Rate limiting
      const rateLimitResult = await ensureRateLimit(userId, "ai_generation");
      if (!rateLimitResult.ok) {
        console.warn("Rate limit exceeded", {
          requestId,
          userId,
          limit: rateLimitResult.limit,
          resetTime: new Date(rateLimitResult.resetTime).toISOString(),
        });

        return createErrorResponse(
          429,
          "Rate limit exceeded. Please try again later.",
          {
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
          },
        );
      }

      // 4. Persist generation record with status = 'pending'
      const { data: generationData, error: insertError } = await supabase
        .from("ai_generations")
        .insert({
          user_id: userId,
          source_text,
          model: model?.trim() || null,
          prompt_version: prompt_version?.trim() || null,
          status: "pending",
        })
        .select("id")
        .single();

      if (insertError || !generationData) {
        console.error("Failed to insert AI generation record", {
          requestId,
          userId,
          error: insertError?.message,
          code: insertError?.code,
        });

        return createErrorResponse(500, "Failed to create generation record");
      }

      const generationId = generationData.id;

      // 5. Enqueue background job for AI processing
      try {
        await enqueueGeneration({
          generationId,
          userId,
          model: model?.trim(),
          promptVersion: prompt_version?.trim(),
        });
      } catch (error) {
        console.error("Failed to enqueue background job", {
          requestId,
          userId,
          generationId,
          error: error instanceof Error ? error.message : "Unknown error",
        });

        // Update generation status to failed since we couldn't start processing
        await supabase
          .from("ai_generations")
          .update({
            status: "failed",
            error: {
              message: "Failed to enqueue background processing",
              timestamp: new Date().toISOString(),
            },
          })
          .eq("id", generationId);

        return createErrorResponse(500, "Failed to start AI processing");
      }

      // 6. Return success response (202 Accepted)
      const response: CreateAIGenerationAcceptedDTO = {
        generation_id: generationId,
        status: "pending",
      };

      const duration = Date.now() - startTime;
      console.log("AI generation request completed successfully", {
        requestId,
        userId,
        generationId,
        duration,
        sourceTextLength: source_text.length,
      });

      return new Response(JSON.stringify(response), {
        status: 202,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
          "X-RateLimit-Limit": rateLimitResult.limit.toString(),
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error("Unhandled error in AI generation endpoint", {
        requestId,
        duration,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });

      return createErrorResponse(500, "Internal server error");
    }
  });
};
