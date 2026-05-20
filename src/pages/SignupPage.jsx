import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import AuthSplitLayout from "../components/auth/AuthSplitLayout";
import AuthFormShell from "../components/auth/AuthFormShell";
import { AUTH_MESSAGES } from "../components/auth/authFeedbackConstants";
import { useAuthFeedback } from "../components/auth/useAuthFeedback";
import {
  AuthDivider,
  AuthField,
  AuthHeading,
  AuthSubmitButton,
  GoogleSignInButton,
} from "../components/auth/AuthFormPrimitives";

function SignupForm() {
  const { signup, startGoogleAuth } = useApp();
  const { notify, clearTimer } = useAuthFeedback();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const onSubmit = async (e) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail || password.length < 6) {
      notify({ message: AUTH_MESSAGES.signupValidation, error: true });
      return;
    }

    setSubmitting(true);
    try {
      await signup({ name: trimmedName, email: trimmedEmail, password });
      notify({
        message: AUTH_MESSAGES.signupSuccess,
        redirectTo: "/login",
        navigate,
      });
    } catch (apiError) {
      notify({
        message: apiError?.message || AUTH_MESSAGES.signupError,
        error: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogleClick = () => {
    startGoogleAuth("signup");
  };

  return (
    <AuthFormShell
      topLink={{ muted: "Already have an account?", linkText: "Log in", linkTo: "/login" }}
      footer={
        <>
          By creating your account you agree to our{" "}
          <a href="/signup" className="underline underline-offset-2 hover:text-slate-600">
            Terms
          </a>{" "}
          &amp;{" "}
          <a href="/signup" className="underline underline-offset-2 hover:text-slate-600">
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
            id="signup-name"
            label="Full name"
            type="text"
            placeholder="Alex Morgan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
          <AuthField
            id="signup-email"
            label="Work email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <AuthField
            id="signup-password"
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <AuthSubmitButton disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
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
