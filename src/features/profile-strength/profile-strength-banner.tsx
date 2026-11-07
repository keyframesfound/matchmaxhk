import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getMyProfileStrength } from "@/features/profile-strength/profile-strength.functions";
import type { NextAction } from "@/features/profile-strength/profile-strength";

const DISMISS_KEY = "mm.profile-strength.dismissed";

function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function nextActionLink(next: NextAction, handle: string | null) {
  const channelEdit = (edit: "availability" | "profile") =>
    handle
      ? ({ to: "/u/$handle", params: { handle }, search: { edit } } as const)
      : ({ to: "/account" } as const);
  switch (next) {
    case "availability":
      return channelEdit("availability");
    case "subjects_rate":
    case "blue_tick":
      return channelEdit("profile");
    case "publish":
      return channelEdit("profile");
    case "post_case":
      return { to: "/tutor-requests", search: { post: true } } as const;
    case "briefing":
      return { to: "/account/cases" } as const;
    case "preferred_times":
      return { to: "/calendar" } as const;
  }
}

/** Non-blocking: one action, dismissible for the session, never a wizard. */
export function ProfileStrengthBanner() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => setDismissed(readDismissed()), []);
  const { data } = useQuery({
    queryKey: ["profile-strength"],
    queryFn: () => getMyProfileStrength(),
    retry: false,
  });
  if (!data || dismissed) return null;
  if (!data.next && data.blueTick !== "in_review") return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Private windows may refuse storage; it stays hidden for this page.
    }
  };

  return (
    <aside className="relative rounded-[var(--radius-panel)] border border-border p-4 pr-11">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm font-semibold text-[color:var(--ink)]">
          {t("profile_strength.title", { pct: data.pct })}
        </p>
        {data.blueTick === "in_review" ? (
          <span className="text-xs font-medium text-muted-foreground">
            {t("profile_strength.blue_tick_in_review")}
          </span>
        ) : null}
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={data.pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("profile_strength.title", { pct: data.pct })}
      >
        <div className="h-full bg-[color:var(--brand-link)]" style={{ width: `${data.pct}%` }} />
      </div>
      {data.next ? (
        <Link
          {...nextActionLink(data.next, data.handle)}
          className="mt-2 inline-block text-sm font-semibold text-[color:var(--brand-link)] hover:underline"
        >
          {t(`profile_strength.cta_${data.next}`)}
        </Link>
      ) : null}
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("profile_strength.dismiss")}
        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:text-[color:var(--ink)]"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </aside>
  );
}
