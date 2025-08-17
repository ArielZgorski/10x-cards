# Plan implementacji widoku Generowanie AI – szczegół

## 1. Przegląd
Widok służy do pracy z pojedynczą generacją AI: prezentuje jej status i metadane oraz listę wygenerowanych sugestii fiszek. Umożliwia edycję treści sugestii (inline), zmianę statusu (edited/rejected), selekcję i akceptację pojedynczo lub wsadowo do wybranego decka, a także usunięcie całej generacji. Zapewnia polling statusu dla pending/running i pełne mapowanie błędów API.

## 2. Routing widoku
- Ścieżka: `/ai/generations/:id`
- Ochrona: prywatna trasa (guard sesji JWT Supabase; 401 → redirect do `/login`).
- Breadcrumbs: `Generowanie AI` → `Generacja #<skrót id>`.

## 3. Struktura komponentów
- `GenerationDetailPage`
  - `StatusBanner`
  - `GenerationMetaPanel`
  - `SuggestionsToolbar`
    - filtry: `status?`, paginacja
    - akcje masowe: `Accept Selected`, `Reject Selected`
  - `SuggestionsList` (wirtualizowana)
    - `SuggestionRow` (xN)
  - `PaginationBar`
  - Portale/Modale:
    - `DeckSelectModal` (dla akceptacji)
    - `ConfirmModal` (usunięcie generacji)
  - Global: `Toasts`, `ErrorBoundary`

Diagram drzewa komponentów:
```
GenerationDetailPage
├─ StatusBanner
├─ GenerationMetaPanel
├─ SuggestionsToolbar
│  ├─ StatusFilter
│  ├─ BulkActions (AcceptSelected, RejectSelected)
├─ SuggestionsList (virtual)
│  ├─ SuggestionRow (editable)
│  │  ├─ FrontEditor
│  │  ├─ BackEditor
│  │  ├─ RowActions (Edit/Save/Cancel, Accept, Reject)
├─ PaginationBar
├─ DeckSelectModal
└─ ConfirmModal
```

## 4. Szczegóły komponentów
### GenerationDetailPage
- Opis: Kontener widoku; pobiera dane generacji i sugestii, orkiestruje polling, filtry, selekcję i mutacje.
- Główne elementy: status, metadane, lista sugestii, toolbar, paginacja, modale.
- Zdarzenia: mount/unmount (start/stop pollingu), zmiana filtrów/paginacji, akcje Accept/Reject/Delete, zapis edycji, pojedyncza akceptacja.
- Walidacja: delegowana do podkomponentów i mutacji (front/back 1–2000; status transitions; accept wymaga `deck_id`).
- Typy: `AIGenerationDTO`, `AISuggestionDTO`, `Paginated<AISuggestionDTO>`, VM-y (poniżej).
- Propsy: brak (widok routowany; `id` z paramów trasy).

### StatusBanner
- Opis: Prezentuje status generacji (`pending|running|succeeded|failed`) i komunikaty błędów.
- Elementy: badge/status, opcjonalny opis błędu, CTA (np. „Spróbuj ponownie pobrać”).
- Zdarzenia: brak specyficznych; reaguje na polling.
- Walidacja: brak.
- Typy: fragment `AIGenerationDTO` (`status`, `error`).
- Propsy: `status: string`, `error?: Record<string, unknown> | null`.

### GenerationMetaPanel
- Opis: Pokazuje metadane generacji: `model`, `prompt_version`, `tokens_input/output`, `cost_usd`, timestampy.
- Elementy: card/stack z parami klucz-wartość.
- Zdarzenia: brak.
- Walidacja: prezentacja tylko.
- Typy: `AIGenerationDTO`.
- Propsy: `generation: AIGenerationDTO`.

### SuggestionsToolbar
- Opis: Filtry, sort (jeśli potrzebne), akcje masowe: akceptacja/odrzucenie wybranych; licznik zaznaczonych.
- Elementy: `StatusFilter` (proposed/edited/accepted/rejected/All), przyciski: Accept Selected, Reject Selected (disabled gdy 0 zaznaczonych).
- Zdarzenia: zmiana filtra, klik akcji masowych.
- Walidacja: przy Accept mass – brak zaznaczenia (disabled); przy Reject mass – tylko dla `proposed|edited`.
- Typy: `AISuggestionStatus`, `UUID[]`.
- Propsy: `{ selectedIds: UUID[]; statusFilter: AISuggestionStatus | 'all'; onChangeFilter; onAcceptSelected; onRejectSelected }`.

### SuggestionsList
- Odp.: Renderuje wirtualizowaną listę sugestii z paginacją; utrzymuje selection i przekazuje eventy do rodzica.
- Elementy: Virtualizer, `SuggestionRow`.
- Zdarzenia: zaznaczanie/odznaczanie, edycja pól, zapis/rollback, akceptacja/rejekcja, otwarcie modalu DeckSelect (dla pojedynczej akceptacji).
- Walidacja: inline (front/back 1–2000; trim; disabled Save, jeśli brak zmian lub błędy).
- Typy: `AISuggestionDTO`, `SuggestionViewModel`.
- Propsy: `{ items: SuggestionViewModel[]; selection: Set<UUID>; onSelectionChange; onEdit; onSave; onCancel; onAcceptOne; onRejectOne }`.

### SuggestionRow
- Opis: Wiersz edytowalny; pokazuje front/back i status; checkbox wybory; akcje row-level.
- Elementy: `FrontEditor`, `BackEditor`, `Checkbox`, `RowActions` (Save/Cancel, Accept, Reject).
- Zdarzenia: onChange front/back (debounced), Save (PUT), Cancel (rollback), Accept (POST), Reject (PUT status=rejected).
- Walidacja: front/back 1–2000, brak HTML; status przejściowy: edit → edited.
- Typy: `AISuggestionDTO`, `UpdateAISuggestionCommand`, `AcceptAISuggestionCommand`.
- Propsy: `{ suggestion: SuggestionViewModel; selected: boolean; onToggleSelect; onChangeFront; onChangeBack; onSave; onCancel; onAccept; onReject }`.

### DeckSelectModal
- Opis: Modal wyboru decka przy akceptacji (pojedynczej/wsadowej); pamięta ostatnio użyty deck.
- Elementy: Search input, lista decków (paginowana), wybór, Confirm/Cancel.
- Zdarzenia: wybór decka, potwierdzenie.
- Walidacja: wymagany `deck_id`.
- Typy: `DeckDTO`.
- Propsy: `{ isOpen: boolean; onClose; onConfirm: (deckId: UUID) => void; initialDeckId?: UUID }`.

### ConfirmModal
- Opis: Modal potwierdzenia usunięcia generacji.
- Elementy: opis, Confirm/Cancel.
- Zdarzenia: onConfirm → DELETE.
- Walidacja: brak (potwierdzenie).
- Typy: —
- Propsy: `{ isOpen: boolean; onConfirm; onClose }`.

### PaginationBar
- Opis: Paginacja numeryczna; integracja z URL i Query cache.
- Elementy: prev/next, numery stron.
- Zdarzenia: zmiana strony.
- Walidacja: ograniczenia per_page (np. max 100 z API sugeruje 50 dla sugestii).
- Typy: `{ page: number; perPage: number; total: number }`.
- Propsy: `{ page; perPage; total; onPageChange }`.

## 5. Typy
- Wykorzystane DTO (z `src/types.ts`):
  - `AIGenerationDTO`, `AISuggestionDTO`, `AISuggestionStatus`, `AcceptAISuggestionCommand`, `AcceptBatchSuggestionsCommand`, `UpdateAISuggestionCommand`, `DeckDTO`, `Paginated<T>`, `UUID`.
- Nowe typy ViewModel (frontend):
  - `SuggestionViewModel`:
    - `id: UUID`
    - `front: string`
    - `back: string`
    - `status: AISuggestionStatus`
    - `isDirty: boolean` – lokalny znacznik edycji
    - `validation: { frontError?: string; backError?: string }`
    - `isAccepted: boolean` – po akceptacji (sync z `status === 'accepted'`)
  - `GenerationDetailViewModel`:
    - `generation: AIGenerationDTO`
    - `suggestions: SuggestionViewModel[]`
    - `page: number`, `perPage: number`, `total: number`
    - `statusFilter: AISuggestionStatus | 'all'`
    - `selectedIds: Set<UUID>`
    - `lastUsedDeckId?: UUID`

Walidacje typów:
- `front`, `back`: string 1..2000 (po `trim()`), brak tagów HTML (sanity check: usuwamy `<` `>` lub blokujemy przez textarea/plaintext render).
- `status` zmienialny tylko na `edited` lub `rejected` przez PUT; `accepted` tylko przez accept.

## 6. Zarządzanie stanem
- TanStack Query:
  - `useQuery(['generation', id], GET /ai/generations/:id, { refetchInterval: status in (pending|running) ? 2000..5000 with backoff : false })`
  - `useQuery(['suggestions', id, {status, page, perPage}], GET /ai/generations/:id/suggestions?status&page&per_page)`
  - `useQuery(['decks', { search, page }], GET /decks)` w modalu.
- Mutacje:
  - `useMutation(PUT /ai/suggestions/:id)` – edycja front/back lub status=rejected (optimistic update + rollback).
  - `useMutation(POST /ai/suggestions/:id/accept)` – akceptacja pojedynczej.
  - `useMutation(POST /ai/generations/:id/accept-batch)` – akceptacja wsadowa.
  - `useMutation(DELETE /ai/generations/:id)` – usunięcie generacji.
- Lokalne hooki:
  - `useSelection<T extends UUID>()` – zaznaczenia wierszy (Set<UUID> + operacje).
  - `useDebouncedState(value, 300)` – edycja inline z odkładanym zapisem.
  - `useLocalStorage<UUID>('lastDeckId')` – pamięć ostatniego decka.

## 7. Integracja API
- GET `/ai/generations/{generationId}` → `AIGenerationDTO`
- GET `/ai/generations/{generationId}/suggestions?status&page&per_page` → `Paginated<AISuggestionDTO>`
- PUT `/ai/suggestions/{suggestionId}` body: `UpdateAISuggestionCommand` → `AISuggestionDTO`
  - Dozwolone: zmiany `front`, `back`, `status` ∈ {`edited`, `rejected`}
- POST `/ai/suggestions/{suggestionId}/accept` body: `AcceptAISuggestionCommand` → `{ suggestion: { id, status: 'accepted', accepted_at, card_id }, card: CardDTO }`
- POST `/ai/generations/{generationId}/accept-batch` body: `AcceptBatchSuggestionsCommand` → `{ created: [...], failed: [...] }`
- DELETE `/ai/generations/{generationId}` → 204
- GET `/decks` (dla modalu) → `Paginated<DeckDTO>`

Uwagi implementacyjne:
- Po akceptacji: `invalidateQueries(['suggestions', id])`, `invalidateQueries(['decks'])`, `invalidateQueries(['statistics'])` (zgodnie z notatkami sesji).
- Przy statusie `failed`: bannery z komunikatem z `error`.

## 8. Interakcje użytkownika
- Edycja front/back wiersza → walidacja długości; Save aktywny tylko gdy `isDirty` i brak błędów → PUT; przy sukcesie status przechodzi na `edited` jeśli treść zmieniona.
- Reject wiersza → PUT status=`rejected`; optimistic update; tooltip dla zablokowanych akcji na `accepted`.
- Zaznaczenie wielu → `Accept Selected` → Modal deck → potwierdzenie → POST accept-batch; pokazanie created/failed z opcją „Ponów dla nieudanych”.
- Accept pojedynczy → menu w wierszu → Modal deck (z uzupełnionym ostatnim deckiem) → POST accept; po sukcesie oznaczenie `accepted` i link do karty.
- Usunięcie generacji → `Delete` → ConfirmModal → DELETE → redirect do `/ai/generations` i toast.
- Zmiana filtra statusu/paginacji → refetch listy + aktualizacja query string.

## 9. Warunki i walidacja
- Front/Back: 1–2000 znaków; blokada Save i komunikat inline; licznik znaków monospaced.
- Accept: wymagany `deck_id`; dla batch limit ≤ 100; zablokuj przy pustej selekcji.
- Status transitions: tylko `edited`/`rejected` przez PUT; `accepted` tylko przez accept.
- Widoczność akcji: ukryj lub wyłącz dla `accepted/rejected`; tooltip z wyjaśnieniem.
- Guard 401: globalny redirect i wylogowanie.

## 10. Obsługa błędów
- 400: wyświetl błędy walidacji inline (front/back), toast z podsumowaniem; nie wysyłaj gdy lokalne walidacje nie przechodzą.
- 401: redirect do `/login`, czyszczenie cache.
- 404: ekran „Nie znaleziono” dla generacji lub toast i link powrotny.
- 409: kolizje akceptacji/duplikatów – pokaż failed items w wynikach accept-batch z możliwością ponowienia.
- 429: blokada przycisku Accept/Save; odliczanie; toast z informacją o czasie.
- 500: retry z backoffem, zachowanie edycji w pamięci lokalnej; ErrorBoundary fallback.

## 11. Kroki implementacji
1. Routing: dodaj trasę `/ai/generations/:id` i guard autoryzacji.
2. Zaimplementuj `GenerationDetailPage` z `useParams` i skeletonami sekcji.
3. Podłącz `useQuery` dla generacji i ustaw polling zależny od statusu.
4. Podłącz `useQuery` dla sugestii (status, page, per_page) + PaginationBar; utrzymuj stan w URL.
5. Zaimplementuj `StatusBanner` i `GenerationMetaPanel` (prezentacja DTO).
6. Zaimplementuj `SuggestionsToolbar` (filtr, bulk actions) i stan selekcji (`useSelection`).
7. Zaimplementuj `SuggestionsList` (virtual) i `SuggestionRow` z edytorami front/back, walidacją, debounce i akcjami.
8. Mutacje: PUT update suggestion (optimistic + rollback), POST accept (one), POST accept-batch (modal deck, pamięć ostatniego decka), DELETE generation.
9. Modale: `DeckSelectModal` (GET /decks, search), `ConfirmModal` (delete).
10. Invalidacje cache po akcjach zgodnie z notatkami (suggestions, decks, statistics).
11. Obsłuż błędy (400/401/404/409/429/500) zgodnie z sekcją 10 i dodaj toasty.
12. A11y: role/ARIA, focus trap w modalach, skróty klawiaturowe (np. Enter do Save, Esc do Cancel), tab order.
13. Testy: msw dla błędów API kluczowych ścieżek; axe dla dostępności; snapshoty layoutu.
