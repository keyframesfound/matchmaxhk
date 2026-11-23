import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Gift, Loader2, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getMyCreatorStudio } from "@/features/account/studio.functions";
import { PayoutDetailsCard } from "@/features/account/payout-details-card";
import { optionACopyKey } from "@/features/materials/marketplace-policy";
import { withSafetyAttestationGate } from "@/features/trust/safety-attestation-gate";

/**
 * Issue #585 — Creator & Account Studio (owner-only). Earnings buckets over
 * the #573 seller ledger + the referral funnel, one page. Insights counters
 * stay parked in V1 (needs the #610/#627 event layer); referral link is
 * /r/{handle} with /join?ref=CODE as the canonical target.
 */
export const Route = createFileRoute("/_authenticated/account/studio")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Creator Studio | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: withSafetyAttestationGate(StudioPage),
});

const money = (v: number) => `HK$${v.toFixed(2)}`;

function Bucket({
  title,
  hint,
  amount,
  accent,
}: {
  title: string;
  hint: string;
  amount: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex-1 rounded-[var(--radius-control)] border p-4 ${
        accent
          ? "border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/5"
          : "border-border"
      }`}
    >
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <p className="mt-1 text-xl font-bold text-[color:var(--ink)]">{amount}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function StudioPage() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["creator-studio"],
    queryFn: () => getMyCreatorStudio(),
  });
  const referralUrl = data?.referral?.referralCode
    ? `${window.location.origin}/r/${data.referral.referralCode}`
    : "";
  const copyLink = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      toast.success(t("studio.copied"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("studio.copy_failed"));
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
        <h1 className="text-2xl font-bold">{t("studio.title")}</h1>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
        {isError || !data ? (
          !isLoading ? (
            <p className="text-sm text-destructive">{t("studio.error")}</p>
          ) : null
        ) : (
          <>
            <section className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 text-base font-bold">
                <Wallet className="h-4 w-4 text-[color:var(--brand-link)]" aria-hidden />
                {t("studio.earnings_title")}
              </h2>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Bucket
                  title={t("studio.in_hold")}
                  hint={t(optionACopyKey("studio.in_hold_hint"))}
                  amount={money(data.inHoldHkd)}
                />
                <Bucket
                  title={t("studio.available")}
                  hint={t(optionACopyKey("studio.available_hint"))}
                  amount={money(data.availableHkd)}
                  accent
                />
                <Bucket
                  title={t("studio.total_paid")}
                  hint={t("studio.total_paid_hint")}
                  amount={money(data.totalPaidHkd)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t(optionACopyKey("studio.payout_note"))}
              </p>
            </section>
            {/* #784 §2.2 / AC-543-6: the recent-sales ledger, with the held
                and window-closed copy the issue locks on the matching rows. */}
            <section className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-card p-5">
              <h2 className="text-base font-bold">{t("studio.recent_sales_title")}</h2>
              {(data.recentSales ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("studio.recent_sales_empty")}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.recentSales.map((sale) => {
                    const held = ["held", "paid_held", "delivered_held"].includes(sale.status);
                    return (
                      <li
                        key={sale.id}
                        className="flex flex-wrap items-start justify-between gap-2 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[color:var(--ink)]">
                            {sale.title || t("studio.sale_untitled")}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {t(
                              held ? "notes_option_a.seller_sold" : "notes_option_a.window_closed",
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-[color:var(--ink)]">
                            {money(sale.netHkd)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("studio.sale_gross", { amount: money(sale.grossHkd) })}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* #784 §2.2: private payout details (needed for paid listings). */}
            <PayoutDetailsCard />

            <section className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 text-base font-bold">
                <Gift className="h-4 w-4 text-[color:var(--brand-link)]" aria-hidden />
                {t("studio.referral_title")}
              </h2>
              {data.referral?.referralCode ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                      {referralUrl}
                    </code>
                    <button
                      type="button"
                      onClick={copyLink}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm font-semibold hover:border-[color:var(--brand-link)]"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      {copied ? t("studio.copied") : t("studio.copy")}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <span className="rounded-full border border-border px-3 py-1">
                      {t("studio.ref_friends", { n: data.referral.friends })}
                    </span>
                    <span className="rounded-full border border-border px-3 py-1">
                      {t("studio.ref_pending", { amount: money(data.referral.pendingHkd) })}
                    </span>
                    <span className="rounded-full border border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/5 px-3 py-1 font-semibold text-[color:var(--ink)]">
                      {t("studio.ref_ready", { amount: money(data.referral.readyHkd) })}
                    </span>
                    <span className="rounded-full border border-border px-3 py-1">
                      {t("studio.ref_paid", { amount: money(data.referral.paidHkd) })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("studio.referral_rule")}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t("studio.referral_none")}</p>
              )}
            </section>

            <section className="rounded-[var(--radius-panel)] border border-border bg-card p-5">
              <h2 className="text-base font-bold">{t("studio.insights_title")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("studio.insights_note")}</p>
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
