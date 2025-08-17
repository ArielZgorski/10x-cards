import React, { useState, useCallback, useId, useEffect } from "react";
import { useAuth } from "../auth/AuthProvider";

interface ResetPasswordFormProps {
  token?: string;
  onSuccess?: () => void;
  redirectTo?: string;
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({
  token,
  onSuccess,
  redirectTo = "/login",
}) => {
  const { updatePassword } = useAuth();
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  const passwordId = useId();
  const confirmPasswordId = useId();

  // Validate token on component mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setTokenValid(false);
        setSubmitError("Brak tokenu resetowania hasła");
        return;
      }

      try {
        // Mock walidacja tokenu - będzie zastąpiona prawdziwą implementacją
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Sprawdź czy token nie jest zbyt stary (mock)
        const tokenTimestamp = parseInt(token.split("-").pop() || "0");
        const now = Date.now();
        const tokenAge = now - tokenTimestamp;
        const maxAge = 1000 * 60 * 60; // 1 godzina

        if (tokenAge > maxAge) {
          setTokenValid(false);
          setSubmitError("Link do resetowania hasła wygasł. Poproś o nowy.");
        } else {
          setTokenValid(true);
        }
      } catch (error) {
        setTokenValid(false);
        setSubmitError("Nieprawidłowy token resetowania hasła");
      }
    };

    validateToken();
  }, [token]);

  const validatePassword = useCallback((password: string): string => {
    if (!password) return "Hasło jest wymagane";
    if (password.length < 6) return "Hasło musi mieć co najmniej 6 znaków";

    // Sprawdź czy hasło zawiera litery i cyfry
    const hasLetters = /[A-Za-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    if (!hasLetters || !hasNumbers) {
      return "Hasło musi zawierać litery i cyfry";
    }

    return "";
  }, []);

  const validateConfirmPassword = useCallback(
    (confirmPassword: string, password: string): string => {
      if (!confirmPassword) return "Potwierdzenie hasła jest wymagane";
      if (confirmPassword !== password) return "Hasła nie są identyczne";
      return "";
    },
    [],
  );

  const handleInputChange = useCallback(
    (field: "password" | "confirmPassword") =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFormData((prev) => ({ ...prev, [field]: value }));

        // Clear previous error for this field
        if (errors[field]) {
          setErrors((prev) => ({ ...prev, [field]: "" }));
        }

        // Real-time validation
        let error = "";
        if (field === "password") {
          error = validatePassword(value);
          // Also revalidate confirm password if it exists
          if (formData.confirmPassword && !errors.confirmPassword) {
            const confirmError = validateConfirmPassword(
              formData.confirmPassword,
              value,
            );
            if (confirmError) {
              setErrors((prev) => ({ ...prev, confirmPassword: confirmError }));
            }
          }
        } else if (field === "confirmPassword") {
          error = validateConfirmPassword(value, formData.password);
        }

        if (error) {
          setErrors((prev) => ({ ...prev, [field]: error }));
        }
      },
    [errors, formData, validatePassword, validateConfirmPassword],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!tokenValid) {
        setSubmitError("Token resetowania hasła jest nieprawidłowy");
        return;
      }

      // Validate all fields
      const passwordError = validatePassword(formData.password);
      const confirmPasswordError = validateConfirmPassword(
        formData.confirmPassword,
        formData.password,
      );

      const newErrors: Record<string, string> = {};
      if (passwordError) newErrors.password = passwordError;
      if (confirmPasswordError)
        newErrors.confirmPassword = confirmPasswordError;

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      setIsSubmitting(true);
      setSubmitError("");
      setSuccessMessage("");
      setErrors({});

      try {
        const result = await updatePassword(formData.password);

        if (result.success) {
          setSuccessMessage(
            "Hasło zostało zmienione! Przekierowanie do logowania...",
          );

          // Delay before redirect to show success message
          setTimeout(() => {
            if (onSuccess) {
              onSuccess();
            } else {
              window.location.href = redirectTo;
            }
          }, 3000);
        } else {
          setSubmitError(result.error || "Wystąpił błąd podczas zmiany hasła");
        }
      } catch (error) {
        setSubmitError("Wystąpił nieoczekiwany błąd");
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      formData,
      validatePassword,
      validateConfirmPassword,
      updatePassword,
      tokenValid,
      onSuccess,
      redirectTo,
    ],
  );

  // Loading state while validating token
  if (tokenValid === null) {
    return (
      <div className="reset-password-loading">
        <div className="loading-spinner">
          <svg
            className="animate-spin h-8 w-8 text-blue-500"
            viewBox="0 0 24 24"
          >
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
        <p>Sprawdzanie linku resetowania hasła...</p>
      </div>
    );
  }

  // Invalid token state
  if (!tokenValid) {
    return (
      <div className="reset-password-error">
        <div className="error-icon">
          <svg
            className="x-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>

        <h2>Link nieprawidłowy</h2>

        <div className="submit-error" role="alert">
          {submitError}
        </div>

        <div className="action-buttons">
          <a href="/forgot-password" className="try-again-link">
            Poproś o nowy link
          </a>

          <a href="/login" className="back-to-login-link">
            Powrót do logowania
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="reset-password-form" noValidate>
      <div className="form-header">
        <h2>Ustaw nowe hasło</h2>
        <p>Wprowadź nowe hasło dla swojego konta.</p>
      </div>

      <div className="form-group">
        <label htmlFor={passwordId} className="form-label">
          Nowe hasło
        </label>
        <input
          type="password"
          id={passwordId}
          value={formData.password}
          onChange={handleInputChange("password")}
          className={`form-input ${errors.password ? "form-input-error" : ""}`}
          placeholder="Minimum 6 znaków, litery i cyfry"
          required
          autoComplete="new-password"
          disabled={isSubmitting}
          aria-describedby={
            errors.password ? `${passwordId}-error` : `${passwordId}-hint`
          }
        />
        <small id={`${passwordId}-hint`} className="form-hint">
          Hasło musi mieć co najmniej 6 znaków i zawierać litery oraz cyfry
        </small>
        {errors.password && (
          <span id={`${passwordId}-error`} className="form-error" role="alert">
            {errors.password}
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor={confirmPasswordId} className="form-label">
          Potwierdź nowe hasło
        </label>
        <input
          type="password"
          id={confirmPasswordId}
          value={formData.confirmPassword}
          onChange={handleInputChange("confirmPassword")}
          className={`form-input ${errors.confirmPassword ? "form-input-error" : ""}`}
          placeholder="Powtórz nowe hasło"
          required
          autoComplete="new-password"
          disabled={isSubmitting}
          aria-describedby={
            errors.confirmPassword ? `${confirmPasswordId}-error` : undefined
          }
        />
        {errors.confirmPassword && (
          <span
            id={`${confirmPasswordId}-error`}
            className="form-error"
            role="alert"
          >
            {errors.confirmPassword}
          </span>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="reset-password-button"
      >
        {isSubmitting ? (
          <>
            <svg className="btn-spinner" viewBox="0 0 24 24">
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
            Zmienianie hasła...
          </>
        ) : (
          "Zmień hasło"
        )}
      </button>

      {submitError && (
        <div className="submit-error" role="alert">
          {submitError}
        </div>
      )}

      {successMessage && (
        <div className="submit-success" role="alert">
          {successMessage}
        </div>
      )}

      <div className="form-footer">
        <p>
          <a href="/login" className="form-link">
            Powrót do logowania
          </a>
        </p>
      </div>
    </form>
  );
};
