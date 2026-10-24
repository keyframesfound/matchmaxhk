import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Building2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
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
import { submitCentreCaseRequest } from "@/features/cases/centre-case.functions";
import {
  getCurriculumOptionsForLevel,
  getSubjectOptionsForCurriculum,
} from "@/features/cases/case-options";
import { SECONDARY_BANDS } from "@/features/cases/case-verticals";
import { useAuth } from "@/features/auth/useAuth";
import { useMyOrganization } from "@/features/business/useMyOrganization";
import { FEE_TERMS_VERSION } from "@/features/legal/terms";
import { SUPPORTED_CURRENCIES } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/business/cases/new")({
  head: () => ({
    meta: [{ title: "New case request | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: CentreCaseRequestPage,
});

// Issue #412 E, the 4-part Cap.57-safe triage. MatchMax facilitates only
// Contracts for Services with independent educators; employment/staff
// recruitment is hard-blocked, and third-party/unsure answers drop the
// request into compliance_hold for manual staff review before matching.
function CentreCaseRequestPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { organization, membership, isLoading: orgLoading } = useMyOrganization();
  const submitFn = useServerFn(submitCentreCaseRequest);
  const [submitting, setSubmitting] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const [form, setForm] = useState({
    // Case basics
    supportType: "subject_tutoring",
    academicLevel: "",
    secondaryBand: "",
    curriculum: "",
    subject1: "",
    subject2: "",
    mode: "",
    district: "",
    budgetMin: "",
    budgetMax: "",
    budgetCurrency: "HKD",
    packageType: "ongoing_1_5",
    studentCount: "1",
    rateUnit: "hr",
    notes: "",
    // Part 1: engagement category (hard gate)
    engagementCategory: "",
    // Part 2: contracting, payment & financial arrangements
    contractingEntity: "organisation_self",
    feeStructure: "hourly",
    feeAmount: "",
    feeOpenToCounter: false,
    premisesProvider: "organisation",
    // Part 3: scope of services & non-integration
    scopeDescription: "",
    adminDutiesRequired: "",
    replacesVacancy: "",
    // Part 4: educator autonomy & genuine choice
    methodologyOwner: "educator",
    otherClientsAllowed: "yes",
    substitutionAllowed: "open",
    feeAck: false,
  });

  const setField = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  const curriculumOptions = getCurriculumOptionsForLevel(form.academicLevel);
  const subjectOptions = getSubjectOptionsForCurriculum(form.curriculum);

  const handleCategoryChange = (value: string) => {
    // Part 1 hard gate: the employment option never submits, the modal
    // explains the marketplace boundary instead.
    if (value === "employment") {
      setBlocked(true);
      return;
    }
    setField({ engagementCategory: value });
  };

  const incomplete =
    !form.academicLevel ||
    !form.curriculum ||
    !form.subject1 ||
    !form.mode ||
    !form.engagementCategory ||
    !form.scopeDescription.trim() ||
    !form.adminDutiesRequired ||
    !form.replacesVacancy ||
    !form.feeAck;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!organization) return;
    setSubmitting(true);
    try {
      const result = await submitFn({
        data: {
          orgId: organization.id,
          supportType: form.supportType as "subject_tutoring" | "admissions",
          academicLevel: form.academicLevel as
            "Kindergarten" | "Primary" | "Secondary" | "University",
          secondaryBand: form.academicLevel === "Secondary" ? form.secondaryBand : null,
          curriculum: form.curriculum,
          subjects: [form.subject1, form.subject2].map((s) => s.trim()).filter(Boolean),
          mode: form.mode as "online" | "offline" | "both",
          district: form.mode !== "online" ? form.district || null : null,
          budgetMin: form.budgetMin ? Number(form.budgetMin) : null,
          budgetMax: form.budgetMax ? Number(form.budgetMax) : null,
          budgetCurrency: form.budgetCurrency,
          packageType: form.packageType as "ongoing_1_5" | "short_20" | "pro_bono",
          studentCount: Number(form.studentCount) || 1,
          rateUnit: form.rateUnit as "hr" | "lesson" | "month",
          notes: form.notes.trim() || null,
          triage: {
            engagementCategory: form.engagementCategory as
              "independent_services" | "third_party" | "unsure",
            contractingEntity: form.contractingEntity as "organisation_self" | "third_party",
            feeStructure: form.feeStructure as "hourly" | "per_session" | "revenue_split",
            feeAmount: form.feeAmount.trim() || null,
            feeOpenToCounter: form.feeOpenToCounter,
            premisesProvider: form.premisesProvider as
              "organisation" | "educator" | "online_shared",
            scopeDescription: form.scopeDescription.trim(),
            adminDutiesRequired: form.adminDutiesRequired as "no" | "yes" | "unsure",
            replacesVacancy: form.replacesVacancy as "no" | "yes",
            methodologyOwner: form.methodologyOwner as "educator" | "mutual" | "centre_controlled",
            otherClientsAllowed: form.otherClientsAllowed as "yes" | "no",
            substitutionAllowed: form.substitutionAllowed as "yes" | "no" | "open",
          },
          feeAck: true,
        },
      });
      toast.success(
        result.status === "compliance_hold"
          ? "Request submitted, placed on compliance hold for a quick review before it can go to educators."
          : `Request ${result.caseCode} submitted to the matching desk.`,
      );
      navigate({ to: "/business", search: { tab: "cases" } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  if (!loading && !user) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Sign in to continue.</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (orgLoading || loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading your organization…</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!membership || !organization) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">
            Create an Education Partner account first.
          </p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 py-12">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> Education Partner
            </span>
            <h1 className="mt-4 text-3xl font-medium tracking-tight text-[color:var(--ink)]">
              New case request
            </h1>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Engage an independent educator for a course module, exam clinic, or class series.
              MatchMax does not provide staff or employment recruitment, every request is screened
              before it can reach educators.
            </p>
          </div>

          <form
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
            className="mt-8 space-y-5 rounded-lg border border-border bg-card p-6 sm:p-8"
          >
            {/* Case basics */}
            <div className="space-y-4">
              <p className="text-sm font-medium text-[color:var(--ink)]">What do you need?</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Request type</Label>
                  <Select
                    value={form.supportType}
                    onValueChange={(v) => setField({ supportType: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subject_tutoring">Subject tutoring</SelectItem>
                      <SelectItem value="admissions">Admissions support</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Academic level *</Label>
                  <Select
                    value={form.academicLevel}
                    onValueChange={(v) =>
                      setField({ academicLevel: v, curriculum: "", subject1: "", subject2: "" })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Kindergarten">Kindergarten</SelectItem>
                      <SelectItem value="Primary">Primary</SelectItem>
                      <SelectItem value="Secondary">Secondary</SelectItem>
                      <SelectItem value="University">University</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.academicLevel === "Secondary" ? (
                <div className="space-y-1.5">
                  <Label>Secondary band</Label>
                  <SearchableSelect
                    value={form.secondaryBand}
                    onChange={(v) => setField({ secondaryBand: v })}
                    options={SECONDARY_BANDS.map((b) => ({ value: b, label: b }))}
                    placeholder="Junior or senior secondary"
                    searchPlaceholder="Search band..."
                  />
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Curriculum *</Label>
                  <SearchableSelect
                    value={form.curriculum}
                    onChange={(v) => setField({ curriculum: v, subject1: "", subject2: "" })}
                    options={curriculumOptions}
                    placeholder={
                      form.academicLevel ? "Select curriculum" : "Pick an academic level first"
                    }
                    searchPlaceholder="Search curriculum..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Subject *</Label>
                  <SearchableSelect
                    value={form.subject1}
                    onChange={(v) => setField({ subject1: v })}
                    options={subjectOptions}
                    placeholder={form.curriculum ? "Select subject" : "Pick a curriculum first"}
                    searchPlaceholder="Search subject..."
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Second subject (optional)</Label>
                  <SearchableSelect
                    value={form.subject2}
                    onChange={(v) => setField({ subject2: v })}
                    options={subjectOptions}
                    placeholder="None"
                    searchPlaceholder="Search subject..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Delivery mode *</Label>
                  <Select value={form.mode} onValueChange={(v) => setField({ mode: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="offline">In person</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="both">Either</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.mode && form.mode !== "online" ? (
                <div className="space-y-1.5">
                  <Label>Nearest MTR station / district</Label>
                  <Input
                    maxLength={80}
                    value={form.district}
                    onChange={(e) => setField({ district: e.target.value })}
                  />
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Service fee budget (per hour)</Label>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Budget currency"
                      className="h-10 shrink-0 rounded-md border border-[color:var(--ink)]/15 bg-transparent px-2 text-sm font-medium text-[color:var(--ink)] outline-none"
                      value={form.budgetCurrency}
                      onChange={(e) => setField({ budgetCurrency: e.target.value })}
                    >
                      {SUPPORTED_CURRENCIES.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                    <Input
                      aria-label="Minimum budget"
                      placeholder="Min"
                      inputMode="numeric"
                      value={form.budgetMin}
                      onChange={(e) =>
                        setField({ budgetMin: e.target.value.replace(/[^\d]/g, "") })
                      }
                    />
                    <span className="text-sm font-medium text-muted-foreground">&ndash;</span>
                    <Input
                      aria-label="Maximum budget"
                      placeholder="Max"
                      inputMode="numeric"
                      value={form.budgetMax}
                      onChange={(e) =>
                        setField({ budgetMax: e.target.value.replace(/[^\d]/g, "") })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Students per cohort</Label>
                  <Input
                    inputMode="numeric"
                    value={form.studentCount}
                    onChange={(e) =>
                      setField({ studentCount: e.target.value.replace(/[^\d]/g, "") || "1" })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Extra notes for the matching desk (optional)</Label>
                <Textarea
                  rows={3}
                  maxLength={500}
                  value={form.notes}
                  onChange={(e) => setField({ notes: e.target.value })}
                />
              </div>
            </div>

            {/* Part 1: engagement category (hard gate) */}
            <div className="space-y-3 rounded-lg border border-border p-4">
              <p className="text-sm font-medium text-[color:var(--ink)]">
                Part 1: Nature of this request *
              </p>
              <div className="space-y-2">
                {[
                  {
                    value: "independent_services",
                    label:
                      "Engaging an independent educator for a specific course module, exam clinic, or class series (Contract for Services)",
                  },
                  {
                    value: "employment",
                    label:
                      "Recruiting a full-time or part-time staff member / employee (Contract of Employment)",
                  },
                  {
                    value: "third_party",
                    label: "Arranging services on behalf of an external third-party organisation",
                  },
                  { value: "unsure", label: "Other / Unsure" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground"
                  >
                    <input
                      type="radio"
                      name="engagementCategory"
                      className="mt-1 accent-[color:var(--brand-link)]"
                      checked={
                        option.value === "employment"
                          ? false
                          : form.engagementCategory === option.value
                      }
                      onChange={() => handleCategoryChange(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                MatchMax is an independent educator marketplace. Requests to recruit employees are
                outside our scope; unsure or third-party arrangements go to a compliance review
                before matching.
              </p>
            </div>

            {/* Part 2: contracting, payment & financial arrangements */}
            <div className="space-y-4 rounded-lg border border-border p-4">
              <p className="text-sm font-medium text-[color:var(--ink)]">
                Part 2: Contracting &amp; payment
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Who contracts with and pays the educator?</Label>
                  <Select
                    value={form.contractingEntity}
                    onValueChange={(v) => setField({ contractingEntity: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="organisation_self">
                        {organization.legal_entity_name || organization.name}
                      </SelectItem>
                      <SelectItem value="third_party">A third-party organisation</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Third-party contracting goes to compliance review.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Proposed service fee structure</Label>
                  <Select
                    value={form.feeStructure}
                    onValueChange={(v) => setField({ feeStructure: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly service fee</SelectItem>
                      <SelectItem value="per_session">Per-session service fee</SelectItem>
                      <SelectItem value="revenue_split">Course revenue-split ratio %</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid items-end gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Amount or split (e.g. HK$400/hr or 70/30)</Label>
                  <Input
                    maxLength={40}
                    value={form.feeAmount}
                    onChange={(e) => setField({ feeAmount: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Who supplies the classroom &amp; equipment?</Label>
                  <Select
                    value={form.premisesProvider}
                    onValueChange={(v) => setField({ premisesProvider: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="organisation">Organisation</SelectItem>
                      <SelectItem value="educator">Educator</SelectItem>
                      <SelectItem value="online_shared">Online / shared</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <label className="flex gap-3 text-sm text-muted-foreground">
                <Checkbox
                  checked={form.feeOpenToCounter}
                  onCheckedChange={(checked) => setField({ feeOpenToCounter: checked === true })}
                />
                <span>Open to educator counter-proposal / negotiation.</span>
              </label>
            </div>

            {/* Part 3: scope of services, deliverables & non-integration */}
            <div className="space-y-4 rounded-lg border border-border p-4">
              <p className="text-sm font-medium text-[color:var(--ink)]">
                Part 3: Scope of services
              </p>
              <div className="space-y-1.5">
                <Label>
                  Course module / subject / curriculum &amp; target duration * (e.g. “IBDP Physics
                  HL, 4-week intensive clinic”)
                </Label>
                <Textarea
                  rows={2}
                  maxLength={300}
                  value={form.scopeDescription}
                  onChange={(e) => setField({ scopeDescription: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>
                    Required to perform admin, reception, sales, discipline, or staff-cover duties?
                    *
                  </Label>
                  <Select
                    value={form.adminDutiesRequired}
                    onValueChange={(v) => setField({ adminDutiesRequired: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="unsure">Unsure</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Yes or unsure → compliance review. Educators on MatchMax teach; they do not fill
                    staff roles.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Is this replacing a staff vacancy or converting an employee? *</Label>
                  <Select
                    value={form.replacesVacancy}
                    onValueChange={(v) => setField({ replacesVacancy: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Yes → compliance review; vacancy hiring is out of scope.
                  </p>
                </div>
              </div>
            </div>

            {/* Part 4: educator autonomy & genuine choice */}
            <div className="space-y-4 rounded-lg border border-border p-4">
              <p className="text-sm font-medium text-[color:var(--ink)]">
                Part 4: Educator autonomy
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Teaching methodology</Label>
                  <Select
                    value={form.methodologyOwner}
                    onValueChange={(v) => setField({ methodologyOwner: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="educator">Educator independently</SelectItem>
                      <SelectItem value="mutual">Mutual alignment</SelectItem>
                      <SelectItem value="centre_controlled">Strictly controlled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Free to teach other clients?</Label>
                  <Select
                    value={form.otherClientsAllowed}
                    onValueChange={(v) => setField({ otherClientsAllowed: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Substitution / delegation allowed?</Label>
                  <Select
                    value={form.substitutionAllowed}
                    onValueChange={(v) => setField({ substitutionAllowed: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="open">Open to discussion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Fee notice, MatchMax's charge stays the 1.5-lesson admin fee,
                paid by the self-employed tutor (CEO lock, #412). */}
            <div className="rounded-sm border border-border bg-muted/50 p-4 text-sm">
              <p className="font-medium">MatchMax fee</p>
              <p className="mt-1 text-muted-foreground">
                The MatchMax matching admin fee is the standard 1.5-lesson fee, 100% of Lesson 1
                plus 50% of Lesson 2, charged to the self-employed educator after the first two
                introductions. Short packages of five lessons or fewer use 20% of the package, and
                pro-bono engagements are free. Your organisation never pays MatchMax a matching fee.
                Fee Agreement version {FEE_TERMS_VERSION}.
              </p>
            </div>
            <label className="flex gap-3 text-sm text-muted-foreground">
              <Checkbox
                checked={form.feeAck}
                onCheckedChange={(checked) => setField({ feeAck: checked === true })}
              />
              <span>
                I confirm the arrangements above describe an independent service engagement, and I
                have read the Matching and Platform Service Fee Agreement. *
              </span>
            </label>

            <Button
              type="submit"
              disabled={submitting || incomplete}
              variant="solid"
              color="blue"
              className="h-11 w-full font-medium"
            >
              {submitting ? "Submitting…" : "Submit case request"}
            </Button>
            {incomplete ? (
              <p className="text-center text-xs text-muted-foreground">
                Complete the required fields, answer both Part 3 gates, and tick the confirmation.
              </p>
            ) : null}
          </form>
        </div>
      </main>
      <SiteFooter />

      {/* Part 1 hard block modal */}
      {blocked ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6">
            <p className="flex items-center gap-2 text-lg font-medium text-[color:var(--ink)]">
              <ShieldAlert className="h-5 w-5 text-purple-600" /> Out of scope
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              MatchMax is an independent educator marketplace and does not provide staff or
              employment recruitment services. To engage independent educators for course modules,
              exam clinics, or class series, choose the first option.
            </p>
            <Button
              variant="solid"
              className="mt-4 w-full font-medium"
              onClick={() => setBlocked(false)}
            >
              Back to the request form
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
