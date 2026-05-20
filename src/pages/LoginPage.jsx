import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import AuthSplitLayout from "../components/auth/AuthSplitLayout";
import AuthFormShell from "../components/auth/AuthFormShell";
import { AUTH_MESSAGES } from "../components/auth/authFeedbackConstants";
import {
  AuthDivider,
  AuthField,
  AuthHeading,
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

  useEffect(() => {
    const authError = location.state?.authError;
    if (!authError) return;
    setToast({ message: authError, error: true });
    navigate("/login", { replace: true, state: null });
  }, [location.state, navigate, setToast]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      setToast({ message: AUTH_MESSAGES.loginValidation, error: true });
      return;
    }

    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate("/dashboard", { replace: true });
    } catch (apiError) {
      setToast({
        message: apiError?.message || AUTH_MESSAGES.loginError,
        error: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogleClick = () => {
    startGoogleAuth("login");
  };

  return (
    <AuthSplitLayout>
      <AuthFormShell
        topLink={{ muted: "New here?", linkText: "Create an account", linkTo: "/signup" }}
        footer={
          <>
            By signing in you agree to our{" "}
            <a href="/login" className="underline underline-offset-2 hover:text-slate-600">
              Terms
            </a>{" "}
            &amp;{" "}
            <a href="/login" className="underline underline-offset-2 hover:text-slate-600">
              Privacy Policy
            </a>
          </>
        }
      >
        <AuthHeading />

        <div className="mt-4 space-y-3">
          <GoogleSignInButton onClick={onGoogleClick} />
          <AuthDivider label="Or continue with email" />

          <form className="space-y-2.5" onSubmit={onSubmit}>
            <AuthField
              id="login-email"
              label="Work email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <AuthField
              id="login-password"
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <AuthSubmitButton disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</AuthSubmitButton>
          </form>
        </div>
      </AuthFormShell>
    </AuthSplitLayout>
  );
}
