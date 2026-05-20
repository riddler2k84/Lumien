import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  role: string | null;
  userId: number | null;
  fullName: string | null;
  setAuth: (token: string, role: string, userId: number, fullName: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      userId: null,
      fullName: null,
      setAuth: (token, role, userId, fullName) => {
        localStorage.setItem("token", token);
        set({ token, role, userId, fullName });
      },
      logout: () => {
        localStorage.removeItem("token");
        set({ token: null, role: null, userId: null, fullName: null });
      },
    }),
    { name: "auth" }
  )
);
