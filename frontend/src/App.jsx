import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { useLayoutEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppProvider, useApp } from "./context/AppContext";

// Auth and Onboarding pages
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

// Connect / selection pages
import FacebookPageSelectPage from "./pages/FacebookPageSelectPage";
import InstagramAccountSelectPage from "./pages/InstagramAccountSelectPage";
import LinkedInAccountSelectPage from "./pages/LinkedInAccountSelectPage";
import GoogleBusinessLocationSelectPage from "./pages/GoogleBusinessLocationSelectPage";

// Dashboards and inner pages
import BusinessDashboard from "./pages/BusinessDashboard";
import InfluencerDashboard from "./pages/InfluencerDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import CreatePostPage from "./pages/CreatePostPage";
import ContentCalendarPage from "./pages/ContentCalendarPage";
import SchedulePage from "./pages/SchedulePage";
import SchedulePostPage from "./pages/SchedulePostPage";
import ScheduledPostDetailPage from "./pages/ScheduledPostDetailPage";
import ChannelsPage from "./pages/ChannelsPage";
import ConnectedPlatformDetailPage from "./pages/ConnectedPlatformDetailPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import MediaLibraryPage from "./pages/MediaLibraryPage";

// Layouts
import DashboardLayout from "./layouts/DashboardLayout";
import SettingsLayout from "./layouts/SettingsLayout";

// Settings pages
import SettingsAccountPage from "./pages/settings/SettingsAccountPage";
import SettingsChannelsPage from "./pages/settings/SettingsChannelsPage";
import SettingsPreferencesPage from "./pages/settings/SettingsPreferencesPage";

// Primitives & Helpers
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
  const onboardingCompleted = user.onboardingCompleted || localStorage.getItem(STORAGE_KEYS.onboardingCompleted) === "1";
  if (requireOnboardingComplete && !onboardingCompleted) {
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

function DashboardRedirect() {
  const { user } = useApp();
  return <Navigate to={getOnboardingRoute(user)} replace />;
}

function RedirectLegacyConnectedPlatform() {
  const { platformKey } = useParams();
  return <Navigate to={platformKey ? `/channels/${platformKey}` : "/channels"} replace />;
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

  const renderRoutes = () => (
    <>
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

      {/* Main App Layout containing Sidebar and Topbar */}
      <Route
        path="/"
        element={
          <ProtectedRoute requireOnboardingComplete>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardRedirect />} />
        <Route path="dashboard/business" element={<BusinessDashboard />} />
        <Route path="dashboard/influencer" element={<InfluencerDashboard />} />
        <Route path="dashboard/student" element={<StudentDashboard />} />
        <Route path="create-post" element={<CreatePostPage />} />
        <Route path="content-calendar" element={<ContentCalendarPage />} />
        <Route path="content-calender" element={<Navigate to="/content-calendar" replace />} />
        <Route path="schedule/new" element={<SchedulePostPage />} />
        <Route path="schedule/:id" element={<ScheduledPostDetailPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="channels" element={<ChannelsPage />} />
        <Route path="channels/:platformKey" element={<ConnectedPlatformDetailPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="media" element={<MediaLibraryPage />} />
        <Route path="connected-platforms" element={<Navigate to="/channels" replace />} />
        <Route path="connected-platforms/:platformKey" element={<RedirectLegacyConnectedPlatform />} />
        <Route path="settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="account" replace />} />
          <Route path="account" element={<SettingsAccountPage />} />
          <Route path="channels" element={<SettingsChannelsPage />} />
          <Route path="preferences" element={<SettingsPreferencesPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundRoute />} />
    </>
  );

  return (
    <>
      {isAuthUiRoute ? (
        <Routes location={location}>
          {renderRoutes()}
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
              {renderRoutes()}
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
