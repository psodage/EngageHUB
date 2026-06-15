import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { STORAGE_KEYS } from "../data/constants";
import { normalizeOnboardingUser } from "../utils/onboarding";
import {
  completeGoogleAuth,
  completeDraftRegistration,
  getGoogleAuthStartUrl,
  loginUser,
  registerUser,
  updateOnboardingStatus,
  updateUser,
} from "../services/userApi";
import { getSocialAccounts } from "../services/socialApi";
import { AUTH_FEEDBACK_REDIRECT_MS } from "../components/auth/authFeedbackConstants";

const AppContext = createContext(null);

function isClientFullyRegistered(payloadUser) {
  const userType = payloadUser?.userType;
  const hasUserType = userType === "business" || userType === "influencer" || userType === "student";
  const profileCompleted = Boolean(payloadUser?.profileSetup?.completed);
  return hasUserType && profileCompleted;
}

function getInitialTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.theme);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialUser() {
  return {
    email: localStorage.getItem(STORAGE_KEYS.email) ?? "",
    name: localStorage.getItem(STORAGE_KEYS.profileName) ?? "Alex Morgan",
    userType: localStorage.getItem(STORAGE_KEYS.userType) ?? "",
    onboardingCompleted: localStorage.getItem(STORAGE_KEYS.onboardingCompleted) === "1",
    profileSetup: { completed: localStorage.getItem(STORAGE_KEYS.profileSetupCompleted) === "1" },
    businessProfile: {},
    influencerProfile: {},
    studentProfile: {},
    linkedAccounts: [],
    accountsLinked: localStorage.getItem(STORAGE_KEYS.accountsLinked) === "1",
    profileImage: localStorage.getItem(STORAGE_KEYS.profileImage) ?? "",
  };
}

function getInitialConnections() {
  const saved = localStorage.getItem(STORAGE_KEYS.socialConnections);
  if (!saved) {
    return {
      instagram: false,
      youtube: false,
      linkedin: false,
      threads: false,
      facebook: false,
    };
  }

  try {
    const parsed = JSON.parse(saved);
    return {
      instagram: !!parsed.instagram,
      youtube: !!parsed.youtube,
      linkedin: !!parsed.linkedin,
      threads: !!(parsed.threads || parsed.x),
      facebook: !!parsed.facebook,
    };
  } catch {
    return {
      instagram: false,
      youtube: false,
      linkedin: false,
      threads: false,
      facebook: false,
    };
  }
}

function getInitialDraftSignupSession() {
  const raw = sessionStorage.getItem(STORAGE_KEYS.draftSignupSession);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.authDraftToken || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function AppProvider({ children }) {
  const [isAuthed, setIsAuthed] = useState(Boolean(localStorage.getItem(STORAGE_KEYS.authToken)));
  const [theme, setTheme] = useState(getInitialTheme);
  const [user, setUser] = useState(getInitialUser);
  const [connections, setConnections] = useState(getInitialConnections);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [toast, setToast] = useState(null);
  const [authAlert, setAuthAlert] = useState(null);
  const [draftSignupSession, setDraftSignupSession] = useState(getInitialDraftSignupSession);

  useEffect(() => {
    console.log("[auth:useEffect] isAuthed:", isAuthed, "user:", user);
    if (!isAuthed) return;
    const hasValidRegisteredUser = Boolean(
      user?.profileSetup?.completed &&
        (user?.userType === "business" || user?.userType === "influencer" || user?.userType === "student")
    );
    console.log("[auth:useEffect] hasValidRegisteredUser:", hasValidRegisteredUser);
    if (hasValidRegisteredUser) return;

    console.warn("[auth:useEffect] Invalid registered user. Clearing auth!");
    localStorage.removeItem(STORAGE_KEYS.auth);
    localStorage.removeItem(STORAGE_KEYS.authToken);
    setIsAuthed(false);
  }, [isAuthed, user]);

  const showAuthFeedback = useCallback((alert) => {
    if (!alert) {
      setAuthAlert(null);
      return;
    }
    setAuthAlert({
      message: alert.message,
      error: Boolean(alert.error),
      redirecting: Boolean(alert.redirecting),
    });
  }, []);

  useEffect(() => {
    if (!authAlert?.message) return undefined;
    const id = setTimeout(() => setAuthAlert(null), AUTH_FEEDBACK_REDIRECT_MS + 500);
    return () => clearTimeout(id);
  }, [authAlert?.message]);

  const refreshConnectedAccounts = useCallback(async () => {
    const accounts = await getSocialAccounts();
    setConnectedAccounts(accounts);
    return accounts;
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEYS.theme, next);
      return next;
    });
  }, []);

  const applyAuthPayload = useCallback((payload) => {
    console.log("[auth:applyAuthPayload] payload:", payload);
    localStorage.setItem(STORAGE_KEYS.auth, "1");
    localStorage.setItem(STORAGE_KEYS.authToken, payload.token);
    const normalizedUser = normalizeOnboardingUser(payload.user);
    localStorage.setItem(STORAGE_KEYS.email, normalizedUser.email);
    localStorage.setItem(STORAGE_KEYS.profileName, normalizedUser.name);
    localStorage.setItem(STORAGE_KEYS.userType, normalizedUser.userType || "");
    localStorage.setItem(STORAGE_KEYS.selectedUserType, normalizedUser.userType || "");
    localStorage.setItem(STORAGE_KEYS.profileSetupCompleted, normalizedUser.profileSetup.completed ? "1" : "0");
    localStorage.setItem(STORAGE_KEYS.profileCompleted, normalizedUser.profileSetup.completed ? "1" : "0");
    const onboardingCompleted = Boolean(normalizedUser.onboardingCompleted);
    localStorage.setItem(STORAGE_KEYS.onboardingCompleted, onboardingCompleted ? "1" : "0");
    localStorage.setItem(STORAGE_KEYS.accountsLinked, normalizedUser.linkedAccounts?.length ? "1" : "0");
    localStorage.setItem(STORAGE_KEYS.profileImage, normalizedUser.profileImage || "");
    setUser(normalizedUser);
    setIsAuthed(true);
    setDraftSignupSession(null);
    sessionStorage.removeItem(STORAGE_KEYS.draftSignupSession);
    return normalizedUser;
  }, []);

  const storeDraftSignupSession = useCallback((draftPayload) => {
    const rawDraft = draftPayload?.draftSignupSession || draftPayload;
    const authDraftToken = rawDraft?.authDraftToken || rawDraft?.token;
    const email = rawDraft?.email || rawDraft?.user?.email;
    const name = rawDraft?.name || rawDraft?.user?.name;
    const selectedUserType = rawDraft?.selectedUserType || rawDraft?.user?.userType || "";
    const provider = rawDraft?.provider || "password";

    if (!authDraftToken || !email) {
      throw new Error("Invalid draft signup session.");
    }
    const normalizedDraft = {
      provider,
      name: name || "",
      email: String(email).trim().toLowerCase(),
      authDraftToken,
      selectedUserType: (selectedUserType === "business" || selectedUserType === "influencer" || selectedUserType === "student") ? selectedUserType : "",
    };
    sessionStorage.setItem(STORAGE_KEYS.draftSignupSession, JSON.stringify(normalizedDraft));
    setDraftSignupSession(normalizedDraft);
    return normalizedDraft;
  }, []);

  const login = useCallback(
    async ({ email, password }) => {
      const normalizedEmail = email.trim().toLowerCase();
      const payload = await loginUser({ email: normalizedEmail, password });
      if (!isClientFullyRegistered(payload?.user)) {
        const draft = storeDraftSignupSession(payload);
        return { kind: "draft", draft };
      }
      return { kind: "auth", user: applyAuthPayload(payload) };
    },
    [applyAuthPayload, storeDraftSignupSession]
  );

  const completeGoogleLogin = useCallback(
    async (code) => {
      const payload = await completeGoogleAuth(code);
      if (payload?.mode === "draft" || payload?.draftSignupSession) {
        return { kind: "draft", draft: storeDraftSignupSession(payload) };
      }
      if (!isClientFullyRegistered(payload?.user)) {
        const draft = storeDraftSignupSession(payload);
        return { kind: "draft", draft };
      }
      return { kind: "auth", user: applyAuthPayload(payload) };
    },
    [applyAuthPayload, storeDraftSignupSession]
  );

  const startGoogleAuth = useCallback((intent = "login") => {
    window.location.href = getGoogleAuthStartUrl(intent);
  }, []);

  const signup = useCallback(async ({ name, email, password }) => {
    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const payload = await registerUser({ name: trimmedName, email: normalizedEmail, password });
    localStorage.removeItem(STORAGE_KEYS.auth);
    localStorage.removeItem(STORAGE_KEYS.authToken);
    localStorage.removeItem(STORAGE_KEYS.userType);
    localStorage.removeItem(STORAGE_KEYS.profileSetupCompleted);
    localStorage.removeItem(STORAGE_KEYS.onboardingCompleted);
    localStorage.removeItem(STORAGE_KEYS.profileImage);
    const draft = storeDraftSignupSession(payload);
    localStorage.setItem(STORAGE_KEYS.email, draft.email);
    localStorage.setItem(STORAGE_KEYS.profileName, draft.name || "");
    localStorage.setItem(STORAGE_KEYS.userType, draft.selectedUserType || "");
    localStorage.setItem(STORAGE_KEYS.selectedUserType, draft.selectedUserType || "");
    localStorage.setItem(STORAGE_KEYS.profileSetupCompleted, "0");
    localStorage.setItem(STORAGE_KEYS.profileCompleted, "0");
    localStorage.setItem(STORAGE_KEYS.accountsLinked, "0");
    setUser((prev) => ({
      ...prev,
      email: draft.email,
      name: draft.name || prev.name,
      userType: draft.selectedUserType || "",
      onboardingCompleted: false,
      profileSetup: { completed: false },
      profileImage: "",
    }));
    setIsAuthed(false);
    return draft;
  }, [storeDraftSignupSession]);

  const updateDraftSignupSession = useCallback((updates) => {
    setDraftSignupSession((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...updates };
      sessionStorage.setItem(STORAGE_KEYS.draftSignupSession, JSON.stringify(next));
      return next;
    });
  }, []);

  const discardDraftSignupSession = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEYS.draftSignupSession);
    setDraftSignupSession(null);
  }, []);

  const completeDraftSignup = useCallback(
    async ({ selectedUserType, businessProfile, influencerProfile, studentProfile }) => {
      if (!draftSignupSession?.authDraftToken) {
        return { ok: false, error: new Error("Signup session expired. Please sign up again.") };
      }
      try {
        const payload = await completeDraftRegistration({
          authDraftToken: draftSignupSession.authDraftToken,
          selectedUserType,
          businessProfile,
          influencerProfile,
          studentProfile,
        });
        applyAuthPayload(payload);
        discardDraftSignupSession();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: new Error(error?.message || "Unable to complete registration.") };
      }
    },
    [applyAuthPayload, discardDraftSignupSession, draftSignupSession]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.auth);
    localStorage.removeItem(STORAGE_KEYS.authToken);
    localStorage.removeItem(STORAGE_KEYS.userType);
    localStorage.removeItem(STORAGE_KEYS.selectedUserType);
    localStorage.removeItem(STORAGE_KEYS.profileSetupCompleted);
    localStorage.removeItem(STORAGE_KEYS.profileCompleted);
    localStorage.removeItem(STORAGE_KEYS.accountsLinked);
    localStorage.removeItem(STORAGE_KEYS.onboardingCompleted);
    localStorage.removeItem(STORAGE_KEYS.profileImage);
    sessionStorage.removeItem(STORAGE_KEYS.draftSignupSession);
    setDraftSignupSession(null);
    setConnectedAccounts([]);
    setIsAuthed(false);
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    refreshConnectedAccounts().catch(() => {
      setConnectedAccounts([]);
    });
  }, [isAuthed, refreshConnectedAccounts]);

  useEffect(() => {
    if (!draftSignupSession) return undefined;
    const clearDraftOnExit = () => {
      sessionStorage.removeItem(STORAGE_KEYS.draftSignupSession);
    };
    window.addEventListener("beforeunload", clearDraftOnExit);
    return () => window.removeEventListener("beforeunload", clearDraftOnExit);
  }, [draftSignupSession]);

  const saveSettings = useCallback(async ({ name, email, password }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    const token = localStorage.getItem(STORAGE_KEYS.authToken);
    if (!token) {
      return { ok: false, error: new Error("You must be signed in.") };
    }

    try {
      const savedUser = await updateUser(token, { name: trimmedName, email: normalizedEmail, password });
      localStorage.setItem(STORAGE_KEYS.profileName, savedUser.name);
      localStorage.setItem(STORAGE_KEYS.email, savedUser.email);
      setUser((prev) => ({ ...prev, name: savedUser.name, email: savedUser.email }));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: new Error(error?.message || "Unable to save settings.") };
    }
  }, []);

  const setConnectionStatus = useCallback((platform, connected) => {
    setConnections((prev) => {
      const next = { ...prev, [platform]: connected };
      localStorage.setItem(STORAGE_KEYS.socialConnections, JSON.stringify(next));
      return next;
    });
  }, []);

  const completeOnboarding = useCallback(async ({ skippedPlatforms = [] } = {}) => {
    const token = localStorage.getItem(STORAGE_KEYS.authToken);
    if (!token) {
      return { ok: false, error: new Error("You must be signed in.") };
    }

    try {
      const linkedPlatforms = connectedAccounts
        .filter((account) => account?.isConnected && account?.platform)
        .map((account) => account.platform);
      const payload = await updateOnboardingStatus(token, {
        onboardingCompleted: true,
        linkedAccounts: linkedPlatforms,
        onboardingSkippedPlatforms: skippedPlatforms,
      });
      localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "1");
      localStorage.setItem(STORAGE_KEYS.accountsLinked, linkedPlatforms.length ? "1" : "0");
      setUser((prev) => ({
        ...prev,
        onboardingCompleted: true,
        linkedAccounts: Array.isArray(payload?.linkedAccounts) ? payload.linkedAccounts : linkedPlatforms,
        accountsLinked: linkedPlatforms.length > 0,
      }));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: new Error(error?.message || "Unable to complete onboarding.") };
    }
  }, [connectedAccounts]);

  const saveOnboardingState = useCallback(async (onboardingState) => {
    const token = localStorage.getItem(STORAGE_KEYS.authToken);
    if (!token) {
      return { ok: false, error: new Error("You must be signed in.") };
    }
    try {
      const payload = await updateOnboardingStatus(token, onboardingState);
      const nextUser = {
        ...user,
        userType: (payload.userType === "business" || payload.userType === "influencer" || payload.userType === "student") ? payload.userType : user.userType,
        onboardingCompleted: Boolean(payload.onboardingCompleted),
        profileSetup: payload.profileSetup || user.profileSetup,
        businessProfile: payload.businessProfile || user.businessProfile,
        influencerProfile: payload.influencerProfile || user.influencerProfile,
        studentProfile: payload.studentProfile || user.studentProfile,
        linkedAccounts: Array.isArray(payload.linkedAccounts) ? payload.linkedAccounts : user.linkedAccounts,
      };

      let profileImage = "";
      if (nextUser.userType === "business") {
        profileImage = nextUser.businessProfile?.logo || "";
      } else if (nextUser.userType === "influencer") {
        profileImage = nextUser.influencerProfile?.profileImage || "";
      } else if (nextUser.userType === "student") {
        profileImage = nextUser.studentProfile?.profileImage || "";
      }
      nextUser.profileImage = profileImage;
      localStorage.setItem(STORAGE_KEYS.profileImage, profileImage || "");

      localStorage.setItem(STORAGE_KEYS.userType, nextUser.userType || "");
      localStorage.setItem(STORAGE_KEYS.selectedUserType, nextUser.userType || "");
      localStorage.setItem(STORAGE_KEYS.profileSetupCompleted, nextUser.profileSetup?.completed ? "1" : "0");
      localStorage.setItem(STORAGE_KEYS.profileCompleted, nextUser.profileSetup?.completed ? "1" : "0");
      localStorage.setItem(
        STORAGE_KEYS.accountsLinked,
        Array.isArray(nextUser.linkedAccounts) && nextUser.linkedAccounts.length > 0 ? "1" : "0"
      );
      localStorage.setItem(STORAGE_KEYS.onboardingCompleted, nextUser.onboardingCompleted ? "1" : "0");
      setUser(nextUser);
      return { ok: true, payload };
    } catch (error) {
      return { ok: false, error: new Error(error?.message || "Unable to save onboarding state.") };
    }
  }, [user]);

  const value = useMemo(
    () => ({
      isAuthed,
      theme,
      user,
      isOnboardingCompleted: Boolean(user.onboardingCompleted),
      onboardingUserType: user.userType || "",
      connections,
      connectedAccounts,
      toast,
      setToast,
      authAlert,
      showAuthFeedback,
      toggleTheme,
      login,
      completeGoogleLogin,
      startGoogleAuth,
      signup,
      logout,
      saveSettings,
      setConnectionStatus,
      completeOnboarding,
      saveOnboardingState,
      refreshConnectedAccounts,
      draftSignupSession,
      updateDraftSignupSession,
      discardDraftSignupSession,
      completeDraftSignup,
    }),
    [
      isAuthed,
      theme,
      user,
      connections,
      connectedAccounts,
      toast,
      authAlert,
      showAuthFeedback,
      toggleTheme,
      login,
      completeGoogleLogin,
      startGoogleAuth,
      signup,
      logout,
      saveSettings,
      setConnectionStatus,
      completeOnboarding,
      saveOnboardingState,
      refreshConnectedAccounts,
      draftSignupSession,
      updateDraftSignupSession,
      discardDraftSignupSession,
      completeDraftSignup,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
