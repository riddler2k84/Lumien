import { Outlet, Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/auth";
import Sidebar from "./Sidebar";
import DemoBanner from "./DemoBanner";

export default function AppLayout() {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DemoBanner />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
