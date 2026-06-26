"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  api,
  clearStoredSession,
  getStoredToken,
  setStoredSession,
} from "@/lib/api";
import type { Usuario } from "@/types/api";

type AuthContextValue = {
  usuario: Usuario | null;
  loading: boolean;
  setSession: (accessToken: string, usuario: Usuario) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const isLoginPage = pathname === "/login";

  const setSession = useCallback(
    (accessToken: string, nextUsuario: Usuario) => {
      setStoredSession(accessToken, nextUsuario);
      setUsuario(nextUsuario);
      router.replace("/");
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // El cierre local debe ocurrir aunque el token ya no sea válido.
    } finally {
      clearStoredSession();
      setUsuario(null);
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    let active = true;

    async function validateSession() {
      const token = getStoredToken();

      if (!token) {
        clearStoredSession();
        setUsuario(null);
        setLoading(false);

        if (!isLoginPage) {
          router.replace("/login");
        }

        return;
      }

      try {
        const response = await api.get<Usuario>("/auth/me");

        if (!active) {
          return;
        }

        setUsuario(response.data);
        setLoading(false);

        if (isLoginPage) {
          router.replace("/");
        }
      } catch {
        if (!active) {
          return;
        }

        clearStoredSession();
        setUsuario(null);
        setLoading(false);

        if (!isLoginPage) {
          router.replace("/login");
        }
      }
    }

    void validateSession();

    return () => {
      active = false;
    };
  }, [isLoginPage, router]);

  const value = useMemo(
    () => ({ usuario, loading, setSession, logout }),
    [usuario, loading, setSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }

  return context;
}
