import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AlertCircle, Building2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { GoogleGIcon } from "@/components/brand/GoogleGIcon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createOrganization } from "@/features/business/business.functions";
import { HK_DISTRICTS } from "@/features/tutors/queries";
import { FEE_TERMS_VERSION } from "@/features/legal/terms";
import { useAuth } from "@/features/auth/useAuth";
import { useGateOverlayPending } from "@/features/auth/gate-overlay";
import { useFormDraft } from "@/lib/use-form-draft";
import {
  clearPendingSubmission,
  readPendingSubmission,
  startPendingSubmission,
  stripPendingCompleteParam,
} from "@/lib/pending-submit";

export const Route = createFileRoute("/business/join")({
  // #759 P0: the Join chooser's Organisation option linked here while this
  // route 404'd under the global centre-market flag — an empty 404. The
  // 60-second organisation application (#412/#577) is safe to expose on its
  // own; the full centre shop / vacancy / payout surfaces stay parked behind
  // CENTRE_MARKET_ENABLED (courses.index, pricing, saved-posts keep gates).
  beforeLoad: () => {},
  validateSearch: z.object({
    plan: z.string().optional(),
    // #759 Part 1: the end-of-flow Google OAuth callback lands back here so
    // a guest's centre application auto-commits after sign-in. The marker
    // rides as "1" (urlWithPendingComplete) — coerce, don't z.boolean().
    complete_pending_submit: z
      .preprocess(
        (value) => (value === true || value === "1" || value === "true" ? true : undefined),
        z.boolean(),
      )
      .optional()
      .catch(undefined),
  }),
  head: () => ({
    meta: [
      { title: "Create your Education Partner account | MatchMax" },
      {
        name: "description",
        content:
          "Create a MatchMax Education Partner account to engage independent educators and list your learning centre's courses.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BusinessJoinPage,
});

// Issue #412: never label this an "Employer Account", Education Partner /
// Organisation Account only, and the page must not read as a recruitment or
// vacancy funnel (Cap. 57 EA-safe posture).
const INITIAL_BUSINESS_JOIN_FORM = {
  name: "",
  tagline: "",
  description: "",
  district: "",
  website_url: "",
  // Legal identity (#412 B)
  legal_entity_name: "",
  trading_name: "",
  br_number: "",
  org_type: "",
  edb_identifier: "",
  charity_identifier: "",
  // Authorised representative
  rep_name: "",
  rep_role: "",
  // Verified contact (#412 B field 5)
  contact_email: "",
  contact_phone: "",
  whatsapp_number: "",
  // Consents (#412 D), unticked by default
  authorityAck: false,
  termsAck: false,
  feeAck: false,
  marketingAck: false,
};

type BusinessJoinForm = typeof INITIAL_BUSINESS_JOIN_FORM;

function BusinessJoinPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const createOrgFn = useServerFn(createOrganization);
  // #759 Part 1 (coherence addendum): the centre join form is guest-fillable
  // — Google runs only on Submit, same handoff as the Case Request / Tutor
  // Intake forms.
  const { user, loading: authLoading } = useAuth();
  const gatePending = useGateOverlayPending();
  const [pendingNotice, setPendingNotice] = useState<"cancelled" | null>(null);
  const [autoSubmitStage, setAutoSubmitStage] = useState<"idle" | "fire" | "done">("idle");
  const [draftApplied, setDraftApplied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [form, setForm] = useState<BusinessJoinForm>(INITIAL_BUSINESS_JOIN_FORM);
  const { restored, flushDraft, clearDraft } = useFormDraft<BusinessJoinForm>("business-join");

  useEffect(() => {
    if (!restored) return;
    setForm((prev) => ({ ...prev, ...restored }));
    setDraftApplied(true);
  }, [restored]);

  // The completion marker only matters for the first hydration pass.
  useEffect(() => {
    if (search.complete_pending_submit) stripPendingCompleteParam();
  }, [search.complete_pending_submit]);

  useEffect(() => {
    if (!search.complete_pending_submit) return;
    if (authLoading || gatePending) return;
    if (!user) {
      clearPendingSubmission();
      setPendingNotice("cancelled");
      return;
    }
    if (autoSubmitStage !== "idle") return;
    const envelope = readPendingSubmission();
    if (!envelope || envelope.form_type !== "centre_join") {
      // Stale (30-min TTL) or foreign payload — silently purged per ticket.
      clearPendingSubmission();
      setAutoSubmitStage("done");
      return;
    }
    // Clear BEFORE any RPC so a callback refresh can never double-submit.
    clearPendingSubmission();
    if (!restored) setDraftApplied(true);
    setAutoSubmitStage("fire");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot arm on the callback state
  }, [search.complete_pending_submit, authLoading, user, gatePending, autoSubmitStage]);

  useEffect(() => {
    if (autoSubmitStage !== "fire") return;
    if (restored && !draftApplied) return;
    setAutoSubmitStage("done");
    void handleSubmitRef.current?.();
  }, [autoSubmitStage, restored, draftApplied]);

  const setField = (patch: Partial<BusinessJoinForm>) => setForm((prev) => ({ ...prev, ...patch }));

  const buildOrgInput = () => ({
    name: form.name.trim(),
    tagline: form.tagline.trim() || undefined,
    description: form.description.trim() || undefined,
    district: form.district || undefined,
    website_url: form.website_url.trim() || undefined,
    // Legal identity
    legal_entity_name: form.legal_entity_name.trim(),
    trading_name: form.trading_name.trim() || undefined,
    br_number: form.br_number.trim(),
    rep_name: form.rep_name.trim(),
    rep_role: form.rep_role.trim(),
    org_type: form.org_type as "tutorial_centre" | "day_school" | "ngo",
    edb_identifier: form.edb_identifier.trim() || undefined,
    charity_identifier: form.charity_identifier.trim() || undefined,
    contact_email: form.contact_email.trim(),
    contact_phone: form.contact_phone.trim(),
    whatsapp_number: form.whatsapp_number.trim() || undefined,
    // Fail-closed literals, the server zod schema rejects without them.
    authorityAck: form.authorityAck as true,
    termsAck: form.termsAck as true,
    feeTermsAck: form.feeAck as true,
    marketingAck: form.marketingAck,
  });

  /**
   * #797 feedback, same ask as the tutor intake: a tutor or centre that misses
   * a field must be told which one, in red, and be taken to it. The old early
   * return on an empty name did nothing at all, and everything else surfaced as
   * a toast from the server with no field marked.
   */
  const missingFields = (): string[] => {
    const missing: string[] = [];
    if (!form.name.trim()) missing.push("Public / listing name");
    if (!form.legal_entity_name.trim()) missing.push("Legal entity name");
    if (!form.br_number.trim()) missing.push("Business Registration number");
    if (!form.rep_name.trim()) missing.push("Authorised representative");
    if (!form.rep_role.trim()) missing.push("Representative role");
    if (!form.contact_email.trim()) missing.push("Contact email");
    if (!form.contact_phone.trim()) missing.push("Contact phone");
    if (!form.authorityAck) missing.push("Authority confirmation");
    if (!form.termsAck) missing.push("Terms acceptance");
    if (!form.feeAck) missing.push("Fee terms acceptance");
    return missing;
  };

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const missing = missingFields();
    if (missing.length > 0) {
      setMissing(missing);
      window.requestAnimationFrame(() => {
        const headerHeight = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
        const first = document.querySelector<HTMLElement>('[aria-invalid="true"]');
        const target = first ?? document.getElementById("org-join-form");
        if (target) {
          window.scrollTo({
            top: window.scrollY + target.getBoundingClientRect().top - headerHeight - 24,
            behavior: "smooth",
          });
          first?.focus({ preventScroll: true });
        }
      });
      return;
    }
    setMissing([]);
    setSubmitting(true);
    try {
      // #759 Part 1: a guest gets the Google OAuth handoff — flush the
      // draft synchronously (it restores verbatim on the callback), store
      // the trigger envelope, then leave for Google.
      if (!user) {
        flushDraft(form);
        await startPendingSubmission("centre_join", "#578", "/business/join");
        return;
      }
      await createOrgFn({ data: buildOrgInput() });
      clearDraft();
      toast.success("Organization created, pending activation");
      navigate({ to: "/business", search: { tab: undefined } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create organization");
    } finally {
      setSubmitting(false);
    }
  };

  // The auto-commit effect fires the same handler; keep a stable ref so the
  // effect deps stay minimal while the handler closes over fresh state.
  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  const consentInvalid = !form.authorityAck || !form.termsAck || !form.feeAck || !form.org_type;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 py-12">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              {search.plan === "enterprise" ? "Enterprise plan selected" : "Education Partner"}
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-[color:var(--ink)]">
              Create your Education Partner account
            </h1>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              For organisations engaging independent educators for course modules, exam clinics, and
              class series. MatchMax does not provide staff or employment recruitment, tutors on
              MatchMax are self-employed educators. Our team reviews your Business Registration
              before activating your account.
            </p>
          </div>

          <form
            id="org-join-form"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
            className="mt-8 space-y-5 rounded-lg border border-border bg-card p-6 sm:p-8"
          >
            {missing.length > 0 ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium leading-relaxed text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <span>Please complete these before submitting:</span>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs font-semibold">
                    {missing.map((label) => (
                      <li key={label}>{label}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Public / listing name *</Label>
              <Input
                required
                maxLength={120}
                aria-invalid={missing.some((m) => m === "Public / listing name") || undefined}
                placeholder="e.g. Ace Learning Centre"
                value={form.name}
                onChange={(e) => setField({ name: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                The name students and parents see. The registered legal entity is captured below.
              </p>
            </div>

            {/* Legal identity, #412 B required fields 1–3 + org type on the
                same form (no second intake). */}
            <div className="space-y-4 rounded-lg border border-border p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-[color:var(--ink)]">
                <ShieldCheck className="h-4 w-4" /> Registered legal identity
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="org-legal-name">Legal entity name *</Label>
                <Input
                  required
                  maxLength={200}
                  aria-invalid={missing.some((m) => m === "Legal entity name") || undefined}
                  placeholder="e.g. XYZ Education Limited"
                  value={form.legal_entity_name}
                  onChange={(e) => setField({ legal_entity_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-trading-name">Trading name (optional)</Label>
                <Input
                  maxLength={120}
                  placeholder="Only if different from the legal entity name"
                  value={form.trading_name}
                  onChange={(e) => setField({ trading_name: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="org-br-number">Business Registration number *</Label>
                  <Input
                    required
                    maxLength={40}
                    aria-invalid={
                      missing.some((m) => m === "Business Registration number") || undefined
                    }
                    placeholder="e.g. 41690777"
                    value={form.br_number}
                    onChange={(e) => setField({ br_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Organisation type *</Label>
                  <Select value={form.org_type} onValueChange={(v) => setField({ org_type: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tutorial_centre">Tutorial centre</SelectItem>
                      <SelectItem value="day_school">Day school</SelectItem>
                      <SelectItem value="ngo">NGO / charity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.org_type === "ngo" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="org-charity-id">Charity registration number (optional)</Label>
                  <Input
                    maxLength={40}
                    value={form.charity_identifier}
                    onChange={(e) => setField({ charity_identifier: e.target.value })}
                  />
                </div>
              ) : form.org_type ? (
                <div className="space-y-1.5">
                  <Label htmlFor="org-edb-id">EDB school registration number (optional)</Label>
                  <Input
                    maxLength={40}
                    value={form.edb_identifier}
                    onChange={(e) => setField({ edb_identifier: e.target.value })}
                  />
                </div>
              ) : null}
            </div>

            {/* Authorised representative */}
            <div className="space-y-4 rounded-lg border border-border p-4">
              <p className="text-sm font-semibold text-[color:var(--ink)]">
                Authorised representative
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="org-rep-name">Full name *</Label>
                  <Input
                    required
                    maxLength={120}
                    value={form.rep_name}
                    onChange={(e) => setField({ rep_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="org-rep-role">Title / role *</Label>
                  <Input
                    required
                    maxLength={80}
                    placeholder="e.g. Director"
                    value={form.rep_role}
                    onChange={(e) => setField({ rep_role: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="org-tagline">Tagline</Label>
              <Input
                maxLength={160}
                placeholder="e.g. IB & DSE specialists since 2012"
                value={form.tagline}
                onChange={(e) => setField({ tagline: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="org-description">About your organization</Label>
              <Textarea
                rows={4}
                placeholder="What you teach, your approach, your track record…"
                value={form.description}
                onChange={(e) => setField({ description: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>District</Label>
                <SearchableSelect
                  value={form.district}
                  onChange={(v) => setField({ district: v })}
                  options={[
                    { value: "", label: "No district" },
                    ...HK_DISTRICTS.map((d) => ({ value: d, label: d })),
                  ]}
                  placeholder="No district"
                  searchPlaceholder="Search district..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-website">Website</Label>
                <Input
                  type="url"
                  placeholder="https://…"
                  value={form.website_url}
                  onChange={(e) => setField({ website_url: e.target.value })}
                />
              </div>
            </div>

            {/* Verified contact, #412 B required field 5. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="org-email">Contact email *</Label>
                <Input
                  required
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setField({ contact_email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-phone">Contact phone *</Label>
                <Input
                  required
                  value={form.contact_phone}
                  onChange={(e) => setField({ contact_phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="org-whatsapp">WhatsApp number</Label>
              <Input
                placeholder="e.g. 85291234567"
                value={form.whatsapp_number}
                onChange={(e) => setField({ whatsapp_number: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Course enquiries can be sent straight to WhatsApp.
              </p>
            </div>

            {/* Consents, #412 D. Unticked by default; the three mandatory
                literals are enforced server-side by the zod schema. */}
            <div className="space-y-3 rounded-lg border border-border p-4">
              <label className="flex gap-3 text-sm text-muted-foreground">
                <Checkbox
                  checked={form.authorityAck}
                  onCheckedChange={(checked) => setField({ authorityAck: checked === true })}
                />
                <span>
                  I confirm that I am authorised to accept these Terms and bind{" "}
                  <span className="font-semibold text-[color:var(--ink)]">
                    {form.legal_entity_name.trim() || "[legal entity name]"}
                  </span>
                  . *
                </span>
              </label>
              <label className="flex gap-3 text-sm text-muted-foreground">
                <Checkbox
                  checked={form.termsAck}
                  onCheckedChange={(checked) => setField({ termsAck: checked === true })}
                />
                <span>
                  I have read and agree to the MatchMax{" "}
                  <a
                    href="/tos"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[color:var(--brand-link)] underline underline-offset-4"
                  >
                    Platform Terms of Service
                  </a>{" "}
                  and Privacy Collection Statement. *
                </span>
              </label>
              <label className="flex gap-3 text-sm text-muted-foreground">
                <Checkbox
                  checked={form.feeAck}
                  onCheckedChange={(checked) => setField({ feeAck: checked === true })}
                />
                <span>
                  I have read and agree to the Matching and Platform Service Fee Agreement (version{" "}
                  {FEE_TERMS_VERSION}). MatchMax&apos;s matching admin fee is owed by the
                  self-employed tutor — parents and centres never pay MatchMax a matching fee.
                  Private / standard matches: 1.5 lessons (100% of Lesson 1 + 50% of Lesson 2).
                  Partner-centre intros step down within 6 months at the same centre: 1st student
                  1.5 lessons, 2nd 1.0, 3rd 0.5, 4th+ $0. Short packages of five lessons or fewer
                  use 20% of the package, and pro-bono engagements are free. *
                </span>
              </label>
              <label className="flex gap-3 text-sm text-muted-foreground">
                <Checkbox
                  checked={form.marketingAck}
                  onCheckedChange={(checked) => setField({ marketingAck: checked === true })}
                />
                <span>
                  Optional: I consent to receive updates, case alerts, and promotional
                  communications from MatchMax. You can opt out at any time; leaving this unticked
                  does not affect registration.
                </span>
              </label>
            </div>

            {/* #759 Part 1: OAuth-cancelled / hydrating notices. */}
            {pendingNotice === "cancelled" ? (
              <p className="flex items-start gap-2 rounded-sm border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{t("pending_submit.cancelled_banner")}</span>
              </p>
            ) : null}
            {autoSubmitStage === "fire" ? (
              <p className="flex items-start gap-2 rounded-sm border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 animate-pulse" aria-hidden />
                <span>{t("pending_submit.hydrating")}</span>
              </p>
            ) : null}
            {!user ? (
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                {t("pending_submit.helper_notice")}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={submitting || consentInvalid || autoSubmitStage === "fire"}
              variant="solid"
              color="blue"
              className="h-11 w-full font-bold"
            >
              {autoSubmitStage === "fire" ? (
                t("pending_submit.hydrating")
              ) : submitting ? (
                "Creating account…"
              ) : user ? (
                "Create Education Partner account"
              ) : (
                <>
                  <GoogleGIcon className="mr-2 h-4 w-4" />
                  {t("pending_submit.guest_cta_centre")}
                </>
              )}
            </Button>
            {consentInvalid ? (
              <p className="text-center text-xs text-muted-foreground">
                Complete the required fields and tick the three mandatory confirmations to submit.
              </p>
            ) : null}

            <p className="text-center text-xs text-muted-foreground">
              Your account is reviewed by our team before going live. No payment is taken on the
              website.
            </p>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
