import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Loader2, Sparkles, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchAutofillApplicationSource,
  generateTutorAutofill,
  type TutorAutofillResult,
} from "./autofill.functions";

interface AutofillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId?: string | null;
  onApply: (result: TutorAutofillResult) => void;
}

export function AutofillDialog({
  open,
  onOpenChange,
  applicationId,
  onApply,
}: AutofillDialogProps) {
  const loadSourceFn = useServerFn(fetchAutofillApplicationSource);
  const generateFn = useServerFn(generateTutorAutofill);

  const [source, setSource] = React.useState("");
  const [result, setResult] = React.useState<TutorAutofillResult | null>(null);

  React.useEffect(() => {
    if (!open) {
      setResult(null);
    }
  }, [open]);

  const loadApplication = useMutation({
    mutationFn: async () => {
      return (await loadSourceFn({
        data: { applicationId: applicationId as string },
      })) as { source: string };
    },
    onSuccess: (data) => {
      setSource(data.source);
      toast.success("Application data loaded into the AI input");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const generate = useMutation({
    mutationFn: async () => {
      return (await generateFn({ data: { source } })) as TutorAutofillResult;
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const apply = () => {
    if (!result) return;
    onApply(result);
    onOpenChange(false);
  };

  const filledSummary = result
    ? [
        result.tutor_code ? "tutor code" : null,
        result.subjects.length > 0 ? `${result.subjects.length} subjects` : null,
        result.exam_results.length > 0 ? `${result.exam_results.length} exam systems` : null,
        result.card_highlights.length > 0 ? `${result.card_highlights.length} card highlights` : null,
        result.qualifications_summary ? "bio" : null,
        result.stations.length > 0 ? `${result.stations.length} stations` : null,
        result.hourly_rate > 0 ? "rate" : null,
      ].filter(Boolean)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[color:var(--ink)]">
            <Sparkles className="h-4.5 w-4.5" />
            AI Autofill
          </DialogTitle>
          <DialogDescription>
            Paste the tutor&apos;s raw information (or load the join application), then generate a
            draft profile in MatchMax house style. Review every field before saving — the AI never
            invents credentials, and nothing is applied without your confirmation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[color:var(--ink)]">
                Source information
              </span>
              {applicationId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px]"
                  disabled={loadApplication.isPending}
                  onClick={() => loadApplication.mutate()}
                >
                  {loadApplication.isPending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <FileText className="mr-1 h-3 w-3" />
                  )}
                  Load application data
                </Button>
              ) : null}
            </div>
            <Textarea
              rows={7}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={`e.g.\nName: Alex Chan\nHKU Medicine Year 2\nIBDP 43/45, Chem HL 7, Bio HL 7\nTeaches IB Chemistry and Biology\nHK$500/hr, online\n5 years experience...`}
              className="text-xs"
            />
          </div>

          {result ? (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3.5 space-y-2">
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                Draft generated — will fill: {filledSummary.join(", ") || "no fields"}
              </p>
              {result.notes.length > 0 ? (
                <ul className="list-inside list-disc space-y-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                  {result.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
              {result.card_highlights.length > 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Highlights: {result.card_highlights.join(" | ")}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              Existing values are overwritten only when the AI provides one.
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              {result ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={apply}
                  className="h-8 text-xs font-bold"
                >
                  Apply to form
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={generate.isPending || source.trim().length < 30}
                  onClick={() => generate.mutate()}
                  className="h-8 text-xs font-bold"
                >
                  {generate.isPending ? (
                    <>
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <WandSparkles className="mr-1.5 h-3 w-3" />
                      Generate draft
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
