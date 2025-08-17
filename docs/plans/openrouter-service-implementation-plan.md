## 1. Opis usługi

Usługa OpenRouter odpowiada za komunikację z `https://openrouter.ai/api/v1/chat/completions` w celu wykonywania inferencji LLM (chat completions) w projekcie opartym o Astro 5 + React 19 + TypeScript 5 oraz Supabase. Jej zadaniem jest:

- Zarządzanie nagłówkami, kluczami API i danymi identyfikującymi aplikację (HTTP-Referer, X-Title).
- Budowanie wiadomości (system + user) i parametrów modeli.
- Opcjonalne wymuszanie ustrukturyzowanych odpowiedzi poprzez `response_format` z poprawnie zdefiniowanym schematem JSON.
- Obsługa błędów i metryk (zużycie tokenów, czas trwania, model).
- Integracja z istniejącym przepływem generowania fiszek (`src/lib/ai/generation.service.ts`) oraz endpointami `src/pages/api/ai/generations/*`.


## 2. Opis konstruktora

Proponowana klasa: `OpenRouterService` w pliku `src/lib/ai/openrouter.service.ts`.

```ts
type OpenRouterParams = {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  repetition_penalty?: number;
  stream?: boolean;
};

type OpenRouterConfig = {
  apiKey: string; // import.meta.env.OPENROUTER_API_KEY
  baseUrl?: string; // domyślnie 'https://openrouter.ai/api/v1/chat/completions'
  defaultModel?: string; // np. z env: DEFAULT_OPENROUTER_MODEL
  defaultParams?: OpenRouterParams;
  appReferer: string; // pełny URL aplikacji produkcyjnej
  appTitle: string; // widoczna nazwa aplikacji
};

class OpenRouterService {
  constructor(private readonly config: OpenRouterConfig) {}
}
```

Wartości `apiKey`, `defaultModel`, `appReferer`, `appTitle` przekazujemy z konfiguracji środowiskowej. W `src/env.d.ts` pozostaje `OPENROUTER_API_KEY`; opcjonalnie dodaj: `DEFAULT_OPENROUTER_MODEL`, `APP_REFERER`, `APP_TITLE` (sekcja 7).


## 3. Publiczne metody i pola

- `chat(messages, options)`
  - **Cel**: pojedyncze wywołanie chat completion z dowolnymi wiadomościami i parametrami.
  - **Sygnatura**:
    ```ts
    async chat(
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
      options?: {
        model?: string;
        params?: OpenRouterParams;
        responseFormat?: {
          type: 'json_schema';
          json_schema: { name: string; strict: true; schema: unknown };
        };
        timeoutMs?: number;
      }
    ): Promise<{
      content: string;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    }>;
    ```

- `chatJson(messages, jsonSchema, options)`
  - **Cel**: wymuszenie ustrukturyzowanej odpowiedzi JSON zgodnej ze schematem.
  - **Sygnatura**:
    ```ts
    async chatJson(
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
      jsonSchema: { name: string; schema: unknown },
      options?: { model?: string; params?: OpenRouterParams; timeoutMs?: number }
    ): Promise<{ json: unknown; raw: string; model?: string; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }>;
    ```

- `buildSystemMessage(version: string)`
  - **Cel**: centralne budowanie komunikatu systemowego (wersjonowanie promptów używane przez istniejący `generation.service.ts`).


## 4. Prywatne metody i pola

- `_headers()`
  - Buduje nagłówki: `Authorization`, `Content-Type`, `HTTP-Referer`, `X-Title`.

- `_endpoint()`
  - Zwraca `config.baseUrl || 'https://openrouter.ai/api/v1/chat/completions'`.

- `_requestBody({ model, messages, params, responseFormat })`
  - Składa JSON zgodny z OpenRouter API.

- `_fetchWithTimeout(url, init, timeoutMs)`
  - Zapewnia timeout i jednolite błędy sieciowe.

- `_parseOpenRouterJson(resp)`
  - Zwraca `{ content, model, usage }`, waliduje obecność `choices[0].message.content`.

- `_parseStrictJson(content)`
  - Parsuje `content` do JSON, w razie potrzeby wycina pierwszy poprawny blok JSON z treści (zachowując ostrożność).


## 5. Obsługa błędów

Potencjalne scenariusze (numerowane):

1. Brak/niepoprawny klucz API (`401/403`).
2. Limit zapytań (`429`).
3. Błędy 5xx po stronie OpenRouter/modelu.
4. Błędy sieciowe/timeout.
5. Niepoprawny `response_format`/niezgodny JSON z modelem.
6. Pusty `choices` lub brak `message.content`.
7. Zbyt duży kontekst (`400` albo odrzucone przez model).
8. Walidacja wejścia po stronie API (`zod`) – źle sformatowany `source_text`, model, wersja promptu.
9. Błędy Supabase (insert/select/update) podczas zapisu wyników i metadanych.

Strategie (odpowiadają numeracji):

1. Sprawdzenie `OPENROUTER_API_KEY` przy starcie; zwracanie 500 z bezpiecznym komunikatem; log jedynie o niedostępności konfiguracji.
2. Własny rate limit (już istnieje `ensureRateLimit`), krótkie backoff retry (np. 250ms, 500ms, 1000ms) i sygnały w nagłówkach odpowiedzi do klienta.
3. Ograniczona liczba retry z jitterem (np. 2 próby), a potem fail-fast; logowanie `status`, `requestId`.
4. `_fetchWithTimeout` (np. 30s) + abort; komunikat przyjazny dla użytkownika; retry jeśli uzasadnione.
5. `chatJson` wymusza `response_format`; przy niezgodności: jedna próba doprecyzowania (system hint), następnie błąd „Failed to parse AI response”.
6. Walidacja odpowiedzi; jeśli brak treści – błąd kontrolowany, aktualizacja statusu generacji na `failed`.
7. Limitacja `max_tokens`, kompresja wejścia (opcjonalnie) i komunikat błędu jeśli stop condition.
8. Utrzymanie rygorystycznych schematów `zod` na wejściu endpointów – już wdrożone.
9. Obsługa błędów Supabase: precyzyjne komunikaty + brak maskowania błędu AI.


## 6. Kwestie bezpieczeństwa

- Przechowywanie klucza w `OPENROUTER_API_KEY` (server-side only). Nigdy nie ujawniać w kliencie.
- Ustawiać nagłówki `HTTP-Referer` i `X-Title` zgodnie z wymaganiami OpenRouter (identyfikacja aplikacji).
- RLS i autoryzacja Supabase na endpointach już są egzekwowane – nie omijać ich.
- Ochrona przed prompt injection: trzymać stały, asertywny komunikat systemowy; walidować i filtrować output (szczególnie przy JSON).
- Ograniczać rozmiar wejścia (`zod` już egzekwuje), limity tokenów i parametry modeli.
- Logi bez danych wrażliwych; logować identyfikatory (requestId, userId), nie treść użytkownika.


## 7. Plan wdrożenia krok po kroku

1) Zmienne środowiskowe i typy

- Dodaj do `.env` w środowiskach: `OPENROUTER_API_KEY`, opcjonalnie `DEFAULT_OPENROUTER_MODEL`, `APP_REFERER`, `APP_TITLE`.
- Upewnij się, że `src/env.d.ts` ma:
  ```ts
  interface ImportMetaEnv {
    readonly OPENROUTER_API_KEY: string;
    readonly SUPABASE_URL: string;
    readonly SUPABASE_KEY: string;
    readonly SUPABASE_SERVICE_ROLE_KEY: string;
    readonly DEFAULT_OPENROUTER_MODEL?: string;
    readonly APP_REFERER?: string;
    readonly APP_TITLE?: string;
  }
  ```

2) Implementacja `OpenRouterService` (`src/lib/ai/openrouter.service.ts`)

```ts
export class OpenRouterService {
  constructor(private readonly config: OpenRouterConfig) {}

  private _headers() {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': this.config.appReferer,
      'X-Title': this.config.appTitle,
    } as const;
  }

  private _endpoint() {
    return this.config.baseUrl ?? 'https://openrouter.ai/api/v1/chat/completions';
  }

  private _requestBody(args: {
    model?: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    params?: OpenRouterParams;
    responseFormat?: { type: 'json_schema'; json_schema: { name: string; strict: true; schema: unknown } };
  }) {
    const { model, messages, params, responseFormat } = args;
    return {
      model: model ?? this.config.defaultModel,
      messages,
      temperature: params?.temperature ?? this.config.defaultParams?.temperature ?? 0.7,
      max_tokens: params?.max_tokens ?? this.config.defaultParams?.max_tokens ?? 2000,
      top_p: params?.top_p ?? this.config.defaultParams?.top_p,
      repetition_penalty: params?.repetition_penalty ?? this.config.defaultParams?.repetition_penalty,
      stream: params?.stream ?? false,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    };
  }

  private async _fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 30000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(t);
    }
  }

  private async _parseOpenRouterJson(res: Response) {
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenRouter error ${res.status}: ${text || res.statusText}`);
    }
    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content in OpenRouter response');
    return { content, model: data.model, usage: data.usage } as const;
  }

  private _parseStrictJson(content: string) {
    // Najpierw spróbuj pełnego parsowania
    try { return JSON.parse(content); } catch {}
    // Spróbuj wyciąć pierwszy blok JSON (np. tablica)
    const match = content.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (!match) throw new Error('Failed to locate JSON in content');
    return JSON.parse(match[0]);
  }

  buildSystemMessage(version: string) {
    switch (version) {
      case 'v1':
      default:
        return (
          'You are an expert flashcard creator. Generate high-quality flashcards from the user-provided source text. ' +
          'Return only valid JSON according to the provided schema when required.'
        );
    }
  }

  async chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, options?: {
    model?: string; params?: OpenRouterParams; responseFormat?: { type: 'json_schema'; json_schema: { name: string; strict: true; schema: unknown } }; timeoutMs?: number;
  }) {
    const body = this._requestBody({ model: options?.model, messages, params: options?.params, responseFormat: options?.responseFormat });
    const res = await this._fetchWithTimeout(this._endpoint(), { method: 'POST', headers: this._headers(), body: JSON.stringify(body) }, options?.timeoutMs);
    return this._parseOpenRouterJson(res);
  }

  async chatJson(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, jsonSchema: { name: string; schema: unknown }, options?: { model?: string; params?: OpenRouterParams; timeoutMs?: number }) {
    const responseFormat = { type: 'json_schema' as const, json_schema: { name: jsonSchema.name, strict: true as const, schema: jsonSchema.schema } };
    const result = await this.chat(messages, { model: options?.model, params: options?.params, responseFormat, timeoutMs: options?.timeoutMs });
    const json = this._parseStrictJson(result.content);
    return { json, raw: result.content, model: result.model, usage: result.usage } as const;
  }
}
```

3) Integracja z istniejącym `generation.service.ts`

- Zamiast bezpośredniego `fetch` do OpenRouter użyj `OpenRouterService`.
- W `runAIGeneration` buduj komunikat systemowy na bazie `promptVersion` i przekazuj `response_format` z odpowiednim schematem JSON (poniżej przykład – punkt 4).

4) Konfiguracja wiadomości i `response_format`

- **Komunikat systemowy (przykład – 1):**
  ```ts
  const system = openRouter.buildSystemMessage(payload.promptVersion || 'v1');
  ```

- **Komunikat użytkownika (przykład – 2):**
  ```ts
  const user = generation.source_text; // istniejące pole z DB
  ```

- **Ustrukturyzowana odpowiedź (przykład – 3):**
  Wymuś tablicę obiektów fiszek `{ front, back }`:
  ```ts
  const flashcardsSchema = {
    name: 'flashcards_schema',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        required: ['front', 'back'],
        additionalProperties: false,
        properties: {
          front: { type: 'string', minLength: 1, maxLength: 2000 },
          back: { type: 'string', minLength: 1, maxLength: 2000 },
        },
      },
      minItems: 3,
      maxItems: 20,
    },
  } as const;

  const { json } = await openRouter.chatJson(
    [ { role: 'system', content: system }, { role: 'user', content: user } ],
    flashcardsSchema,
    { model: payload.model || import.meta.env.DEFAULT_OPENROUTER_MODEL, params: { temperature: 0.7, max_tokens: 2000 } }
  );
  ```

- **Nazwa modelu (przykład – 4):**
  ```ts
  const model = payload.model || import.meta.env.DEFAULT_OPENROUTER_MODEL || 'openai/gpt-3.5-turbo';
  ```

- **Parametry modelu (przykład – 5):**
  ```ts
  const params = { temperature: 0.7, max_tokens: 2000, top_p: 0.9 };
  ```

5) Użycie w `runAIGeneration`

Minimalna zmiana polega na zastąpieniu istniejącego `callOpenRouter(...)` przez `openRouter.chatJson(...)` i usunięciu niestabilnego ręcznego parsowania JSON. Upewnij się, że wynik `json` mapujesz do tablicy `{ front, back }` i zapisujesz w `ai_suggestions` jak dotychczas.

6) Testy

- Dodaj testy jednostkowe dla `openrouter.service.ts` (mock `fetch`).
- Dodaj testy integracyjne dla endpointów `POST /api/ai/generations` i `GET /api/ai/generations/[id]/suggestions` (ścieżka szczęśliwa i błędy 4xx/5xx).

7) CI/CD i deploy (GitHub Actions + DigitalOcean)

- Skonfiguruj sekrety: `OPENROUTER_API_KEY`, `SUPABASE_*`, `DEFAULT_OPENROUTER_MODEL`, `APP_REFERER`, `APP_TITLE` w środowiskach (DO + GH Actions).
- W pipeline dodaj job z testami i lintem; blokuj deploy przy niepowodzeniu.
- Po wdrożeniu monitoruj logi (błędy OpenRouter, czasy odpowiedzi, liczniki 429/5xx).


## 8. Konkrety implementacyjne – przykłady elementów OpenRouter API

1) **Komunikat systemowy**
```ts
const system = openRouter.buildSystemMessage('v1');
// np. "You are an expert flashcard creator... Return only valid JSON..."
```

2) **Komunikat użytkownika**
```ts
const user = sourceTextFromDb; // długi tekst wejściowy użytkownika
```

3) **Ustrukturyzowane odpowiedzi (response_format)**
```ts
const responseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'flashcards_schema',
    strict: true,
    schema: {
      type: 'array',
      items: {
        type: 'object',
        required: ['front', 'back'],
        additionalProperties: false,
        properties: {
          front: { type: 'string', minLength: 1, maxLength: 2000 },
          back: { type: 'string', minLength: 1, maxLength: 2000 },
        },
      },
      minItems: 3,
      maxItems: 20,
    },
  },
} as const;
```

4) **Nazwa modelu**
```ts
const model = 'openai/gpt-3.5-turbo'; // albo z env / payload
```

5) **Parametry modelu**
```ts
const params = { temperature: 0.6, max_tokens: 1800, top_p: 0.9 };
```

Przekazanie do `chat(...)`:
```ts
await openRouter.chat(
  [ { role: 'system', content: system }, { role: 'user', content: user } ],
  { model, params, responseFormat }
);
```


## 9. Mapowanie na istniejący kod projektu

- `src/lib/ai/generation.service.ts`
  - Zastąp `callOpenRouter(...)` wywołaniem `OpenRouterService.chatJson(...)`.
  - Usuń ręczne dopasowania regex JSON i `JSON.parse` na surowym tekście – bazuj na `response_format`.
  - Zachowaj obecny przepływ: update statusów (`running` -> `succeeded`/`failed`), zapis `ai_suggestions`, metryki `usage`.

- `src/pages/api/ai/generations/index.ts`
  - Pozostaw walidację `zod` i rate limit.
  - Umożliw użytkownikowi podanie `model` i `prompt_version`; walidację pozostaw jak jest.

- `src/env.d.ts`
  - Upewnij się, że zdefiniowane są wymagane pola (sekcja 7).


## 10. Dobre praktyki

- Trzymaj `system` prompt w jednym miejscu i wersjonuj.
- Domyślnie wymuszaj `response_format` dla ścieżek wymagających JSON – poprawia deterministykę.
- Stosuj ograniczone retry z jitterem tylko dla błędów przejściowych (5xx, 429, sieć).
- Zwracaj kontrolowane komunikaty błędów do klienta; logi po stronie serwera.
- Agreguj metryki (czas, tokeny) do `ai_metadata` generacji – już obsługiwane w kodzie.


