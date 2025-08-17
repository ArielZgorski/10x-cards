import React, { useState, useCallback, useId } from "react";
import { useAuth } from "../auth/AuthProvider";

interface LoginFormProps {
  onSuccess?: () => void;
  redirectTo?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  redirectTo = "/ai/generations",
}) => {
  // Use AuthProvider as specified in auth-spec.md
  const { signIn, loading } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailId = useId();
  const passwordId = useId();

  const validateEmail = useCallback((email: string): string => {
    if (!email) return "Email jest wymagany";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Nieprawidłowy format email";
    return "";
  }, []);

  const validatePassword = useCallback((password: string): string => {
    if (!password) return "Hasło jest wymagane";
    return "";
  }, []);

  const handleInputChange = useCallback(
    (field: "email" | "password") =>
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
        }

        if (error) {
          setErrors((prev) => ({ ...prev, [field]: error }));
        }
      },
    [errors, validateEmail, validatePassword],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Clear previous errors
      setErrors({});
      setSubmitError("");

      // Validate form
      const emailError = validateEmail(formData.email);
      const passwordError = validatePassword(formData.password);

      if (emailError || passwordError) {
        setErrors({
          email: emailError,
          password: passwordError,
        });
        return;
      }

      if (!signIn) {
        setSubmitError("AuthProvider nie jest gotowy");
        return;
      }

      try {
        setIsSubmitting(true);

        const result = await signIn(formData.email, formData.password);

        if (result.success) {
          // Success - redirect will happen via AuthProvider state change or onSuccess callback
          if (onSuccess) {
            onSuccess();
          } else {
            // Fallback redirect
            window.location.href = redirectTo;
          }
        } else {
          setSubmitError(result.error || "Błąd logowania");
        }
      } catch {
        setSubmitError("Wystąpił nieoczekiwany błąd");
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, validateEmail, validatePassword, signIn, onSuccess, redirectTo],
  );

  // Form is disabled during submission or while loading
  const isFormDisabled = isSubmitting || loading;

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

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        style={formStyle}
        noValidate
        data-testid="login-form"
      >
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
            data-testid="email"
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
            placeholder="Wprowadź hasło"
            required
            autoComplete="current-password"
            disabled={isFormDisabled}
            aria-describedby={
              errors.password ? `${passwordId}-error` : undefined
            }
            data-testid="password"
          />
          {errors.password && (
            <span id={`${passwordId}-error`} style={errorStyle} role="alert">
              {errors.password}
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={isFormDisabled}
          style={buttonStyle}
          data-testid="login-button"
        >
          {isSubmitting ? (
            <>
              <div
                style={{
                  width: "1.25rem",
                  height: "1.25rem",
                  border: "2px solid currentColor",
                  borderTop: "2px solid transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              Logowanie...
            </>
          ) : (
            "Zaloguj się"
          )}
        </button>

        {submitError && (
          <div
            style={submitErrorStyle}
            role="alert"
            data-testid="error-message"
          >
            {submitError}
          </div>
        )}

        <div style={footerStyle}>
          <p
            style={{
              margin: "0.5rem 0",
              color: "#6b7280",
              fontSize: "0.875rem",
            }}
          >
            Nie pamiętasz hasła?{" "}
            <a href="/forgot-password" style={linkStyle}>
              Resetuj hasło
            </a>
          </p>
          <p
            style={{
              margin: "0.5rem 0",
              color: "#6b7280",
              fontSize: "0.875rem",
            }}
          >
            Nie masz konta?{" "}
            <a href="/register" style={linkStyle}>
              Zarejestruj się
            </a>
          </p>
        </div>
      </form>
    </div>
  );
};
