import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { AxiosRequestConfig, Method } from "axios";
import { api } from "@/lib/api";

const TOKEN_KEY = "aegis_jwt";

export type UserRole = "admin" | "investigator";

export interface Session {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  title: string;
  initials: string;
}

interface AuthContextValue {
  session: Session | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => void;
  authFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const normalizePath = (path: string) => path.replace(/^\/+/, "/");

async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const cfg: AxiosRequestConfig = {
    url: normalizePath(path),
    method: (init?.method as Method | undefined) ?? "GET",
    headers: (init?.headers as Record<string, string> | undefined) ?? {},
  };
  if (init?.body !== undefined) {
    try {
      cfg.data = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    } catch {
      cfg.data = init.body;
    }
  }
  const res = await api.request<T>(cfg);
  return res.data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken]     = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Verify token and hydrate session on mount
  useEffect(() => {
    if (!token) { setIsLoading(false); return; }
    apiFetch<any>("/auth/me", { method: "GET" })
      .then((user) => {
        setSession({
          id: user.id, email: user.email, name: user.name,
          role: user.role, title: user.title, initials: user.initials,
        });
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setSession(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const payload = await apiFetch<any>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const jwt = payload.access_token ?? payload.token;
    localStorage.setItem(TOKEN_KEY, jwt);
    setToken(jwt);
    setSession({
      id: payload.user.id, email: payload.user.email, name: payload.user.name,
      role: payload.user.role, title: payload.user.title, initials: payload.user.initials,
    });
  };

  const signup = async (data: SignupData) => {
    const payload = await apiFetch<any>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const jwt = payload.access_token ?? payload.token;
    localStorage.setItem(TOKEN_KEY, jwt);
    setToken(jwt);
    setSession({
      id: payload.user.id, email: payload.user.email, name: payload.user.name,
      role: payload.user.role, title: payload.user.title, initials: payload.user.initials,
    });
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setSession(null);
  };

  const authFetch = <T = unknown>(input: string, init?: RequestInit) => apiFetch<T>(input, init);

  return (
    <AuthContext.Provider value={{
      session, token, isAuthenticated: !!session, isLoading,
      login, signup, logout, authFetch,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
