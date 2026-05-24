import { create } from "zustand";
import { persist } from "zustand/middleware";

type Tenant = "production" | "demo";

interface AuthState {
  token: string | null;
  role: string | null;
  userId: number | null;
  fullName: string | null;
  tenant: Tenant;
  setAuth: (token: string, role: string, userId: number, fullName: string, tenant: Tenant) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      userId: null,
      fullName: null,
      tenant: "production",
      setAuth: (token, role, userId, fullName, tenant) => {
        localStorage.setItem("token", token);
        localStorage.setItem("tenant", tenant);
        set({ token, role, userId, fullName, tenant });
      },
      logout: () => {
        localStorage.removeItem("token");
        set({ token: null, role: null, userId: null, fullName: null, tenant: "production" });
      },
    }),
    { name: "auth" }
  )
);
