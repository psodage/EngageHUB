import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { AUTH_MESSAGES, AUTH_FEEDBACK_REDIRECT_MS } from "../components/auth/authFeedbackConstants";
import { getOnboardingRoute } from "../utils/onboarding";

export default function AuthGoogleCallbackPage() {
  const { completeGoogleLogin, showAuthFeedback } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("google_status");
    const code = params.get("code");
    const reason = params.get("reason");

    if (status === "error") {
      navigate("/login", {
        replace: true,
        state: { authError: reason || AUTH_MESSAGES.googleError },
      });
      return undefined;
    }

    if (!code) {
      navigate("/login", {
        replace: true,
        state: { authError: AUTH_MESSAGES.googleMissingCode },
      });
      return undefined;
    }

    let cancelled = false;

    completeGoogleLogin(code)
      .then((result) => {
        if (cancelled) return;
        if (result?.kind === "draft") {
          showAuthFeedback({ message: AUTH_MESSAGES.onboardingContinue, redirecting: true });
          setTimeout(() => {
            if (!cancelled) navigate("/onboarding/user-type", { replace: true });
          }, AUTH_FEEDBACK_REDIRECT_MS);
          return;
        }
        showAuthFeedback({ message: AUTH_MESSAGES.loginSuccess, redirecting: true });
        const nextRoute = getOnboardingRoute(result?.user);
        setTimeout(() => {
          if (!cancelled) navigate(nextRoute, { replace: true });
        }, AUTH_FEEDBACK_REDIRECT_MS);
      })
      .catch((apiError) => {
        if (cancelled) return;
        navigate("/login", {
          replace: true,
          state: { authError: apiError?.message || AUTH_MESSAGES.googleError },
        });
      });

    return () => {
      cancelled = true;
    };
  }, [completeGoogleLogin, navigate, showAuthFeedback]);

  return null;
}
