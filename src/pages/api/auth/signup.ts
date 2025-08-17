import type { APIRoute } from "astro";
import { z } from "zod";
import { createServerSupabaseClient } from "../../../db/supabase.client.ts";

export const prerender = false;

// Validation schema
const SignUpSchema = z.object({
  email: z.string().email("Nieprawidłowy format email"),
  password: z
    .string()
    .min(6, "Hasło musi mieć co najmniej 6 znaków")
    .regex(/^(?=.*[A-Za-z])(?=.*\d)/, "Hasło musi zawierać litery i cyfry"),
});

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = SignUpSchema.safeParse(body);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: "Błędne dane wejściowe",
          details: validationResult.error.errors.map((err) => err.message),
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const { email, password } = validationResult.data;

    // Create Supabase client
    const supabase = createServerSupabaseClient();

    // Attempt sign up
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: email.split("@")[0], // Set default display name
        },
      },
    });

    if (error) {
      // Map Supabase errors to user-friendly messages
      let errorMessage = "Wystąpił błąd podczas rejestracji";

      switch (error.message) {
        case "User already registered":
          errorMessage = "Konto z tym adresem email już istnieje";
          break;
        case "Password should be at least 6 characters":
          errorMessage = "Hasło musi mieć co najmniej 6 znaków";
          break;
        case "Signup is disabled":
          errorMessage = "Rejestracja jest obecnie wyłączona";
          break;
        default:
          if (error.message.includes("rate limit")) {
            errorMessage =
              "Zbyt wiele prób rejestracji. Spróbuj ponownie za chwilę";
          } else if (error.message.includes("weak password")) {
            errorMessage = "Hasło jest zbyt słabe";
          }
      }

      const statusCode = error.message.includes("already registered")
        ? 409
        : 400;

      return new Response(
        JSON.stringify({
          error: errorMessage,
        }),
        {
          status: statusCode,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (!data.user) {
      return new Response(
        JSON.stringify({
          error: "Nieprawidłowa odpowiedź serwera",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const { session, user } = data;

    // If session exists (auto-confirm enabled), set cookies
    if (session) {
      // Set access token cookie
      let secure = import.meta.env.PROD;
      let sameSite: "lax" | "none" = "lax";
      const originHeader = request.headers.get("origin") || "";
      try {
        if (originHeader) {
          const originHost = new URL(originHeader).hostname;
          const serverHost = new URL(request.url).hostname;
          const isCrossSite = originHost !== serverHost;
          if (isCrossSite) {
            secure = true;
            sameSite = "none";
          }
        }
      } catch {
        // ignore parsing errors
      }

      cookies.set("sb-access-token", session.access_token, {
        httpOnly: true,
        secure,
        sameSite,
        maxAge: session.expires_in,
        path: "/",
      });

      // Set refresh token cookie
      if (session.refresh_token) {
        cookies.set("sb-refresh-token", session.refresh_token, {
          httpOnly: true,
          secure,
          sameSite,
          maxAge: 60 * 60 * 24 * 30, // 30 days
          path: "/",
        });
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          display_name:
            user.user_metadata?.display_name || user.email?.split("@")[0],
        },
        session: session
          ? {
              expires_at: session.expires_at,
              expires_in: session.expires_in,
            }
          : null,
        message: session
          ? "Konto zostało utworzone i jesteś zalogowany"
          : "Konto zostało utworzone. Sprawdź email w celu potwierdzenia",
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Sign up error:", error);

    return new Response(
      JSON.stringify({
        error: "Wystąpił nieoczekiwany błąd",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
