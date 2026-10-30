import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Puzzle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ConsolePanel } from "@/components/ui/console-panel";
import {
  FIT_TAG_KEYS,
  FIT_TAG_OPTIONS,
  type FitTagKey,
  type FitTags,
} from "@/features/cases/fit-tags";
import {
  getCaseFit,
  saveCaseFitTags,
  type CaseFitState,
} from "@/features/cases/fit-tags.functions";

// #528 Phase A: optional soft tags, desk-entered from the parent's WhatsApp.
const TAG_LABEL: Record<FitTagKey, string> = {
  teachingStyle: "Teaching style",
  materialsPolicy: "Materials",
  vibe: "Vibe",
  homework: "Homework",
};
const VALUE_LABEL: Record<string, string> = {
  "": "Not set",
  EXAM_DRILLING: "Exam drilling",
  CONCEPT_PATIENCE: "Concept patience",
  HOMEWORK_COACHING: "Homework coaching",
  PROVIDES_OWN_NOTES: "Tutor's own notes",
  USES_SCHOOL_MATERIALS: "School materials",
  STRICT_DISCIPLINED: "Strict, disciplined",
  WARM_ENCOURAGING: "Warm, encouraging",
  WEEKLY_EXTRA_HOMEWORK: "Weekly extra homework",
  IN_CLASS_ONLY: "In class only",
};

const fieldClass = "mt-1 h-9 w-full rounded-xl border border-input bg-transparent px-2 text-sm";

function HintLine({ state }: { state: CaseFitState }) {
  if (!state.tutor || !state.hint) {
    return <p className="text-[11px] text-muted-foreground">No matched tutor yet.</p>;
  }
  if (state.hint.hardBlock) {
    return (
      <p className="text-[11px] font-semibold text-[color:var(--destructive)]">
        Materials mismatch: parent and tutor both set different materials. Rematch suggested.
      </p>
    );
  }
  if (state.hint.compared === 0) {
    return <p className="text-[11px] text-muted-foreground">No shared tags to compare yet.</p>;
  }
  const names = (keys: FitTagKey[]) => keys.map((k) => TAG_LABEL[k].toLowerCase()).join(", ");
  return (
    <p className="text-[11px] text-muted-foreground">
      {state.hint.matches.length > 0 ? `Matches on ${names(state.hint.matches)}. ` : ""}
      {state.hint.mismatches.length > 0 ? `Differs on ${names(state.hint.mismatches)}.` : ""}
    </p>
  );
}

function SignalsLine({ state }: { state: CaseFitState }) {
  if (!state.signals) return null;
  const minutes = state.signals.matchToL1BookedMinutes;
  const latency =
    minutes === null
      ? "Lesson 1 not booked yet"
      : minutes < 60
        ? `Lesson 1 booked ${minutes} min after match`
        : `Lesson 1 booked ${Math.round(minutes / 60)} h after match`;
  return (
    <p className="text-[11px] text-muted-foreground">
      {latency} · {state.signals.l1RescheduleCount} Lesson 1 reschedule
      {state.signals.l1RescheduleCount === 1 ? "" : "s"}
    </p>
  );
}

function TagsForm({ caseId, state }: { caseId: string; state: CaseFitState }) {
  const queryClient = useQueryClient();
  const save = useServerFn(saveCaseFitTags);
  const [tags, setTags] = useState<FitTags>(state.parent);
  const mutation = useMutation({
    mutationFn: () => save({ data: { caseId, tags } }),
    onSuccess: () => {
      toast.success("Fit tags saved");
      void queryClient.invalidateQueries({ queryKey: ["admin", "case-fit", caseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {FIT_TAG_KEYS.map((key) => (
          <div key={key}>
            <Label className="text-[11px] font-medium text-muted-foreground">
              {TAG_LABEL[key]}
            </Label>
            <select
              value={tags[key] ?? ""}
              onChange={(e) =>
                setTags((prev) => ({ ...prev, [key]: e.target.value || null }) as FitTags)
              }
              className={fieldClass}
              aria-label={`Parent ${TAG_LABEL[key]}`}
            >
              {["", ...FIT_TAG_OPTIONS[key]].map((v) => (
                <option key={v} value={v}>
                  {VALUE_LABEL[v]}
                  {state.tutor && v !== "" && state.tutor[key] === v ? " (tutor)" : ""}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-9 w-full font-semibold"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        Save parent tags
      </Button>
    </div>
  );
}

export function CaseFitPanel({ caseId }: { caseId: string }) {
  const fetchFit = useServerFn(getCaseFit);
  const { data: state, isLoading } = useQuery({
    queryKey: ["admin", "case-fit", caseId],
    queryFn: () => fetchFit({ data: { caseId } }),
  });

  return (
    <ConsolePanel>
      <h2 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Puzzle className="h-3.5 w-3.5" aria-hidden="true" />
        Fit (optional parent tags)
      </h2>
      {isLoading || !state ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </p>
      ) : (
        <div className="mt-2 space-y-1">
          <HintLine state={state} />
          <SignalsLine state={state} />
          <TagsForm key={JSON.stringify(state.parent)} caseId={caseId} state={state} />
        </div>
      )}
    </ConsolePanel>
  );
}
