1. Lista tabel z ich kolumnami, typami danych i ograniczeniami

- profiles
  - id: uuid, PK, NOT NULL, FK → auth.users(id) ON DELETE CASCADE
  - display_name: text, NULL
  - timezone: text, NULL (IANA, np. "Europe/Warsaw")
  - locale: text, NULL (np. "pl-PL")
  - created_at: timestamptz, NOT NULL, DEFAULT now()
  - updated_at: timestamptz, NOT NULL, DEFAULT now()
  - RLS key: id (równa się auth.uid())

- decks
  - id: uuid, PK, NOT NULL, DEFAULT gen_random_uuid()
  - user_id: uuid, NOT NULL, FK → auth.users(id) ON DELETE CASCADE
  - name: text, NOT NULL
  - slug: text, NOT NULL
  - language_code: text, NULL (ISO 639-1; opcjonalny CHECK: char_length(language_code)=2)
  - is_archived: boolean, NOT NULL, DEFAULT false
  - created_at: timestamptz, NOT NULL, DEFAULT now()
  - updated_at: timestamptz, NOT NULL, DEFAULT now()
  - UNIQUE (user_id, slug)
  - RLS key: user_id

- cards
  - id: uuid, PK, NOT NULL, DEFAULT gen_random_uuid()
  - user_id: uuid, NOT NULL, FK → auth.users(id) ON DELETE CASCADE
  - deck_id: uuid, NOT NULL, FK → decks(id) ON DELETE CASCADE
  - front: text, NOT NULL, CHECK (char_length(front) BETWEEN 1 AND 2000)
  - back: text, NOT NULL, CHECK (char_length(back) BETWEEN 1 AND 2000)
  - source: text, NOT NULL, DEFAULT 'manual', CHECK (source IN ('manual','ai'))
  - is_archived: boolean, NOT NULL, DEFAULT false
  - language_code: text, NULL (dziedziczone domyślnie z deck)
  - created_at: timestamptz, NOT NULL, DEFAULT now()
  - updated_at: timestamptz, NOT NULL, DEFAULT now()
  - due_at: timestamptz, NULL
  - last_reviewed_at: timestamptz, NULL
  - repetitions_count: integer, NOT NULL, DEFAULT 0, CHECK (repetitions_count >= 0)
  - lapses_count: integer, NOT NULL, DEFAULT 0, CHECK (lapses_count >= 0)
  - ease_factor: numeric(4,2), NOT NULL, DEFAULT 2.50, CHECK (ease_factor > 0)
  - interval_days: integer, NOT NULL, DEFAULT 0, CHECK (interval_days >= 0)
  - (opcjonalnie) UNIQUE (user_id, deck_id, lower(front), lower(back))
  - RLS key: user_id

- reviews
  - id: uuid, PK, NOT NULL, DEFAULT gen_random_uuid()
  - user_id: uuid, NOT NULL, FK → auth.users(id) ON DELETE CASCADE
  - card_id: uuid, NOT NULL, FK → cards(id) ON DELETE CASCADE
  - reviewed_at: timestamptz, NOT NULL, DEFAULT now()
  - rating: smallint, NOT NULL, CHECK (rating BETWEEN 0 AND 3)
  - duration_ms: integer, NULL, CHECK (duration_ms IS NULL OR duration_ms >= 0)
  - pre_ease_factor: numeric(4,2), NULL
  - post_ease_factor: numeric(4,2), NULL
  - pre_interval_days: integer, NULL
  - post_interval_days: integer, NULL
  - pre_repetitions_count: integer, NULL
  - post_repetitions_count: integer, NULL
  - pre_lapses_count: integer, NULL
  - post_lapses_count: integer, NULL
  - (opcjonalnie dla FSRS) pre_stability/post_stability: numeric, pre_difficulty/post_difficulty: numeric, pre_elapsed_days/post_elapsed_days: integer, pre_scheduled_days/post_scheduled_days: integer
  - RLS key: user_id

- ai_generations
  - id: uuid, PK, NOT NULL, DEFAULT gen_random_uuid()
  - user_id: uuid, NOT NULL, FK → auth.users(id) ON DELETE CASCADE
  - source_text: text, NOT NULL, CHECK (char_length(source_text) BETWEEN 1000 AND 10000)
  - model: text, NULL
  - prompt_version: text, NULL
  - tokens_input: integer, NULL, CHECK (tokens_input IS NULL OR tokens_input >= 0)
  - tokens_output: integer, NULL, CHECK (tokens_output IS NULL OR tokens_output >= 0)
  - cost_usd: numeric(10,4), NULL, CHECK (cost_usd IS NULL OR cost_usd >= 0)
  - status: text, NULL
  - error: jsonb, NULL
  - ai_metadata: jsonb, NULL
  - created_at: timestamptz, NOT NULL, DEFAULT now()
  - updated_at: timestamptz, NOT NULL, DEFAULT now()
  - RLS key: user_id

- ai_suggestions
  - id: uuid, PK, NOT NULL, DEFAULT gen_random_uuid()
  - user_id: uuid, NOT NULL, FK → auth.users(id) ON DELETE CASCADE
  - generation_id: uuid, NOT NULL, FK → ai_generations(id) ON DELETE CASCADE
  - front: text, NOT NULL, CHECK (char_length(front) BETWEEN 1 AND 2000)
  - back: text, NOT NULL, CHECK (char_length(back) BETWEEN 1 AND 2000)
  - status: text, NOT NULL, DEFAULT 'proposed', CHECK (status IN ('proposed','edited','accepted','rejected'))
  - accepted_at: timestamptz, NULL
  - card_id: uuid, NULL, FK → cards(id) ON DELETE SET NULL
  - created_at: timestamptz, NOT NULL, DEFAULT now()
  - updated_at: timestamptz, NOT NULL, DEFAULT now()
  - RLS key: user_id

- (opcjonalnie) study_sessions
  - id: uuid, PK, NOT NULL, DEFAULT gen_random_uuid()
  - user_id: uuid, NOT NULL, FK → auth.users(id) ON DELETE CASCADE
  - started_at: timestamptz, NOT NULL, DEFAULT now()
  - ended_at: timestamptz, NULL
  - notes: text, NULL
  - created_at: timestamptz, NOT NULL, DEFAULT now()
  - updated_at: timestamptz, NOT NULL, DEFAULT now()
  - RLS key: user_id


2. Relacje między tabelami

- profiles 1:1 auth.users (profiles.id = auth.users.id), ON DELETE CASCADE.
- decks N:1 auth.users (decks.user_id → auth.users.id), ON DELETE CASCADE.
- cards N:1 decks (cards.deck_id → decks.id), ON DELETE CASCADE; oraz N:1 auth.users (cards.user_id → auth.users.id), ON DELETE CASCADE.
- reviews N:1 cards (reviews.card_id → cards.id), ON DELETE CASCADE; oraz N:1 auth.users (reviews.user_id → auth.users.id), ON DELETE CASCADE.
- ai_generations N:1 auth.users (ai_generations.user_id → auth.users.id), ON DELETE CASCADE.
- ai_suggestions N:1 ai_generations (ai_suggestions.generation_id → ai_generations.id), ON DELETE CASCADE; N:1 auth.users (user_id); opcjonalne N:1 cards przez ai_suggestions.card_id (ON DELETE SET NULL).
- (opcjonalnie) study_sessions N:1 auth.users; reviews mogą mieć dodatkową kolumnę session_id (uuid, NULL, FK → study_sessions.id ON DELETE SET NULL) jeżeli sesje zostaną włączone.

Kardynalności i reguły:
- Użytkownik ma wiele decks, cards, reviews, ai_generations, ai_suggestions, (opcjonalnie) study_sessions.
- Deck ma wiele cards.
- Card ma wiele reviews.
- Jedna ai_generation ma wiele ai_suggestions.
- Po akceptacji sugestii AI, ai_suggestions.card_id wskazuje na utworzoną card.


3. Indeksy

- profiles
  - PK: (id)

- decks
  - PK: (id)
  - IDX: (user_id)
  - UNIQUE: (user_id, slug)

- cards
  - PK: (id)
  - IDX: (user_id)
  - IDX: (deck_id)
  - IDX: (user_id, is_archived, due_at)
  - (opcjonalnie) UNIQUE: (user_id, deck_id, lower(front), lower(back))

- reviews
  - PK: (id)
  - IDX: (card_id, reviewed_at)
  - IDX: (user_id, reviewed_at)

- ai_generations
  - PK: (id)
  - IDX: (user_id, created_at)

- ai_suggestions
  - PK: (id)
  - IDX: (user_id, status)
  - IDX: (generation_id)
  - IDX: (card_id)

- (opcjonalnie) study_sessions
  - PK: (id)
  - IDX: (user_id, started_at)


4. Zasady PostgreSQL (jeśli dotyczy)

- Włącz RLS na wszystkich tabelach użytkownika: profiles, decks, cards, reviews, ai_generations, ai_suggestions, (opcjonalnie) study_sessions.
- Polityki owner-only (przykłady):
  - profiles: USING (id = auth.uid()) WITH CHECK (id = auth.uid()).
  - decks/cards/reviews/ai_generations/ai_suggestions/study_sessions: USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()).
- Dostępy bazowe: REVOKE ALL od public; konfiguruj uprawnienia tylko dla ról Supabase (authenticated/anon) zgodnie z API. Service role omija RLS (do batchów/cronów).
- Relacje ON DELETE CASCADE jak w sekcji 2 zapewniają spójne czyszczenie danych po usunięciu użytkownika/decku/karty.
- Kolumny updated_at: utwórz funkcję triggera aktualizującą updated_at na UPDATE i podłącz do: profiles, decks, cards, ai_generations, ai_suggestions, (opcjonalnie) study_sessions.


5. Dodatkowe uwagi lub wyjaśnienia

- Klucze główne: uuid (DEFAULT gen_random_uuid()); upewnij się, że rozszerzenie pgcrypto jest dostępne (CREATE EXTENSION IF NOT EXISTS pgcrypto).
- Czas: używaj timestamptz i przechowuj wszystkie czasy w UTC; timezone użytkownika trzymaj w profiles.timezone.
- Treści fiszek: front/back ograniczone do 1–2000 znaków; można dostosować według potrzeb UI/UX.
- SRS: obecnie pola w cards/reviews odpowiadają SM-2; przejście na FSRS możliwe przez dodanie dedykowanych kolumn (już przewidziane opcjonalnie w reviews) i ewentualną migrację danych.
- Sesja nauki: tabela study_sessions jest opcjonalna; jeśli włączona, rozważ dodanie reviews.session_id (uuid, NULL, FK → study_sessions.id) i indeksu (user_id, session_id).
- Retencja AI: rozważ politykę retencji ai_generations.source_text (np. 30 dni) i cykliczne czyszczenie; pozostaw metadane do raportowania.
- Wyszukiwanie: w MVP brak pełnotekstowego; w przyszłości można dodać tsvector GIN na cards(front/back).
- Unikalność duplikatów: opcjonalny UNIQUE na (user_id, deck_id, lower(front), lower(back)) może zmniejszyć duplikaty kosztem elastyczności (zachowaj jako opcję).
- Zapytanie sesji: SELECT z cards WHERE user_id = auth.uid() AND is_archived = false AND (due_at IS NULL OR due_at <= now()) ORDER BY due_at NULLS LAST LIMIT ...; indeks (user_id, is_archived, due_at) wspiera to zapytanie.
