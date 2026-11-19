import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/useAuth";
import {
  acceptSafetyAttestation,
  getMySafetyAttestation,
} from "@/features/trust/safety-attestation.functions";
import {
  allChecksTicked,
  SAFETY_ATTESTATION_CHECKS,
  type SafetyAttestationCheck,
} from "@/features/trust/safety-attestation";

export const SAFETY_ATTESTATION_QUERY_KEY = ["trust", "safety-attestation"] as const;

// Static locale maps so the i18n guard sees every key.
const TITLE_KEYS: Record<SafetyAttestationCheck, string> = {
  clean_record: "safety_attestation.clean_record_title",
  zero_illegal: "safety_attestation.zero_illegal_title",
  independent_operator: "safety_attestation.independent_operator_title",
};
const BODY_KEYS: Record<SafetyAttestationCheck, string> = {
  clean_record: "safety_attestation.clean_record_body",
  zero_illegal: "safety_attestation.zero_illegal_body",
  independent_operator: "safety_attestation.independent_operator_body",
};

/**
 * #782 §2.1 (was #755): the non-dismissible Safety, Clean Record & Legal
 * Conduct Declaration. Mounted on tutor surfaces (dashboard, case board,
 * storefront upload). Shows only for a signed-in tutor with no current
 * attestation; Cancel leaves the page (the action is cancelled, the gate
 * stays). The server fns enforce the same rule.
 */
export function SafetyAttestationGate() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ticked, setTicked] = useState<Partial<Record<SafetyAttestationCheck, boolean>>>({});

  const status = useQuery({
    queryKey: SAFETY_ATTESTATION_QUERY_KEY,
    queryFn: () => getMySafetyAttestation(),
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  });

  const accept = useMutation({
    mutationFn: () =>
      acceptSafetyAttestation({
        data: {
          version: status.data?.version ?? "",
          clean_record: ticked.clean_record === true,
          zero_illegal: ticked.zero_illegal === true,
          independent_operator: ticked.independent_operator === true,
        },
      }),
    onSuccess: () => {
      toast.success(t("safety_attestation.saved"));
      void queryClient.invalidateQueries({ queryKey: SAFETY_ATTESTATION_QUERY_KEY });
    },
    onError: () => toast.error(t("safety_attestation.error")),
  });

  if (!user || !status.data?.required) return null;
  const ready = allChecksTicked(ticked);

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] max-w-lg overflow-y-auto"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[color:var(--primary)]" aria-hidden />
            {t("safety_attestation.title")}
          </DialogTitle>
          <DialogDescription>{t("safety_attestation.intro")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {SAFETY_ATTESTATION_CHECKS.map((check) => (
            <label
              key={check}
              htmlFor={`attest-${check}`}
              className="flex cursor-pointer gap-3 rounded-lg border border-[color:var(--ink)]/10 p-3"
            >
              <Checkbox
                id={`attest-${check}`}
                className="mt-0.5"
                checked={ticked[check] === true}
                onCheckedChange={(value) =>
                  setTicked((prev) => ({ ...prev, [check]: value === true }))
                }
              />
              <span className="text-sm">
                <span className="block font-semibold">{t(TITLE_KEYS[check])}</span>
                <span className="mt-1 block text-muted-foreground">{t(BODY_KEYS[check])}</span>
              </span>
            </label>
          ))}
          <p className="text-xs text-muted-foreground">{t("safety_attestation.footnote")}</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => void navigate({ to: "/" })}>
            {t("safety_attestation.cancel")}
          </Button>
          <Button
            className="font-bold"
            disabled={!ready || accept.isPending}
            onClick={() => accept.mutate()}
          >
            {accept.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {t("safety_attestation.agree")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Route helper: render the gate above a tutor page without touching it. */
export function withSafetyAttestationGate<P extends object>(Page: ComponentType<P>) {
  function Gated(props: P) {
    return (
      <>
        <SafetyAttestationGate />
        <Page {...props} />
      </>
    );
  }
  Gated.displayName = `WithSafetyAttestation(${Page.displayName ?? Page.name})`;
  return Gated;
}
