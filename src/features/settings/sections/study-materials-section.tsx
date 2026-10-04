import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SettingsCard } from "@/features/settings/option-card";
import { useAuth } from "@/features/auth/useAuth";
import { uploadStudyMaterial } from "@/features/materials/materials.functions";
import { supabase } from "@/integrations/supabase/client";

/**
 * Issues #131/#133: the tutor-facing "Study Materials" upload tab (verified
 * tutors only — the tab is gated in settings-page.tsx on verification_tier).
 * The PDF never renders client-side: bytes go to the server fn, which stores
 * the private original, watermarks the first pages, and creates the listing
 * as pending admin review.
 */

type MyListing = {
  id: string;
  title: string;
  is_published: boolean;
  price_hkd: number;
};

const DOCUMENT_TYPES = [
  "custom_notes",
  "past_paper_solutions",
  "ia",
  "ee",
  "tok_essay",
  "mock_exam",
] as const;

export function StudyMaterialsSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [legalAgreed, setLegalAgreed] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    schoolTag: "",
    curriculumTag: "",
    subjectTag: "",
    documentType: "custom_notes" as (typeof DOCUMENT_TYPES)[number],
    yearTag: "",
    pageCount: "",
  });

  const { data: listings = [] } = useQuery({
    queryKey: ["settings", "my-materials", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not signed in");
      // Table added by this PR's migration — cast through unknown until the
      // generated DB types are regenerated.
      const { data, error } = await (
        supabase as unknown as {
          from: (t: string) => {
            select: (c: string) => {
              order: (
                c: string,
                opts: { ascending: boolean },
              ) => Promise<{
                data: MyListing[] | null;
                error?: { message: string };
              }>;
            };
          };
        }
      )
        .from("digital_materials")
        .select("id, title, is_published, price_hkd")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(user),
  });

  const documentTypeOptions = useMemo(
    () =>
      DOCUMENT_TYPES.map((value) => ({
        value,
        label: t(`materials.doc_type_${value}`),
      })),
    [t],
  );

  const setField = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!user || !file) {
      toast.error(t("materials.field_file"));
      return;
    }
    if (!legalAgreed) return;
    setSubmitting(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result ?? "");
          resolve(result.slice(result.indexOf(",") + 1));
        };
        reader.onerror = () => reject(new Error("Failed to read the PDF file."));
        reader.readAsDataURL(file);
      });

      await uploadStudyMaterial({
        data: {
          fileName: file.name,
          base64Data,
          title: form.title,
          description: form.description || undefined,
          priceHkd: Number(form.price),
          schoolTag: form.schoolTag || undefined,
          curriculumTag: form.curriculumTag,
          subjectTag: form.subjectTag || undefined,
          documentType: form.documentType,
          yearTag: form.yearTag || undefined,
          pageCount: form.pageCount ? Number(form.pageCount) : undefined,
          legalAgreed: true,
        },
      });
      toast.success(t("materials.upload_success"));
      setForm({
        title: "",
        description: "",
        price: "",
        schoolTag: "",
        curriculumTag: "",
        subjectTag: "",
        documentType: "custom_notes",
        yearTag: "",
        pageCount: "",
      });
      setLegalAgreed(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await queryClient.invalidateQueries({ queryKey: ["settings", "my-materials"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsCard
        title={t("materials.upload_title")}
        description={t("materials.upload_description")}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="material-title">{t("materials.field_title")}</Label>
              <Input
                id="material-title"
                value={form.title}
                onChange={(event) => setField({ title: event.target.value })}
                required
                minLength={3}
                maxLength={160}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="material-price">{t("materials.field_price")}</Label>
              <Input
                id="material-price"
                type="number"
                min={0}
                step="1"
                value={form.price}
                onChange={(event) => setField({ price: event.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="material-curriculum">{t("materials.field_curriculum")}</Label>
              <Input
                id="material-curriculum"
                value={form.curriculumTag}
                onChange={(event) => setField({ curriculumTag: event.target.value })}
                placeholder="IB / DSE / IGCSE / A-Level"
                required
                maxLength={160}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="material-subject">{t("materials.field_subject")}</Label>
              <Input
                id="material-subject"
                value={form.subjectTag}
                onChange={(event) => setField({ subjectTag: event.target.value })}
                maxLength={160}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="material-school">{t("materials.field_school_tag")}</Label>
              <Input
                id="material-school"
                value={form.schoolTag}
                onChange={(event) => setField({ schoolTag: event.target.value })}
                maxLength={160}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="material-doc-type">{t("materials.field_document_type")}</Label>
              <select
                id="material-doc-type"
                value={form.documentType}
                onChange={(event) =>
                  setField({ documentType: event.target.value as typeof form.documentType })
                }
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {documentTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="material-year">{t("materials.field_year")}</Label>
              <Input
                id="material-year"
                value={form.yearTag}
                onChange={(event) => setField({ yearTag: event.target.value })}
                maxLength={20}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="material-description">{t("materials.field_description")}</Label>
              <textarea
                id="material-description"
                value={form.description}
                onChange={(event) => setField({ description: event.target.value })}
                rows={3}
                maxLength={4000}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="material-file">{t("materials.field_file")}</Label>
              <Input
                id="material-file"
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                required
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-4">
            <Checkbox
              id="material-legal"
              checked={legalAgreed}
              onCheckedChange={(checked) => setLegalAgreed(checked === true)}
              required
            />
            <Label
              htmlFor="material-legal"
              className="text-xs font-medium leading-relaxed text-muted-foreground"
            >
              {t("materials.legal_checkbox")}
            </Label>
          </div>

          <Button type="submit" disabled={submitting || !legalAgreed} className="w-full font-bold">
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileUp className="mr-2 h-4 w-4" aria-hidden />
            )}
            {t("materials.upload_button")}
          </Button>
        </form>
      </SettingsCard>

      {listings.length > 0 ? (
        <SettingsCard title={t("materials.my_listings_title")}>
          <ul className="divide-y divide-border">
            {listings.map((listing) => (
              <li key={listing.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate text-sm font-semibold text-[color:var(--ink)]">
                  {listing.title}
                </span>
                <span
                  className={
                    listing.is_published
                      ? "shrink-0 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400"
                      : "shrink-0 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400"
                  }
                >
                  {listing.is_published
                    ? t("materials.listing_published")
                    : t("materials.listing_pending")}
                </span>
              </li>
            ))}
          </ul>
        </SettingsCard>
      ) : null}
    </div>
  );
}
