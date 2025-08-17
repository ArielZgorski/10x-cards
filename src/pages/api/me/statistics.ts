/**
 * GET /api/me/statistics - Get user statistics
 */

import type { APIRoute } from "astro";
import { getStudyStatistics } from "../../../lib/study.service";
import { requireAuth } from "../../../lib/auth/auth-helpers";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  return requireAuth(context, async (user, { locals }) => {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      const supabase = locals.supabase;

      // Get statistics
      const statistics = await getStudyStatistics(supabase, user.id);

      const duration = Date.now() - startTime;
      console.log("Statistics retrieved successfully", {
        requestId,
        userId: user.id,
        duration,
      });

      return new Response(JSON.stringify(statistics), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error("Error retrieving statistics", {
        requestId,
        duration,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return new Response(
        JSON.stringify({
          error: "Internal server error",
          status: 500,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  });
};
