# Komponenty Autentykacji - 10x Cards

## Przegląd

Ta dokumentacja opisuje komponenty React odpowiedzialne za obsługę autentykacji użytkowników w aplikacji 10x Cards. Implementacja została stworzona zgodnie ze specyfikacją `auth-spec.md` z uwzględnieniem zasad `astro.mdc` i `react.mdc`.

## Struktura Komponentów

### AuthProvider (`AuthProvider.tsx`)

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

### AuthGuard (`AuthGuard.tsx`)

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

## Komponenty Formularzy

### LoginForm (`forms/LoginForm.tsx`)

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

### RegisterForm (`forms/RegisterForm.tsx`)

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

### ForgotPasswordForm (`forms/ForgotPasswordForm.tsx`)

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

### ResetPasswordForm (`forms/ResetPasswordForm.tsx`)

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

## Stylowanie

### Wspólne Style (`forms/form-styles.css`)

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

## Integracja z Astro

### Hydratacja

Wszystkie komponenty używają dyrektywy `client:load` dla zapewnienia interaktywności:

```astro
<AuthProvider client:load>
  <LoginForm client:load />
</AuthProvider>
```

### Imports w Astro

```astro
---
import { AuthProvider } from '../components/auth/AuthProvider';
import { LoginForm } from '../components/forms/LoginForm';
---
```

## Stan Mock vs Produkcja

### Obecna Implementacja (Mock)

- Używa `localStorage` do przechowywania tokenów
- Symuluje opóźnienia sieciowe
- Twarde dane logowania: `demo@10xcards.com` / `demo123`
- Mock walidacja tokenów resetowania

### Przyszła Implementacja (Supabase)

Komponenty zostały zaprojektowane z myślą o łatwej migracji:

1. **AuthProvider**: Zastąpienie mock funkcji prawdziwymi wywołaniami Supabase
2. **Error handling**: Mapowanie błędów Supabase na komunikaty UI
3. **Session management**: Integracja z Supabase session management
4. **Token validation**: Prawdziwa walidacja JWT tokenów

## Patterns i Best Practices

### React Patterns

- **Functional components** z hooks
- **useCallback** dla event handlers
- **useMemo** dla expensive computations (jeśli potrzebne)
- **useId** dla accessibility IDs
- **Custom hooks** do logiki biznesowej

### Error Handling

- **Graceful degradation** przy błędach
- **User-friendly messages** zamiast technical errors
- **Loading states** dla wszystkich async operations
- **Retry mechanisms** gdzie to ma sens

### Accessibility

- **Semantic HTML** i proper form elements
- **ARIA labels** i role attributes
- **Keyboard navigation** support
- **Screen reader** friendly error messages
- **Focus management** w formularzach

### Security Considerations

- **Input validation** na froncie i backencie
- **XSS protection** przez proper escaping
- **CSRF protection** (będzie dodane z Supabase)
- **Rate limiting** UI feedback
- **Secure token storage** (obecnie localStorage, później httpOnly cookies)

## Testowanie

### Unit Tests

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

### Integration Tests

- **Form submission flows**
- **Auth state changes**
- **Error scenarios**
- **Redirect behaviors**

## Konserwacja i Rozwój

### Dodawanie Nowych Funkcji

1. **Social login**: Extend AuthProvider z nowymi metodami
2. **MFA**: Dodaj nowe komponenty i estados
3. **Profile management**: Użyj istniejącego AuthProvider
4. **Session timeout**: Extend auth context

### Refaktoring do Supabase

1. Zastąp mock funkcje w `AuthProvider`
2. Zaktualizuj error mappings
3. Dodaj prawdziwe session management
4. Update token validation logic

### Performance Optimizations

- **React.memo** dla form components
- **Code splitting** z React.lazy
- **Bundle size optimization**
- **Image optimization** dla loading states
