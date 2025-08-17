import React, { useState, useCallback, useId } from "react";
import { useAuth } from "../auth/AuthProvider";

interface RegisterFormProps {
  onSuccess?: () => void;
  redirectTo?: string;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  redirectTo = "/ai/generations",
}) => {
  // Use AuthProvider as specified in auth-spec.md
  const { signUp, loading } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();

  const validateEmail = useCallback((email: string): string => {
    if (!email) return "Email jest wymagany";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Nieprawidłowy format email";
    return "";
  }, []);

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
    (field: "email" | "password" | "confirmPassword") =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFormData((prev) => ({ ...prev, [field]: value }));

        // Clear previous error for this field
        if (errors[field]) {
          setErrors((prev) => ({ ...prev, [field]: "" }));
        }

        // Real-time validation
        let error = "";
        if (field === "email") {
          error = validateEmail(value);
        } else if (field === "password") {
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
    [
      errors,
      formData,
      validateEmail,
      validatePassword,
      validateConfirmPassword,
    ],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validate all fields
      const emailError = validateEmail(formData.email);
      const passwordError = validatePassword(formData.password);
      const confirmPasswordError = validateConfirmPassword(
        formData.confirmPassword,
        formData.password,
      );

      const newErrors: Record<string, string> = {};
      if (emailError) newErrors.email = emailError;
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
        if (!signUp) {
          setSubmitError(
            "System autentykacji się ładuje. Spróbuj ponownie za chwilę.",
          );
          return;
        }

        const result = await signUp(formData.email, formData.password);

        if (result.success) {
          setSuccessMessage("Konto zostało utworzone! Przekierowanie...");

          // Delay before redirect to show success message as per auth-spec.md
          setTimeout(() => {
            if (onSuccess) {
              onSuccess();
            } else {
              window.location.href = redirectTo;
            }
          }, 2000);
        } else {
          setSubmitError(result.error || "Wystąpił błąd podczas rejestracji");
        }
      } catch (error) {
        console.error("Registration error:", error);
        setSubmitError("Wystąpił nieoczekiwany błąd");
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      formData,
      validateEmail,
      validatePassword,
      validateConfirmPassword,
      signUp,
      onSuccess,
      redirectTo,
    ],
  );

  // Don't disable form during AuthProvider loading - only during actual submission
  const isFormDisabled = isSubmitting;

  // Inline styles for reliable rendering
  const formStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
    width: "100%",
    maxWidth: "400px",
  };

  const formGroupStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  };

  const labelStyle: React.CSSProperties = {
    fontWeight: 500,
    color: "#374151",
    fontSize: "0.875rem",
  };

  const inputStyle: React.CSSProperties = {
    padding: "0.75rem",
    border: "1px solid #d1d5db",
    borderRadius: "0.5rem",
    fontSize: "1rem",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    backgroundColor: "white",
  };

  const inputErrorStyle: React.CSSProperties = {
    ...inputStyle,
    borderColor: "#dc2626",
  };

  const errorStyle: React.CSSProperties = {
    color: "#dc2626",
    fontSize: "0.75rem",
    fontWeight: 500,
  };

  const buttonStyle: React.CSSProperties = {
    background: "#3b82f6",
    color: "white",
    border: "none",
    padding: "0.75rem 1rem",
    borderRadius: "0.5rem",
    fontSize: "1rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.2s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    minHeight: "2.75rem",
    opacity: isFormDisabled ? 0.75 : 1,
  };

  const footerStyle: React.CSSProperties = {
    textAlign: "center",
    marginTop: "1rem",
    paddingTop: "1rem",
    borderTop: "1px solid #e5e7eb",
  };

  const linkStyle: React.CSSProperties = {
    color: "#3b82f6",
    textDecoration: "none",
    fontWeight: 500,
  };

  const successStyle: React.CSSProperties = {
    color: "#16a34a",
    fontSize: "0.875rem",
    textAlign: "center",
    fontWeight: 500,
    padding: "0.75rem",
    backgroundColor: "#f0fdf4",
    border: "1px solid #86efac",
    borderRadius: "0.5rem",
  };

  const submitErrorStyle: React.CSSProperties = {
    color: "#dc2626",
    fontSize: "0.875rem",
    textAlign: "center",
    fontWeight: 500,
    padding: "0.75rem",
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "0.5rem",
  };

  return (
    <form onSubmit={handleSubmit} style={formStyle} noValidate>
      <div style={formGroupStyle}>
        <label htmlFor={emailId} style={labelStyle}>
          Email
        </label>
        <input
          type="email"
          id={emailId}
          value={formData.email}
          onChange={handleInputChange("email")}
          style={errors.email ? inputErrorStyle : inputStyle}
          placeholder="twoj@email.com"
          required
          autoComplete="email"
          disabled={isFormDisabled}
          aria-describedby={errors.email ? `${emailId}-error` : undefined}
        />
        {errors.email && (
          <span id={`${emailId}-error`} style={errorStyle} role="alert">
            {errors.email}
          </span>
        )}
      </div>

      <div style={formGroupStyle}>
        <label htmlFor={passwordId} style={labelStyle}>
          Hasło
        </label>
        <input
          type="password"
          id={passwordId}
          value={formData.password}
          onChange={handleInputChange("password")}
          style={errors.password ? inputErrorStyle : inputStyle}
          placeholder="Minimum 6 znaków, litery i cyfry"
          required
          autoComplete="new-password"
          disabled={isFormDisabled}
          aria-describedby={
            errors.password ? `${passwordId}-error` : `${passwordId}-hint`
          }
        />
        <small
          id={`${passwordId}-hint`}
          style={{ color: "#6b7280", fontSize: "0.875rem" }}
        >
          Hasło musi mieć co najmniej 6 znaków i zawierać litery oraz cyfry
        </small>
        {errors.password && (
          <span id={`${passwordId}-error`} style={errorStyle} role="alert">
            {errors.password}
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor={confirmPasswordId} className="form-label">
          Potwierdź hasło
        </label>
        <input
          type="password"
          id={confirmPasswordId}
          value={formData.confirmPassword}
          onChange={handleInputChange("confirmPassword")}
          className={`form-input ${errors.confirmPassword ? "form-input-error" : ""}`}
          placeholder="Powtórz hasło"
          required
          autoComplete="new-password"
          disabled={isFormDisabled}
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
        disabled={isFormDisabled}
        className="register-button"
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
            Rejestracja...
          </>
        ) : (
          "Zarejestruj się"
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
          Masz już konto?{" "}
          <a href="/login" className="form-link">
            Zaloguj się
          </a>
        </p>
      </div>
    </form>
  );
};
