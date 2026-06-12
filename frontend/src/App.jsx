import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useLayoutEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppProvider, useApp } from "./context/AppContext";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AuthGoogleCallbackPage from "./pages/AuthGoogleCallbackPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import ChooseUserTypeScreen from "./pages/ChooseUserTypeScreen";
import BusinessProfileSetup from "./pages/BusinessProfileSetup";
import InfluencerProfileSetup from "./pages/InfluencerProfileSetup";
import StudentProfileSetup from "./pages/StudentProfileSetup";
import LinkAccounts from "./pages/LinkAccounts";
import FacebookPageSelectPage from "./pages/FacebookPageSelectPage";
import InstagramAccountSelectPage from "./pages/InstagramAccountSelectPage";
import LinkedInAccountSelectPage from "./pages/LinkedInAccountSelectPage";
import GoogleBusinessLocationSelectPage from "./pages/GoogleBusinessLocationSelectPage";
import BusinessDashboard from "./pages/BusinessDashboard";
import InfluencerDashboard from "./pages/InfluencerDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import Toast from "./components/Toast";
import AuthAlert from "./components/auth/AuthAlert";
import { getOnboardingRoute } from "./utils/onboarding";
import { STORAGE_KEYS } from "./data/constants";

function getDraftSignupSessionFromStorage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.draftSignupSession);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.authDraftToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

function ProtectedRoute({ children, requireOnboardingComplete = false }) {
  const { isAuthed, user } = useApp();
  if (!isAuthed) return <Navigate to="/login" replace />;
  if (requireOnboardingComplete && !user.onboardingCompleted) {
    return <Navigate to={getOnboardingRoute(user)} replace />;
  }
  return children;
}

function LoginRoute() {
  const { isAuthed, user, draftSignupSession } = useApp();
  const draft = draftSignupSession?.authDraftToken ? draftSignupSession : getDraftSignupSessionFromStorage();
  if (!isAuthed && draft?.authDraftToken) {
    return <Navigate to="/onboarding/user-type" replace />;
  }
  if (!isAuthed) return <LoginPage />;
  return <Navigate to={getOnboardingRoute(user)} replace />;
}

function SignupRoute() {
  const { isAuthed, user, draftSignupSession } = useApp();
  const draft = draftSignupSession?.authDraftToken ? draftSignupSession : getDraftSignupSessionFromStorage();
  if (!isAuthed && draft?.authDraftToken) {
    return <Navigate to="/onboarding/user-type" replace />;
  }
  if (!isAuthed) return <SignupPage />;
  return <Navigate to={getOnboardingRoute(user)} replace />;
}

function OnboardingRoute() {
  const { isAuthed, user, draftSignupSession } = useApp();
  const draft = draftSignupSession?.authDraftToken ? draftSignupSession : getDraftSignupSessionFromStorage();
  if (!isAuthed && draft?.authDraftToken) return <Navigate to="/onboarding/user-type" replace />;
  if (!isAuthed) return <Navigate to="/login" replace />;
  return <Navigate to={getOnboardingRoute(user)} replace />;
}

function ProfileSetupRoute() {
  const { user, draftSignupSession } = useApp();
  const draft = draftSignupSession?.authDraftToken ? draftSignupSession : getDraftSignupSessionFromStorage();
  const resolvedUserType =
    draft?.selectedUserType || user.userType || localStorage.getItem(STORAGE_KEYS.userType) || "";
  if (resolvedUserType === "business") return <BusinessProfileSetup />;
  if (resolvedUserType === "influencer") return <InfluencerProfileSetup />;
  if (resolvedUserType === "student") return <StudentProfileSetup />;
  return <Navigate to="/onboarding/user-type" replace />;
}

function DraftProtectedRoute({ children }) {
  const { draftSignupSession } = useApp();
  const draft = draftSignupSession?.authDraftToken ? draftSignupSession : getDraftSignupSessionFromStorage();
  if (!draft?.authDraftToken) return <Navigate to="/signup" replace />;
  return children;
}

function NotFoundRoute() {
  const { isAuthed, user } = useApp();
  if (!isAuthed) return <Navigate to="/login" replace />;
  return <Navigate to={getOnboardingRoute(user)} replace />;
}

function RootRouter() {
  const { theme } = useApp();
  const location = useLocation();
  const isAuthUiRoute =
    location.pathname === "/login" ||
    location.pathname === "/signup" ||
    location.pathname.startsWith("/auth/");

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  return (
    <>
      {isAuthUiRoute ? (
        <Routes location={location}>
          <Route path="/index.html" element={<Navigate to="/login" replace />} />
          <Route path="/login.html" element={<Navigate to="/login" replace />} />
          <Route path="/signup.html" element={<Navigate to="/signup" replace />} />
          <Route path="/dashboard.html" element={<OnboardingRoute />} />
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/signup" element={<SignupRoute />} />
          <Route path="/auth/google/callback" element={<AuthGoogleCallbackPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/onboarding/platforms" element={<OnboardingRoute />} />
          <Route
            path="/onboarding/user-type"
            element={
              <DraftProtectedRoute>
                <ChooseUserTypeScreen />
              </DraftProtectedRoute>
            }
          />
          <Route
            path="/onboarding/profile-setup"
            element={
              <DraftProtectedRoute>
                <ProfileSetupRoute />
              </DraftProtectedRoute>
            }
          />
          <Route
            path="/onboarding/link-accounts"
            element={
              <ProtectedRoute>
                <LinkAccounts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/connect/facebook/pages"
            element={
              <ProtectedRoute>
                <FacebookPageSelectPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/connect/instagram/accounts"
            element={
              <ProtectedRoute>
                <InstagramAccountSelectPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/connect/linkedin/accounts"
            element={
              <ProtectedRoute>
                <LinkedInAccountSelectPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/connect/google-business/locations"
            element={
              <ProtectedRoute>
                <GoogleBusinessLocationSelectPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/business"
            element={
              <ProtectedRoute requireOnboardingComplete>
                <BusinessDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/influencer"
            element={
              <ProtectedRoute requireOnboardingComplete>
                <InfluencerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/student"
            element={
              <ProtectedRoute requireOnboardingComplete>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<OnboardingRoute />} />
          <Route path="/dashboard/*" element={<OnboardingRoute />} />
          <Route path="/channels/*" element={<OnboardingRoute />} />
          <Route path="/connected-platforms/*" element={<OnboardingRoute />} />
          <Route path="/create-post/*" element={<OnboardingRoute />} />
          <Route path="/schedule/*" element={<OnboardingRoute />} />
          <Route path="/settings/*" element={<OnboardingRoute />} />
          <Route path="*" element={<NotFoundRoute />} />
        </Routes>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="min-h-dvh"
          >
            <Routes location={location}>
            <Route path="/index.html" element={<Navigate to="/login" replace />} />
            <Route path="/login.html" element={<Navigate to="/login" replace />} />
            <Route path="/signup.html" element={<Navigate to="/signup" replace />} />
            <Route path="/dashboard.html" element={<OnboardingRoute />} />
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/signup" element={<SignupRoute />} />
            <Route path="/auth/google/callback" element={<AuthGoogleCallbackPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/onboarding/platforms" element={<OnboardingRoute />} />
            <Route
              path="/onboarding/user-type"
              element={
                <DraftProtectedRoute>
                  <ChooseUserTypeScreen />
                </DraftProtectedRoute>
              }
            />
            <Route
              path="/onboarding/profile-setup"
              element={
                <DraftProtectedRoute>
                  <ProfileSetupRoute />
                </DraftProtectedRoute>
              }
            />
            <Route
              path="/onboarding/link-accounts"
              element={
                <ProtectedRoute>
                  <LinkAccounts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/connect/facebook/pages"
              element={
                <ProtectedRoute>
                  <FacebookPageSelectPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/connect/instagram/accounts"
              element={
                <ProtectedRoute>
                  <InstagramAccountSelectPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/connect/linkedin/accounts"
              element={
                <ProtectedRoute>
                  <LinkedInAccountSelectPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/connect/google-business/locations"
              element={
                <ProtectedRoute>
                  <GoogleBusinessLocationSelectPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business"
              element={
                <ProtectedRoute requireOnboardingComplete>
                  <BusinessDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/influencer"
              element={
                <ProtectedRoute requireOnboardingComplete>
                  <InfluencerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student"
              element={
                <ProtectedRoute requireOnboardingComplete>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<OnboardingRoute />} />
            <Route path="/dashboard/*" element={<OnboardingRoute />} />
            <Route path="/channels/*" element={<OnboardingRoute />} />
            <Route path="/connected-platforms/*" element={<OnboardingRoute />} />
            <Route path="/create-post/*" element={<OnboardingRoute />} />
            <Route path="/schedule/*" element={<OnboardingRoute />} />
            <Route path="/settings/*" element={<OnboardingRoute />} />
            <Route path="*" element={<NotFoundRoute />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      )}
      <Toast />
      <AuthAlert />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <RootRouter />
    </AppProvider>
  );
}
