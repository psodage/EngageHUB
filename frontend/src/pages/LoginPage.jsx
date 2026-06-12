import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import AuthSplitLayout from "../components/auth/AuthSplitLayout";
import AuthFormShell from "../components/auth/AuthFormShell";
import { AUTH_MESSAGES } from "../components/auth/authFeedbackConstants";
import {
  AuthDivider,
  AuthField,
  AuthHeading,
  AuthInlineAlert,
  AuthSubmitButton,
  GoogleSignInButton,
} from "../components/auth/AuthFormPrimitives";

export default function LoginPage() {
  const { login, startGoogleAuth, setToast } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({ email: false, password: false });
  const [formAlert, setFormAlert] = useState(null);
  const redirectTimerRef = useRef(null);

  useEffect(
    () => () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    },
    []
  );

  useEffect(() => {
    const authError = location.state?.authError;
    if (!authError) return;
    setFormAlert({ type: "error", message: authError });
    navigate("/login", { replace: true, state: null });
  }, [location.state, navigate]);

  useEffect(() => {
    if (!formAlert?.message) return undefined;
    const id = setTimeout(() => setFormAlert(null), 4200);
    return () => clearTimeout(id);
  }, [formAlert]);

  const validate = (nextEmail, nextPassword) => {
    const errors = {};
    const normalizedEmail = nextEmail.trim();
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
    const errors = validate(email, password);
    setFieldErrors(errors);
    setTouched({ email: true, password: true });
    if (Object.keys(errors).length) {
      setFormAlert({ type: "error", message: AUTH_MESSAGES.loginValidation });
      return;
    }

    setSubmitting(true);
    try {
      const result = await login({ email: email.trim(), password });
      if (result?.kind === "draft") {
        setFormAlert({ type: "success", message: AUTH_MESSAGES.onboardingContinue || "Continuing onboarding..." });
        setToast({ message: "Continuing onboarding..." });
        redirectTimerRef.current = setTimeout(() => navigate("/onboarding/user-type", { replace: true }), 650);
        return;
      }
      setFormAlert({ type: "success", message: "Login successful." });
      setToast({ message: "Login successful." });
      const signedInUser = result?.user;
      const nextRoute = signedInUser?.onboardingCompleted ? "/dashboard" : "/onboarding/platforms";
      console.log("[login:onSubmit] Login successful. signedInUser:", signedInUser, "nextRoute:", nextRoute);
      redirectTimerRef.current = setTimeout(() => {
        console.log("[login:onSubmit:timeout] Navigating to:", nextRoute);
        navigate(nextRoute, { replace: true });
      }, 650);
      return;
    } catch (apiError) {
      setFormAlert({
        type: "error",
        message:
          apiError?.message?.toLowerCase?.().includes("invalid") ||
          apiError?.message?.toLowerCase?.().includes("password")
            ? "Failed to log in. Please check your credentials and try again."
            : AUTH_MESSAGES.loginError,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onEmailChange = (e) => {
    const nextEmail = e.target.value;
    setEmail(nextEmail);
    if (fieldErrors.email) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.email;
        return next;
      });
    }
  };

  const onPasswordChange = (e) => {
    const nextPassword = e.target.value;
    setPassword(nextPassword);
    if (fieldErrors.password) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.password;
        return next;
      });
    }
  };

  const onGoogleClick = () => {
    setFormAlert(null);
    startGoogleAuth("login");
  };

  const emailValid =
    touched.email && Boolean(email.trim()) && !fieldErrors.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = touched.password && password.length >= 8 && !fieldErrors.password;

  return (
    <AuthSplitLayout>
      <AuthFormShell
        topLink={{ muted: "New here?", linkText: "Create an account", linkTo: "/signup" }}
        footer={
          <>
            By signing in you agree to our Terms &amp; Privacy Policy
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
              id="login-email"
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
              id="login-password"
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={onPasswordChange}
              autoComplete="current-password"
              error={fieldErrors.password}
              valid={passwordValid}
            />
            <AuthSubmitButton disabled={submitting}>{submitting ? "Signing in..." : "Sign in"}</AuthSubmitButton>
          </form>
        </div>
      </AuthFormShell>
    </AuthSplitLayout>
  );
}
