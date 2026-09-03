import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { createOrganization } from "@/features/business/business.functions";
import { useMyOrganization } from "@/features/business/useMyOrganization";
import { HK_DISTRICTS } from "@/features/tutors/queries";

export const Route = createFileRoute("/_authenticated/business/join")({
  validateSearch: z.object({ plan: z.string().optional() }),
  head: () => ({
    meta: [{ title: "Create your business account | MatchMax" }],
  }),
  component: BusinessJoinPage,
});

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
    contact_email: "",
    contact_phone: "",
    whatsapp_number: "",
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
          contact_email: form.contact_email.trim() || undefined,
          contact_phone: form.contact_phone.trim() || undefined,
          whatsapp_number: form.whatsapp_number.trim() || undefined,
        },
      });
      toast.success("Organization created — pending activation");
      navigate({ to: "/business", search: { tab: undefined } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create organization");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 py-12">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              {search.plan === "enterprise" ? "Enterprise plan selected" : "Business account"}
            </span>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-[color:var(--ink)]">
              Create your business account
            </h1>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Tell us about your organization. Our team will review and activate your account, then
              you can start posting courses right away.
            </p>
          </div>

          <form
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
            className="mt-8 space-y-5 rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8"
          >
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Business / centre name *</Label>
              <Input
                required
                maxLength={120}
                placeholder="e.g. Ace Learning Centre"
                value={form.name}
                onChange={(e) => setField({ name: e.target.value })}
              />
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="org-email">Contact email</Label>
                <Input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setField({ contact_email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-phone">Contact phone</Label>
                <Input
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

            <Button
              type="submit"
              disabled={submitting}
              className="h-11 w-full bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
            >
              {submitting ? "Creating account…" : "Create business account"}
            </Button>

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
