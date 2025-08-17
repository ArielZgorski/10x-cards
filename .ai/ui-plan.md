# Architektura UI dla 10x-cards

## 1. Przegląd struktury UI

- Ogólny układ: aplikacja web (mobile-first) z lewym sidebar (nawigacja główna) i obszarem treści; breadcrumbs na widokach szczegółowych. Dark mode i design tokens (Tailwind + shadcn/ui).
- Stany aplikacji: prywatne trasy chronione guardem sesji (Supabase JWT). Po zalogowaniu landing to Generowanie AI.
- Dane i wydajność: TanStack Query (cache, revalidate on focus, retry bez 4xx), paginacja i filtry w query string, wirtualizacja list, prefetch kolejnych stron przy ~70% scrolla. Polling statusów generacji AI co 2–5 s z backoffem i łagodną degradacją przy 429.
- Walidacje: Zod po stronie klienta, liczniki znaków, debouncing, blokada akcji poza zakresem (source_text 1000–10000; front/back 1–2000).
- A11y i UX: pełna nawigacja klawiaturą, role/ARIA, focus management, focus trap w modalach, Esc/Enter w confirmach, skróty (1–4, spacja), sticky actions na mobile, soft-wrap/break-words, czytelny kontrast (WCAG AA).
- Bezpieczeństwo: interceptory Authorization (JWT) w kliencie API; zgodność z RLS; confirmy przed destrukcją; ukrywanie akcji bez uprawnień; bez HTML w treściach; standardowe mapowanie błędów HTTP.

- Kluczowe wymagania z PRD:
  - Generowanie fiszek przez AI (wklejanie tekstu, statusy, lista sugestii, edycja, akceptacja/odrzucenie).
  - Ręczne tworzenie/edycja/usuwanie fiszek; zarządzanie deckami; trwałe usuwanie kart po potwierdzeniu.
  - Auth (rejestracja/logowanie) i możliwość usunięcia konta; profil (display_name, timezone, locale).
  - Sesja nauki (rating 0–3, mapowanie z UI 1–4, duration_ms, due queue); statystyki użytkownika.
  - Prywatność i bezpieczeństwo danych (RLS), responsywność i dostępność.

- Główne punkty końcowe API i cele:
  - Auth: POST /auth/register, POST /auth/login, POST /auth/logout, DELETE /users/me; Profile: GET/PUT /profiles/me.
  - Decki: GET/POST /decks; GET/PUT/DELETE /decks/{deckId}; POST /decks/{deckId}/restore; DELETE /decks/{deckId}/hard.
  - Karty: GET/POST /decks/{deckId}/cards; GET/PUT/DELETE /decks/{deckId}/cards/{cardId}; POST archive/restore.
  - AI: POST /ai/generations; GET /ai/generations, /ai/generations/{id}, /ai/generations/{id}/suggestions; PUT /ai/suggestions/{id}; POST /ai/suggestions/{id}/accept; POST /ai/generations/{id}/accept-batch; DELETE /ai/generations/{id}.
  - Nauka: GET /study/queue; POST /cards/{cardId}/reviews; (opcjonalnie) /study-sessions.
  - Statystyki: GET /me/statistics.

- Mapowanie historyjek PRD → widoki:
  - US-001/002: Login/Register → widoki Auth + guard.
  - US-003/004: Generowanie AI (lista/szczegół) + akceptacje.
  - US-005/007: Deck – szczegół (Create/Edit Card) i ręczne tworzenie.
  - US-006: Usuwanie kart (confirm) w Deck – szczegół.
  - US-008: Sesja nauki.
  - US-009: Bezpieczny dostęp (Guard + RLS-aware UI).

- Potencjalne punkty bólu i rozwiązania UI:
  - Długi czas generacji AI → wyraźne statusy, polling/backoff, informacja o limitach; możliwość pracy równoległej.
  - Konflikty slug (409) → natychmiastowa podpowiedź alternatywy i autogenerowanie.
  - Długie treści → soft-wrap, kontrolowane wysokości, zwijane sekcje.
  - 429 (rate limit) → odliczanie i zablokowany przycisk, tooltip z czasem do ponowienia.
  - Edycja inline → optimistic update z czytelnym rollbackiem i komunikatami.

## 2. Lista widoków

Dla każdego widoku: Nazwa; Ścieżka; Główny cel; Kluczowe informacje; Kluczowe komponenty; UX/A11y/Bezpieczeństwo.

1) Login
- Ścieżka: `/login`
- Główny cel: Uwierzytelnienie i przekierowanie do Generowania AI.
- Kluczowe informacje: Formularz email/hasło, link do rejestracji, błędy 400/401.
- Kluczowe komponenty: Shared AuthForm (Zod), Submit z deduplikacją, Toaster.
- UX/A11y/Bezpieczeństwo: Autocomplete, Enter-submit, focus na polu i na pierwszym błędzie, bez ujawniania szczegółów błędów auth.

2) Register
- Ścieżka: `/register`
- Główny cel: Założenie konta, automatyczne zalogowanie i redirect.
- Kluczowe informacje: Email/hasło, wymagania hasła, link do loginu.
- Kluczowe komponenty: Shared AuthForm, Toaster.
- UX/A11y/Bezpieczeństwo: Maskowanie hasła, walidacja, 409 dla zajętego maila.

3) Generowanie AI – lista
- Ścieżka: `/ai/generations`
- Główny cel: Uruchomienie nowych generacji i przegląd istniejących (list, filtry, sort, paginacja).
- Kluczowe informacje: Textarea 1000–10000 z licznikiem, statusy generacji, `updated_at`, filtry status, sort desc, stronicowanie.
- Kluczowe komponenty: Textarea z licznikami, Button Generate (obsługa 429), List/Virtual Table, FiltersBar (query string), PaginationBar, Delete z ConfirmModal.
- UX/A11y/Bezpieczeństwo: Blokada przycisku poza zakresem, odliczanie przy 429, confirm przed delete, brak HTML render.

4) Generowanie AI – szczegół
- Ścieżka: `/ai/generations/:id`
- Główny cel: Praca na sugestiach (edycja inline, selekcja, akceptacja solo/batch) + metadane generacji.
- Kluczowe informacje: Status (pending/running/succeeded/failed), model, prompt_version, tokens/cost, error (jeśli jest), lista sugestii z `front/back/status`.
- Kluczowe komponenty: StatusBanner z pollingiem, SuggestionItem (edytowalny), selekcja, przycisk Accept Selected → DeckSelectModal (pamięć ostatniego), wynik created/failed z „Ponów nieudane”.
- UX/A11y/Bezpieczeństwo: Optimistic updates (status=edited), rollback; confirm przy porzucaniu edycji; tooltipy; 404/401 obsługiwane globalnie.

5) Decki – lista
- Ścieżka: `/decks`
- Główny cel: Przegląd/zarządzanie deckami; tworzenie/edycja.
- Kluczowe informacje: Nazwa, slug, language_code, is_archived, daty; search, filtry, sort; paginacja.
- Kluczowe komponenty: Toolbar (search, filtry), List/Virtual Table, Modal Create/Edit (auto-slug; walidacja unikalności), akcje Archive/Restore, Hard Delete z confirm.
- UX/A11y/Bezpieczeństwo: 409 → propozycja slug; filtrowanie w URL; confirmy destrukcji.

6) Deck – szczegół
- Ścieżka: `/decks/:id`
- Główny cel: Lista kart w decku i operacje na kartach.
- Kluczowe informacje: Filtry `is_archived`, `source`, `due_before`; sort `due_at|updated_at`; paginacja.
- Kluczowe komponenty: FiltersBar (URL), Cards List (virtual), Create Card (formularz front/back + optional language_code), CardItem (Edit, Archive/Restore, Delete), Modal Edit.
- UX/A11y/Bezpieczeństwo: Optimistic updates, rollback; confirmy; 404 gdy brak decka, 401 redirect.

7) Karta – szczegół (opcjonalny deep-link)
- Ścieżka: `/decks/:id/cards/:cardId`
- Główny cel: Podgląd/edycja pojedynczej karty.
- Kluczowe informacje: Treść front/back, metryki SRS, daty; historia audytu (MVP 501).
- Kluczowe komponenty: Formularz edycji, akcje Archive/Restore/Delete.
- UX/A11y/Bezpieczeństwo: Jak w Deck – szczegół.

8) Sesja nauki
- Ścieżka: `/study`
- Główny cel: Nauka due cards globalnie lub dla wybranego decka.
- Kluczowe informacje: Wybór decka (opcjonalnie), bieżąca karta (front → reveal → back), rating 1–4 (map do 0–3), duration_ms, postęp.
- Kluczowe komponenty: DeckSelector, StudyCard (etapy), StudyControls (przyciski 1–4, spacja), ProgressBar/Counter.
- UX/A11y/Bezpieczeństwo: Skróty klawiaturowe, focus handling, pusty stan gdy brak due cards, bezpieczne renderowanie.

9) Profil
- Ścieżka: `/profile`
- Główny cel: Edycja profilu użytkownika.
- Kluczowe informacje: display_name, timezone, locale; banner o wpływie timezone na due_at; daty utw./akt.
- Kluczowe komponenty: Profil Form (Zod), Timezone/Locale pickers, Banner.
- UX/A11y/Bezpieczeństwo: Walidacja IANA/BCP47; 401 redirect.

10) Statystyki
- Ścieżka: `/statistics`
- Główny cel: Agregaty statystyk użytkownika.
- Kluczowe informacje: cards_total/archived/due, ai_generations_total, ai_suggestions_total/accepted, ai_acceptance_rate, reviews_total, last_reviewed_at.
- Kluczowe komponenty: KPI Tiles, (opcjonalnie) proste wykresy, odświeżanie po mutacjach.
- UX/A11y/Bezpieczeństwo: Opisy ARIA; formatowanie dat wg timezone profilu.

11) Widoki systemowe
- 401 Guard: prywatne trasy sprawdzają sesję (redirect do `/login`, pamiętanie docelowego URL).
- 404: „Nie znaleziono” (linki powrotu: AI/Decki), komunikat o możliwych przyczynach.
- Globalne modale: Confirm (destrukcja), Deck Select, Rate-limit (429) z timerem, 500 (spróbuj ponownie/zgłoś).

## 3. Mapa podróży użytkownika

Główny przepływ (Generowanie → Akceptacja → Nauka):
1. Login (`/login`) → po sukcesie redirect do `/ai/generations`.
2. Wklejenie `source_text` (1000–10000) → POST /ai/generations; UI pokazuje pending/running; polling co 2–5 s z backoffem.
3. Po `succeeded` → `/ai/generations/:id`; przegląd i edycja sugestii (status=edited), selekcja; Accept Selected → wybór decka w DeckSelectModal.
4. Akceptacja: POST /ai/generations/{id}/accept-batch (lub pojedyncze /ai/suggestions/{id}/accept); UI pokazuje created/failed i „ponów nieudane”.
5. Po akceptacji: toasty, invalidacje (deck cards, statistics, suggestions), opcja przejścia do decka.
6. Nauka: `/study` → (opcjonalny) wybór decka → GET /study/queue → reveal → rating (1–4 mapowane na 0–3) → POST /cards/{cardId}/reviews z duration_ms.

Alternatywy:
- Ręcznie dodaj kartę: `/decks/:id` → Create Card → POST /decks/{id}/cards.
- Zarządzaj deckami: `/decks` → Create/Edit/Archive/Restore/Hard Delete.
- Edytuj profil: `/profile` → PUT /profiles/me.
- Usuń generację: z listy/szczegółu → DELETE /ai/generations/{id} (confirm) → odśwież listę.

Stany i błędy (mapowanie UI):
- 400: inline errors i blokada przycisków do czasu poprawy.
- 401: wylogowanie, redirect do `/login`, czyszczenie cache.
- 404: ekran „Nie znaleziono” (np. usunięty deck/generacja) z linkiem powrotu.
- 409: deck slug conflict → propozycje slug w modalu.
- 429: blokada przycisków z odliczaniem; informacja o czasie do ponowienia.
- 500: możliwość ponowienia; zachowanie danych formularza.

## 4. Układ i struktura nawigacji

- Sidebar (główna IA):
  - Generowanie AI (`/ai/generations`)
  - Decki (`/decks`)
  - Sesja nauki (`/study`)
  - Statystyki (`/statistics`)
  - Profil (`/profile`)
- Breadcrumbs: dla `/ai/generations/:id`, `/decks/:id`, `/decks/:id/cards/:cardId`.
- Query string jako stan: filtry, sort, paginacja; utrzymanie deep-linków; prefetch kolejnych stron ~70% scrolla.
- Responsywność: Sidebar → Drawer na mobile; filtry w Sheet/Drawer; sticky action bar (np. Accept Selected) na dole.
- Guard autoryzacji: trasy prywatne (`/ai/*`, `/decks*`, `/study`, `/statistics`, `/profile`) wymagają sesji; brak → redirect do `/login`.

## 5. Kluczowe komponenty

- Layout/Scaffold: `Sidebar`, `Topbar`, `Breadcrumbs`, `Content`, `ThemeToggle`, „Skip to content”.
- AuthGuard + ErrorBoundary: przechwytywanie i mapowanie 401/403/404/409/429/500.
- ApiClient (standard): interceptory Authorization (JWT), mapowanie błędów, retry/backoff (bez 4xx), licznik 429.
- DataList/DataTable (virtual): wspólne listy dla generacji, decków i kart; integracja z `FiltersBar` i `PaginationBar`.
- Forms (Zod): pola z licznikami znaków, inline errors, debouncing, disabled na submit, deduplikacja kliknięć.
- ConfirmModal: destrukcyjne akcje (Delete/Hard delete), Esc/Enter, focus trap, opisy ARIA.
- DeckSelectModal: wybór decka (search, pamięć ostatniego); zwraca `deck_id` do akceptacji.
- SuggestionItem: edycja inline front/back, status (`proposed/edited/accepted/rejected`), selekcja do batch.
- CardItem: front/back, flagi (is_archived, source), akcje (Edit/Archive/Restore/Delete), optimistic update.
- PaginationBar: numeryczna paginacja z aria-current, integracja z URL i Query cache.
- FiltersBar: kontrolki filtrów + reset; synchronizacja z URL.
- Toasts/Notifications: globalne komunikaty sukces/błąd, 409 hinty.
- StudyControls: reveal, oceny 1–4 (map 0–3), ProgressBar/Counter, skróty klawiaturowe.
- Date/Time utils: render dat wg timezone profilu; relative time; locale z profilu.
