/**
 * AI Generation Service
 * 
 * Handles background processing of AI generation jobs using OpenRouter
 * Implements the business logic for creating flashcard suggestions from source text
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../db/database.types';

// Types for the service
interface GenerationPayload {
  generationId: string;
  userId: string;
  model?: string;
  promptVersion?: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
}

interface FlashcardSuggestion {
  front: string;
  back: string;
}

/**
 * Enqueue an AI generation job for background processing
 * For MVP: fire-and-forget with setTimeout
 * TODO: Replace with proper queue system (e.g., Inngest, BullMQ) for production
 */
export async function enqueueGeneration(payload: GenerationPayload): Promise<void> {
  // Log the generation request for observability
  console.log('Enqueuing AI generation:', {
    generationId: payload.generationId,
    userId: payload.userId,
    model: payload.model,
    timestamp: new Date().toISOString(),
  });

  // For MVP: immediate background processing with setTimeout
  // In production, this would be a proper queue system
  setTimeout(() => {
    runAIGeneration(payload).catch((error) => {
      console.error('Background AI generation failed:', {
        generationId: payload.generationId,
        error: error.message,
        stack: error.stack,
      });
    });
  }, 0);
}

/**
 * Main background worker function for AI generation
 * Handles the complete flow from updating status to calling OpenRouter and storing results
 */
export async function runAIGeneration(payload: GenerationPayload): Promise<void> {
  const startTime = Date.now();
  let supabase: ReturnType<typeof createClient<Database>>;

  try {
    // Create service role client for background operations
    supabase = createServiceRoleClient();

    // 1. Update generation status to 'running'
    await updateGenerationStatus(supabase, payload.generationId, 'running');

    // 2. Get the generation details
    const generation = await getGeneration(supabase, payload.generationId);
    if (!generation) {
      throw new Error(`Generation ${payload.generationId} not found`);
    }

    // 3. Call OpenRouter API
    const openRouterResponse = await callOpenRouter(
      generation.source_text,
      payload.model || 'openai/gpt-3.5-turbo',
      payload.promptVersion || 'v1'
    );

    // 4. Parse and validate the AI response
    const suggestions = parseOpenRouterResponse(openRouterResponse);

    // 5. Bulk insert suggestions into ai_suggestions table
    await insertSuggestions(supabase, {
      generationId: payload.generationId,
      userId: payload.userId,
      suggestions,
    });

    // 6. Update generation to 'succeeded' with metadata
    const endTime = Date.now();
    const metadata = {
      model: openRouterResponse.model || payload.model,
      duration_ms: endTime - startTime,
      suggestions_count: suggestions.length,
      timestamp: new Date().toISOString(),
    };

    await updateGenerationSuccess(supabase, payload.generationId, {
      tokens_input: openRouterResponse.usage?.prompt_tokens || null,
      tokens_output: openRouterResponse.usage?.completion_tokens || null,
      ai_metadata: metadata,
    });

    console.log('AI generation completed successfully:', {
      generationId: payload.generationId,
      duration: endTime - startTime,
      suggestionsCount: suggestions.length,
    });

  } catch (error) {
    // Handle errors by updating generation status to 'failed'
    const endTime = Date.now();
    const errorData = {
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      duration_ms: endTime - startTime,
      stack: error instanceof Error ? error.stack : undefined,
    };

    if (supabase!) {
      await updateGenerationFailure(supabase, payload.generationId, errorData);
    }

    console.error('AI generation failed:', {
      generationId: payload.generationId,
      error: errorData,
    });

    // Re-throw to allow caller to handle if needed
    throw error;
  }
}

/**
 * Create Supabase client with service role for background operations
 */
function createServiceRoleClient() {
  const supabaseUrl = import.meta.env.SUPABASE_URL;
  const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration for service role');
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Update generation status
 */
async function updateGenerationStatus(
  supabase: ReturnType<typeof createClient<Database>>,
  generationId: string,
  status: string
): Promise<void> {
  const { error } = await supabase
    .from('ai_generations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', generationId);

  if (error) {
    throw new Error(`Failed to update generation status: ${error.message}`);
  }
}

/**
 * Get generation details
 */
async function getGeneration(
  supabase: ReturnType<typeof createClient<Database>>,
  generationId: string
) {
  const { data, error } = await supabase
    .from('ai_generations')
    .select('id, source_text, model, prompt_version')
    .eq('id', generationId)
    .single();

  if (error) {
    throw new Error(`Failed to get generation: ${error.message}`);
  }

  return data;
}

/**
 * Call OpenRouter API to generate flashcard suggestions
 */
async function callOpenRouter(
  sourceText: string,
  model: string,
  promptVersion: string
): Promise<OpenRouterResponse> {
  const openRouterApiKey = import.meta.env.OPENROUTER_API_KEY;

  if (!openRouterApiKey) {
    throw new Error('Missing OpenRouter API key configuration');
  }

  // Construct system prompt based on version
  const systemPrompt = getSystemPrompt(promptVersion);
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openRouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://10x-cards.com', // Replace with actual domain
      'X-Title': '10x Cards - Flashcard Generator',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: sourceText },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
  }

  const data: OpenRouterResponse = await response.json();
  
  if (!data.choices || data.choices.length === 0) {
    throw new Error('No choices returned from OpenRouter API');
  }

  return data;
}

/**
 * Get system prompt based on version
 */
function getSystemPrompt(version: string): string {
  switch (version) {
    case 'v1':
    default:
      return `You are an expert flashcard creator. Your task is to generate high-quality flashcard suggestions from the provided source text.

Rules:
1. Create 5-10 flashcards that cover the most important concepts
2. Each flashcard should have a clear, concise question (front) and a complete answer (back)
3. Questions should test understanding, not just memorization
4. Keep fronts under 200 characters and backs under 500 characters
5. Use simple, clear language
6. Avoid yes/no questions unless they test important concepts

Format your response as a JSON array of objects with "front" and "back" properties:
[
  {"front": "Question here?", "back": "Complete answer here"},
  {"front": "Another question?", "back": "Another answer"}
]

Only return the JSON array, no additional text.`;
  }
}

/**
 * Parse OpenRouter response and extract flashcard suggestions
 */
function parseOpenRouterResponse(response: OpenRouterResponse): FlashcardSuggestion[] {
  const content = response.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content in OpenRouter response');
  }

  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const jsonString = jsonMatch ? jsonMatch[0] : content;
    
    const parsed = JSON.parse(jsonString);
    
    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    // Validate and sanitize suggestions
    const suggestions: FlashcardSuggestion[] = parsed
      .filter((item): item is FlashcardSuggestion => {
        return (
          typeof item === 'object' &&
          item !== null &&
          typeof item.front === 'string' &&
          typeof item.back === 'string' &&
          item.front.length >= 1 &&
          item.front.length <= 2000 &&
          item.back.length >= 1 &&
          item.back.length <= 2000
        );
      })
      .map((item) => ({
        front: item.front.trim(),
        back: item.back.trim(),
      }));

    if (suggestions.length === 0) {
      throw new Error('No valid suggestions found in response');
    }

    return suggestions;
  } catch (error) {
    console.error('Failed to parse OpenRouter response:', { content, error });
    throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Bulk insert suggestions into ai_suggestions table
 */
async function insertSuggestions(
  supabase: ReturnType<typeof createClient<Database>>,
  params: {
    generationId: string;
    userId: string;
    suggestions: FlashcardSuggestion[];
  }
): Promise<void> {
  const suggestionsData = params.suggestions.map((suggestion) => ({
    user_id: params.userId,
    generation_id: params.generationId,
    front: suggestion.front,
    back: suggestion.back,
    status: 'proposed' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('ai_suggestions')
    .insert(suggestionsData);

  if (error) {
    throw new Error(`Failed to insert suggestions: ${error.message}`);
  }
}

/**
 * Update generation to success status with metadata
 */
async function updateGenerationSuccess(
  supabase: ReturnType<typeof createClient<Database>>,
  generationId: string,
  data: {
    tokens_input: number | null;
    tokens_output: number | null;
    ai_metadata: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase
    .from('ai_generations')
    .update({
      status: 'succeeded',
      tokens_input: data.tokens_input,
      tokens_output: data.tokens_output,
      ai_metadata: data.ai_metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', generationId);

  if (error) {
    throw new Error(`Failed to update generation success: ${error.message}`);
  }
}

/**
 * Update generation to failed status with error details
 */
async function updateGenerationFailure(
  supabase: ReturnType<typeof createClient<Database>>,
  generationId: string,
  errorData: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('ai_generations')
    .update({
      status: 'failed',
      error: errorData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', generationId);

  if (error) {
    console.error('Failed to update generation failure status:', error);
    // Don't throw here to avoid masking the original error
  }
}
