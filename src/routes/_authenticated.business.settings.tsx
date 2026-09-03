import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Camera,
  Check,
  CircleCheck,
  ImagePlus,
  Mail,
  Phone,
  Sparkles,
  Upload,
} from "lucide-react";
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
import { ProfilePreview, type ProfilePreviewData } from "@/components/business/profile-preview";
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
  const [localLogo, setLocalLogo] = useState<string | null>(null);
  const [localCover, setLocalCover] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

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

  const snapshot = useMemo(
    () =>
      organization
        ? {
            name: organization.name ?? "",
            tagline: organization.tagline ?? "",
            description: organization.description ?? "",
            website_url: organization.website_url ?? "",
            contact_email: organization.contact_email ?? "",
            contact_phone: organization.contact_phone ?? "",
            whatsapp_number: organization.whatsapp_number ?? "",
            district: organization.district ?? "",
          }
        : null,
    [organization],
  );
  const isDirty = !!snapshot && JSON.stringify(form) !== JSON.stringify(snapshot);

  const displayLogoUrl = localLogo ?? organization?.logo_url ?? null;
  const displayCoverUrl = localCover ?? organization?.cover_image_url ?? null;

  const completeness = useMemo(() => {
    const items = [
      { label: "Logo", done: !!displayLogoUrl },
      { label: "Cover image", done: !!displayCoverUrl },
      { label: "Business name", done: !!form.name.trim() },
      { label: "Tagline", done: !!form.tagline.trim() },
      { label: "About section", done: !!form.description.trim() },
      { label: "District", done: !!form.district },
      { label: "Website", done: !!form.website_url.trim() },
      { label: "Contact email", done: !!form.contact_email.trim() },
      { label: "WhatsApp number", done: !!form.whatsapp_number.trim() },
    ];
    const filled = items.filter((item) => item.done).length;
    return { items, filled, total: items.length, pct: Math.round((filled / items.length) * 100) };
  }, [form, displayLogoUrl, displayCoverUrl]);

  const strengthLabel =
    completeness.pct === 100
      ? "All-star"
      : completeness.pct >= 70
        ? "Almost there"
        : completeness.pct >= 40
          ? "Building up"
          : "Just started";
  const missingTips = completeness.items.filter((item) => !item.done).slice(0, 3);

  const previewData: ProfilePreviewData = {
    slug: organization?.slug ?? "",
    name: form.name.trim(),
    tagline: form.tagline.trim(),
    description: form.description.trim(),
    district: form.district,
    logoUrl: displayLogoUrl,
    coverUrl: displayCoverUrl,
    websiteUrl: form.website_url.trim(),
    contactEmail: form.contact_email.trim(),
    whatsappNumber: form.whatsapp_number.trim(),
    courseCount: usage?.coursesUsed ?? 0,
    memberSince: organization
      ? new Date(organization.created_at).toLocaleDateString("en-HK", {
          month: "long",
          year: "numeric",
        })
      : "",
  };

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
    const objectUrl = URL.createObjectURL(file);
    if (kind === "logo") setLocalLogo(objectUrl);
    else setLocalCover(objectUrl);
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
      if (kind === "logo") setLocalLogo(null);
      else setLocalCover(null);
      invalidate();
    } catch (error) {
      if (kind === "logo") setLocalLogo(null);
      else setLocalCover(null);
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

  const resetForm = () => {
    if (snapshot) setForm(snapshot);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <SiteHeader />
      <BusinessLayout organization={organization} usage={usage}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-[color:var(--ink)]">
              Edit business profile
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Changes appear in the live preview instantly — save when you're happy.
            </p>

            <form
              onSubmit={(event) => {
                void handleSave(event);
              }}
              className="mt-6 space-y-6"
            >
              {/* Branding */}
              <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-[#1FA8B6]" />
                  <h2 className="text-base font-bold text-[color:var(--ink)]">Logo & cover</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Shown on your public page, the directory and course pages.
                </p>
                <div className="mt-5 space-y-6">
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Logo
                    </Label>
                    <div className="mt-2 flex items-center gap-4">
                      <label className="group relative block h-20 w-20 shrink-0 cursor-pointer">
                        {displayLogoUrl ? (
                          <img
                            src={displayLogoUrl}
                            alt="Logo"
                            className="h-20 w-20 rounded-full border border-border object-cover"
                          />
                        ) : (
                          <span className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
                            <Building2 className="h-6 w-6" />
                          </span>
                        )}
                        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          <Camera className="h-5 w-5 text-white" />
                        </span>
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                          disabled={uploading !== null}
                          className="sr-only"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) await handleImageUpload("logo", file);
                          }}
                        />
                      </label>
                      <div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          prefix={<Upload />}
                          loading={uploading === "logo"}
                          disabled={uploading !== null}
                          onClick={() => logoInputRef.current?.click()}
                        >
                          {displayLogoUrl ? "Replace logo" : "Upload logo"}
                        </Button>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          PNG, JPG, WEBP or GIF. Shown as a circle.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Cover image
                    </Label>
                    <div className="mt-2">
                      <label className="group relative block cursor-pointer overflow-hidden rounded-lg border border-border">
                        {displayCoverUrl ? (
                          <img
                            src={displayCoverUrl}
                            alt=""
                            className="aspect-[4/1] w-full object-cover"
                          />
                        ) : (
                          <div className="flex aspect-[4/1] w-full items-center justify-center border border-dashed border-border text-xs text-muted-foreground">
                            No cover image yet
                          </div>
                        )}
                        <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1.5 text-xs font-semibold text-white">
                            <Camera className="h-3.5 w-3.5" />
                            {displayCoverUrl ? "Replace cover" : "Upload cover"}
                          </span>
                        </span>
                        <input
                          ref={coverInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                          disabled={uploading !== null}
                          className="sr-only"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) await handleImageUpload("cover", file);
                          }}
                        />
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        prefix={<Upload />}
                        loading={uploading === "cover"}
                        disabled={uploading !== null}
                        className="mt-2"
                        onClick={() => coverInputRef.current?.click()}
                      >
                        {displayCoverUrl ? "Replace cover" : "Upload cover"}
                      </Button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Business details */}
              <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#1FA8B6]" />
                  <h2 className="text-base font-bold text-[color:var(--ink)]">Business details</h2>
                </div>
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
                    <p className="text-xs text-muted-foreground">
                      One line under your name, e.g. "IB & DSE maths specialists in Causeway Bay".
                    </p>
                  </div>
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
                </div>
              </section>

              {/* About */}
              <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <h2 className="text-base font-bold text-[color:var(--ink)]">
                  About your organization
                </h2>
                <div className="mt-4 space-y-1.5">
                  <Textarea
                    rows={5}
                    aria-label="About your organization"
                    value={form.description}
                    onChange={(e) => setField({ description: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Separate paragraphs with a blank line. This appears in the About section of your
                    public page.
                  </p>
                </div>
              </section>

              {/* Contact */}
              <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-[#1FA8B6]" />
                  <h2 className="text-base font-bold text-[color:var(--ink)]">
                    Contact information
                  </h2>
                </div>
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="settings-website">Website</Label>
                      <Input
                        type="url"
                        value={form.website_url}
                        onChange={(e) => setField({ website_url: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="settings-email">
                        <Mail className="mr-1 inline h-3.5 w-3.5" />
                        Contact email
                      </Label>
                      <Input
                        type="email"
                        value={form.contact_email}
                        onChange={(e) => setField({ contact_email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-phone">Contact phone</Label>
                    <Input
                      value={form.contact_phone}
                      onChange={(e) => setField({ contact_phone: e.target.value })}
                    />
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

              {/* Sticky save bar */}
              <div
                className={`sticky bottom-4 z-30 rounded-xl border bg-card/95 p-4 shadow-lg backdrop-blur transition-colors ${
                  isDirty ? "border-[#1FA8B6]/40" : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    {isDirty ? (
                      <>
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        You have unsaved changes
                      </>
                    ) : (
                      <>
                        <CircleCheck className="h-4 w-4 text-emerald-600" />
                        All changes saved
                      </>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    {isDirty && (
                      <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                        Discard
                      </Button>
                    )}
                    <Button
                      type="submit"
                      size="sm"
                      loading={saving}
                      disabled={!isDirty || saving}
                      className="bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
                    >
                      Save changes
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Live preview rail */}
          <aside className="min-w-0 self-start lg:sticky lg:top-6">
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-[#1FA8B6]" />
                  Profile strength
                </p>
                <span
                  className={`text-xs font-bold ${
                    completeness.pct === 100 ? "text-emerald-600" : "text-[#1FA8B6]"
                  }`}
                >
                  {strengthLabel}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    completeness.pct === 100 ? "bg-emerald-500" : "bg-[#1FA8B6]"
                  }`}
                  style={{ width: `${completeness.pct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {completeness.filled} of {completeness.total} profile sections complete
              </p>
              {missingTips.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {missingTips.map((tip) => (
                    <span
                      key={tip.label}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                    >
                      <Check className="h-3 w-3 opacity-40" />
                      Add {tip.label.toLowerCase()}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1FA8B6] opacity-75 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1FA8B6]" />
                </span>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Live preview
                </p>
              </div>
              <ProfilePreview data={previewData} />
            </div>
          </aside>
        </div>
      </BusinessLayout>
    </div>
  );
}
