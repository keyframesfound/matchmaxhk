import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "admin" | "staff" | "tutor" | "parent";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) return [];
  return (data ?? []).map((r) => r.role as AppRole);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      window.setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const { data: subscription } = supabase.auth.onAuthStateChange((event, sess) => {
      if (!mounted) return;
      if (
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED" &&
        event !== "INITIAL_SESSION"
      ) {
        return;
      }
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // Defer role fetch to avoid deadlock inside the listener
        setTimeout(() => {
          fetchRoles(sess.user.id).then((r) => {
            if (mounted) setRoles(r);
          });
        }, 0);
      } else {
        setRoles([]);
      }
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      }
    });

    withTimeout(supabase.auth.getSession(), 8000, { data: { session: null }, error: null })
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        setLoading(false);
        if (data.session?.user) {
          withTimeout(fetchRoles(data.session.user.id), 8000, []).then((r) => {
            if (mounted) setRoles(r);
          });
        } else {
          setRoles([]);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [queryClient, router]);

  const value: AuthContextValue = {
    user,
    session,
    roles,
    loading,
    hasRole: (r) => roles.includes(r),
    hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
    refreshRoles: async () => {
      if (user) setRoles(await fetchRoles(user.id));
    },
    signOut: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      router.navigate({ to: "/auth", replace: true });
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
