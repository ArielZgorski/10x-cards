# 🧪 Instrukcje testowania UI - Widok Generacji AI

## Status: ✅ Serwer działa na http://localhost:3000

## 📋 Checklist testowania

### 1. Podstawowe scenariusze

#### ✅ Generacja zakończona sukcesem
**URL:** http://localhost:3000/ai/generations/test-generation-1

**Sprawdź:**
- [ ] Breadcrumbs: "Generowanie AI → Generacja #test-gen"
- [ ] Status Banner: status "succeeded" 
- [ ] Generation Meta Panel: wszystkie metadane (model, tokeny, koszt, daty)
- [ ] 6 sugestii fiszek z różnymi statusami
- [ ] Każda sugestia ma checkbox, front/back, status badge, przyciski akcji

#### 🔄 Generacja w toku
**URL:** http://localhost:3000/ai/generations/test-generation-running

**Sprawdź:**
- [ ] Status Banner: status "running"
- [ ] Polling (strona powinna się odświeżać co kilka sekund)
- [ ] Loading skeleton podczas ładowania danych

#### ❌ Generacja z błędem
**URL:** http://localhost:3000/ai/generations/test-generation-failed

**Sprawdź:**
- [ ] Status Banner: status "failed" z komunikatem błędu
- [ ] Error message: "API rate limit exceeded"

### 2. Testowanie komponentów shadcn/ui

#### Select (Filtr statusów)
- [ ] Kliknij dropdown "Status"
- [ ] Sprawdź opcje: Wszystkie, Zaproponowane, Edytowane, Zaakceptowane, Odrzucone
- [ ] Wybierz "Zaakceptowane" → powinien pokazać 1 element
- [ ] Wybierz "Zaproponowane" → powinien pokazać 3 elementy
- [ ] Wybierz "Wszystkie" → powinien pokazać wszystkie 6 elementów

#### Checkbox i selekcja
- [ ] Zaznacz kilka checkboxów przy sugestiach
- [ ] Sprawdź czy licznik w toolbar się aktualizuje
- [ ] Sprawdź czy przyciski "Akceptuj zaznaczone" i "Odrzuć zaznaczone" się aktywują
- [ ] Odznacz wszystkie → przyciski powinny się zdezaktywować

#### Status badges
Sprawdź kolory dla różnych statusów:
- [ ] "Zaproponowane" → niebieski
- [ ] "Edytowane" → żółty  
- [ ] "Zaakceptowane" → zielony + data akceptacji
- [ ] "Odrzucone" → czerwony

#### Disabled states
- [ ] Sugestie ze statusem "accepted" powinny mieć disabled przycisk "Edytuj"
- [ ] Sugestie ze statusem "accepted" lub "rejected" powinny mieć disabled przycisk "Akceptuj"

### 3. Testowanie interakcji

#### Console logging
Otwórz Developer Tools (F12) → Console tab:
- [ ] Kliknij "Akceptuj zaznaczone" → sprawdź log w console
- [ ] Kliknij "Odrzuć zaznaczone" → sprawdź log w console  
- [ ] Kliknij "Usuń generację" → sprawdź log w console

#### Loading states
- [ ] Odśwież stronę i obserwuj skeleton loading
- [ ] Sprawdź czy komponenty Skeleton wyglądają dobrze

### 4. Responsive design

#### Desktop (>1024px)
- [ ] Grid 2-kolumnowy dla front/back w sugestiach
- [ ] Toolbar z elementami obok siebie
- [ ] Breadcrumbs w jednej linii

#### Mobile (<768px)
- [ ] Sprawdź czy layout się dostosowuje
- [ ] Toolbar może się przepłonować
- [ ] Przyciski pozostają dostępne

### 5. Testowanie edge cases

#### Puste dane
**URL:** http://localhost:3000/ai/generations/empty-test

**Sprawdź:**
- [ ] Komunikat "Brak sugestii do wyświetlenia"

#### Loading delay
- [ ] Odśwież stronę kilka razy i obserwuj loading states
- [ ] Sprawdź czy skeleton animation działa

### 6. Accessibility

#### Keyboard navigation
- [ ] Tab przez elementy
- [ ] Enter na przyciskach
- [ ] Escape z dropdown (jeśli wspiera)

#### Screen reader support
- [ ] Sprawdź aria-labels na checkboxach
- [ ] Sprawdź labels na Select
- [ ] Sprawdź role i ARIA attributes

## 🎯 Scenariusze testowe krok po kroku

### Scenariusz 1: Filtrowanie i selekcja
1. Idź do: http://localhost:3000/ai/generations/test-generation-1
2. Wybierz filter "Zaproponowane" 
3. Zaznacz wszystkie widoczne elementy
4. Kliknij "Akceptuj zaznaczone"
5. Sprawdź console log

### Scenariusz 2: Status polling
1. Idź do: http://localhost:3000/ai/generations/test-generation-running
2. Obserwuj przez 10-15 sekund
3. Sprawdź Network tab w Dev Tools - powinny być powtarzalne zapytania

### Scenariusz 3: Error handling
1. Idź do: http://localhost:3000/ai/generations/test-generation-failed
2. Sprawdź czy error message jest wyraźny
3. Spróbuj odświeżyć stronę

## 🐛 Znane problemy do sprawdzenia

- [ ] Mock data loading może być zbyt szybkie/wolne
- [ ] Dark mode (jeśli skonfigurowany)
- [ ] Focus states na wszystkich elementach interaktywnych
- [ ] Overflow dla długich tekstów

## 📱 Test na różnych urządzeniach

- [ ] Desktop Chrome
- [ ] Desktop Safari  
- [ ] Desktop Firefox
- [ ] Mobile Chrome (dev tools device simulation)
- [ ] Mobile Safari (dev tools device simulation)

## ✅ Wszystkie testy zaliczone?

Jeśli wszystkie powyższe punkty działają, UI jest gotowe do produkcji!

## 🚀 Następne kroki

Po pozytywnym teście UI możesz przejść do:
1. Implementacji prawdziwych mutacji (edit, accept, reject)
2. Dodania modali (DeckSelectModal, ConfirmModal)  
3. Integracji z prawdziwym API
4. Dodania toast notifications
