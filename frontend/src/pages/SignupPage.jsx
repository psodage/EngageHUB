import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import AuthSplitLayout from "../components/auth/AuthSplitLayout";
import AuthFormShell from "../components/auth/AuthFormShell";
import { AUTH_MESSAGES, AUTH_FEEDBACK_REDIRECT_MS } from "../components/auth/authFeedbackConstants";
import {
  AuthDivider,
  AuthField,
  AuthHeading,
  AuthInlineAlert,
  AuthSubmitButton,
  GoogleSignInButton,
} from "../components/auth/AuthFormPrimitives";

function SignupForm() {
  const { signup, startGoogleAuth, showAuthFeedback } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({ name: false, email: false, password: false });
  const [formAlert, setFormAlert] = useState(null);
  const redirectTimerRef = useRef(null);

  useEffect(() => {
    if (!formAlert?.message) return undefined;
    const id = setTimeout(() => setFormAlert(null), formAlert.type === "success" ? AUTH_FEEDBACK_REDIRECT_MS : 4200);
    return () => clearTimeout(id);
  }, [formAlert]);

  useEffect(
    () => () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    },
    []
  );

  const validate = (nextName, nextEmail, nextPassword) => {
    const errors = {};
    const normalizedName = nextName.trim();
    const normalizedEmail = nextEmail.trim();
    if (!normalizedName) {
      errors.name = "Full name is required.";
    }
    if (!normalizedEmail) {
      errors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      errors.email = "Invalid email address.";
    }
    if (!nextPassword) {
      errors.password = "Password is required.";
    } else if (nextPassword.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }
    return errors;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormAlert(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const errors = validate(trimmedName, trimmedEmail, password);
    setFieldErrors(errors);
    setTouched({ name: true, email: true, password: true });

    if (Object.keys(errors).length) {
      setFormAlert({ type: "error", message: AUTH_MESSAGES.signupValidation });
      return;
    }

    setSubmitting(true);
    try {
      await signup({ name: trimmedName, email: trimmedEmail, password });
      setFormAlert({ type: "success", message: AUTH_MESSAGES.onboardingContinue });
      showAuthFeedback({ message: AUTH_MESSAGES.onboardingContinue, redirecting: true });
      redirectTimerRef.current = setTimeout(() => navigate("/onboarding/user-type", { replace: true }), AUTH_FEEDBACK_REDIRECT_MS);
    } catch (apiError) {
      const rawMessage = apiError?.message || "";
      setFormAlert({
        type: "error",
        message: rawMessage.toLowerCase().includes("exist")
          ? "Account already exists."
          : AUTH_MESSAGES.signupError,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const clearFieldError = (fieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[fieldKey]) return prev;
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  };

  const onNameChange = (e) => {
    setName(e.target.value);
    clearFieldError("name");
  };

  const onEmailChange = (e) => {
    setEmail(e.target.value);
    clearFieldError("email");
  };

  const onPasswordChange = (e) => {
    setPassword(e.target.value);
    clearFieldError("password");
  };

  const onGoogleClick = () => {
    setFormAlert(null);
    startGoogleAuth("signup");
  };

  const nameValid = touched.name && Boolean(name.trim()) && !fieldErrors.name;
  const emailValid =
    touched.email && Boolean(email.trim()) && !fieldErrors.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = touched.password && password.length >= 8 && !fieldErrors.password;

  return (
    <AuthFormShell
      topLink={{ muted: "Already have an account?", linkText: "Log in", linkTo: "/login" }}
      footer={
        <>
          By creating your account you agree to our Terms &amp; Privacy Policy
        </>
      }
    >
      <AuthHeading />
      <div className="mt-3">
        <AuthInlineAlert alert={formAlert} />
      </div>

      <div className="mt-4 space-y-3">
        <GoogleSignInButton onClick={onGoogleClick} />
        <AuthDivider label="Or continue with email" />

        <form className="space-y-2.5" onSubmit={onSubmit} noValidate>
          <AuthField
            id="signup-name"
            label="Full name"
            type="text"
            placeholder="Alex Morgan"
            value={name}
            onChange={onNameChange}
            autoComplete="name"
            error={fieldErrors.name}
            valid={nameValid}
          />
          <AuthField
            id="signup-email"
            label="Work email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={onEmailChange}
            autoComplete="email"
            error={fieldErrors.email}
            valid={emailValid}
          />
          <AuthField
            id="signup-password"
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={onPasswordChange}
            autoComplete="new-password"
            error={fieldErrors.password}
            valid={passwordValid}
          />
          <AuthSubmitButton disabled={submitting}>
            {submitting ? "Creating account..." : "Create account"}
          </AuthSubmitButton>
        </form>
      </div>
    </AuthFormShell>
  );
}

export default function SignupPage() {
  return (
    <AuthSplitLayout reverse>
      <SignupForm />
    </AuthSplitLayout>
  );
}
