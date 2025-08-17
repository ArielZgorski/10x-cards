/**
 * OpenRouter Service
 *
 * Handles communication with OpenRouter API for LLM inference (chat completions).
 * Provides structured JSON responses and comprehensive error handling.
 */

// Types for OpenRouter API parameters
export interface OpenRouterParams {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  repetition_penalty?: number;
  stream?: boolean;
}

// Configuration for OpenRouter service
export interface OpenRouterConfig {
  apiKey: string; // from import.meta.env.OPENROUTER_API_KEY
  baseUrl?: string; // defaults to 'https://openrouter.ai/api/v1/chat/completions'
  defaultModel?: string; // e.g. from env: DEFAULT_OPENROUTER_MODEL
  defaultParams?: OpenRouterParams;
  appReferer: string; // full URL of production app
  appTitle: string; // visible app name
}

// Message structure for chat completions
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Response format for structured JSON responses
export interface ResponseFormat {
  type: "json_schema";
  json_schema: {
    name: string;
    strict: true;
    schema: unknown;
  };
}

// Options for chat method
export interface ChatOptions {
  model?: string;
  params?: OpenRouterParams;
  responseFormat?: ResponseFormat;
  timeoutMs?: number;
}

// Options for chatJson method
export interface ChatJsonOptions {
  model?: string;
  params?: OpenRouterParams;
  timeoutMs?: number;
}

// Usage statistics from OpenRouter
export interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

// Chat response structure
export interface ChatResponse {
  content: string;
  model?: string;
  usage?: Usage;
}

// JSON chat response structure
export interface ChatJsonResponse {
  json: unknown;
  raw: string;
  model?: string;
  usage?: Usage;
}

// JSON schema definition
export interface JsonSchema {
  name: string;
  schema: unknown;
}

// Internal OpenRouter API response structure
interface OpenRouterApiResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
  model?: string;
  usage?: Usage;
}

/**
 * OpenRouter Service Class
 *
 * Manages communication with OpenRouter API for chat completions.
 * Supports both regular and structured JSON responses.
 */
export class OpenRouterService {
  constructor(private readonly config: OpenRouterConfig) {
    // Validate required configuration
    if (!config.apiKey) {
      throw new Error("OpenRouter API key is required");
    }
    if (!config.appReferer) {
      throw new Error("App referer is required for OpenRouter identification");
    }
    if (!config.appTitle) {
      throw new Error("App title is required for OpenRouter identification");
    }
  }

  /**
   * Build headers for OpenRouter API requests
   */
  private _headers() {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": this.config.appReferer,
      "X-Title": this.config.appTitle,
    } as const;
  }

  /**
   * Get OpenRouter API endpoint URL
   */
  private _endpoint(): string {
    return (
      this.config.baseUrl ?? "https://openrouter.ai/api/v1/chat/completions"
    );
  }

  /**
   * Build request body for OpenRouter API
   */
  private _requestBody(args: {
    model?: string;
    messages: ChatMessage[];
    params?: OpenRouterParams;
    responseFormat?: ResponseFormat;
  }) {
    const { model, messages, params, responseFormat } = args;

    return {
      model: model ?? this.config.defaultModel ?? "openai/gpt-3.5-turbo",
      messages,
      temperature:
        params?.temperature ?? this.config.defaultParams?.temperature ?? 0.7,
      max_tokens:
        params?.max_tokens ?? this.config.defaultParams?.max_tokens ?? 2000,
      top_p: params?.top_p ?? this.config.defaultParams?.top_p,
      repetition_penalty:
        params?.repetition_penalty ??
        this.config.defaultParams?.repetition_penalty,
      stream: params?.stream ?? false,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    };
  }

  /**
   * Fetch with timeout and abort controller
   */
  private async _fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs = 30000,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Retry logic with exponential backoff for transient errors
   */
  private async _retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 250,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Only retry on specific transient errors
        if (this._shouldRetry(lastError)) {
          const delay =
            baseDelayMs * Math.pow(2, attempt) + Math.random() * 100; // Add jitter
          console.warn(
            `OpenRouter request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1}):`,
            {
              error: lastError.message,
              attempt: attempt + 1,
            },
          );
          await this._sleep(delay);
        } else {
          // Non-retryable error, fail immediately
          break;
        }
      }
    }

    throw lastError!;
  }

  /**
   * Determine if an error should trigger a retry
   */
  private _shouldRetry(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Retry on rate limits (429)
    if (message.includes("429") || message.includes("rate limit")) {
      return true;
    }

    // Retry on server errors (5xx)
    if (
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503") ||
      message.includes("504")
    ) {
      return true;
    }

    // Retry on network timeouts
    if (message.includes("timeout") || message.includes("network")) {
      return true;
    }

    // Don't retry on client errors (4xx except 429), auth errors, etc.
    return false;
  }

  /**
   * Sleep utility for retry delays
   */
  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Parse OpenRouter API response and handle errors
   */
  private async _parseOpenRouterJson(
    response: Response,
  ): Promise<{ content: string; model?: string; usage?: Usage }> {
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `OpenRouter error ${response.status}: ${text || response.statusText}`,
      );
    }

    const data: OpenRouterApiResponse = await response.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in OpenRouter response");
    }

    return {
      content,
      model: data.model,
      usage: data.usage,
    } as const;
  }

  /**
   * Parse strict JSON from content, handling potential formatting issues
   */
  private _parseStrictJson(content: string): unknown {
    // First, try parsing the full content
    try {
      return JSON.parse(content);
    } catch {
      // If that fails, try to extract the first JSON block (array or object)
      const match = content.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (!match) {
        throw new Error("Failed to locate JSON in content");
      }
      return JSON.parse(match[0]);
    }
  }

  /**
   * Build system message based on prompt version
   */
  buildSystemMessage(version: string): string {
    switch (version) {
      case "v2":
        return this._buildSystemPromptV2();
      case "v1":
      default:
        return this._buildSystemPromptV1();
    }
  }

  /**
   * Build detailed system prompt v1 for flashcard generation
   */
  private _buildSystemPromptV1(): string {
    return `You are an expert flashcard creator with deep knowledge of effective learning techniques. Your task is to generate high-quality flashcard suggestions from the provided source text that will help users learn and retain information effectively.

CORE PRINCIPLES:
- Focus on understanding over memorization
- Create questions that test comprehension and application
- Use clear, concise language appropriate for the content level
- Ensure each flashcard is self-contained and understandable

CONTENT GUIDELINES:
1. Create 5-15 flashcards covering the most important concepts
2. Each flashcard should have a clear question (front) and complete answer (back)
3. Questions should progressively build understanding
4. Include definitions, explanations, examples, and applications
5. Avoid overly simple yes/no questions unless they test critical concepts
6. Keep fronts under 200 characters and backs under 800 characters

QUESTION TYPES TO USE:
- "What is...?" for definitions and concepts
- "How does...?" for processes and mechanisms
- "Why is...?" for reasoning and causation
- "When would you...?" for application scenarios
- "What are the differences between...?" for comparisons

FORMATTING RULES:
- Return ONLY a valid JSON array with the exact schema provided
- Each object must have "front" and "back" properties
- Use proper grammar and punctuation
- Ensure factual accuracy based on the source text
- No additional text, explanations, or comments outside the JSON

Generate flashcards that will genuinely help someone master the material.`;
  }

  /**
   * Build advanced system prompt v2 with enhanced instructions
   */
  private _buildSystemPromptV2(): string {
    return `You are an expert educational content creator specializing in spaced repetition learning systems. Your mission is to transform source material into highly effective flashcards that maximize learning retention and comprehension.

LEARNING SCIENCE PRINCIPLES:
- Apply cognitive load theory: chunk information appropriately
- Use elaborative interrogation: create "why" and "how" questions
- Implement desirable difficulties: questions should challenge but not overwhelm
- Follow the testing effect: design questions that strengthen retrieval

ADVANCED CONTENT STRATEGY:
1. Create 7-20 flashcards with strategic difficulty progression
2. Include multiple perspectives on key concepts
3. Design questions that connect new information to existing knowledge
4. Create scenario-based questions for practical application
5. Include edge cases and common misconceptions
6. Use active recall patterns that strengthen memory consolidation

SOPHISTICATED QUESTION PATTERNS:
- Conceptual: "Explain the relationship between X and Y"
- Analytical: "What would happen if...?"
- Synthesis: "How does this concept apply to...?"
- Evaluation: "What are the strengths and weaknesses of...?"
- Transfer: "How is this similar to/different from...?"

QUALITY ASSURANCE:
- Ensure logical flow and conceptual coherence
- Verify that answers are complete yet concise
- Check that questions test different cognitive levels
- Maintain consistency in terminology and style
- Validate factual accuracy against source material

OUTPUT SPECIFICATION:
Return exclusively a JSON array conforming to the provided schema. Each flashcard must be pedagogically sound, factually accurate, and optimized for long-term retention.`;
  }

  /**
   * Execute chat completion with OpenRouter API
   *
   * @param messages - Array of chat messages
   * @param options - Optional parameters for the request
   * @returns Promise resolving to chat response with content, model, and usage
   */
  async chat(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const body = this._requestBody({
      model: options?.model,
      messages,
      params: options?.params,
      responseFormat: options?.responseFormat,
    });

    return this._retryWithBackoff(async () => {
      const response = await this._fetchWithTimeout(
        this._endpoint(),
        {
          method: "POST",
          headers: this._headers(),
          body: JSON.stringify(body),
        },
        options?.timeoutMs,
      );

      return this._parseOpenRouterJson(response);
    });
  }

  /**
   * Execute chat completion with enforced JSON schema response
   *
   * @param messages - Array of chat messages
   * @param jsonSchema - JSON schema definition for structured response
   * @param options - Optional parameters for the request
   * @returns Promise resolving to parsed JSON response with metadata
   */
  async chatJson(
    messages: ChatMessage[],
    jsonSchema: JsonSchema,
    options?: ChatJsonOptions,
  ): Promise<ChatJsonResponse> {
    const responseFormat: ResponseFormat = {
      type: "json_schema",
      json_schema: {
        name: jsonSchema.name,
        strict: true,
        schema: jsonSchema.schema,
      },
    };

    const result = await this.chat(messages, {
      model: options?.model,
      params: options?.params,
      responseFormat,
      timeoutMs: options?.timeoutMs,
    });

    const json = this._parseStrictJson(result.content);

    return {
      json,
      raw: result.content,
      model: result.model,
      usage: result.usage,
    } as const;
  }
}

/**
 * Create a configured OpenRouterService instance from environment variables
 */
export function createOpenRouterService(): OpenRouterService {
  const apiKey = import.meta.env.OPENROUTER_API_KEY;
  const defaultModel = import.meta.env.DEFAULT_OPENROUTER_MODEL;
  const appReferer = import.meta.env.APP_REFERER || "https://10x-cards.com";
  const appTitle =
    import.meta.env.APP_TITLE || "10x Cards - Flashcard Generator";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is required");
  }

  const config: OpenRouterConfig = {
    apiKey,
    defaultModel: defaultModel || "openai/gpt-3.5-turbo",
    appReferer,
    appTitle,
    defaultParams: {
      temperature: 0.7,
      max_tokens: 2000,
      top_p: 0.9,
    },
  };

  return new OpenRouterService(config);
}
