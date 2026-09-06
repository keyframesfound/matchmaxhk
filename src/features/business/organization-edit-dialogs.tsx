import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { SOCIAL_NETWORKS, SocialInput } from "@/components/business/social-links";
import { HK_DISTRICTS } from "@/features/tutors/queries";
import { parseYouTubeUrl } from "@/lib/youtube";
import { updateOrganization, type OrgFaqItem } from "@/features/business/business.functions";
import type { OrganizationPublic } from "@/features/courses/queries";

export function normalizeFaq(value: unknown): OrgFaqItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = item as Record<string, unknown> | null;
      const question = typeof record?.question === "string" ? record.question : "";
      const answer = typeof record?.answer === "string" ? record.answer : "";
      return { question, answer };
    })
    .filter((item) => item.question.trim() && item.answer.trim());
}

function useOrgSaver(slug: string) {
  const updateOrgFn = useServerFn(updateOrganization);
  const queryClient = useQueryClient();
  return async (patch: Record<string, unknown>) => {
    const orgId = patch.orgId as string;
    await (updateOrgFn({ data: patch }) as Promise<unknown>);
    toast.success("Profile updated");
    void queryClient.invalidateQueries({ queryKey: ["organization-profile", slug] });
    void queryClient.invalidateQueries({ queryKey: ["organization-profile-courses"] });
    void queryClient.invalidateQueries({ queryKey: ["my-organization"] });
    void queryClient.invalidateQueries({ queryKey: ["my-org-role"] });
    void orgId;
  };
}

function SaveFooter({
  saving,
  onCancel,
  onSave,
}: {
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <DialogFooter className="mt-2 gap-2 sm:justify-end">
      <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      <Button type="submit" loading={saving} className="font-bold">
        Save changes
      </Button>
    </DialogFooter>
  );
}

export function OrgIdentityDialog({
  org,
  open,
  onOpenChange,
}: {
  org: OrganizationPublic;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useOrgSaver(org.slug);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: org.name,
    tagline: org.tagline ?? "",
    district: org.district ?? "",
  });

  useEffect(() => {
    if (open) {
      setForm({ name: org.name, tagline: org.tagline ?? "", district: org.district ?? "" });
    }
  }, [open, org]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await save({
        orgId: org.id,
        name: form.name.trim(),
        tagline: form.tagline,
        district: form.district || undefined,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit business details</DialogTitle>
          <DialogDescription>Shown at the top of your public profile.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="od-name">Business / centre name *</Label>
            <Input
              id="od-name"
              required
              maxLength={120}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="od-tagline">Tagline</Label>
            <Input
              id="od-tagline"
              maxLength={160}
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>District</Label>
            <SearchableSelect
              value={form.district}
              onChange={(v) => setForm({ ...form, district: v })}
              options={[
                { value: "", label: "No district" },
                ...HK_DISTRICTS.map((d) => ({ value: d, label: d })),
              ]}
              placeholder="No district"
              searchPlaceholder="Search district..."
            />
          </div>
          <SaveFooter saving={saving} onCancel={() => onOpenChange(false)} onSave={() => {}} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OrgAboutDialog({
  org,
  open,
  onOpenChange,
}: {
  org: OrganizationPublic;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useOrgSaver(org.slug);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    description: org.description ?? "",
    founded_year: org.founded_year ? String(org.founded_year) : "",
    languages: org.languages ?? "",
    intro_video_url: org.intro_video_url ?? "",
  });
  const [faqItems, setFaqItems] = useState<OrgFaqItem[]>([]);

  useEffect(() => {
    if (open) {
      setForm({
        description: org.description ?? "",
        founded_year: org.founded_year ? String(org.founded_year) : "",
        languages: org.languages ?? "",
        intro_video_url: org.intro_video_url ?? "",
      });
      setFaqItems(normalizeFaq(org.faq));
    }
  }, [open, org]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.intro_video_url.trim() && !parseYouTubeUrl(form.intro_video_url)) {
      toast.error("That doesn't look like a YouTube link");
      return;
    }
    setSaving(true);
    try {
      await save({
        orgId: org.id,
        description: form.description,
        founded_year: form.founded_year.trim() ? Number(form.founded_year) : null,
        languages: form.languages,
        intro_video_url: form.intro_video_url,
        faq: faqItems.filter((item) => item.question.trim() && item.answer.trim()),
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit about & FAQ</DialogTitle>
          <DialogDescription>
            Tell parents who you are and answer common questions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="oa-description">About</Label>
            <Textarea
              id="oa-description"
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Separate paragraphs with a blank line.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="oa-founded">Founded year</Label>
              <Input
                id="oa-founded"
                type="number"
                min={1900}
                max={2100}
                placeholder="e.g. 2015"
                value={form.founded_year}
                onChange={(e) => setForm({ ...form, founded_year: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oa-languages">Languages</Label>
              <Input
                id="oa-languages"
                maxLength={200}
                placeholder="e.g. English, Cantonese"
                value={form.languages}
                onChange={(e) => setForm({ ...form, languages: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="oa-video">Intro video (YouTube)</Label>
            <Input
              id="oa-video"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={form.intro_video_url}
              onChange={(e) => setForm({ ...form, intro_video_url: e.target.value })}
            />
            {form.intro_video_url.trim() && !parseYouTubeUrl(form.intro_video_url) ? (
              <p className="text-xs text-red-500">
                That doesn't look like a YouTube link. Paste a youtube.com/watch, youtu.be or
                /shorts URL.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                A short intro video builds trust. It shows at the top of your About tab.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>FAQ</Label>
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
            {faqItems.map((item, index) => (
              <div key={index} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
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
                  placeholder="Question"
                  maxLength={200}
                  value={item.question}
                  onChange={(e) =>
                    setFaqItems((prev) =>
                      prev.map((entry, i) =>
                        i === index ? { ...entry, question: e.target.value } : entry,
                      ),
                    )
                  }
                />
                <Textarea
                  placeholder="Answer"
                  rows={2}
                  maxLength={1000}
                  value={item.answer}
                  onChange={(e) =>
                    setFaqItems((prev) =>
                      prev.map((entry, i) =>
                        i === index ? { ...entry, answer: e.target.value } : entry,
                      ),
                    )
                  }
                />
              </div>
            ))}
          </div>

          <SaveFooter saving={saving} onCancel={() => onOpenChange(false)} onSave={() => {}} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OrgContactDialog({
  org,
  open,
  onOpenChange,
}: {
  org: OrganizationPublic;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useOrgSaver(org.slug);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    website_url: org.website_url ?? "",
    contact_email: org.contact_email ?? "",
    contact_phone: org.contact_phone ?? "",
    whatsapp_number: org.whatsapp_number ?? "",
    youtube_url: org.youtube_url ?? "",
    linkedin_url: org.linkedin_url ?? "",
    x_url: org.x_url ?? "",
    rednote_url: org.rednote_url ?? "",
    instagram_url: org.instagram_url ?? "",
    facebook_url: org.facebook_url ?? "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        website_url: org.website_url ?? "",
        contact_email: org.contact_email ?? "",
        contact_phone: org.contact_phone ?? "",
        whatsapp_number: org.whatsapp_number ?? "",
        youtube_url: org.youtube_url ?? "",
        linkedin_url: org.linkedin_url ?? "",
        x_url: org.x_url ?? "",
        rednote_url: org.rednote_url ?? "",
        instagram_url: org.instagram_url ?? "",
        facebook_url: org.facebook_url ?? "",
      });
    }
  }, [open, org]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await save({ orgId: org.id, ...form });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit contact details</DialogTitle>
          <DialogDescription>How parents reach you on your public profile.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="oc-website">Website</Label>
            <Input
              id="oc-website"
              type="url"
              value={form.website_url}
              onChange={(e) => setForm({ ...form, website_url: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="oc-email">Contact email</Label>
            <Input
              id="oc-email"
              type="email"
              value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="oc-phone">Contact phone</Label>
            <Input
              id="oc-phone"
              value={form.contact_phone}
              onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="oc-whatsapp">WhatsApp number</Label>
            <Input
              id="oc-whatsapp"
              placeholder="e.g. 85291234567"
              value={form.whatsapp_number}
              onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
            />
          </div>
          <div className="space-y-2.5">
            <Label>Social links</Label>
            {SOCIAL_NETWORKS.map((network) => {
              const field = `${network.id}_url` as keyof typeof form;
              return (
                <SocialInput
                  key={network.id}
                  network={network}
                  id={`oc-${network.id}`}
                  value={form[field]}
                  onChange={(value) => setForm({ ...form, [field]: value })}
                />
              );
            })}
          </div>
          <SaveFooter saving={saving} onCancel={() => onOpenChange(false)} onSave={() => {}} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
