import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { useLayoutEffect } from "react";
import { AppProvider, useApp } from "./context/AppContext";
import DashboardLayout from "./layouts/DashboardLayout";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AuthGoogleCallbackPage from "./pages/AuthGoogleCallbackPage";
import DashboardPage from "./pages/DashboardPage";
import CreatePostPage from "./pages/CreatePostPage";
import SchedulePage from "./pages/SchedulePage";
import SchedulePostPage from "./pages/SchedulePostPage";
import SettingsLayout from "./layouts/SettingsLayout";
import SettingsAccountPage from "./pages/settings/SettingsAccountPage";
import SettingsChannelsPage from "./pages/settings/SettingsChannelsPage";
import SettingsPreferencesPage from "./pages/settings/SettingsPreferencesPage";
import ChannelsPage from "./pages/ChannelsPage";
import ConnectedPlatformDetailPage from "./pages/ConnectedPlatformDetailPage";
import OnboardingPlatformsPage from "./pages/OnboardingPlatformsPage";
import Toast from "./components/Toast";
import AuthAlert from "./components/auth/AuthAlert";

function ProtectedRoute({ children }) {
  const { isAuthed } = useApp();
  return isAuthed ? children : <Navigate to="/login" replace />;
}

function LoginRoute() {
  const { isAuthed } = useApp();
  if (!isAuthed) return <LoginPage />;
  return <Navigate to="/dashboard" replace />;
}

function SignupRoute() {
  const { isAuthed } = useApp();
  if (!isAuthed) return <SignupPage />;
  return <Navigate to="/dashboard" replace />;
}

function OnboardingRoute() {
  const { isAuthed, isOnboardingCompleted } = useApp();
  if (!isAuthed) return <Navigate to="/login" replace />;
  return isOnboardingCompleted ? <Navigate to="/dashboard" replace /> : <OnboardingPlatformsPage />;
}

function NotFoundRoute() {
  const { isAuthed } = useApp();
  if (!isAuthed) return <Navigate to="/login" replace />;
  return <Navigate to="/dashboard" replace />;
}

function RedirectLegacyConnectedPlatform() {
  const { platformKey } = useParams();
  return <Navigate to={platformKey ? `/channels/${platformKey}` : "/channels"} replace />;
}

function RootRouter() {
  const { theme } = useApp();

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  return (
    <>
      <Routes>
        <Route path="/index.html" element={<Navigate to="/login" replace />} />
        <Route path="/login.html" element={<Navigate to="/login" replace />} />
        <Route path="/signup.html" element={<Navigate to="/signup" replace />} />
        <Route path="/dashboard.html" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/signup" element={<SignupRoute />} />
        <Route path="/auth/google/callback" element={<AuthGoogleCallbackPage />} />
        <Route path="/onboarding/platforms" element={<OnboardingRoute />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="create-post" element={<CreatePostPage />} />
          <Route path="schedule/new" element={<SchedulePostPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="channels" element={<ChannelsPage />} />
          <Route path="channels/:platformKey" element={<ConnectedPlatformDetailPage />} />
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
      </Routes>
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
