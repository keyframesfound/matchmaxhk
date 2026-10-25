import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ShieldBan, X } from "lucide-react";

import { useAuth } from "@/features/auth/useAuth";

/**
 * Issue #308: global banners for restricted accounts.
 *  - Banned: the session was just ended server-side; a persistent notice
 *    explains why sign-in is refused ("This account is suspended. Contact
 *    support." per the issue copy, ban is a suspension of access).
 *  - Suspended: the user keeps their session and sees the reason plus what
 *    is blocked. Dismissible per page view.
 */
export function AccountStatusBanners() {
  const { t } = useTranslation();
  const { accountStatus, suspensionReason } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  // Reset the dismissal whenever the status changes (e.g. re-suspended).
  useEffect(() => {
    setDismissed(false);
  }, [accountStatus]);

  if (accountStatus === "banned") {
    return (
      <div className="fixed inset-x-0 top-0 z-[100] flex items-start justify-center px-4 pt-3">
        <div
          role="alert"
          className="flex w-full max-w-lg items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 backdrop-blur"
        >
          <ShieldBan className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[color:var(--ink)]">
              {t("auth.account_blocked_title")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("auth.account_blocked_message")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (accountStatus === "suspended" && !dismissed) {
    return (
      <div className="sticky top-0 z-40 border-b border-amber-500/30 bg-amber-500/10">
        <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-2.5 sm:px-6">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[color:var(--ink)]">
              {t("account.suspended_banner_title")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("account.suspended_banner_body")}
            </p>
            {suspensionReason ? (
              <p className="mt-0.5 text-xs font-medium text-[color:var(--ink)]">
                {t("account.suspended_reason_label", { reason: suspensionReason })}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={t("account.suspended_dismiss")}
            onClick={() => setDismissed(true)}
            className="rounded p-1 text-muted-foreground hover:text-[color:var(--ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
