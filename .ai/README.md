# 10x Cards - Dokumentacja Projektu

## Spis treści

1. [Przegląd Projektu](#przegląd-projektu)
2. [Komponenty Autentykacji](#komponenty-autentykacji)
3. [AI Generations API](#ai-generations-api)
4. [Architektura i Tech Stack](#architektura-i-tech-stack)
5. [Deployment i Środowisko](#deployment-i-środowisko)

---

## Przegląd Projektu

10x Cards to aplikacja do tworzenia i zarządzania zestawami fiszek edukacyjnych z wykorzystaniem sztucznej inteligencji. Aplikacja umożliwia użytkownikom automatyczne generowanie fiszek na podstawie dostarczonego tekstu oraz zarządzanie procesem nauki metodą spaced repetition.

### Główne Funkcjonalności

- **Automatyczne generowanie fiszek**: Wykorzystanie modeli LLM do tworzenia pytań i odpowiedzi
- **System autentykacji**: Rejestracja, logowanie, zarządzanie hasłami
- **Zarządzanie fiskami**: Tworzenie, edycja, usuwanie, organizowanie w zestawy
- **Spaced Repetition**: Algorytm inteligentnego powtarzania materiału
- **Statystyki**: Monitoring postępów w nauce

---

## Komponenty Autentykacji

### Przegląd

Kompletny system autentykacji oparty na React z integracją z Astro. Implementacja została stworzona zgodnie ze specyfikacją `auth-spec.md` z uwzględnieniem zasad `astro.mdc` i `react.mdc`.

### Struktura Komponentów

#### AuthProvider (`AuthProvider.tsx`)

**Cel**: Context Provider zarządzający globalnym stanem autentykacji.

**Kluczowe funkcjonalności**:
- Przechowywanie informacji o użytkowniku i sesji
- Udostępnianie metod autentykacji (`signIn`, `signUp`, `signOut`, etc.)
- Mock implementacja gotowa na zastąpienie integracją z Supabase
- Synchronizacja stanu między komponentami

**Interfejs API**:
```typescript
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
}
```

**Użycie**:
```tsx
import { AuthProvider, useAuth } from '../components/auth/AuthProvider';

// W komponencie nadrzędnym
<AuthProvider>
  <YourApp />
</AuthProvider>

// W dowolnym komponencie
const { user, signIn, loading } = useAuth();
```

#### AuthGuard (`AuthGuard.tsx`)

**Cel**: Komponent ochronny dla zabezpieczonych części aplikacji.

**Funkcjonalności**:
- Sprawdzanie stanu autentykacji
- Automatyczne przekierowywanie na stronę logowania
- Wyświetlanie stanu ładowania podczas weryfikacji
- Obsługa fallback UI

**Użycie**:
```tsx
import { AuthGuard } from '../components/auth/AuthGuard';

<AuthGuard redirectTo="/login">
  <ProtectedContent />
</AuthGuard>
```

### Komponenty Formularzy

#### LoginForm (`forms/LoginForm.tsx`)

**Funkcjonalności**:
- Walidacja email i hasła w czasie rzeczywistym
- Obsługa stanu ładowania
- Przyjazne komunikaty błędów
- Accessibility (ARIA labels, role attributes)
- Przekierowanie po pomyślnym logowaniu

**Props**:
```typescript
interface LoginFormProps {
  onSuccess?: () => void;
  redirectTo?: string; // domyślnie: '/ai/generations'
}
```

#### RegisterForm (`forms/RegisterForm.tsx`)

**Funkcjonalności**:
- Walidacja email, hasła i potwierdzenia hasła
- Sprawdzanie siły hasła (minimum 6 znaków, litery + cyfry)
- Walidacja w czasie rzeczywistym
- Auto-login po rejestracji
- Komunikaty sukcesu i błędów

**Props**:
```typescript
interface RegisterFormProps {
  onSuccess?: () => void;
  redirectTo?: string; // domyślnie: '/ai/generations'
}
```

#### ForgotPasswordForm (`forms/ForgotPasswordForm.tsx`)

**Funkcjonalności**:
- Formularz resetowania hasła
- Bezpieczne komunikaty (nie ujawnia czy email istnieje)
- Stan sukcesu z instrukcjami
- Możliwość ponownego wysłania emaila
- Timer dla ograniczenia prób

**Props**:
```typescript
interface ForgotPasswordFormProps {
  onSuccess?: () => void;
}
```

#### ResetPasswordForm (`forms/ResetPasswordForm.tsx`)

**Funkcjonalności**:
- Walidacja tokenu z URL
- Formularz nowego hasła z potwierdzeniem
- Obsługa wygasłych tokenów
- Loading state podczas walidacji tokenu
- Przekierowanie po zmianie hasła

**Props**:
```typescript
interface ResetPasswordFormProps {
  token?: string;
  onSuccess?: () => void;
  redirectTo?: string; // domyślnie: '/login'
}
```

### Stylowanie

#### Wspólne Style (`forms/form-styles.css`)

**Zawiera**:
- Unified design system dla wszystkich formularzy
- Responsive design (mobile-first)
- Accessibility focus states
- Loading spinners i animacje
- Komunikaty błędów i sukcesu
- Modern UI z consistent spacing

**Klasę CSS**:
- `.form-group`, `.form-label`, `.form-input`
- `.form-error`, `.form-hint`, `.form-link`
- `.submit-error`, `.submit-success`
- `.btn-spinner`, `.loading-spinner`

### Integracja z Astro

#### Hydratacja

Wszystkie komponenty używają dyrektywy `client:load` dla zapewnienia interaktywności:

```astro
<AuthProvider client:load>
  <LoginForm client:load />
</AuthProvider>
```

#### Imports w Astro

```astro
---
import { AuthProvider } from '../components/auth/AuthProvider';
import { LoginForm } from '../components/forms/LoginForm';
---
```

### Stan Mock vs Produkcja

#### Obecna Implementacja (Mock)

- Używa `localStorage` do przechowywania tokenów
- Symuluje opóźnienia sieciowe
- Twarde dane logowania: `demo@10xcards.com` / `demo123`
- Mock walidacja tokenów resetowania

#### Przyszła Implementacja (Supabase)

Komponenty zostały zaprojektowane z myślą o łatwej migracji:

1. **AuthProvider**: Zastąpienie mock funkcji prawdziwymi wywołaniami Supabase
2. **Error handling**: Mapowanie błędów Supabase na komunikaty UI
3. **Session management**: Integracja z Supabase session management
4. **Token validation**: Prawdziwa walidacja JWT tokenów

### Patterns i Best Practices

#### React Patterns

- **Functional components** z hooks
- **useCallback** dla event handlers
- **useMemo** dla expensive computations (jeśli potrzebne)
- **useId** dla accessibility IDs
- **Custom hooks** do logiki biznesowej

#### Error Handling

- **Graceful degradation** przy błędach
- **User-friendly messages** zamiast technical errors
- **Loading states** dla wszystkich async operations
- **Retry mechanisms** gdzie to ma sens

#### Accessibility

- **Semantic HTML** i proper form elements
- **ARIA labels** i role attributes
- **Keyboard navigation** support
- **Screen reader** friendly error messages
- **Focus management** w formularzach

#### Security Considerations

- **Input validation** na froncie i backencie
- **XSS protection** przez proper escaping
- **CSRF protection** (będzie dodane z Supabase)
- **Rate limiting** UI feedback
- **Secure token storage** (obecnie localStorage, później httpOnly cookies)

### Testowanie

#### Unit Tests

Komponenty są przygotowane do testowania:

```typescript
// Przykład testu LoginForm
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider } from '../auth/AuthProvider';
import { LoginForm } from '../forms/LoginForm';

test('validates email format', async () => {
  render(
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
  
  const emailInput = screen.getByLabelText(/email/i);
  fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
  
  expect(screen.getByText(/nieprawidłowy format email/i)).toBeInTheDocument();
});
```

#### Integration Tests

- **Form submission flows**
- **Auth state changes**
- **Error scenarios**
- **Redirect behaviors**

### Konserwacja i Rozwój

#### Dodawanie Nowych Funkcji

1. **Social login**: Extend AuthProvider z nowymi metodami
2. **MFA**: Dodaj nowe komponenty i estados
3. **Profile management**: Użyj istniejącego AuthProvider
4. **Session timeout**: Extend auth context

#### Refaktoring do Supabase

1. Zastąp mock funkcje w `AuthProvider`
2. Zaktualizuj error mappings
3. Dodaj prawdziwe session management
4. Update token validation logic

#### Performance Optimizations

- **React.memo** dla form components
- **Code splitting** z React.lazy
- **Bundle size optimization**
- **Image optimization** dla loading states

---

## AI Generations API

### Przegląd

API umożliwiające generowanie fiszek edukacyjnych przy użyciu sztucznej inteligencji. System przetwarza tekst źródłowy i tworzy sugestie pytań i odpowiedzi na podstawie materiału edukacyjnego.

### POST /api/ai/generations

Inicjuje zadanie generowania AI w celu utworzenia sugestii fiszek z tekstu źródłowego.

#### Authentication

Wymaga nagłówka `Authorization: Bearer <supabase_jwt>`.

#### Request Body

```json
{
  "source_text": "string (1000-10000 characters)",
  "model": "string (optional)",
  "prompt_version": "string (optional)"
}
```

#### Response

**Success (202 Accepted):**
```json
{
  "generation_id": "uuid",
  "status": "pending"
}
```

**Error (400 Bad Request):**
```json
{
  "error": "Validation error: source_text: Source text must be at least 1000 characters",
  "status": 400,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Error (401 Unauthorized):**
```json
{
  "error": "Authorization header required",
  "status": 401,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Error (429 Too Many Requests):**
```json
{
  "error": "Rate limit exceeded. Please try again later.",
  "status": 429,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Rate Limits

- 5 requests per 5 minutes per user for AI generation
- Headers include rate limit information:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining in current window
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

#### Background Processing

The actual AI processing happens asynchronously. Check the generation status using:
- `GET /api/ai/generations/{generationId}` (to be implemented)
- `GET /api/ai/generations/{generationId}/suggestions` (to be implemented)

#### Environment Variables Required

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
OPENROUTER_API_KEY=your_openrouter_api_key
```

#### Example Usage

```javascript
const response = await fetch('/api/ai/generations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseJwt}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    source_text: 'Your source material here...' // Must be 1000-10000 chars
  }),
});

const result = await response.json();
console.log(result.generation_id); // Use this to check status later
```

---

## Architektura i Tech Stack

### Tech Stack

- **Frontend**: Astro 5 + React 19
- **Styling**: Tailwind CSS 4 + Shadcn/ui
- **Backend**: Astro API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI**: OpenRouter API
- **Language**: TypeScript 5

### Project Structure

```
./src
├── layouts/          # Astro layouts
├── pages/           # Astro pages
│   └── api/         # API endpoints
├── middleware/      # Astro middleware
├── db/             # Supabase clients and types
├── types.ts        # Shared types
├── components/     # Client-side components
│   ├── auth/       # Authentication components
│   ├── forms/      # Form components
│   └── ui/         # Shadcn/ui components
├── lib/            # Services and helpers
├── assets/         # Static internal assets
└── public/         # Public assets
```

### Coding Practices

#### Guidelines for Clean Code

- Use feedback from linters to improve the code when making changes
- Prioritize error handling and edge cases
- Handle errors and edge cases at the beginning of functions
- Use early returns for error conditions to avoid deeply nested if statements
- Place the happy path last in the function for improved readability
- Avoid unnecessary else statements; use if-return pattern instead
- Use guard clauses to handle preconditions and invalid states early
- Implement proper error logging and user-friendly error messages
- Consider using custom error types or error factories for consistent error handling

---

## Deployment i Środowisko

### Environment Variables

Wymagane zmienne środowiskowe dla pełnej funkcjonalności aplikacji:

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Configuration
OPENROUTER_API_KEY=your_openrouter_api_key

# Optional: Development
NODE_ENV=development|production
```

### Database Setup

Projekt wykorzystuje Supabase jako główną bazę danych. Migracje znajdują się w folderze `supabase/migrations/`.

#### Główne tabele:
- `profiles` - Profile użytkowników
- `decks` - Zestawy fiszek
- `flashcards` - Fiszki
- `ai_generations` - Historia generowania AI
- `ai_suggestions` - Sugestie fiszek od AI
- `card_reviews` - Historia przeglądów fiszek

### Performance Considerations

- **React Components**: Używaj `React.memo` dla komponentów renderujących często
- **Code Splitting**: Implementuj lazy loading dla dużych komponentów
- **API Rate Limiting**: Przestrzegaj limitów API (5 req/5min dla AI)
- **Caching**: Wykorzystuj browser cache dla statycznych assets
- **Bundle Size**: Monitoruj rozmiar bundlea i optymalizuj importy

### Security

- **Input Validation**: Walidacja wszystkich danych wejściowych
- **XSS Protection**: Proper escaping user content
- **CSRF Protection**: Implementowane przez Supabase
- **Rate Limiting**: Ograniczenia na poziomie API
- **Secure Headers**: Konfiguracja bezpiecznych nagłówków HTTP

### Monitoring i Debugging

- **Error Tracking**: Implementuj system logowania błędów
- **Performance Monitoring**: Monitoruj wydajność API i UI
- **User Analytics**: Zbieraj statystyki użytkowania (zgodnie z RODO)
- **Health Checks**: Endpoint do sprawdzania stanu aplikacji

---

## Kontakt i Wsparcie

Dla pytań technicznych lub problemów z implementacją, sprawdź:
- Dokumentację w folderze `.ai/`
- Testy jednostkowe w `src/lib/__tests__/`
- Konfigurację w plikach `rules/*.mdc`

Projekt jest w fazie aktywnego rozwoju - aktualizacje dokumentacji będą publikowane regularnie.
