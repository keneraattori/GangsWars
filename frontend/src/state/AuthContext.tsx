import { useEffect, useState, type ReactNode } from "react";
import * as authApi from "../api/auth";
import type { AuthUser } from "../api/auth";
import { AuthContext, type AuthContextValue } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    enter: async (name) => {
      setUser(await authApi.enter(name));
    },
    logout: async () => {
      await authApi.logout();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
