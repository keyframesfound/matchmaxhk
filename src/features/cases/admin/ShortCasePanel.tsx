import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import {
  BadgePercent,
  Check,
  Copy,
  Loader2,
  MessageSquareQuote,
  Repeat1,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ConsolePanel } from "@/components/ui/console-panel";
import {
  convertShortCaseToStandard,
  getShortCaseState,
  invoiceShortCaseFee,
  setShortCase,
} from "@/features/cases/short-case.functions";
import {
  SHORT_CASE_CONFIRMED_BY_OPTIONS,
  SHORT_CASE_HOURS_OPTIONS,
  shortCaseFeeAmount,
  type ShortCaseConfirmedBy,
} from "@/features/cases/short-case";

/**
 * Issue #443 — Short-Case Handling (≤5 lessons, 20% package fee).
 *
 * The fee-math toggle for the admin case view: turn the case short, capture
 * the REQUIRED payer confirmation (parent WA B2C / org WA B2B / CS note +
 * pasted text), see the 20% package fee with the inputs used, invoice it via
 * the case_fees machinery, and convert back to the standard 1.5-lesson rule
 * with a never-over-invoiced balance. The four desk macros render as
 * copy-to-clipboard snippets with the exact approved strings.
 */

const CONFIRMED_BY_LABEL: Record<ShortCaseConfirmedBy, string> = {
  parent_wa: "Parent WhatsApp (B2C)",
  org_wa: "Org WhatsApp (B2B)",
  cs_note: "CS note",
};

// Desk macros — EXACT strings locked in issue #443. Never reword.
const DESK_MACROS: Array<{ id: string; label: string; text: string }> = [
  {
    id: "parent_en",
    label: "Parent B2C · EN",
    text: "Just to lock the fee clearly 💙 — if this is a short package of ≤5 lessons, MatchMax's platform fee is 20% of the package (tutor-side), not the usual 1.5-lesson fee. Reply YES if that's the plan (how many lessons + hours each)?",
  },
  {
    id: "parent_zh",
    label: "家長 B2C · 繁中",
    text: "想同你確認收費 💙 — 如果係 ≤5 堂短計劃，MatchMax 平台費係計劃總額嘅 20%（導師付），唔係一般一堂半。回覆 YES 確認（幾多堂 + 每堂幾耐）？",
  },
  {
    id: "org_en",
    label: "Org B2B · EN",
    text: "For this overflow case — confirm it's a fixed ≤5-lesson engagement? We'll mark it Short Case (tutor pays 20% of package). Your end-parent details stay with you.",
  },
  {
    id: "org_zh",
    label: "機構 B2B · 繁中",
    text: "呢單 overflow — 確認係 固定 ≤5 堂 嗎？我會標 Short Case（導師付計劃 20%）。家長資料繼續只喺你哋度。",
  },
];

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API can be unavailable — fall back to a transient textarea.
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

function MacroRow({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-[color:var(--ink)]/[0.07] bg-[color:var(--surface-subtle)]/40 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-muted-foreground">{label}</p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[11px] font-bold text-muted-foreground hover:text-[color:var(--ink)]"
          onClick={async () => {
            const ok = await copyText(text);
            if (ok) {
              setCopied(true);
              toast.success(`${label} copied`);
              setTimeout(() => setCopied(false), 2000);
            } else {
              toast.error("Copy failed — select the text manually");
            }
          }}
        >
          {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-[color:var(--ink)]/80">
        {text}
      </p>
    </div>
  );
}

function hkd(n: number): string {
  return `HK$${Number(n).toFixed(0)}`;
}

export function ShortCasePanel({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const ensureFn = useServerFn(getShortCaseState);
  const [count, setCount] = useState("");
  const [hours, setHours] = useState("");
  const [confirmedBy, setConfirmedBy] = useState<ShortCaseConfirmedBy | "">("");
  const [confirmedNote, setConfirmedNote] = useState("");
  const [confirmConvert, setConfirmConvert] = useState(false);

  const { data: state, isLoading } = useQuery({
    queryKey: ["admin", "short-case", caseId],
    queryFn: () => ensureFn({ data: { caseId } }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "short-case", caseId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "cases"] });
  };

  const setError = (e: Error) => toast.error(e.message);

  const setMutation = useMutation({
    mutationFn: (input: { isShortCase: boolean }) =>
      setShortCase({
        data: {
          caseId,
          isShortCase: input.isShortCase,
          scheduledLessonCount: input.isShortCase ? Number(count) : null,
          hoursPerLesson: input.isShortCase ? Number(hours) : null,
          confirmedBy: input.isShortCase ? confirmedBy : null,
          confirmedNote: input.isShortCase ? confirmedNote.trim() : null,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        res.shortCaseFee !== null
          ? `Short case saved — fee snapshot ${hkd(res.shortCaseFee)}`
          : "Short case turned off",
      );
      setConfirmedNote("");
      setConfirmConvert(false);
      invalidate();
    },
    onError: setError,
  });

  const invoiceMutation = useMutation({
    mutationFn: () => invoiceShortCaseFee({ data: { caseId } }),
    onSuccess: (res) => {
      toast.success(`Short-case fee invoiced — ${hkd(res.amountHkd ?? 0)}`);
      invalidate();
    },
    onError: setError,
  });

  const convertMutation = useMutation({
    mutationFn: () => convertShortCaseToStandard({ data: { caseId } }),
    onSuccess: (res) => {
      toast.success(
        res.invoicedBalance
          ? `Converted to standard — balance invoice ${hkd(res.balanceHkd)} created`
          : "Converted to standard — no balance due",
      );
      setConfirmConvert(false);
      invalidate();
    },
    onError: setError,
  });

  // Live preview of the 20% fee from the inputs the admin is about to lock.
  const previewFee = useMemo(() => {
    if (!state?.hourlyRateHkd) return null;
    const n = Number(count);
    const h = Number(hours);
    if (!Number.isInteger(n) || n < 1 || n > 5 || ![1, 1.5, 2].includes(h)) return null;
    return shortCaseFeeAmount({
      rateHkd: state.hourlyRateHkd,
      hoursPerLesson: h,
      scheduledLessonCount: n,
      packageType: state.packageType,
    });
  }, [state?.hourlyRateHkd, state?.packageType, count, hours]);

  const canEnable =
    !state?.isShortCase &&
    !setMutation.isPending &&
    count !== "" &&
    hours !== "" &&
    confirmedBy !== "" &&
    confirmedNote.trim().length >= 10 &&
    !state?.cohortBlocked &&
    state?.packageType !== "pro_bono" &&
    state?.hourlyRateHkd != null;

  return (
    <ConsolePanel>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <BadgePercent className="h-3.5 w-3.5" aria-hidden="true" />
          Short case — 20% package fee
        </h2>
        {state?.isShortCase ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
            Active
          </span>
        ) : null}
      </div>

      {isLoading || !state ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </p>
      ) : state.cohortBlocked ? (
        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-[#a16207] dark:text-amber-400">
          Study-group / cohort case — the short-case flag must NOT apply. Group cases stay on the
          1.5-lesson admin fee.
        </p>
      ) : state.packageType === "pro_bono" ? (
        <p className="mt-3 rounded-xl border border-[color:var(--ink)]/[0.07] bg-[color:var(--surface-subtle)]/40 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          Pro-bono case — the $0 fee wins over the short 20%. Nothing to configure.
        </p>
      ) : !state.isShortCase ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] font-medium text-muted-foreground">Lessons (1–5)</Label>
              <select
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="mt-1 h-9 w-full rounded-xl border border-input bg-transparent px-2 text-sm"
                aria-label="Scheduled lesson count"
              >
                <option value="">Select…</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[11px] font-medium text-muted-foreground">
                Hours / lesson
              </Label>
              <select
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="mt-1 h-9 w-full rounded-xl border border-input bg-transparent px-2 text-sm"
                aria-label="Hours per lesson"
              >
                <option value="">Select…</option>
                {SHORT_CASE_HOURS_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h}h
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label className="text-[11px] font-medium text-muted-foreground">
              Fee confirmed by
            </Label>
            <select
              value={confirmedBy}
              onChange={(e) => setConfirmedBy(e.target.value as ShortCaseConfirmedBy)}
              className="mt-1 h-9 w-full rounded-xl border border-input bg-transparent px-2 text-sm"
              aria-label="Fee confirmation source"
            >
              <option value="">Select…</option>
              {SHORT_CASE_CONFIRMED_BY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {CONFIRMED_BY_LABEL[opt]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-[11px] font-medium text-muted-foreground">
              Pasted confirmation (required)
            </Label>
            <textarea
              rows={3}
              maxLength={2000}
              value={confirmedNote}
              onChange={(e) => setConfirmedNote(e.target.value)}
              placeholder="Paste the payer's YES reply (WhatsApp text or CS note)…"
              className="mt-1 w-full rounded-xl border border-input bg-transparent p-2.5 text-sm"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Stored as an internal case note; saved with the confirmation source and timestamp.
            </p>
          </div>

          <div className="rounded-xl border border-[color:var(--ink)]/[0.07] bg-[color:var(--surface-subtle)]/40 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-[color:var(--ink)]">
              {previewFee !== null
                ? `Fee snapshot: ${hkd(previewFee)} — 20% of package`
                : "Fee snapshot: pick lessons + hours to preview"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {state.hourlyRateHkd != null
                ? `${hkd(state.hourlyRateHkd)}/hr × hours × lessons`
                : "No agreed rate on the case yet — lock a rate first."}
            </p>
          </div>

          <Button
            size="sm"
            className="h-9 w-full font-bold"
            disabled={!canEnable}
            onClick={() => setMutation.mutate({ isShortCase: true })}
          >
            {setMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Mark as short case (20% package fee)
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-[color:var(--ink)]/[0.07] bg-[color:var(--surface-subtle)]/40 px-3.5 py-3">
            <p className="text-sm font-bold text-[color:var(--ink)]">
              Short case – 20% package fee ·{" "}
              {state.shortCaseFee !== null ? hkd(state.shortCaseFee) : "—"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {state.hourlyRateHkd != null &&
              state.hoursPerLesson !== null &&
              state.scheduledLessonCount !== null
                ? `${hkd(state.hourlyRateHkd)}/hr × ${state.hoursPerLesson}h × ${state.scheduledLessonCount} lessons`
                : "Inputs incomplete"}
              {" · package "}
              {state.hourlyRateHkd != null &&
              state.hoursPerLesson !== null &&
              state.scheduledLessonCount !== null
                ? hkd(state.hourlyRateHkd * state.hoursPerLesson * state.scheduledLessonCount)
                : "—"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {state.confirmedBy
                ? `Confirmed via ${CONFIRMED_BY_LABEL[state.confirmedBy as ShortCaseConfirmedBy]}${state.confirmedAt ? ` · ${format(new Date(state.confirmedAt), "d MMM yyyy")}` : ""}`
                : "No confirmation on file"}
            </p>
          </div>

          <div className="rounded-xl border border-[color:var(--ink)]/[0.07] px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-[color:var(--ink)]">
              <Wallet className="h-3.5 w-3.5" aria-hidden="true" /> Invoice the 20% fee
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {state.invoiceReady
                ? "Lesson 1 confirmed — ready to invoice (immediate for single-lesson packages)."
                : "Fires after Lesson 1 is confirmed by both sides — or straight away when the package is 1 lesson. The 1.5-lesson / Lesson-2 trigger does NOT apply while short."}
            </p>
            {state.openFee ? (
              <p className="mt-1.5 text-[11px] font-semibold text-[#a16207] dark:text-amber-400">
                Open fee row exists ({state.openFee.status} · {hkd(state.openFee.amountHkd)}) —
                resolve it first.
              </p>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-8 w-full text-xs font-bold"
              disabled={!state.invoiceReady || state.openFee !== null || invoiceMutation.isPending}
              onClick={() => invoiceMutation.mutate()}
            >
              {invoiceMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Invoice short-case fee
            </Button>
          </div>

          <div className="rounded-xl border border-[color:var(--ink)]/[0.07] px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-[color:var(--ink)]">
              <Repeat1 className="h-3.5 w-3.5" aria-hidden="true" /> Convert to Standard Case
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Standard 1.5-lesson admin fee{" "}
              {state.standardFeeHkd !== null ? hkd(state.standardFeeHkd) : "—"} · already billed{" "}
              {hkd(state.invoicedTotalHkd)} ·{" "}
              {state.convertBalanceHkd === 0 ? (
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  No balance due
                </span>
              ) : (
                <>
                  balance{" "}
                  <span className="font-bold text-[color:var(--ink)]">
                    {state.convertBalanceHkd !== null ? hkd(state.convertBalanceHkd) : "—"}
                  </span>
                  {state.convertBalanceHkd !== null && state.convertBalanceHkd > 0
                    ? " (invoice created on convert)"
                    : ""}
                </>
              )}
            </p>
            {confirmConvert ? (
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 flex-1 text-xs font-bold"
                  disabled={convertMutation.isPending}
                  onClick={() => convertMutation.mutate()}
                >
                  {convertMutation.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Confirm convert
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => setConfirmConvert(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-8 w-full text-xs font-bold"
                disabled={convertMutation.isPending}
                onClick={() => setConfirmConvert(true)}
              >
                Convert to Standard Case
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Desk macros — copy-to-clipboard confirm scripts (exact locked strings). */}
      <div className="mt-4 border-t border-[color:var(--ink)]/[0.07] pt-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden="true" /> Confirm scripts
        </p>
        <div className="mt-2 space-y-2">
          {DESK_MACROS.map((m) => (
            <MacroRow key={m.id} label={m.label} text={m.text} />
          ))}
        </div>
      </div>
    </ConsolePanel>
  );
}
