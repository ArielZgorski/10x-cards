# Specyfikacja Architektury Systemu Autentykacji - 10x Cards

## Przegląd

Dokument opisuje szczegółową architekturę funkcjonalności rejestracji, logowania i odzyskiwania hasła użytkowników dla aplikacji 10x Cards, zgodnie z wymaganiami US-010 i US-011 z PRD oraz wykorzystującą stos technologiczny oparty na Astro 5, React 19, TypeScript 5 i Supabase.

## 1. ARCHITEKTURA INTERFEJSU UŻYTKOWNIKA

### 1.1 Struktura Stron i Komponentów

#### 1.1.1 Strony Autentykacji (Astro)

**A. `/src/pages/login.astro`**
- **Stan obecny**: Implementuje formularz logowania z mock'ową autentykacją
- **Wymagane zmiany**:
  - Zastąpienie mock'owej logiki prawdziwą integracją z Supabase Auth
  - Dodanie walidacji po stronie klienta i serwera
  - Implementacja obsługi błędów specyficznych dla Supabase
  - Dodanie przekierowania do strony odzyskiwania hasła

**B. `/src/pages/register.astro`**
- **Stan obecny**: Implementuje formularz rejestracji z mock'ową logiką
- **Wymagane zmiany**:
  - Integracja z Supabase Auth dla rzeczywistej rejestracji
  - Rozszerzenie walidacji hasła zgodnie z polityką Supabase
  - Dodanie obsługi potwierdzenia email (jeśli włączone)
  - Implementacja automatycznego logowania po rejestracji

**C. `/src/pages/forgot-password.astro` (NOWA)**
- **Cel**: Strona do resetowania hasła
- **Struktura**:
  - Formularz z polem email
  - Komunikaty o statusie wysłania emaila
  - Link powrotny do logowania
  - Obsługa błędów (nieistniejący email, rate limiting)

**D. `/src/pages/reset-password.astro` (NOWA)**
- **Cel**: Strona do ustawiania nowego hasła
- **Struktura**:
  - Formularz z nowymi polami hasła i potwierdzenia
  - Walidacja tokenu resetującego z URL
  - Obsługa wygaśnięcia tokenu
  - Przekierowanie po pomyślnej zmianie

#### 1.1.2 Layouty

**A. `/src/layouts/Layout.astro`**
- **Stan obecny**: Podstawowy layout z opcjonalną autentykacją
- **Wymagane rozszerzenia**:
  - Ulepszenie mechanizmu `requireAuth` z prawdziwą weryfikacją tokenu Supabase
  - Dodanie obsługi refresh tokenów
  - Implementacja globalnego stanu autentykacji
  - Dodanie meta tagów dla stron autentykacji

**B. `/src/layouts/AppLayout.astro`**
- **Stan obecny**: Layout aplikacji z sidebar'em i nawigacją
- **Wymagane rozszerzenia**:
  - Dodanie informacji o zalogowanym użytkowniku (email, nazwa wyświetlana)
  - Rozszerzenie funkcji logout o prawidłowe zakończenie sesji Supabase
  - Dodanie obsługi błędów autoryzacji
  - Implementacja auto-wylogowania przy wygaśnięciu sesji

#### 1.1.3 Komponenty React

**A. `/src/components/auth/AuthProvider.tsx` (NOWY)**
- **Cel**: Context Provider zarządzający stanem autentykacji
- **Odpowiedzialności**:
  - Przechowywanie informacji o użytkowniku i statusie autentykacji
  - Udostępnianie metod logowania, wylogowania, rejestracji
  - Automatyczne odświeżanie tokenów
  - Synchronizacja stanu między kartami przeglądarki
- **Interface**:
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

**B. `/src/components/auth/AuthGuard.tsx` (NOWY)**
- **Cel**: Komponent ochronny dla zabezpieczonych części aplikacji
- **Wykorzystanie**: W komponentach wymagających autoryzacji
- **Funkcjonalność**:
  - Sprawdzanie stanu autentykacji
  - Przekierowywanie na login przy braku autoryzacji
  - Wyświetlanie loading state podczas weryfikacji

**C. `/src/components/forms/` (NOWE)**
- **LoginForm.tsx**: Formularz logowania z walidacją i obsługą błędów
- **RegisterForm.tsx**: Formularz rejestracji z walidacją hasła
- **ForgotPasswordForm.tsx**: Formularz resetowania hasła
- **ResetPasswordForm.tsx**: Formularz ustawiania nowego hasła

### 1.2 Rozdzielenie Odpowiedzialności

#### 1.2.1 Strony Astro vs Komponenty React

**Strony Astro odpowiadają za**:
- Server-side rendering pierwszego ładowania
- Walidację tokenów z URL (reset password)
- Ustawienie początkowego stanu na podstawie cookies/session
- Meta tagi i SEO
- Layout i strukturę strony

**Komponenty React odpowiadają za**:
- Interaktywne formularze i walidację client-side
- Zarządzanie stanem UI (loading, errory)
- Komunikację z API autentykacji
- Przekierowywania po akcjach użytkownika
- Real-time feedback dla użytkownika

#### 1.2.2 Strategia Renderowania

**Server-side (Astro)**:
- Inicial auth check w middleware
- Przekierowania na poziomie serwera dla chronionych stron
- Hydratacja z istniejącym stanem autentykacji

**Client-side (React)**:
- Interaktywne komponenty po hydratacji
- Automatyczne odświeżanie sesji
- Obsługa błędów i komunikatów

### 1.3 Walidacja i Komunikaty Błędów

#### 1.3.1 Walidacja Client-side
- **Email**: Regex + format validation
- **Hasło**: Minimum 6 znaków (zgodnie z Supabase config)
- **Potwierdzenie hasła**: Identyczność z hasłem
- **Real-time feedback**: Walidacja w trakcie wpisywania

#### 1.3.2 Obsługa Błędów Supabase
- **Nieistniejący użytkownik**: "Nieprawidłowy email lub hasło"
- **Błędne hasło**: "Nieprawidłowy email lub hasło" 
- **Email już istnieje**: "Konto z tym adresem email już istnieje"
- **Rate limiting**: "Zbyt wiele prób. Spróbuj ponownie za [czas]"
- **Słabe hasło**: "Hasło musi spełniać wymagania bezpieczeństwa"
- **Token wygasł**: "Link wygasł. Poproś o nowy"

#### 1.3.3 Scenariusze UX
- **Sukces logowania**: Przekierowanie na `/ai/generations`
- **Sukces rejestracji**: Auto-login + przekierowanie
- **Reset hasła**: Komunikat o wysłaniu emaila + timer
- **Nowe hasło**: Potwierdzenie + przekierowanie na login
- **Sesja wygasła**: Automatyczne wylogowanie + komunikat

## 2. LOGIKA BACKENDOWA

### 2.1 Struktura Endpointów API

#### 2.1.1 Endpointy Autentykacji

**A. `/src/pages/api/auth/signin.ts` (NOWY)**
```typescript
POST /api/auth/signin
Request: { email: string, password: string }
Response: { 
  user: User, 
  session: Session,
  access_token: string,
  refresh_token: string 
}
Errors: 400 (validation), 401 (invalid credentials), 429 (rate limit)
```

**B. `/src/pages/api/auth/signup.ts` (NOWY)**
```typescript
POST /api/auth/signup  
Request: { email: string, password: string }
Response: {
  user: User,
  session: Session | null, // null jeśli wymaga potwierdzenia email
  message?: string
}
Errors: 400 (validation/weak password), 409 (email exists), 429 (rate limit)
```

**C. `/src/pages/api/auth/signout.ts` (NOWY)**
```typescript
POST /api/auth/signout
Headers: Authorization: Bearer <token>
Response: 204 No Content
Errors: 401 (invalid token)
```

**D. `/src/pages/api/auth/forgot-password.ts` (NOWY)**
```typescript
POST /api/auth/forgot-password
Request: { email: string }
Response: { message: "Email został wysłany jeśli konto istnieje" }
Errors: 400 (validation), 429 (rate limit)
```

**E. `/src/pages/api/auth/reset-password.ts` (NOWY)**
```typescript
POST /api/auth/reset-password
Request: { 
  token: string, // z URL
  password: string 
}
Response: { message: "Hasło zostało zmienione" }
Errors: 400 (validation/invalid token), 401 (expired token)
```

**F. `/src/pages/api/auth/refresh.ts` (NOWY)**
```typescript
POST /api/auth/refresh
Request: { refresh_token: string }
Response: {
  access_token: string,
  refresh_token: string,
  expires_in: number
}
Errors: 401 (invalid/expired refresh token)
```

#### 2.1.2 Endpointy Profilu Użytkownika

**A. Aktualizacja `/src/pages/api/profiles/me.ts`**
- **Rozszerzenie**: Dodanie endpoint'u DELETE dla usunięcia konta
- **Nowa funkcjonalność**: Cascade usuwanie wszystkich danych użytkownika

**B. `/src/pages/api/auth/delete-account.ts` (NOWY)**
```typescript
DELETE /api/auth/delete-account
Headers: Authorization: Bearer <token>
Request: { password: string } // potwierdzenie
Response: 204 No Content
Errors: 401 (invalid token), 400 (wrong password), 403 (forbidden)
```

### 2.2 Mechanizm Walidacji Danych

#### 2.2.1 Schemas Zod

**A. `/src/lib/auth/validation.ts` (NOWY)**
```typescript
// Schemas walidacji dla autentykacji
const SignInSchema = z.object({
  email: z.string().email('Nieprawidłowy format email'),
  password: z.string().min(1, 'Hasło jest wymagane')
});

const SignUpSchema = z.object({
  email: z.string().email('Nieprawidłowy format email'),
  password: z.string()
    .min(6, 'Hasło musi mieć co najmniej 6 znaków')
    .regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'Hasło musi zawierać litery i cyfry')
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token jest wymagany'),
  password: z.string().min(6, 'Hasło musi mieć co najmniej 6 znaków')
});
```

#### 2.2.2 Middleware Walidacyjny

**A. Rozszerzenie `/src/middleware/index.ts`**
- **Dodanie**: Walidacja access tokenów w headerach
- **Dodanie**: Automatyczne odświeżanie wygasających tokenów
- **Dodanie**: Logowanie prób dostępu i błędów autoryzacji

### 2.3 Obsługa Wyjątków

#### 2.3.1 Error Handling Strategy

**A. `/src/lib/auth/errors.ts` (NOWY)**
```typescript
class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
  }
}

const AUTH_ERRORS = {
  INVALID_CREDENTIALS: new AuthError('Nieprawidłowy email lub hasło', 'invalid_credentials', 401),
  EMAIL_EXISTS: new AuthError('Konto z tym emailem już istnieje', 'email_exists', 409),
  WEAK_PASSWORD: new AuthError('Hasło nie spełnia wymagań', 'weak_password', 400),
  RATE_LIMITED: new AuthError('Zbyt wiele prób', 'rate_limited', 429),
  TOKEN_EXPIRED: new AuthError('Token wygasł', 'token_expired', 401)
};
```

#### 2.3.2 Centralized Error Handler

**A. `/src/lib/auth/error-handler.ts` (NOWY)**
- **Funkcja**: Mapowanie błędów Supabase na przyjazne komunikaty
- **Logging**: Rejestrowanie błędów z kontekstem (IP, user agent, timestamp)
- **Rate limiting**: Integracja z systemem rate limiting

### 2.4 Aktualizacja Server-side Rendering

#### 2.4.1 Astro Middleware Enhancement

**A. Rozszerzenie `/src/middleware/index.ts`**
```typescript
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  
  // Public routes that don't require auth
  const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/'];
  const isPublicRoute = publicRoutes.includes(pathname);
  
  // API routes handle auth internally
  const isApiRoute = pathname.startsWith('/api/');
  
  if (isPublicRoute || isApiRoute) {
    return next();
  }
  
  // Check for auth session
  const session = await getServerSession(context);
  
  if (!session) {
    return context.redirect('/login');
  }
  
  // Attach user to context
  context.locals.user = session.user;
  context.locals.session = session;
  
  return next();
});
```

#### 2.4.2 Session Management

**A. `/src/lib/auth/session.ts` (NOWY)**
```typescript
async function getServerSession(context: APIContext): Promise<Session | null> {
  // Try to get session from cookie or header
  const authHeader = context.request.headers.get('authorization');
  const sessionCookie = context.cookies.get('sb-access-token');
  
  if (!authHeader && !sessionCookie) {
    return null;
  }
  
  // Validate session with Supabase
  const supabase = createServerSupabaseClient(context);
  const { data: { session } } = await supabase.auth.getSession();
  
  return session;
}
```

## 3. SYSTEM AUTENTYKACJI

### 3.1 Integracja z Supabase Auth

#### 3.1.1 Konfiguracja Klienta Supabase

**A. `/src/lib/auth/supabase-client.ts` (NOWY)**
```typescript
// Client-side Supabase client
export const supabase = createClient<Database>(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  }
);

// Server-side Supabase client  
export function createServerSupabaseClient(context: APIContext) {
  return createClient<Database>(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          Authorization: context.request.headers.get('authorization') || ''
        }
      }
    }
  );
}
```

#### 3.1.2 Konfiguracja Supabase Auth

**A. Aktualizacja `supabase/config.toml`**
```toml
[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = [
  "http://localhost:3000/auth/callback",
  "https://your-domain.com/auth/callback"
]

# Email settings
[auth.email]
enabled = true
enable_signup = true
enable_confirmations = false # Dla MVP - później można włączyć
secure_email_change_enabled = true
secure_password_change_enabled = true

# Password requirements
minimum_password_length = 6
password_requirements = "letters_digits"

# Rate limiting
[auth.rate_limit]
email_sent = 10  # Emails per hour
sms_sent = 10    # SMS per hour (nie używane)
token_refresh = 300  # Token refreshes per 5 min interval
```

### 3.2 Zarządzanie Sesjami

#### 3.2.1 Cookie Strategy

**A. Session Cookies**
- **`sb-access-token`**: Krótkotrwały access token (1h)
- **`sb-refresh-token`**: Długotrwały refresh token (30 dni)  
- **Secure flags**: HttpOnly, Secure, SameSite=Lax
- **Path**: `/` dla całej aplikacji

#### 3.2.2 Token Refresh Strategy

**A. Automatyczne odświeżanie**
- **Client-side**: Supabase client automatycznie odświeża tokeny
- **Server-side**: Middleware sprawdza ważność tokenów
- **Background refresh**: 5 minut przed wygaśnięciem
- **Fallback**: Przekierowanie na login przy niepowodzeniu

### 3.3 Bezpieczeństwo

#### 3.3.1 Zabezpieczenia

**A. CSRF Protection**
- **Double Submit Cookies**: Dla state-changing operations
- **SameSite Cookies**: Ochrona przed CSRF

**B. Rate Limiting**
- **Login attempts**: 5 prób na 15 minut na IP
- **Registration**: 3 rejestracje na godzinę na IP  
- **Password reset**: 2 emaile na godzinę na email
- **Token refresh**: 150 odświeżeń na 5 minut na IP

**C. Input Validation**
- **Server-side**: Wszystkie endpointy z Zod validation
- **Client-side**: Real-time feedback dla UX
- **Sanitization**: HTML escape dla wszystkich inputów

#### 3.3.2 Monitoring i Logging

**A. Auth Events Logging**
```typescript
interface AuthEvent {
  event_type: 'signin' | 'signup' | 'signout' | 'password_reset';
  user_id?: string;
  email?: string;
  ip_address: string;
  user_agent: string;
  success: boolean;
  error_code?: string;
  timestamp: Date;
}
```

### 3.4 Profile Management

#### 3.4.1 Automatic Profile Creation

**A. Trigger po rejestracji**
- **Database trigger**: Automatyczne tworzenie profilu przy nowym użytkowniku
- **Default values**: Pusty display_name, system timezone, default locale
- **RLS policies**: Automatyczne zabezpieczenie dostępu

#### 3.4.2 Account Deletion

**A. Cascade Strategy**
```sql
-- Kolejność usuwania danych:
1. ai_suggestions (przez FK cascade)
2. ai_generations (przez FK cascade)  
3. reviews (przez FK cascade)
4. cards (przez FK cascade)
5. decks (przez FK cascade)
6. profiles (przez FK cascade)
7. auth.users (Supabase service role)
```

## 4. INTEGRACJA Z ISTNIEJĄCĄ APLIKACJĄ

### 4.1 Backward Compatibility

#### 4.1.1 Existing API Endpoints
- **Zachowanie**: Wszystkie istniejące endpointy zachowują obecną strukturę autoryzacji
- **Upgrade path**: Stopniowa migracja na nowy system auth
- **Mock compatibility**: Obecne mock'i zastępowane prawdziwą implementacją

#### 4.1.2 Database Schema
- **RLS policies**: Już zaimplementowane, nie wymagają zmian
- **User relationships**: Profile table już połączona z auth.users
- **Existing data**: Kompatybilność z istniejącymi rekordami

### 4.2 Environment Variables

#### 4.2.1 Required Variables
```env
# Supabase
PUBLIC_SUPABASE_URL=your_supabase_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Auth
AUTH_SECRET=your_random_secret_key
AUTH_REDIRECT_URL=http://localhost:3000/auth/callback

# Optional
SMTP_HOST=your_smtp_host (dla custom email)
SMTP_USER=your_smtp_user  
SMTP_PASS=your_smtp_password
```

### 4.3 Migration Strategy

#### 4.3.1 Phase 1: Core Auth (MVP)
1. Implementacja podstawowych endpointów auth
2. Zamiana mock'ów na prawdziwą implementację
3. Testowanie rejestracji i logowania

#### 4.3.2 Phase 2: Enhanced Features  
1. Password reset functionality
2. Account deletion
3. Email confirmations (opcjonalnie)

#### 4.3.3 Phase 3: Advanced Security
1. Multi-factor authentication (opcjonalnie)
2. Advanced rate limiting
3. Security monitoring

## 5. TESTING STRATEGY

### 5.1 Unit Tests
- **Auth services**: Testy funkcji autentykacji
- **Validation schemas**: Testy walidacji danych
- **Error handling**: Testy obsługi błędów

### 5.2 Integration Tests
- **API endpoints**: Testy end-to-end dla auth flow
- **Database operations**: Testy RLS policies
- **Session management**: Testy zarządzania sesjami

### 5.3 E2E Tests
- **User registration flow**: Kompletny proces rejestracji
- **Login/logout flow**: Pełny cykl autentykacji
- **Password reset flow**: Reset hasła end-to-end

## 6. DEPLOYMENT CONSIDERATIONS

### 6.1 Production Setup
- **HTTPS**: Wymagane dla secure cookies
- **Domain configuration**: Proper CORS i redirect URLs
- **Environment variables**: Bezpieczne przechowywanie sekretów

### 6.2 Monitoring
- **Auth metrics**: Success/failure rates
- **Performance**: Response times dla auth operations  
- **Security**: Failed attempts, rate limiting hits

---

*Specyfikacja obejmuje pełną implementację systemu autentykacji zgodną z wymaganiami PRD, zachowującą kompatybilność z istniejącą aplikacją oraz zapewniającą bezpieczeństwo i skalowalność.*
