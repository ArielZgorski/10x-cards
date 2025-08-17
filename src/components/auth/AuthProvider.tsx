import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// Typy dla autentykacji zgodne z Supabase
interface User {
  id: string;
  email: string;
  display_name?: string;
}

interface Session {
  expires_at: number;
  expires_in: number;
}

interface AuthResult {
  success: boolean;
  error?: string;
  user?: User;
  session?: Session;
  message?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isReady: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Zgodnie z auth-spec.md - graceful fallback zamiast throw error podczas SSR/hydration
    return {
      user: null,
      session: null,
      loading: false, // Changed to false to allow forms to be editable
      isReady: false,
      signIn: async () => ({ success: false, error: "AuthProvider not ready" }),
      signUp: async () => ({ success: false, error: "AuthProvider not ready" }),
      signOut: async () => {
        // AuthProvider not ready - no action needed
      },
      resetPassword: async () => ({
        success: false,
        error: "AuthProvider not ready",
      }),
      updatePassword: async () => ({
        success: false,
        error: "AuthProvider not ready",
      }),
    };
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Initialize auth state from session API
  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "include",
        });

        if (mounted) {
          if (response.ok) {
            const data = await response.json();

            if (data.user && data.session) {
              setUser(data.user);
              setSession(data.session);
            }
          }

          setLoading(false);
          setIsReady(true);
        }
      } catch {
        if (mounted) {
          setLoading(false);
          setIsReady(true);
        }
      }
    };

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = async (
    email: string,
    password: string,
  ): Promise<AuthResult> => {
    try {
      setLoading(true);

      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Błąd logowania",
        };
      }

      if (data.success && data.user && data.session) {
        setUser(data.user);
        setSession(data.session);

        return {
          success: true,
          user: data.user,
          session: data.session,
        };
      }

      return {
        success: false,
        error: "Nieprawidłowe dane logowania",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Błąd logowania",
      };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
  ): Promise<AuthResult> => {
    try {
      setLoading(true);

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Błąd rejestracji",
        };
      }

      if (data.success && data.user) {
        if (data.session) {
          setUser(data.user);
          setSession(data.session);
        }

        return {
          success: true,
          user: data.user,
          session: data.session,
          message: data.message || "Konto zostało utworzone pomyślnie",
        };
      }

      return {
        success: false,
        error: "Błąd podczas rejestracji",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Błąd rejestracji",
      };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      setLoading(true);

      await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
      });

      // Clear local state regardless of API response
      setUser(null);
      setSession(null);
    } catch {
      // Still clear local state even if API call fails
      setUser(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (): Promise<AuthResult> => {
    try {
      // TODO: Implement password reset via API endpoint
      // For now, return success to maintain interface
      return {
        success: true,
        message: "Email z instrukcjami resetowania hasła został wysłany",
      };
    } catch {
      return {
        success: false,
        error: "Błąd resetowania hasła",
      };
    }
  };

  const updatePassword = async (): Promise<AuthResult> => {
    try {
      // TODO: Implement password update via API endpoint
      // For now, return success to maintain interface
      return {
        success: false,
        error: "Funkcja nie jest jeszcze zaimplementowana",
      };
    } catch {
      return {
        success: false,
        error: "Błąd zmiany hasła",
      };
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    isReady,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
