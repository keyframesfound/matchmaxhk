import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Building2, ShieldCheck } from "lucide-react";
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
import { createOrganization } from "@/features/business/business.functions";
import { HK_DISTRICTS } from "@/features/tutors/queries";
import { FEE_TERMS_VERSION } from "@/features/legal/terms";
import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";

export const Route = createFileRoute("/_authenticated/business/join")({
  beforeLoad: () => {
    if (!CENTRE_MARKET_ENABLED) throw notFound();
  },
  validateSearch: z.object({ plan: z.string().optional() }),
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
function BusinessJoinPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const createOrgFn = useServerFn(createOrganization);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
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
  });

  const setField = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      await createOrgFn({
        data: {
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
        },
      });
      toast.success("Organization created, pending activation");
      navigate({ to: "/business", search: { tab: undefined } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create organization");
    } finally {
      setSubmitting(false);
    }
  };

  const consentInvalid = !form.authorityAck || !form.termsAck || !form.feeAck || !form.org_type;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 py-12">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              {search.plan === "enterprise" ? "Enterprise plan selected" : "Education Partner"}
            </span>
            <h1 className="mt-4 text-3xl font-medium tracking-tight text-[color:var(--ink)]">
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
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
            className="mt-8 space-y-5 rounded-lg border border-border bg-card p-6 sm:p-8"
          >
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Public / listing name *</Label>
              <Input
                required
                maxLength={120}
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
              <p className="flex items-center gap-2 text-sm font-medium text-[color:var(--ink)]">
                <ShieldCheck className="h-4 w-4" /> Registered legal identity
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="org-legal-name">Legal entity name *</Label>
                <Input
                  required
                  maxLength={200}
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
              <p className="text-sm font-medium text-[color:var(--ink)]">
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
                  <span className="font-medium text-[color:var(--ink)]">
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
                    className="font-medium text-[color:var(--brand-link)] underline underline-offset-4"
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
                  {FEE_TERMS_VERSION}). MatchMax&apos;s matching admin fee is the standard
                  1.5-lesson fee, 100% of Lesson 1 plus 50% of Lesson 2, charged to the
                  self-employed tutor after the first two introductions. Short packages of five
                  lessons or fewer use 20% of the package, and pro-bono engagements are free.
                  Parents and centres never pay MatchMax a matching fee. *
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

            <Button
              type="submit"
              disabled={submitting || consentInvalid}
              variant="solid"
              color="blue"
              className="h-11 w-full font-medium"
            >
              {submitting ? "Creating account…" : "Create Education Partner account"}
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
