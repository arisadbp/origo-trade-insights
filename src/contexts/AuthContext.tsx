import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type AccountType = "customer" | "admin";

interface UserProfile {
  id: string;
  email: string;
  username: string;
  role: "ADMIN" | "CUSTOMER";
  is_active: boolean;
}

interface AuthSession {
  isAuthenticated: boolean;
  accountType: AccountType | null;
  email: string;
  username: string;
}

interface LoginResult {
  success: boolean;
  accountType?: AccountType;
  error?: string;
}

interface AuthContextValue extends AuthSession {
  loading: boolean;
  login: (identifier: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  displayName: string;
}

const GENERIC_INVALID_ERROR = "Invalid credentials";

const emptySession: AuthSession = {
  isAuthenticated: false,
  accountType: null,
  email: "",
  username: "",
};

const AuthContext = createContext<AuthContextValue | null>(null);

const formatDisplayName = (email: string, username: string) => {
  const seed = username.trim() || email.trim();
  if (!seed) return "User";
  const localPart = seed.split("@")[0] ?? seed;
  return localPart
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
};

const normalizeIdentifier = (identifier: string) => identifier.trim().toLowerCase();

const mapRoleToAccountType = (role: UserProfile["role"]): AccountType => (
  role === "ADMIN" ? "admin" : "customer"
);

async function resolveProfileByUser(user: User | null): Promise<UserProfile | null> {
  if (!user || !supabase) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, email, username, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data as UserProfile;
}

async function resolveEmailFromIdentifier(identifier: string): Promise<string | null> {
  if (!supabase) return null;
  const normalized = normalizeIdentifier(identifier);

  if (normalized.includes("@")) {
    return normalized;
  }

  const { data, error } = await supabase.rpc("resolve_login_email", {
    p_identifier: normalized,
  });

  if (error || !data) return null;
  return String(data);
}

async function canAttemptLogin(identifier: string) {
  if (!supabase) return true;
  const { data, error } = await supabase.rpc("auth_login_attempt_check", {
    p_identifier: normalizeIdentifier(identifier),
  });
  if (error) return true;
  return Boolean(data);
}

async function recordLoginAttempt(identifier: string, success: boolean) {
  if (!supabase) return;
  await supabase.rpc("auth_login_attempt_record", {
    p_identifier: normalizeIdentifier(identifier),
    p_success: success,
  });
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession>(emptySession);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    const syncFromUser = async (user: User | null) => {
      if (!active) return;
      if (!user) {
        setSession(emptySession);
        setLoading(false);
        return;
      }

      const profile = await resolveProfileByUser(user);
      if (!profile || !profile.is_active) {
        await supabase.auth.signOut();
        if (!active) return;
        setSession(emptySession);
        setLoading(false);
        return;
      }

      setSession({
        isAuthenticated: true,
        accountType: mapRoleToAccountType(profile.role),
        email: profile.email || user.email || "",
        username: profile.username || "",
      });
      setLoading(false);
    };

    void supabase.auth.getSession().then(({ data }) => {
      void syncFromUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      void syncFromUser(currentSession?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...session,
      loading,
      login: async (identifier, password) => {
        if (!isSupabaseConfigured || !supabase) {
          return { success: false, error: "Authentication is not configured." };
        }

        const allowAttempt = await canAttemptLogin(identifier);
        if (!allowAttempt) {
          return { success: false, error: GENERIC_INVALID_ERROR };
        }

        const email = await resolveEmailFromIdentifier(identifier);
        if (!email) {
          await recordLoginAttempt(identifier, false);
          return { success: false, error: GENERIC_INVALID_ERROR };
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data.user) {
          await recordLoginAttempt(identifier, false);
          return { success: false, error: GENERIC_INVALID_ERROR };
        }

        const profile = await resolveProfileByUser(data.user);
        if (!profile || !profile.is_active) {
          await supabase.auth.signOut();
          await recordLoginAttempt(identifier, false);
          return { success: false, error: GENERIC_INVALID_ERROR };
        }

        const accountType = mapRoleToAccountType(profile.role);
        setSession({
          isAuthenticated: true,
          accountType,
          email: profile.email || data.user.email || "",
          username: profile.username || "",
        });

        await recordLoginAttempt(identifier, true);
        return { success: true, accountType };
      },
      logout: async () => {
        if (supabase) {
          await supabase.auth.signOut();
        }
        setSession(emptySession);
      },
      requestPasswordReset: async (email) => {
        if (!isSupabaseConfigured || !supabase) return;
        await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
      },
      resetPassword: async (newPassword) => {
        if (!isSupabaseConfigured || !supabase) {
          return { success: false, error: "Authentication is not configured." };
        }

        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
          return { success: false, error: error.message };
        }

        await supabase.auth.signOut({ scope: "global" });
        setSession(emptySession);
        return { success: true };
      },
      displayName: formatDisplayName(session.email, session.username),
    }),
    [session, loading],
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
