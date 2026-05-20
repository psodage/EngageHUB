import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { useApp } from "../context/AppContext";
import { getDashboardContentLayout } from "../utils/pageLayout";

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const contentLayout = useMemo(
    () => getDashboardContentLayout(location.pathname),
    [location.pathname]
  );

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="dashboard-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onLogout={handleLogout} />
      <div className="dashboard-main">
        <Topbar contentLayout={contentLayout} onOpenSidebar={() => setSidebarOpen(true)} />
        <main
          className={`dashboard-scroll ${contentLayout === "composer" ? "dashboard-scroll--composer" : ""}`}
        >
          <div className={`dashboard-content dashboard-content--${contentLayout}`}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
