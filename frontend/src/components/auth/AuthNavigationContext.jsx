import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AUTH_FADE_MS, AUTH_NAV_DELAY_MS } from "./authNavigationConstants";
import AuthReloadOverlay from "./AuthReloadOverlay";

const AuthNavigationContext = createContext(null);

export function useAuthNavigation() {
  const ctx = useContext(AuthNavigationContext);
  if (!ctx) {
    throw new Error("useAuthNavigation must be used within AuthNavigationProvider");
  }
  return ctx;
}

export function AuthNavigationProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isReloading, setIsReloading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const navTimerRef = useRef(null);
  const fadeTimerRef = useRef(null);

  const clearTimers = useCallback(() => {
    if (navTimerRef.current) {
      clearTimeout(navTimerRef.current);
      navTimerRef.current = null;
    }
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setIsVisible(false);
    fadeTimerRef.current = setTimeout(() => setIsVisible(true), 50);
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [location.pathname]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const navigateAuth = useCallback(
    (to) => {
      if (to === location.pathname) return;

      clearTimers();

      if (AUTH_NAV_DELAY_MS <= 0) {
        navigate(to);
        return;
      }

      setIsVisible(false);
      setIsReloading(true);

      navTimerRef.current = setTimeout(() => {
        navigate(to);
        setIsReloading(false);
      }, AUTH_NAV_DELAY_MS);
    },
    [clearTimers, location.pathname, navigate]
  );

  const value = useMemo(() => ({ navigateAuth, isReloading }), [navigateAuth, isReloading]);

  return (
    <AuthNavigationContext.Provider value={value}>
      {isReloading && <AuthReloadOverlay />}
      <div
        className="transition-opacity ease-out"
        style={{
          opacity: isVisible && !isReloading ? 1 : 0,
          transitionDuration: `${AUTH_FADE_MS}ms`,
        }}
      >
        {children}
      </div>
    </AuthNavigationContext.Provider>
  );
}
