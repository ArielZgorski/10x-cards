import { useQuery } from "@tanstack/react-query";
import type {
  UUID,
  AIGenerationDTO,
  AISuggestionDTO,
  AISuggestionStatus,
  Paginated,
  GetAISuggestionsQueryParams,
} from "../../types";

// Mock data for testing
function createMockGeneration(id: UUID): AIGenerationDTO {
  const mockGenerations: Record<string, Partial<AIGenerationDTO>> = {
    "test-generation-running": {
      status: "running",
      source_text:
        "Tekst źródłowy do generowania fiszek o programowaniu React...",
    },
    "test-generation-failed": {
      status: "failed",
      error: { message: "API rate limit exceeded", code: "RATE_LIMIT" },
      source_text: "Tekst, który spowodował błąd generacji...",
    },
  };

  const baseGeneration: AIGenerationDTO = {
    id,
    user_id: "user-123",
    source_text:
      "Przykładowy tekst źródłowy do generowania fiszek z pojęciami programistycznymi, które powinny być przekształcone w karty do nauki.",
    model: "gpt-4",
    prompt_version: "v1.2",
    tokens_input: 250,
    tokens_output: 800,
    cost_usd: 0.035,
    status: "succeeded",
    error: null,
    ai_metadata: { temperature: 0.7, max_tokens: 1000 },
    created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    updated_at: new Date().toISOString(),
  };

  return { ...baseGeneration, ...mockGenerations[id] };
}

function createMockSuggestions(generationId: UUID): AISuggestionDTO[] {
  const baseSuggestions: Omit<
    AISuggestionDTO,
    "id" | "front" | "back" | "status"
  >[] = [
    {
      user_id: "user-123",
      generation_id: generationId,
      accepted_at: null,
      card_id: null,
      created_at: new Date(Date.now() - 3000000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const suggestionData = [
    {
      front: "Czym jest React Hook?",
      back: "React Hook to funkcja, która pozwala na używanie stanu i innych funkcjonalności React w komponentach funkcyjnych.",
      status: "proposed" as const,
    },
    {
      front: "Co to jest useState?",
      back: "useState to React Hook, który pozwala na dodawanie lokalnego stanu do komponentów funkcyjnych.",
      status: "proposed" as const,
    },
    {
      front: "Jak działa useEffect?",
      back: "useEffect to Hook, który pozwala na wykonywanie efektów ubocznych w komponentach funkcyjnych, takich jak pobieranie danych czy subskrypcje.",
      status: "edited" as const,
    },
    {
      front: "Co oznacza JSX?",
      back: "JSX (JavaScript XML) to rozszerzenie składni JavaScript, które pozwala na pisanie struktur HTML-podobnych w kodzie JavaScript.",
      status: "accepted" as const,
    },
    {
      front: "Czym jest komponent w React?",
      back: "Komponent to niezależna, wielokrotnego użytku część kodu, która zwraca elementy React opisujące, co powinno pojawić się na ekranie.",
      status: "rejected" as const,
    },
    {
      front: "Co to jest props w React?",
      back: "Props (properties) to argumenty przekazywane do komponentów React. Działają podobnie jak argumenty funkcji.",
      status: "proposed" as const,
    },
  ];

  return suggestionData.map((data, index) => ({
    id: `suggestion-${generationId}-${index + 1}`,
    ...baseSuggestions[0],
    ...data,
    accepted_at:
      data.status === "accepted"
        ? new Date(Date.now() - 1800000).toISOString()
        : null, // 30 min ago if accepted
    card_id: data.status === "accepted" ? `card-${index + 1}` : null,
  }));
}

// API client functions (with mock fallback for testing)
async function fetchGeneration(id: UUID): Promise<AIGenerationDTO> {
  // Use mock data for test IDs
  if (id.startsWith("test-generation")) {
    await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate API delay
    return createMockGeneration(id);
  }

  const response = await fetch(`/api/ai/generations/${id}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const error = new Error(`Failed to fetch generation: ${response.status}`);
    (error as any).status = response.status;
    throw error;
  }

  return response.json();
}

async function fetchSuggestions(
  generationId: UUID,
  params: GetAISuggestionsQueryParams = {},
): Promise<Paginated<AISuggestionDTO>> {
  // Use mock data for test IDs
  if (generationId.startsWith("test-generation")) {
    await new Promise((resolve) => setTimeout(resolve, 600)); // Simulate API delay

    let allSuggestions = createMockSuggestions(generationId);

    // Filter by status if provided
    if (params.status) {
      allSuggestions = allSuggestions.filter((s) => s.status === params.status);
    }

    // Pagination
    const page = params.page || 1;
    const perPage = params.per_page || 20;
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedItems = allSuggestions.slice(startIndex, endIndex);

    return {
      items: paginatedItems,
      page,
      perPage,
      total: allSuggestions.length,
    };
  }

  const searchParams = new URLSearchParams();

  if (params.status) searchParams.set("status", params.status);
  if (params.page) searchParams.set("page", params.page.toString());
  if (params.per_page) searchParams.set("per_page", params.per_page.toString());

  const url = `/api/ai/generations/${generationId}/suggestions${
    searchParams.toString() ? `?${searchParams.toString()}` : ""
  }`;

  const response = await fetch(url, {
    credentials: "include",
  });

  if (!response.ok) {
    const error = new Error(`Failed to fetch suggestions: ${response.status}`);
    (error as any).status = response.status;
    throw error;
  }

  return response.json();
}

// Custom hooks
export function useGeneration(id: UUID) {
  return useQuery({
    queryKey: ["generation", id],
    queryFn: () => fetchGeneration(id),
    enabled: !!id,
    // Polling based on status - will be enhanced later
    refetchInterval: (data) => {
      if (data?.status === "pending" || data?.status === "running") {
        return 3000; // Poll every 3 seconds for active generations
      }
      return false; // No polling for completed generations
    },
  });
}

export function useSuggestions(
  generationId: UUID,
  params: GetAISuggestionsQueryParams = {},
) {
  return useQuery({
    queryKey: ["suggestions", generationId, params],
    queryFn: () => fetchSuggestions(generationId, params),
    enabled: !!generationId,
  });
}

// Hook for polling with exponential backoff
export function useGenerationWithPolling(id: UUID) {
  return useQuery({
    queryKey: ["generation", id],
    queryFn: () => fetchGeneration(id),
    enabled: !!id,
    refetchInterval: (data, query) => {
      const status = data?.status;

      // No polling for completed states
      if (status === "succeeded" || status === "failed") {
        return false;
      }

      // Exponential backoff for pending/running states
      if (status === "pending" || status === "running") {
        const failureCount = query.state.fetchFailureCount || 0;
        const baseInterval = 2000; // 2 seconds
        const maxInterval = 30000; // 30 seconds max
        const interval = Math.min(
          baseInterval * Math.pow(1.5, failureCount),
          maxInterval,
        );
        return interval;
      }

      return false;
    },
    refetchIntervalInBackground: true,
  });
}
