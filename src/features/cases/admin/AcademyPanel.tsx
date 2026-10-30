import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ConsolePanel } from "@/components/ui/console-panel";
import { MacroRow } from "@/features/cases/admin/ShortCasePanel";
import { AttendanceForm } from "@/features/academy/attendance-form";
import {
  addCaseCredits,
  getAcademyState,
  setCaseManaged,
  type AcademyState,
} from "@/features/academy/managed.functions";

// #533 (#530 Hybrid): optional MatchMax Managed tier for one case. Off by
// default; pure-matching cases never see credits or the note gate.

const fieldClass = "mt-1 h-9 w-full rounded-xl border border-input bg-transparent px-2 text-sm";
const credits = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

function EnableForm({ caseId, state }: { caseId: string; state: AcademyState }) {
  const queryClient = useQueryClient();
  const [studentName, setStudentName] = useState("");
  const enable = useMutation({
    mutationFn: () =>
      setCaseManaged({
        data: { caseId, managed: true, studentName: studentName.trim() || undefined },
      }),
    onSuccess: () => {
      toast.success("Case is now Managed");
      void queryClient.invalidateQueries({ queryKey: ["admin", "academy", caseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!state.hasTutor) {
    return <p className="mt-2 text-[11px] text-muted-foreground">Match a tutor first.</p>;
  }
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] text-muted-foreground">
        Pure matching (default). Turn on Managed only when the family buys a lesson pack.
      </p>
      <div>
        <Label className="text-[11px] font-medium text-muted-foreground">Student name</Label>
        <input
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          maxLength={80}
          className={fieldClass}
          aria-label="Student name"
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-9 w-full font-semibold"
        disabled={enable.isPending}
        onClick={() => enable.mutate()}
      >
        {enable.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        Turn on Managed
      </Button>
    </div>
  );
}

function ManagedBody({ caseId, state }: { caseId: string; state: AcademyState }) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["admin", "academy", caseId] });
  const [topUp, setTopUp] = useState("10");
  const [marking, setMarking] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () =>
      addCaseCredits({
        data: { caseId, credits: Number(topUp), idempotencyKey: crypto.randomUUID() },
      }),
    onSuccess: (r) => {
      toast.success(`Credits added. Balance ${credits(r.balance)}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const policy = useMutation({
    mutationFn: (lateCancelBillable: boolean) =>
      setCaseManaged({ data: { caseId, managed: true, lateCancelBillable } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const turnOff = useMutation({
    mutationFn: () => setCaseManaged({ data: { caseId, managed: false } }),
    onSuccess: () => {
      toast.success("Back to pure matching. Credits are kept.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Available", state.balance],
          ["Held", state.held],
          ["Used 30d", state.burn30],
        ].map(([label, n]) => (
          <div key={label} className="rounded-xl border border-[color:var(--ink)]/[0.07] px-2 py-2">
            <p className="text-sm font-semibold text-[color:var(--ink)]">{credits(Number(n))}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      {state.studentName ? (
        <p className="text-[11px] text-muted-foreground">Student: {state.studentName}</p>
      ) : null}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-[11px] font-medium text-muted-foreground">Add credits</Label>
          <input
            type="number"
            min={0.5}
            max={200}
            step={0.5}
            value={topUp}
            onChange={(e) => setTopUp(e.target.value)}
            className={fieldClass}
            aria-label="Credits to add"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-9 font-semibold"
          disabled={!(Number(topUp) > 0) || add.isPending}
          onClick={() => add.mutate()}
        >
          Add
        </Button>
      </div>

      <label className="flex items-center gap-2 text-[11px]">
        <input
          type="checkbox"
          checked={state.lateCancelBillable}
          disabled={policy.isPending}
          onChange={(e) => policy.mutate(e.target.checked)}
        />
        Late cancel uses a credit (cancellation policy)
      </label>

      {state.openLessons.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground">Mark attendance</p>
          {state.openLessons.map((l) => (
            <div key={l.id}>
              <button
                type="button"
                className="text-xs font-semibold underline-offset-2 hover:underline"
                onClick={() => setMarking(marking === l.id ? null : l.id)}
              >
                Lesson {l.sequence} · {new Date(l.startsAt).toLocaleString("en-HK")}
              </button>
              {marking === l.id ? (
                <AttendanceForm
                  lessonId={l.id}
                  managed
                  admin
                  onSaved={(r) => {
                    setMarking(null);
                    setSummary(r.summary);
                    invalidate();
                  }}
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {summary ? <MacroRow label="Parent WhatsApp summary" text={summary} /> : null}

      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-full text-[11px] text-muted-foreground"
        disabled={turnOff.isPending}
        onClick={() => turnOff.mutate()}
      >
        Turn off Managed
      </Button>
    </div>
  );
}

export function AcademyPanel({ caseId }: { caseId: string }) {
  const fetchState = useServerFn(getAcademyState);
  const { data: state, isLoading } = useQuery({
    queryKey: ["admin", "academy", caseId],
    queryFn: () => fetchState({ data: { caseId } }),
  });

  return (
    <ConsolePanel>
      <h2 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
        MatchMax Managed
      </h2>
      {isLoading || !state ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </p>
      ) : state.managed ? (
        <ManagedBody caseId={caseId} state={state} />
      ) : (
        <EnableForm caseId={caseId} state={state} />
      )}
    </ConsolePanel>
  );
}
