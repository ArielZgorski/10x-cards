import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabaseClient } from "../../db/supabase.client.ts";

// Typy dla autentykacji
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
    console.warn(
      "useAuth called outside AuthProvider context - returning fallback",
    );
    return {
      user: null,
      session: null,
      loading: true,
      isReady: false,
      signIn: null as any, // null oznacza, że AuthProvider nie jest gotowy
      signUp: null as any,
      signOut: async () => {},
      resetPassword: null as any,
      updatePassword: null as any,
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
  const [loading, setLoading] = useState(false); // Start with false for mock
  const [isReady, setIsReady] = useState(true); // Ready immediately for mock

  console.log("Mock AuthProvider ready");

  // Mock initialization - check if user is already logged in from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem("mockUser");
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setSession({
          expires_at: Date.now() + 3600000, // 1 hour from now
          expires_in: 3600,
        });
      } catch (error) {
        console.error("Error parsing saved user:", error);
        localStorage.removeItem("mockUser");
      }
    }
  }, []);

  const signIn = async (
    email: string,
    password: string,
  ): Promise<AuthResult> => {
    setLoading(true);

    // Mock authentication - accept any email/password (no delay)

    const mockUser = {
      id: "mock-user-" + Date.now(),
      email: email,
      display_name: email.split("@")[0],
    };

    const mockSession = {
      expires_at: Date.now() + 3600000, // 1 hour from now
      expires_in: 3600,
    };

    setUser(mockUser);
    setSession(mockSession);
    setLoading(false);

    // Save to localStorage for persistence
    localStorage.setItem("mockUser", JSON.stringify(mockUser));

    console.log("Mock login successful for:", email);

    return {
      success: true,
      user: mockUser,
      session: mockSession,
    };
  };

  const signUp = async (
    email: string,
    password: string,
  ): Promise<AuthResult> => {
    // Mock signup - same as signin for now
    return signIn(email, password);
  };

  const signOut = async (): Promise<void> => {
    setLoading(true);

    // Mock signout
    setUser(null);
    setSession(null);
    localStorage.removeItem("mockUser");

    setLoading(false);
    console.log("Mock logout successful");
  };

  const resetPassword = async (email: string): Promise<AuthResult> => {
    // Mock reset password
    return {
      success: true,
      message: "Mock: Email z instrukcjami resetowania hasła został wysłany",
    };
  };

  const updatePassword = async (password: string): Promise<AuthResult> => {
    // Mock update password
    return {
      success: true,
      message: "Mock: Hasło zostało zmienione",
    };
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
