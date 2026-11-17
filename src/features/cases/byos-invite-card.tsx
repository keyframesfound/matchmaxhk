import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Loader2, MessageCircle, UserPlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createByosInvite,
  listMyByosInvites,
  revokeByosInvite,
  type ByosInviteRow,
} from "@/features/cases/byos.functions";
import { validateByosInvite, type ByosInputProblem } from "@/features/cases/byos";

const QUERY_KEY = ["byos", "my-invites"] as const;

// Static locale maps so the i18n guard sees every key.
const PROBLEM_KEYS: Record<ByosInputProblem, string> = {
  label: "byos.error_label",
  subject: "byos.error_subject",
  level: "byos.error_level",
  rate: "byos.error_rate",
  mode: "byos.error_mode",
};
const STATUS_KEYS: Record<ByosInviteRow["status"], string> = {
  active: "byos.status_active",
  claimed: "byos.status_claimed",
  revoked: "byos.status_revoked",
};

function errorMessage(t: (key: string) => string, error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (code === "ACTIVE_INVITE_EXISTS") return t("byos.error_active_exists");
  if (code === "NOT_A_TUTOR") return t("byos.error_not_tutor");
  return t("byos.error_generic");
}

/**
 * #783 §2.4: Bring Your Own Student. A tutor creates a one-time invite link
 * for an EXISTING off-platform student; the claimed case carries a HK$0
 * admin fee. Hidden for accounts without a tutor card.
 */
export function ByosInviteCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [rate, setRate] = useState("");
  const [mode, setMode] = useState("");
  const [link, setLink] = useState<string | null>(null);

  const invitesQuery = useQuery({ queryKey: QUERY_KEY, queryFn: () => listMyByosInvites() });

  const input = {
    inviteeLabel: label,
    subject,
    level,
    hourlyRateHkd: Number(rate),
    lessonMode: mode,
  };
  const problem = validateByosInvite(input);

  const createMutation = useMutation({
    mutationFn: () => createByosInvite({ data: input }),
    onSuccess: (result) => {
      setLink(`${window.location.origin}${result.path}`);
      setLabel("");
      setSubject("");
      setLevel("");
      setRate("");
      setMode("");
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error) => toast.error(errorMessage(t, error)),
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => revokeByosInvite({ data: { inviteId } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (error) => toast.error(errorMessage(t, error)),
  });

  if (!invitesQuery.data?.isTutor) return null;
  const invites = invitesQuery.data.invites;

  return (
    <section className="mb-8 rounded-2xl border border-[color:var(--ink)]/10 p-5">
      <div className="flex items-start gap-3">
        <UserPlus className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--primary)]" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--ink)]">{t("byos.card_title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("byos.card_body")}</p>
          <p className="mt-2 text-xs text-muted-foreground">{t("byos.card_rule")}</p>
        </div>
      </div>

      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!problem) createMutation.mutate();
        }}
      >
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="byos-label">{t("byos.field_label")}</Label>
          <Input
            id="byos-label"
            value={label}
            maxLength={60}
            onChange={(event) => setLabel(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t("byos.field_label_hint")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="byos-subject">{t("byos.field_subject")}</Label>
          <Input
            id="byos-subject"
            value={subject}
            maxLength={80}
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="byos-level">{t("byos.field_level")}</Label>
          <Input
            id="byos-level"
            value={level}
            maxLength={80}
            onChange={(event) => setLevel(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="byos-rate">{t("byos.field_rate")}</Label>
          <Input
            id="byos-rate"
            type="number"
            inputMode="decimal"
            min={1}
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
        </div>
        <fieldset className="space-y-1.5 sm:col-span-2">
          <legend className="text-sm font-medium">{t("byos.field_mode")}</legend>
          <div className="flex gap-2">
            {(["online", "f2f"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={mode === value ? "default" : "outline"}
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                {value === "online" ? t("byos.mode_online") : t("byos.mode_f2f")}
              </Button>
            ))}
          </div>
        </fieldset>
        <div className="flex items-end">
          <Button
            type="submit"
            className="w-full font-bold"
            disabled={Boolean(problem) || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Link2 className="mr-2 h-4 w-4" aria-hidden />
            )}
            {t("byos.create")}
          </Button>
        </div>
        {problem && (label || subject || rate) ? (
          <p className="text-xs text-amber-700 sm:col-span-2">{t(PROBLEM_KEYS[problem])}</p>
        ) : null}
      </form>

      {link ? (
        <div className="mt-4 space-y-2 rounded-xl bg-[color:var(--ink)]/[0.04] p-3">
          <p className="text-xs font-medium">{t("byos.link_ready")}</p>
          <p className="break-all font-mono text-xs">{link}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard
                  .writeText(link)
                  .then(() => toast.success(t("byos.copied")))
                  .catch(() => toast.error(t("byos.error_generic")));
              }}
            >
              <Copy className="mr-2 h-4 w-4" aria-hidden />
              {t("byos.copy")}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${t("byos.whatsapp_text")} ${link}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="mr-2 h-4 w-4" aria-hidden />
                {t("byos.share_whatsapp")}
              </a>
            </Button>
          </div>
        </div>
      ) : null}

      {invites.length > 0 ? (
        <ul className="mt-4 divide-y divide-[color:var(--ink)]/10 text-sm">
          {invites.map((invite) => (
            <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{invite.invitee_label}</p>
                <p className="text-xs text-muted-foreground">
                  {invite.subject}
                  {invite.level ? ` · ${invite.level}` : ""} · HK$
                  {Number(invite.hourly_rate_hkd).toFixed(0)}/h · {t(STATUS_KEYS[invite.status])}
                </p>
              </div>
              {invite.status === "active" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate(invite.id)}
                >
                  {t("byos.revoke")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
