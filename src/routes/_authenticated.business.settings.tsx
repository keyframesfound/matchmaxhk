import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/business/empty-state";
import { BusinessLayout } from "@/components/business/business-layout";
import {
  updateOrganization,
  uploadOrganizationImage,
} from "@/features/business/business.functions";
import { useMyOrganization } from "@/features/business/useMyOrganization";
import { HK_DISTRICTS } from "@/features/tutors/queries";

export const Route = createFileRoute("/_authenticated/business/settings")({
  head: () => ({
    meta: [{ title: "Business settings | MatchMax" }],
  }),
  component: BusinessSettingsPage,
});

function BusinessSettingsPage() {
  const updateOrgFn = useServerFn(updateOrganization);
  const uploadImageFn = useServerFn(uploadOrganizationImage);

  const { membership, organization, usage, isLoading, invalidate } = useMyOrganization();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);
  const [form, setForm] = useState({
    name: "",
    tagline: "",
    description: "",
    website_url: "",
    contact_email: "",
    contact_phone: "",
    whatsapp_number: "",
    district: "",
  });

  useEffect(() => {
    if (organization) {
      setForm({
        name: organization.name ?? "",
        tagline: organization.tagline ?? "",
        description: organization.description ?? "",
        website_url: organization.website_url ?? "",
        contact_email: organization.contact_email ?? "",
        contact_phone: organization.contact_phone ?? "",
        whatsapp_number: organization.whatsapp_number ?? "",
        district: organization.district ?? "",
      });
    }
  }, [organization]);

  const setField = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  const fileToBase64 = useCallback(async (file: File): Promise<string> => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
    }
    return btoa(binary);
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/40">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center">
          <Skeleton className="h-8 w-48" />
        </main>
      </div>
    );
  }

  if (!membership || !organization) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <EmptyState
            icon={Building2}
            title="No business account yet"
            description="Create a business account to manage your profile."
            action={
              <Button asChild>
                <a href="/business/join">Create a business account</a>
              </Button>
            }
          />
        </main>
      </div>
    );
  }

  const handleImageUpload = async (kind: "logo" | "cover", file: File) => {
    setUploading(kind);
    try {
      const result = (await uploadImageFn({
        data: {
          orgId: organization.id,
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          base64Data: await fileToBase64(file),
        },
      })) as { key: string; url: string };
      await (updateOrgFn({
        data: {
          orgId: organization.id,
          ...(kind === "logo" ? { logo_url: result.url } : { cover_image_url: result.url }),
        },
      }) as Promise<unknown>);
      toast.success(kind === "logo" ? "Logo updated" : "Cover image updated");
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await (updateOrgFn({
        data: {
          orgId: organization.id,
          name: form.name.trim() || undefined,
          tagline: form.tagline,
          description: form.description,
          website_url: form.website_url,
          contact_email: form.contact_email,
          contact_phone: form.contact_phone,
          whatsapp_number: form.whatsapp_number,
          district: form.district || undefined,
        },
      }) as Promise<unknown>);
      toast.success("Business profile saved");
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <SiteHeader />
      <BusinessLayout organization={organization} usage={usage}>
        <h1 className="text-2xl font-black tracking-tight text-[color:var(--ink)]">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your business profile and branding.
        </p>

        <form
          onSubmit={(event) => {
            void handleSave(event);
          }}
          className="mt-6 space-y-6"
        >
          <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-base font-bold text-[color:var(--ink)]">Images</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Shown in the public directory and on course pages.
            </p>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Logo
                </Label>
                <div className="mt-2 flex items-center gap-3">
                  {organization.logo_url ? (
                    <img
                      src={organization.logo_url}
                      alt="Logo"
                      className="h-14 w-14 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                      <Building2 className="h-5 w-5" />
                    </span>
                  )}
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                    disabled={uploading !== null}
                    className="max-w-56"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) await handleImageUpload("logo", file);
                    }}
                  />
                </div>
                {uploading === "logo" && (
                  <p className="mt-1 text-xs text-muted-foreground">Uploading logo…</p>
                )}
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Cover image
                </Label>
                <div className="mt-2">
                  {organization.cover_image_url ? (
                    <img
                      src={organization.cover_image_url}
                      alt=""
                      className="aspect-[4/1] w-full rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/1] w-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                      No cover image
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                    disabled={uploading !== null}
                    className="mt-2 max-w-56"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) await handleImageUpload("cover", file);
                    }}
                  />
                </div>
                {uploading === "cover" && (
                  <p className="mt-1 text-xs text-muted-foreground">Uploading cover…</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-base font-bold text-[color:var(--ink)]">Profile</h2>
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="settings-name">Business / centre name *</Label>
                <Input
                  required
                  maxLength={120}
                  value={form.name}
                  onChange={(e) => setField({ name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-tagline">Tagline</Label>
                <Input
                  maxLength={160}
                  value={form.tagline}
                  onChange={(e) => setField({ tagline: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-description">About your organization</Label>
                <Textarea
                  rows={4}
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
                  <Label htmlFor="settings-website">Website</Label>
                  <Input
                    type="url"
                    value={form.website_url}
                    onChange={(e) => setField({ website_url: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="settings-email">Contact email</Label>
                  <Input
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => setField({ contact_email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settings-phone">Contact phone</Label>
                  <Input
                    value={form.contact_phone}
                    onChange={(e) => setField({ contact_phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-whatsapp">WhatsApp number</Label>
                <Input
                  placeholder="e.g. 85291234567"
                  value={form.whatsapp_number}
                  onChange={(e) => setField({ whatsapp_number: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Course enquiries can be sent straight to WhatsApp.
                </p>
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saving}
              className="bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </BusinessLayout>
    </div>
  );
}
