import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck2, Eye, GraduationCap, Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";
import {
  confirmRosterClaim,
  getRosterClaimPreview,
  getRosterClaimViewerState,
  type ClaimHistoryItem,
  type ClaimPreview,
} from "@/features/rosters/rosters.functions";

/**
 * #613 §4.3 Parent Claim Landing Card — PUBLIC page at /claim-roster/{token}.
 * States: loading, expired/used/revoked/invalid token, sign-in gate (return
 * URL preserved through /auth?redirect=), self-claim block (educator sees the
 * Preview Mode banner and can never confirm), success card with the
 * now-attached historical attendance records.
 */
export const Route = createFileRoute("/claim-roster/$token")({
  head: () => ({
    meta: [{ title: "Parent claim | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: ClaimRosterPage,
});

const STATE_KEYS: Record<string, { title: string; body: string }> = {
  not_found: { title: "state_not_found_title", body: "state_not_found_body" },
  used: { title: "state_used_title", body: "state_used_body" },
  expired: { title: "state_expired_title", body: "state_expired_body" },
  revoked: { title: "state_expired_title", body: "state_expired_body" },
};

function statusLabelKey(status: string): string {
  return `rosters.status_${status}`;
}

function HistoryList({ history }: { history: ClaimHistoryItem[] }) {
  const { t } = useTranslation();
  if (history.length === 0) return null;
  return (
    <div className="mt-4 rounded-xl border border-border bg-[color:var(--background)] p-3">
      <p className="flex items-center gap-2 text-xs font-bold text-[color:var(--ink)]">
        <CalendarCheck2 className="h-4 w-4" aria-hidden />
        {t("claim_roster.history_title")}
      </p>
      <ul className="mt-2 space-y-1.5">
        {history.map((item, i) => (
          <li
            key={`${item.sessionDate}-${i}`}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-muted-foreground">{item.sessionDate}</span>
            <span className="rounded-md bg-[color:var(--foreground)]/[0.06] px-2 py-0.5 text-xs font-semibold text-[color:var(--ink)]">
              {t(statusLabelKey(item.status))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClaimRosterPage() {
  const { token } = Route.useParams();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<{ studentName: string; history: ClaimHistoryItem[] } | null>(
    null,
  );
  const [selfClaimBlocked, setSelfClaimBlocked] = useState(false);

  // The public preview runs without auth; no DB fetch during SSR (react-query
  // fetches client-side), so a crafted token never 500s a cold load.
  const previewQuery = useQuery({
    queryKey: ["claim-roster", "preview", token],
    enabled: token.length >= 10 && token.length <= 200,
    queryFn: () => getRosterClaimPreview({ data: { token } }),
    retry: false,
  });

  // Signed-in viewers: is this THEIR roster? (educator preview mode)
  const viewerQuery = useQuery({
    queryKey: ["claim-roster", "viewer", token, user?.id],
    enabled: Boolean(user) && previewQuery.data?.state === "valid",
    queryFn: () => getRosterClaimViewerState({ data: { token } }),
    retry: false,
  });
  const isEducatorViewer = viewerQuery.data?.isEducator === true;

  const confirm = useMutation({
    mutationFn: () => confirmRosterClaim({ data: { token } }),
    onSuccess: (res) => {
      setResult({ studentName: res.studentName, history: res.history });
      toast.success(t("claim_roster.success_toast", { student: res.studentName }));
      void queryClient.invalidateQueries({ queryKey: ["claim-roster"] });
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("SELF_EDUCATOR")) {
        setSelfClaimBlocked(true);
        toast.error(t("claim_roster.self_claim_error"));
      } else if (msg.includes("USED")) {
        toast.error(t("claim_roster.state_used_title"));
      } else {
        toast.error(t("claim_roster.state_expired_body"));
      }
      void previewQuery.refetch();
    },
  });

  const preview: ClaimPreview | undefined = previewQuery.data;
  // A failed preview read (bad token, env gap) degrades to the invalid state,
  // never an endless spinner.
  const state: ClaimPreview["state"] | "loading" =
    previewQuery.isError && !preview ? "not_found" : (preview?.state ?? "loading");
  const signInHref = `/auth?redirect=${encodeURIComponent(`/claim-roster/${token}`)}`;

  let body: React.ReactNode;

  if (result) {
    // §4.3 success: linked + past records attach immediately.
    body = (
      <div className="rounded-2xl border border-emerald-500/40 bg-card p-6">
        <p className="flex items-center gap-2 text-lg font-bold text-emerald-700">
          <GraduationCap className="h-5 w-5" aria-hidden />
          {t("claim_roster.success", { student: result.studentName })}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{t("claim_roster.success_body")}</p>
        <HistoryList history={result.history} />
        <Button className="mt-4 font-bold" asChild>
          <Link to="/account">{t("claim_roster.success_cta")}</Link>
        </Button>
      </div>
    );
  } else if (previewQuery.isLoading || authLoading || state === "loading") {
    body = (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-border bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  } else if (state !== "valid") {
    const key = STATE_KEYS[state] ?? STATE_KEYS.not_found;
    body = (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-xl font-bold text-[color:var(--ink)]">
          {t(`claim_roster.${key.title}`)}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t(`claim_roster.${key.body}`)}</p>
      </div>
    );
  } else if (!user) {
    // §6: preserve the return URL so the parent lands back here after
    // login / lightweight parent sign-up (HK$0).
    body = (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-xl font-bold text-[color:var(--ink)]">
          {t("claim_roster.sign_in_title", { student: preview?.studentName ?? "" })}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("claim_roster.sign_in_body")}</p>
        <p className="mt-3 rounded-xl bg-[color:var(--foreground)]/[0.04] px-3 py-2 text-xs font-semibold text-emerald-700">
          {t("claim_roster.fee_free")}
        </p>
        <Button className="mt-4 font-bold" asChild>
          <a href={signInHref}>{t("claim_roster.sign_in_cta")}</a>
        </Button>
      </div>
    );
  } else {
    body = (
      <div className="rounded-2xl border border-border bg-card p-6">
        {isEducatorViewer ? (
          // §4.3 educator-preview mode: banner + confirm stays blocked.
          <p className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/[0.06] px-3 py-2 text-xs font-semibold text-amber-700">
            <Eye className="h-4 w-4 shrink-0" aria-hidden />
            {t("claim_roster.preview_banner")}
          </p>
        ) : null}
        {selfClaimBlocked ? (
          <p className="mb-4 flex items-center gap-2 rounded-xl border border-[#F4212E]/30 bg-[#F4212E]/[0.06] px-3 py-2 text-xs font-semibold text-destructive">
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
            {t("claim_roster.self_claim_error")}
          </p>
        ) : null}
        <h1 className="text-xl font-bold text-[color:var(--ink)]">
          {t("claim_roster.title", { student: preview?.studentName ?? "" })}
        </h1>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t("claim_roster.educator")}</dt>
            <dd className="font-semibold text-[color:var(--ink)]">
              {preview?.educatorName ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t("claim_roster.student")}</dt>
            <dd className="font-semibold text-[color:var(--ink)]">{preview?.studentName ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t("claim_roster.course")}</dt>
            <dd className="font-semibold text-[color:var(--ink)]">{preview?.courseTitle ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t("claim_roster.fee")}</dt>
            <dd className="font-semibold text-emerald-700">{t("claim_roster.fee_free")}</dd>
          </div>
        </dl>
        <Button
          className="mt-5 w-full font-bold sm:w-auto"
          disabled={confirm.isPending || isEducatorViewer}
          onClick={() => confirm.mutate()}
        >
          {confirm.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          {t("claim_roster.confirm")}
        </Button>
        {isEducatorViewer ? (
          <p className="mt-2 text-xs text-muted-foreground">{t("claim_roster.self_claim_note")}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-10">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <GraduationCap className="h-4 w-4" aria-hidden />
          {t("claim_roster.eyebrow")}
        </div>
        {body}
      </main>
      <SiteFooter />
    </div>
  );
}
