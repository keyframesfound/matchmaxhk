import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Copy, Gift, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SettingsCard } from "@/features/settings/option-card";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";

type ReferralDashboard = {
  referral_code: string;
  friends_joined: number;
  pending_cents: number;
  ready_cents: number;
  paid_cents: number;
};

function formatHkd(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency: "HKD",
    minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * "Refer & Earn 15%" — tutor-side view of the referral program. Aggregates
 * come from the get_my_referral_dashboard RPC so the tutor never reads
 * referred applicants' personal data directly.
 */
export function ReferralsSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["settings", "referrals", user?.id],
    queryFn: async () => {
      const { data: payload, error } = await supabase.rpc("get_my_referral_dashboard");
      if (error) throw error;
      return (payload as ReferralDashboard | null) ?? null;
    },
    enabled: Boolean(user),
  });

  const referralUrl = data
    ? `${window.location.origin}/join?ref=${encodeURIComponent(data.referral_code)}`
    : "";

  async function copyLink() {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      toast.success(t("settings.referrals.copied"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("settings.referrals.copy_error"));
    }
  }

  const pendingCents = (data?.pending_cents ?? 0) + (data?.ready_cents ?? 0);

  const stats = [
    {
      label: t("settings.referrals.friends_joined"),
      value: data ? String(data.friends_joined) : "—",
    },
    {
      label: t("settings.referrals.pending"),
      value: data ? formatHkd(pendingCents) : "—",
    },
    {
      label: t("settings.referrals.paid"),
      value: data ? formatHkd(data.paid_cents) : "—",
    },
  ];

  return (
    <SettingsCard
      title={t("settings.referrals.title")}
      description={t("settings.referrals.description")}
    >
      {isLoading ? (
        <div className="space-y-4" aria-hidden>
          <div className="h-20 animate-pulse rounded-xl bg-[color:var(--ink)]/5" />
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-24 animate-pulse rounded-xl bg-[color:var(--ink)]/5" />
            ))}
          </div>
        </div>
      ) : isError ? (
        <p className="text-sm font-medium text-destructive">{t("settings.load_error")}</p>
      ) : !data ? (
        <p className="text-sm leading-6 text-[color:var(--ink)]/70">
          {t("settings.referrals.not_linked")}
        </p>
      ) : (
        <div className="space-y-8">
          <div>
            <p className="text-sm font-bold text-[color:var(--ink)]">
              {t("settings.referrals.link_label")}
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <div className="flex min-w-0 flex-1 items-center rounded-xl border border-[color:var(--ink)]/15 bg-[color:var(--surface-subtle)] px-4 py-3">
                <span className="truncate font-mono text-sm text-[color:var(--ink)]">
                  {referralUrl}
                </span>
              </div>
              <Button
                type="button"
                onClick={() => void copyLink()}
                className="shrink-0 gap-2 font-bold"
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                {t("settings.referrals.copy")}
              </Button>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-[color:var(--ink)]">
              {t("settings.referrals.stats_title")}
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] p-4"
                >
                  <p className="text-xs font-medium text-[color:var(--ink)]/60">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-[color:var(--ink)]">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
            {data.ready_cents > 0 ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-[color:var(--ink)]/60">
                <Gift className="h-3.5 w-3.5" aria-hidden="true" />
                {t("settings.referrals.pending_cleared", {
                  amount: formatHkd(data.ready_cents),
                })}
              </p>
            ) : null}
          </div>

          <p className="flex items-start gap-2.5 rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] px-4 py-3 text-xs leading-5 text-[color:var(--ink)]/65">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t("settings.referrals.note")}</span>
          </p>

          <Link
            to="/how-it-works"
            hash="referral-bounty"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--brand-link)] underline underline-offset-2 hover:opacity-80"
          >
            {t("settings.referrals.rules_link")}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}
    </SettingsCard>
  );
}
