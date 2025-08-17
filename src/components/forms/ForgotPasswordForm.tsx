import React, { useState, useCallback, useId } from "react";
import { useAuth } from "../auth/AuthProvider";

interface ForgotPasswordFormProps {
  onSuccess?: () => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  onSuccess,
}) => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const emailId = useId();

  const validateEmail = useCallback((email: string): string => {
    if (!email) return "Email jest wymagany";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Nieprawidłowy format email";
    return "";
  }, []);

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setEmail(value);

      // Clear previous error
      if (errors.email) {
        setErrors((prev) => ({ ...prev, email: "" }));
      }

      // Real-time validation
      const error = validateEmail(value);
      if (error) {
        setErrors((prev) => ({ ...prev, email: error }));
      }
    },
    [errors.email, validateEmail],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validate email
      const emailError = validateEmail(email);

      if (emailError) {
        setErrors({ email: emailError });
        return;
      }

      setIsSubmitting(true);
      setSubmitError("");
      setSuccessMessage("");
      setErrors({});

      try {
        const result = await resetPassword(email);

        if (result.success) {
          setEmailSent(true);
          setSuccessMessage(
            "Jeśli konto z tym adresem email istnieje, wysłaliśmy instrukcje resetowania hasła.",
          );

          if (onSuccess) {
            onSuccess();
          }
        } else {
          setSubmitError(
            result.error || "Wystąpił błąd podczas wysyłania emaila",
          );
        }
      } catch (error) {
        setSubmitError("Wystąpił nieoczekiwany błąd");
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, validateEmail, resetPassword, onSuccess],
  );

  const handleResendEmail = useCallback(async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const result = await resetPassword(email);

      if (result.success) {
        setSuccessMessage("Email został wysłany ponownie.");
      } else {
        setSubmitError(
          result.error || "Wystąpił błąd podczas wysyłania emaila",
        );
      }
    } catch (error) {
      setSubmitError("Wystąpił nieoczekiwany błąd");
    } finally {
      setIsSubmitting(false);
    }
  }, [email, resetPassword, isSubmitting]);

  if (emailSent) {
    return (
      <div className="forgot-password-success">
        <div className="success-icon">
          <svg
            className="check-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h2>Email został wysłany</h2>

        {successMessage && (
          <div className="submit-success" role="alert">
            {successMessage}
          </div>
        )}

        <div className="instructions">
          <p>
            Sprawdź swoją skrzynkę odbiorczą i kliknij link w emailu, aby
            zresetować hasło.
          </p>
          <p>
            <small>
              Nie widzisz emaila? Sprawdź folder spam lub kliknij poniżej, aby
              wysłać ponownie.
            </small>
          </p>
        </div>

        {submitError && (
          <div className="submit-error" role="alert">
            {submitError}
          </div>
        )}

        <div className="action-buttons">
          <button
            type="button"
            onClick={handleResendEmail}
            disabled={isSubmitting}
            className="resend-button"
          >
            {isSubmitting ? "Wysyłanie..." : "Wyślij ponownie"}
          </button>

          <a href="/login" className="back-to-login-link">
            Powrót do logowania
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="forgot-password-form" noValidate>
      <div className="form-header">
        <h2>Resetowanie hasła</h2>
        <p>Podaj adres email, na który wyślemy instrukcje resetowania hasła.</p>
      </div>

      <div className="form-group">
        <label htmlFor={emailId} className="form-label">
          Email
        </label>
        <input
          type="email"
          id={emailId}
          value={email}
          onChange={handleEmailChange}
          className={`form-input ${errors.email ? "form-input-error" : ""}`}
          placeholder="twoj@email.com"
          required
          autoComplete="email"
          disabled={isSubmitting}
          aria-describedby={errors.email ? `${emailId}-error` : undefined}
        />
        {errors.email && (
          <span id={`${emailId}-error`} className="form-error" role="alert">
            {errors.email}
          </span>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="forgot-password-button"
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
            Wysyłanie...
          </>
        ) : (
          "Wyślij instrukcje"
        )}
      </button>

      {submitError && (
        <div className="submit-error" role="alert">
          {submitError}
        </div>
      )}

      <div className="form-footer">
        <p>
          Pamiętasz hasło?{" "}
          <a href="/login" className="form-link">
            Powrót do logowania
          </a>
        </p>
      </div>
    </form>
  );
};
