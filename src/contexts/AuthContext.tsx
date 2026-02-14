import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

export type AccountType = "customer" | "backoffice";

interface AuthSession {
  isAuthenticated: boolean;
  accountType: AccountType | null;
  email: string;
}

interface AuthContextValue extends AuthSession {
  login: (accountType: AccountType, email: string) => void;
  logout: () => void;
  displayName: string;
}

const STORAGE_KEY = "origo-auth-session-v1";

const emptySession: AuthSession = {
  isAuthenticated: false,
  accountType: null,
  email: "",
};

const AuthContext = createContext<AuthContextValue | null>(null);

const getStoredSession = (): AuthSession => {
  if (typeof window === "undefined") {
    return emptySession;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return emptySession;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;

    if (!parsed.isAuthenticated || !parsed.accountType || !parsed.email) {
      return emptySession;
    }

    if (parsed.accountType !== "customer" && parsed.accountType !== "backoffice") {
      return emptySession;
    }

    return {
      isAuthenticated: true,
      accountType: parsed.accountType,
      email: parsed.email,
    };
  } catch {
    return emptySession;
  }
};

const formatDisplayName = (email: string) => {
  const localPart = email.split("@")[0] ?? "User";
  if (!localPart) {
    return "User";
  }

  return localPart
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
};

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession>(() => getStoredSession());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!session.isAuthenticated) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...session,
      login: (accountType, email) => {
        setSession({
          isAuthenticated: true,
          accountType,
          email: email.trim(),
        });
      },
      logout: () => {
        setSession(emptySession);
      },
      displayName: formatDisplayName(session.email),
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
