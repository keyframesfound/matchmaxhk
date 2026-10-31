import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { resolveActiveRole, type AccountType } from "@/features/auth/active-role";

import type { AccountStatus } from "@/features/admin-users/account-status.shared";

export type AppRole = "super_admin" | "admin" | "staff" | "tutor" | "parent";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  /** Issue #459: account type the user is acting as. Roles stay additive. */
  activeRole: AccountType;
  /** Issue #308: mirror of profiles.account_status for the signed-in user. */
  accountStatus: AccountStatus | null;
  /** Staff-facing reason shown to the suspended user (never names a reporter). */
  suspensionReason: string | null;
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  signOut: () => Promise<void>;
  /** Sign out on this device and every other signed-in session. */
  signOutEverywhere: () => Promise<void>;
  refreshRoles: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type RoleState = { roles: AppRole[]; storedActiveRole: AccountType | null };

const NO_ROLES: RoleState = { roles: [], storedActiveRole: null };

async function fetchRoles(userId: string): Promise<RoleState> {
  const [rolesResult, profileResult] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("active_role").eq("id", userId).maybeSingle(),
  ]);
  const roles = rolesResult.error ? [] : (rolesResult.data ?? []).map((r) => r.role as AppRole);
  // Missing column (pre-migration) or row falls back to role-derived default.
  const stored = profileResult.error ? null : profileResult.data?.active_role;
  return {
    roles,
    storedActiveRole: stored === "parent" || stored === "tutor" ? stored : null,
  };
}

/**
 * Issue #308: read the account status for the post-auth check. Tolerates a
 * pre-migration database (missing column / missing row counts as active) —
 * the migration and the DB default are the source of truth in production.
 */
async function fetchAccountStatus(
  userId: string,
): Promise<{ status: AccountStatus; reason: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("account_status, account_status_reason")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return { status: "active", reason: null };
  const status = (data.account_status as AccountStatus | null | undefined) ?? "active";
  return { status, reason: (data.account_status_reason as string | null) ?? null };
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
  const [{ roles, storedActiveRole }, setRoles] = useState<RoleState>(NO_ROLES);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [suspensionReason, setSuspensionReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const router = useRouter();

  // Issue #308: post-auth status check. A banned account's session is ended
  // immediately (the server also forces global sign-out on ban); the
  // 'banned' flag intentionally survives the SIGNED_OUT event so the
  // blocked-message banner stays visible. Suspended accounts keep their
  // session, the banner exposes the reason.
  const applyAccountStatus = (userId: string) => {
    fetchAccountStatus(userId).then(({ status, reason }) => {
      setSuspensionReason(reason);
      if (status === "banned") {
        setAccountStatus("banned");
        void supabase.auth.signOut();
      } else {
        setAccountStatus(status);
      }
    });
  };

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
      if (event === "SIGNED_IN") {
        setAccountStatus(null);
        setSuspensionReason(null);
      }
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // Defer role fetch to avoid deadlock inside the listener
        setTimeout(() => {
          if (!mounted) return;
          fetchRoles(sess.user.id).then((r) => {
            if (mounted) setRoles(r);
          });
          applyAccountStatus(sess.user.id);
          // P2 (#280): record the Google subject id on the profile for
          // reference. Ownership itself is the auth user id; this column is
          // an audit/linking aid. Best-effort, never blocks sign-in.
          const identity = sess.user.identities?.find((i) => i.provider === "google");
          const googleSub = identity?.id ?? (sess.user.user_metadata?.sub as string | undefined);
          if (googleSub) {
            void supabase
              .from("profiles")
              .upsert(
                { id: sess.user.id, google_sub: googleSub },
                { onConflict: "id", ignoreDuplicates: false },
              );
          }
        }, 0);
      } else {
        setRoles(NO_ROLES);
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
          withTimeout(fetchRoles(data.session.user.id), 8000, NO_ROLES).then((r) => {
            if (mounted) setRoles(r);
          });
          applyAccountStatus(data.session.user.id);
        } else {
          setRoles(NO_ROLES);
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
    activeRole: resolveActiveRole(storedActiveRole, roles),
    accountStatus,
    suspensionReason,
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
      router.navigate({ to: "/", replace: true });
    },
    signOutEverywhere: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut({ scope: "global" });
      router.navigate({ to: "/", replace: true });
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
