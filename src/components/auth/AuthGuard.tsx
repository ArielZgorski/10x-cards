import React, { useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthProvider';

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  fallback,
  redirectTo = '/login' 
}) => {
  const { user, loading } = useAuth();

  useEffect(() => {
    // Przekierowanie tylko jeśli nie ma użytkownika i nie ładujemy
    if (!loading && !user) {
      window.location.href = redirectTo;
    }
  }, [user, loading, redirectTo]);

  // Wyświetl loading state podczas sprawdzania autentykacji
  if (loading) {
    return (
      <div className="auth-guard-loading">
        <div className="loading-spinner">
          <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
            <circle 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4" 
              fill="none" 
              opacity="0.25"
            />
            <path 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
              fill="currentColor"
            />
          </svg>
        </div>
        <p>Sprawdzanie autoryzacji...</p>
      </div>
    );
  }

  // Jeśli nie ma użytkownika, wyświetl fallback lub nic (przekierowanie nastąpi)
  if (!user) {
    return (
      <div className="auth-guard-fallback">
        {fallback || (
          <div className="unauthorized-message">
            <p>Przekierowywanie do logowania...</p>
          </div>
        )}
      </div>
    );
  }

  // Użytkownik jest zalogowany, wyświetl zawartość
  return <>{children}</>;
};

// Stylowanie inline dla prostoty - w przyszłości można przenieść do CSS
const styles = `
  .auth-guard-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    gap: 1rem;
  }
  
  .loading-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .auth-guard-loading p {
    color: #6b7280;
    font-size: 0.875rem;
  }
  
  .auth-guard-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
  }
  
  .unauthorized-message p {
    color: #6b7280;
    font-size: 0.875rem;
  }
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  
  .animate-spin {
    animation: spin 1s linear infinite;
  }
`;

// Dodaj style do dokumentu
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}
