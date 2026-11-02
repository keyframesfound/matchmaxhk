import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Copy, Loader2, RefreshCcw, Send } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConsolePanel } from "@/components/ui/console-panel";
import { Input } from "@/components/ui/input";
import {
  COCKPIT_MACROS,
  DECLINE_REASONS,
  GROUP_SIZES,
  PARALLEL_PING_MAX,
  WAVE_MAX,
  canSendBoth,
  cockpitFeeQuote,
  fillMacro,
  fpsMacroVars,
  marketVerdict,
  type GroupSize,
  type MacroVars,
} from "@/features/cases/cockpit";
import {
  getCockpit,
  logTutorDecline,
  setFastPins,
  updateCockpitFields,
  type CockpitCase,
} from "@/features/cases/cockpit.functions";
import { createRematchCase } from "@/features/cases/rematch.functions";
import { copyTextToClipboard } from "@/features/cases/quick-replies";

async function copyOrToast(text: string, okMsg: string, failMsg: string) {
  if (await copyTextToClipboard(text)) toast.success(okMsg);
  else toast.error(failMsg);
}

function baseVars(caseId: string, c: CockpitCase): MacroVars {
  const quote = cockpitFeeQuote(c);
  const l1 = c.firstLessonAt ? format(new Date(c.firstLessonAt), "d MMM HH:mm") : undefined;
  return {
    case_id: c.caseCode,
    rate: c.rateHkd ? String(c.rateHkd) : c.budgetMaxHkd ? String(c.budgetMaxHkd) : undefined,
    fee: quote.ok ? String(quote.amountHkd) : undefined,
    status: c.status,
    status_url:
      typeof window === "undefined"
        ? undefined
        : `${window.location.origin}/account/cases/${caseId}`,
    l1_time: l1,
    market_min: c.marketMinHkd ? String(c.marketMinHkd) : undefined,
    market_max: c.marketMaxHkd ? String(c.marketMaxHkd) : undefined,
    group_size: c.groupSize === "GROUP_2_3" ? "2–3人小組" : "一對一",
    slots: l1,
  };
}

/**
 * #454 Brain-Dead Matching Cockpit: fee + FPS display (#443 formulas),
 * market band → ratecheck, net-new macro bar (insert-only), fast-tutor pins
 * with Parallel Ping (max 2), decline reasons and the Failed-Trial Pivot.
 * Macro copy for #451 stays in the quick-replies block above.
 */
export function DeskCockpitPanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ["desk", "cockpit", caseId];
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => getCockpit({ data: { caseId } }),
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [pinDraft, setPinDraft] = useState<string | null>(null);
  const [band, setBand] = useState<{ min: string; max: string } | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey });
  const copyFailed = t("desk.quick.copy_failed");

  const saveFields = useMutation({
    mutationFn: (input: { groupSize: GroupSize; min: number | null; max: number | null }) =>
      updateCockpitFields({
        data: {
          caseId,
          groupSize: input.groupSize,
          marketMinHkd: input.min,
          marketMaxHkd: input.max,
        },
      }),
    onSuccess: () => {
      setBand(null);
      void invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const savePins = useMutation({
    mutationFn: (input: { subject: string; codes: string[] }) =>
      setFastPins({ data: { subject: input.subject, tutorCodes: input.codes } }),
    onSuccess: (res) => {
      setPinDraft(null);
      if (res.unknownCodes.length > 0) {
        toast.error(t("cockpit.pins_unknown", { codes: res.unknownCodes.join(", ") }));
      }
      void invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const decline = useMutation({
    mutationFn: (input: { tutorId: string; reason: (typeof DECLINE_REASONS)[number] }) =>
      logTutorDecline({ data: { caseId, ...input } }),
    onSuccess: () => {
      toast.success(t("cockpit.decline_logged"));
      void invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const pivot = useMutation({
    mutationFn: () => createRematchCase({ data: { failedCaseId: caseId } }),
    onSuccess: (res) => {
      const next = res.nextTutors.map((n) => `${n.display_name} (${n.tutor_code})`).join(", ");
      toast.success(t("cockpit.pivot_done", { code: res.caseCode, next: next || "—" }));
    },
    onError: (e) => toast.error(e.message),
  });

  if (isError) return null;
  if (isLoading || !data?.caseRow) {
    return (
      <ConsolePanel title={t("cockpit.title")}>
        <Loader2 className="m-4 h-4 w-4 animate-spin" aria-hidden />
      </ConsolePanel>
    );
  }

  const c = data.caseRow;
  const quote = cockpitFeeQuote(c);
  const vars = baseVars(caseId, c);
  const verdict = marketVerdict(c.budgetMaxHkd ?? c.rateHkd, c.marketMinHkd);
  const declinedIds = new Set(data.declines.map((d) => d.tutorId));
  const wavesLeft = Math.max(0, WAVE_MAX - data.declines.length);

  const toggle = (id: string) =>
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= PARALLEL_PING_MAX) {
        toast.error(t("cockpit.max_two"));
        return prev;
      }
      return [...prev, id];
    });

  const sendBoth = () => {
    const dispatch = COCKPIT_MACROS.find((m) => m.key === "dispatch");
    if (!dispatch || !canSendBoth(selected.length)) return;
    const lines = data.pins
      .filter((p) => selected.includes(p.id))
      .map((p) => fillMacro(dispatch.text, { ...vars, tutor: p.name }));
    void copyOrToast(lines.join("\n\n"), t("cockpit.dispatch_copied"), copyFailed);
  };

  const bandMin = band?.min ?? (c.marketMinHkd ? String(c.marketMinHkd) : "");
  const bandMax = band?.max ?? (c.marketMaxHkd ? String(c.marketMaxHkd) : "");
  const toInt = (v: string) => (v.trim() && Number(v) > 0 ? Math.round(Number(v)) : null);

  return (
    <ConsolePanel title={t("cockpit.title")}>
      <div className="space-y-5 text-sm">
        <section className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">{t("cockpit.fee_title")}</p>
          {quote.ok ? (
            <p>
              {t(quote.mode === "short" ? "cockpit.fee_short" : "cockpit.fee_standard", {
                amount: quote.amountHkd,
              })}
            </p>
          ) : (
            <p className="text-amber-700">
              {t(
                quote.reason === "RATE_MISSING"
                  ? "cockpit.fee_rate_missing"
                  : "cockpit.fee_short_missing",
              )}
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={!quote.ok}
            onClick={() => {
              const fps = COCKPIT_MACROS.find((m) => m.key === "fps");
              if (!fps) return;
              void copyOrToast(
                fillMacro(fps.text, fpsMacroVars(c.caseCode, quote)),
                t("cockpit.copied"),
                copyFailed,
              );
            }}
          >
            <Copy className="mr-1 h-3 w-3" aria-hidden /> {t("cockpit.copy_fps")}
          </Button>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">{t("cockpit.case_title")}</p>
          <div className="flex flex-wrap gap-2">
            {GROUP_SIZES.map((g) => (
              <Button
                key={g}
                size="sm"
                variant={c.groupSize === g ? "default" : "outline"}
                disabled={saveFields.isPending}
                onClick={() =>
                  saveFields.mutate({ groupSize: g, min: c.marketMinHkd, max: c.marketMaxHkd })
                }
              >
                {t(g === "GROUP_2_3" ? "cockpit.group_group" : "cockpit.group_one")}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("cockpit.market_band")}</span>
            <Input
              className="h-8 w-24"
              inputMode="numeric"
              aria-label={t("cockpit.market_min")}
              placeholder={t("cockpit.market_min")}
              value={bandMin}
              onChange={(e) => setBand({ min: e.target.value, max: bandMax })}
            />
            <Input
              className="h-8 w-24"
              inputMode="numeric"
              aria-label={t("cockpit.market_max")}
              placeholder={t("cockpit.market_max")}
              value={bandMax}
              onChange={(e) => setBand({ min: bandMin, max: e.target.value })}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={band === null || saveFields.isPending}
              onClick={() =>
                saveFields.mutate({
                  groupSize: c.groupSize as GroupSize,
                  min: toInt(bandMin),
                  max: toInt(bandMax),
                })
              }
            >
              {t("cockpit.save")}
            </Button>
          </div>
          {verdict === "low" && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {t("cockpit.market_low")}
            </p>
          )}
        </section>

        <section className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">{t("cockpit.macros_title")}</p>
          <div className="flex flex-wrap gap-1.5">
            {COCKPIT_MACROS.map((m) => (
              <Button
                key={m.key}
                size="sm"
                variant={m.key === "ratecheck" && verdict === "low" ? "default" : "outline"}
                className="h-7 px-2 font-mono text-xs"
                onClick={() =>
                  void copyOrToast(
                    fillMacro(
                      m.text,
                      m.key === "fps" ? { ...vars, ...fpsMacroVars(c.caseCode, quote) } : vars,
                    ),
                    t("cockpit.copied"),
                    copyFailed,
                  )
                }
              >
                {m.label}
              </Button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">
              {t("cockpit.pins_title", { subject: data.subject ?? "-" })}
            </p>
            <span className="text-xs text-muted-foreground">
              {t("cockpit.waves_left", { n: wavesLeft, max: WAVE_MAX })}
            </span>
          </div>
          {data.pins.length === 0 && (
            <p className="text-xs text-muted-foreground">{t("cockpit.pins_empty")}</p>
          )}
          <ul className="space-y-1.5">
            {data.pins.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-2.5 py-1.5"
              >
                <label className="flex flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <span>
                    {p.name} <span className="text-muted-foreground">({p.code})</span>
                  </span>
                  {declinedIds.has(p.id) && (
                    <span className="text-xs text-muted-foreground">{t("cockpit.declined")}</span>
                  )}
                </label>
                {DECLINE_REASONS.map((r) => (
                  <Button
                    key={r}
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5 text-xs"
                    disabled={decline.isPending}
                    onClick={() => decline.mutate({ tutorId: p.id, reason: r })}
                  >
                    {t(
                      r === "SCHEDULE"
                        ? "cockpit.decline_schedule"
                        : r === "RATE"
                          ? "cockpit.decline_rate"
                          : "cockpit.decline_other",
                    )}
                  </Button>
                ))}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!canSendBoth(selected.length)} onClick={sendBoth}>
              <Send className="mr-1 h-3 w-3" aria-hidden /> {t("cockpit.send_both")}
            </Button>
            {data.subject && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPinDraft(data.pins.map((p) => p.code).join(", "))}
              >
                {t("cockpit.edit_pins")}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={pivot.isPending}
              onClick={() => pivot.mutate()}
            >
              <RefreshCcw className="mr-1 h-3 w-3" aria-hidden /> {t("cockpit.pivot")}
            </Button>
          </div>
          {pinDraft !== null && data.subject && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="h-8 flex-1"
                value={pinDraft}
                aria-label={t("cockpit.edit_pins")}
                placeholder="T-0001, T-0002"
                onChange={(e) => setPinDraft(e.target.value)}
              />
              <Button
                size="sm"
                disabled={savePins.isPending}
                onClick={() =>
                  savePins.mutate({
                    subject: data.subject as string,
                    codes: pinDraft
                      .split(/[\s,]+/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              >
                {t("cockpit.save")}
              </Button>
            </div>
          )}
        </section>
      </div>
    </ConsolePanel>
  );
}
