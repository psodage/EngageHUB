import { useCallback, useRef } from "react";
import { useApp } from "../../context/AppContext";
import { AUTH_FEEDBACK_REDIRECT_MS } from "./authFeedbackConstants";

export function useAuthFeedback() {
  const { showAuthFeedback } = useApp();
  const timerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const notify = useCallback(
    ({ message, error = false, redirectTo, navigate, delayMs = AUTH_FEEDBACK_REDIRECT_MS }) => {
      clearTimer();
      const willRedirect = Boolean(redirectTo && navigate);
      showAuthFeedback({ message, error, redirecting: willRedirect });

      if (!willRedirect) {
        timerRef.current = setTimeout(() => showAuthFeedback(null), delayMs);
        return;
      }

      timerRef.current = setTimeout(() => {
        showAuthFeedback(null);
        navigate(redirectTo, { replace: true });
      }, delayMs);
    },
    [clearTimer, showAuthFeedback]
  );

  return { notify, clearTimer };
}
