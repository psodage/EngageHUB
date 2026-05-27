import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { AUTH_MESSAGES } from "../components/auth/authFeedbackConstants";

export default function AuthGoogleCallbackPage() {
  const { completeGoogleLogin, setToast } = useApp();
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
      .then((signedInUser) => {
        if (cancelled) return;
        console.log("[auth:google:callback] signedInUser:", signedInUser);
        setToast({ message: "Login successful." });
        const nextRoute = signedInUser?.onboardingCompleted ? "/dashboard" : "/onboarding/platforms";
        console.log("[auth:google:callback] navigating to:", nextRoute);
        navigate(nextRoute, { replace: true });
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
  }, [completeGoogleLogin, navigate]);

  return null;
}
