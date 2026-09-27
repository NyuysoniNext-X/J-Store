import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/types";

export type AppRole = Role;

export type AuthState = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  isAuthenticated: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  refreshRoles: () => Promise<void>;
  /** Sign in with email + password — throws on error */
  signIn: (email: string, password: string) => Promise<void>;
  /** Sign in with a pre-seeded demo account for a given role */
  signInDemo: (role: AppRole) => Promise<void>;
  signOut: () => Promise<void>;
};

const DEMO_EMAILS: Record<AppRole, string> = {
  customer: "demo@j-store.cm",
  seller: "seller@j-store.cm",
  admin: "admin@j-store.cm",
  super_admin: "super@j-store.cm",
  delivery: "rider@j-store.cm",
  partner: "partner@j-store.cm",
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Set up auth listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => {
          void fetchRoles(sess.user.id);
        }, 0);
      } else {
        setRoles([]);
      }
    });

    // 2. Get existing session
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) void fetchRoles(sess.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 3. Separate useEffect for realtime role changes (depends on user.id)
  useEffect(() => {
    if (!user?.id) return;

    const roleChannel = supabase
      .channel(`user-roles-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_roles",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Role change detected:", payload);
          // Role changed, refresh immediately
          void fetchRoles(user.id);
        }
      )
      .subscribe();

    return () => {
      void roleChannel.unsubscribe();
    };
  }, [user?.id]);

  async function fetchRoles(userId: string) {
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!error && data) setRoles(data.map((r) => r.role as AppRole));
  }

  const refreshRoles = async () => {
    if (user?.id) await fetchRoles(user.id);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signInDemo = async (role: AppRole) => {
    const email = DEMO_EMAILS[role];
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: "demo1234",
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
    // Force navigation to home after sign out
    window.location.href = '/';
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const hasAnyRole = (rs: AppRole[]) => rs.some((r) => roles.includes(r));

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        roles,
        loading,
        isAuthenticated: !!session,
        hasRole,
        hasAnyRole,
        refreshRoles,
        signIn,
        signInDemo,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
