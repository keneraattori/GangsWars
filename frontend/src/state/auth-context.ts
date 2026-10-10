import { createContext, useContext } from "react";
import type { AuthUser } from "../api/auth";

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  enter: (name: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
