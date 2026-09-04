import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Check,
  CircleCheck,
  ImagePlus,
  Mail,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ProfilePreview, type ProfilePreviewData } from "@/components/business/profile-preview";
import { SOCIAL_NETWORKS, SocialInput } from "@/components/business/social-links";
import { HK_DISTRICTS } from "@/features/tutors/queries";
import { parseYouTubeUrl } from "@/lib/youtube";
import {
  updateOrganization,
  uploadOrganizationImage,
  type OrgFaqItem,
} from "@/features/business/business.functions";
import { useMyOrganization, type Organization } from "@/features/business/useMyOrganization";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "branding", label: "Branding" },
  { id: "details", label: "Business details" },
  { id: "about", label: "About & FAQ" },
  { id: "contact", label: "Contact" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

type ProfileForm = {
  name: string;
  tagline: string;
  description: string;
  website_url: string;
  contact_email: string;
  contact_phone: string;
  whatsapp_number: string;
  district: string;
  youtube_url: string;
  linkedin_url: string;
  x_url: string;
  rednote_url: string;
  instagram_url: string;
  facebook_url: string;
  intro_video_url: string;
  founded_year: string;
  languages: string;
};

function formFromOrganization(organization: Organization): ProfileForm {
  return {
    name: organization.name ?? "",
    tagline: organization.tagline ?? "",
    description: organization.description ?? "",
    website_url: organization.website_url ?? "",
    contact_email: organization.contact_email ?? "",
    contact_phone: organization.contact_phone ?? "",
    whatsapp_number: organization.whatsapp_number ?? "",
    district: organization.district ?? "",
    youtube_url: organization.youtube_url ?? "",
    linkedin_url: organization.linkedin_url ?? "",
    x_url: organization.x_url ?? "",
    rednote_url: organization.rednote_url ?? "",
    instagram_url: organization.instagram_url ?? "",
    facebook_url: organization.facebook_url ?? "",
    intro_video_url: organization.intro_video_url ?? "",
    founded_year: organization.founded_year ? String(organization.founded_year) : "",
    languages: organization.languages ?? "",
  };
}

function SettingsRow({
  htmlFor,
  label,
  description,
  children,
}: {
  htmlFor?: string;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 sm:max-w-md">
        <Label htmlFor={htmlFor} className="text-sm font-medium text-[color:var(--ink)]">
          {label}
        </Label>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0 sm:w-60">{children}</div>
    </div>
  );
}

function SettingsCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <h3 className="text-base font-bold tracking-tight text-[color:var(--ink)]">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col gap-4 px-6 py-5">{children}</div>
    </section>
  );
}

function DropZone({
  currentUrl,
  fallback,
  className,
  uploading,
  onFile,
}: {
  currentUrl: string | null;
  fallback: React.ReactNode;
  className: string;
  uploading: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload image"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith("image/")) onFile(file);
      }}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-lg border border-border transition-colors",
        dragging ? "border-[#1FA8B6] bg-[#1FA8B6]/5" : "hover:border-[#1FA8B6]/40",
        className,
      )}
    >
      {currentUrl ? (
        <img src={currentUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center border border-dashed border-border text-muted-foreground">
          {fallback}
        </span>
      )}
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity",
          dragging
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
        )}
      >
        <span className="inline-flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1.5 text-xs font-semibold text-white">
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Uploading…" : currentUrl ? "Replace" : "Upload"}
        </span>
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </div>
  );
}

export function ProfilePanel() {
  const updateOrgFn = useServerFn(updateOrganization);
  const uploadImageFn = useServerFn(uploadOrganizationImage);
  const { organization, usage } = useMyOrganization();

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    name: "",
    tagline: "",
    description: "",
    website_url: "",
    contact_email: "",
    contact_phone: "",
    whatsapp_number: "",
    district: "",
    youtube_url: "",
    linkedin_url: "",
    x_url: "",
    rednote_url: "",
    instagram_url: "",
    facebook_url: "",
    intro_video_url: "",
    founded_year: "",
    languages: "",
  });
  const [faqItems, setFaqItems] = useState<OrgFaqItem[]>([]);
  const [localLogo, setLocalLogo] = useState<string | null>(null);
  const [localCover, setLocalCover] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (organization) {
      setForm(formFromOrganization(organization));
      setFaqItems(organization.faq ?? []);
    }
  }, [organization]);

  const snapshot = useMemo(
    () =>
      organization
        ? { form: formFromOrganization(organization), faq: organization.faq ?? [] }
        : null,
    [organization],
  );
  const isDirty =
    !!snapshot &&
    (JSON.stringify(form) !== JSON.stringify(snapshot.form) ||
      JSON.stringify(faqItems) !== JSON.stringify(snapshot.faq));

  const displayLogoUrl = localLogo ?? organization?.logo_url ?? null;
  const displayCoverUrl = localCover ?? organization?.cover_image_url ?? null;

  const setField = (patch: Partial<ProfileForm>) => setForm((prev) => ({ ...prev, ...patch }));

  const completeness = useMemo(() => {
    const items = [
      { label: "Logo", done: !!displayLogoUrl, section: "branding" as SectionId },
      { label: "Cover image", done: !!displayCoverUrl, section: "branding" as SectionId },
      { label: "Business name", done: !!form.name.trim(), section: "details" as SectionId },
      { label: "Tagline", done: !!form.tagline.trim(), section: "details" as SectionId },
      { label: "About section", done: !!form.description.trim(), section: "about" as SectionId },
      {
        label: "Intro video",
        done: !!parseYouTubeUrl(form.intro_video_url),
        section: "about" as SectionId,
      },
      { label: "FAQ", done: faqItems.length > 0, section: "about" as SectionId },
      { label: "District", done: !!form.district, section: "details" as SectionId },
      { label: "Website", done: !!form.website_url.trim(), section: "contact" as SectionId },
      {
        label: "Contact email",
        done: !!form.contact_email.trim(),
        section: "contact" as SectionId,
      },
      {
        label: "WhatsApp number",
        done: !!form.whatsapp_number.trim(),
        section: "contact" as SectionId,
      },
      {
        label: "Social links",
        done: SOCIAL_NETWORKS.some(
          (network) => !!form[`${network.id}_url` as keyof ProfileForm]?.trim(),
        ),
        section: "contact" as SectionId,
      },
    ];
    const filled = items.filter((item) => item.done).length;
    return { items, filled, total: items.length, pct: Math.round((filled / items.length) * 100) };
  }, [form, faqItems, displayLogoUrl, displayCoverUrl]);
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
    introVideoUrl: parseYouTubeUrl(form.intro_video_url)?.thumbnailUrl ?? null,
    socials: {
      youtube: form.youtube_url.trim() || null,
      linkedin: form.linkedin_url.trim() || null,
      x: form.x_url.trim() || null,
      rednote: form.rednote_url.trim() || null,
      instagram: form.instagram_url.trim() || null,
      facebook: form.facebook_url.trim() || null,
    },
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

  const handleImageUpload = async (kind: "logo" | "cover", file: File) => {
    if (!organization) return;
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
    } catch (error) {
      if (kind === "logo") setLocalLogo(null);
      else setLocalCover(null);
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const saveProfile = useCallback(async () => {
    if (!organization || !isDirty || saving) return;
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
          youtube_url: form.youtube_url,
          linkedin_url: form.linkedin_url,
          x_url: form.x_url,
          rednote_url: form.rednote_url,
          instagram_url: form.instagram_url,
          facebook_url: form.facebook_url,
          intro_video_url: form.intro_video_url,
          founded_year: form.founded_year.trim() ? Number(form.founded_year) : null,
          languages: form.languages,
          faq: faqItems.filter((item) => item.question.trim() && item.answer.trim()),
        },
      }) as Promise<unknown>);
      toast.success("Business profile saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }, [organization, form, faqItems, isDirty, saving, updateOrgFn]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (isDirty && !saving) void saveProfile();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDirty, saving, saveProfile]);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  if (!organization) return null;

  const resetForm = () => {
    if (snapshot) {
      setForm(snapshot.form);
      setFaqItems(snapshot.faq);
    }
  };

  const updateFaqItem = (index: number, patch: Partial<OrgFaqItem>) => {
    setFaqItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="min-w-0 space-y-6">
        <SettingsCard
          id="branding"
          title="Branding"
          description="Your logo and cover image across MatchMax."
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div>
              <Label className="text-sm font-medium text-[color:var(--ink)]">Logo</Label>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                PNG, JPG, WEBP or GIF. Shown as a circle.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <DropZone
                currentUrl={displayLogoUrl}
                uploading={uploading === "logo"}
                className="h-16 w-16 shrink-0 rounded-full"
                fallback={<Building2 className="h-5 w-5" />}
                onFile={(file) => void handleImageUpload("logo", file)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                prefix={<Upload />}
                loading={uploading === "logo"}
                disabled={uploading !== null}
                onClick={() => logoInputRef.current?.click()}
              >
                {displayLogoUrl ? "Replace" : "Upload"}
              </Button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleImageUpload("logo", file);
                }}
              />
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div>
              <Label className="text-sm font-medium text-[color:var(--ink)]">Cover image</Label>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Wide banner shown at the top of your public profile.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:w-60">
              <DropZone
                currentUrl={displayCoverUrl}
                uploading={uploading === "cover"}
                className="aspect-[4/1] w-full"
                fallback={<span className="text-xs">Drag an image here or click to upload</span>}
                onFile={(file) => void handleImageUpload("cover", file)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                prefix={<Upload />}
                loading={uploading === "cover"}
                disabled={uploading !== null}
                onClick={() => coverInputRef.current?.click()}
              >
                {displayCoverUrl ? "Replace" : "Upload"}
              </Button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleImageUpload("cover", file);
                }}
              />
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          id="details"
          title="Business details"
          description="How your business appears across the directory."
        >
          <SettingsRow
            htmlFor="pp-name"
            label="Business name"
            description="The name shown across your public profile and courses."
          >
            <Input
              id="pp-name"
              required
              maxLength={120}
              value={form.name}
              onChange={(e) => setField({ name: e.target.value })}
            />
          </SettingsRow>

          <Separator />

          <SettingsRow
            htmlFor="pp-tagline"
            label="Tagline"
            description="One line under your name, e.g. IB & DSE maths specialists in Causeway Bay."
          >
            <Input
              id="pp-tagline"
              maxLength={160}
              value={form.tagline}
              onChange={(e) => setField({ tagline: e.target.value })}
            />
          </SettingsRow>

          <Separator />

          <SettingsRow label="District" description="Where parents can find you in Hong Kong.">
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
          </SettingsRow>

          <Separator />

          <SettingsRow
            htmlFor="pp-founded"
            label="Founded year"
            description="When your organization was established."
          >
            <Input
              id="pp-founded"
              type="number"
              min={1900}
              max={2100}
              placeholder="e.g. 2015"
              value={form.founded_year}
              onChange={(e) => setField({ founded_year: e.target.value })}
            />
          </SettingsRow>

          <Separator />

          <SettingsRow
            htmlFor="pp-languages"
            label="Languages of instruction"
            description="Comma separated, e.g. English, Cantonese, Mandarin."
          >
            <Input
              id="pp-languages"
              maxLength={200}
              placeholder="e.g. English, Cantonese, Mandarin"
              value={form.languages}
              onChange={(e) => setField({ languages: e.target.value })}
            />
          </SettingsRow>
        </SettingsCard>

        <SettingsCard
          id="about"
          title="About & FAQ"
          description="Tell parents who you are and answer common questions."
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="pp-description">About your organization</Label>
            <Textarea
              id="pp-description"
              rows={6}
              value={form.description}
              onChange={(e) => setField({ description: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Separate paragraphs with a blank line. This appears in the About section of your
              public page.
            </p>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <Label htmlFor="pp-intro-video">Intro video (YouTube)</Label>
            <Input
              id="pp-intro-video"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={form.intro_video_url}
              onChange={(e) => setField({ intro_video_url: e.target.value })}
            />
            {form.intro_video_url.trim() && !parseYouTubeUrl(form.intro_video_url) ? (
              <p className="text-xs text-red-500">
                That doesn't look like a YouTube link. Paste a youtube.com/watch, youtu.be or
                /shorts URL.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                A short intro video builds trust. It shows at the top of your About section.
              </p>
            )}
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-[color:var(--ink)]">
                  Frequently asked questions
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Up to 8 questions, shown as an accordion on your public page.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                prefix={<Plus />}
                disabled={faqItems.length >= 8}
                onClick={() => setFaqItems((prev) => [...prev, { question: "", answer: "" }])}
              >
                Add question
              </Button>
            </div>
            {faqItems.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                Add common parent questions here.
              </p>
            ) : (
              <div className="space-y-3">
                {faqItems.map((item, index) => (
                  <div
                    key={index}
                    className="space-y-2 rounded-lg border border-border bg-muted/30 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-muted-foreground">
                        Question {index + 1}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove question"
                        onClick={() => setFaqItems((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Question, e.g. Do you offer trial lessons?"
                      maxLength={200}
                      value={item.question}
                      onChange={(e) => updateFaqItem(index, { question: e.target.value })}
                    />
                    <Textarea
                      placeholder="Answer"
                      rows={2}
                      maxLength={1000}
                      value={item.answer}
                      onChange={(e) => updateFaqItem(index, { answer: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </SettingsCard>

        <SettingsCard
          id="contact"
          title="Contact"
          description="How parents reach you and where to follow your business."
        >
          <SettingsRow
            htmlFor="pp-website"
            label="Website"
            description="Link to your own site or booking page."
          >
            <Input
              id="pp-website"
              type="url"
              value={form.website_url}
              onChange={(e) => setField({ website_url: e.target.value })}
            />
          </SettingsRow>

          <Separator />

          <SettingsRow
            htmlFor="pp-email"
            label="Contact email"
            description="Shown as an Email button on your profile."
          >
            <Input
              id="pp-email"
              type="email"
              value={form.contact_email}
              onChange={(e) => setField({ contact_email: e.target.value })}
            />
          </SettingsRow>

          <Separator />

          <SettingsRow
            htmlFor="pp-phone"
            label="Contact phone"
            description="Tap-to-call link on your public profile."
          >
            <Input
              id="pp-phone"
              value={form.contact_phone}
              onChange={(e) => setField({ contact_phone: e.target.value })}
            />
          </SettingsRow>

          <Separator />

          <SettingsRow
            htmlFor="pp-whatsapp"
            label="WhatsApp number"
            description="Course enquiries can be sent straight to WhatsApp, e.g. 85291234567."
          >
            <Input
              id="pp-whatsapp"
              placeholder="e.g. 85291234567"
              value={form.whatsapp_number}
              onChange={(e) => setField({ whatsapp_number: e.target.value })}
            />
          </SettingsRow>

          <Separator />

          <div className="flex flex-col gap-3">
            <div>
              <Label className="text-sm font-medium text-[color:var(--ink)]">Social links</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Icon buttons shown under your tagline.
              </p>
            </div>
            <div className="space-y-2">
              {SOCIAL_NETWORKS.map((network) => {
                const field = `${network.id}_url` as keyof ProfileForm;
                return (
                  <SocialInput
                    key={network.id}
                    network={network}
                    id={`pp-${network.id}`}
                    value={form[field]}
                    onChange={(value) => setField({ [field]: value } as Partial<ProfileForm>)}
                  />
                );
              })}
            </div>
          </div>
        </SettingsCard>

        <div
          className={cn(
            "sticky bottom-4 z-30 rounded-xl border bg-card/95 p-4 shadow-lg backdrop-blur transition-colors",
            isDirty ? "border-[#1FA8B6]/40" : "border-border",
          )}
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
                type="button"
                size="sm"
                loading={saving}
                disabled={!isDirty || saving}
                onClick={() => void saveProfile()}
                className="bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
              >
                Save changes
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Live preview rail */}
      <aside className="min-w-0 self-start lg:sticky lg:top-6">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-[#1FA8B6]" />
            Improve your profile
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {completeness.filled} of {completeness.total} sections complete
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                completeness.pct === 100 ? "bg-emerald-500" : "bg-[#1FA8B6]",
              )}
              style={{ width: `${completeness.pct}%` }}
            />
          </div>
          {missingTips.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {missingTips.map((tip) => (
                <button
                  key={tip.label}
                  type="button"
                  onClick={() =>
                    document
                      .getElementById(tip.section)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-[#1FA8B6]/10 hover:text-[color:var(--ink)]"
                >
                  <Check className="h-3 w-3 opacity-40" />
                  Add {tip.label.toLowerCase()}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <CircleCheck className="h-3.5 w-3.5" />
              Your profile is fully populated
            </p>
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
  );
}
