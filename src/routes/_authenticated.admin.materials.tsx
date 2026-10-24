import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Check,
  Download,
  FileUp,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Star,
  X,
} from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  ConsoleTable,
  ConsoleTableBody,
  ConsoleTableEmpty,
  ConsoleTableHead,
  ConsoleTableSkeletonRows,
  ConsoleTd,
  ConsoleTh,
} from "@/components/ui/console-table";
import {
  getMaterialOriginalUrl,
  listAllMaterialsAdmin,
  listPendingGigReviews,
  listPendingListingReviews,
  reviewGigListing,
  reviewListing,
  updateMaterialAdmin,
  type AdminMaterialRow,
  type PendingGigReviewRow,
  type PendingListingReviewRow,
} from "@/features/materials/materials.functions";
import {
  exportTutorPayoutCsv,
  parsePayoutMonthWindow,
} from "@/features/materials/orders.functions";
import {
  DEFAULT_TURNAROUND_HOURS,
  findIntegrityRedFlags,
  gigCategoryLabelKey,
  gigDeliveryLabelKey,
} from "@/features/gigs/gig";

import { MaterialsOrdersDesk } from "@/features/materials/materials-orders-desk";
import { formatMaterialTypeLabel } from "@/features/materials/queries";
import { shopKindLabel } from "@/features/materials/material-card";
import { validateCourseVideoUrl } from "@/lib/vimeo";
import { MATERIAL_TYPES, NOTE_CURRICULA } from "@/features/materials/lifecycle";
import { getSubjectOptionsForCategory } from "@/features/tutors/subjects";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/materials")({
  head: () => ({
    meta: [
      { title: "Study Materials, MatchMax Admin" },
      { name: "description", content: "Manage the study materials marketplace listings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminMaterials,
});

type AdminTutorOption = { id: string; display_name: string; tutor_code: string };

/**
 * Issue #131/#133/#134: admin management for the study-materials marketplace.
 * One table of every listing (publish toggle, star rating, commission
 * status, signed-URL download of the private original) plus an "Add listing"
 * dialog that runs the same watermarking pipeline as the tutor upload —
 * Ryan: admins enter listings like tutors are entered.
 */
function AdminMaterials() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AdminMaterialRow | null>(null);
  const [legalAgreed, setLegalAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    tutorId: "",
    title: "",
    description: "",
    price: "",
    schoolTag: "",
    curriculumTag: "",
    subjectTag: "",
    materialType: "notes" as "notes" | "mock" | "exemplar" | "flashcards",
    topic: "",
    gradeAchieved: "",
    exemplarPermission: false,
    wordCount: "",
    yearTag: "",
    pageCount: "",
    adminStarRating: "",
    adminMarketingSummary: "",
  });

  const materialsQuery = useQuery({
    queryKey: ["admin", "materials"],
    queryFn: () => listAllMaterialsAdmin(),
    enabled: Boolean(user),
  });

  const tutorsQuery = useQuery({
    queryKey: ["admin", "materials", "tutor-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select("id, display_name, tutor_code")
        .eq("is_published", true)
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as AdminTutorOption[];
    },
    enabled: Boolean(user),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "materials"] });

  const updateMutation = useMutation({
    mutationFn: (patch: {
      materialId: string;
      isPublished?: boolean;
      adminStarRating?: number | null;
      adminMarketingSummary?: string | null;
      commissionStatus?: "pending" | "invoiced" | "settled";
    }) => updateMaterialAdmin({ data: patch }),
    onSuccess: () => {
      toast.success("Listing updated.");
      void invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed."),
  });

  const downloadMutation = useMutation({
    mutationFn: (materialId: string) => getMaterialOriginalUrl({ data: { materialId } }),
    onSuccess: (result) => {
      window.open(result.signedUrl, "_blank", "noopener");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Download failed."),
  });

  // Issue #250: monthly payout export. Grant rows (HK$0 staff grants) are
  // excluded server-side; the window is a month of delivered_at (HKT) so
  // re-exporting a prior month cannot silently re-pay newer rows.
  const currentMonth = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
  }); // YYYY-MM (en-CA gives ISO-style output)
  const [payoutMonth, setPayoutMonth] = useState(currentMonth);
  const payoutExportMutation = useMutation({
    mutationFn: (month: string) => {
      const { from, to } = parsePayoutMonthWindow(month);
      return exportTutorPayoutCsv({ data: { from, to } });
    },
    onSuccess: (result) => {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(
        result.rowCount === 1
          ? "1 payout row exported."
          : `${result.rowCount} payout rows exported.`,
      );
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Export failed."),
  });

  const setField = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  const resetForm = () => {
    setForm({
      tutorId: "",
      title: "",
      description: "",
      price: "",
      schoolTag: "",
      curriculumTag: "",
      subjectTag: "",
      materialType: "notes",
      topic: "",
      gradeAchieved: "",
      exemplarPermission: false,
      wordCount: "",
      yearTag: "",
      pageCount: "",
      adminStarRating: "",
      adminMarketingSummary: "",
    });
    setLegalAgreed(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAdd = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error(t("materials.field_file"));
      return;
    }
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

      // Same watermark pipeline as the tutor flow; tutorId routes it through
      // the admin path (server fn verifies the admin role and publishes).
      const { uploadStudyMaterial } = await import("@/features/materials/materials.functions");
      await uploadStudyMaterial({
        data: {
          fileName: file.name,
          base64Data,
          title: form.title,
          description: form.description || undefined,
          priceHkd: Number(form.price),
          schoolTag: form.schoolTag || undefined,
          curriculumTag: form.curriculumTag,
          subjectTag: form.subjectTag,
          materialType: form.materialType,
          topic: form.topic || undefined,
          gradeAchieved:
            form.materialType === "exemplar" ? form.gradeAchieved || undefined : undefined,
          exemplarPermission:
            form.materialType === "exemplar" ? form.exemplarPermission : undefined,
          wordCount: form.wordCount ? Number(form.wordCount) : undefined,
          yearTag: form.yearTag || undefined,
          pageCount: form.pageCount ? Number(form.pageCount) : undefined,
          legalAgreed: true,
          tutorId: form.tutorId,
        },
      });

      // Trust fields (rating / summary) ride the admin update fn, look the
      // new row up by refetching the admin list.
      if (form.adminStarRating || form.adminMarketingSummary) {
        const latest = await queryClient.fetchQuery({
          queryKey: ["admin", "materials"],
          queryFn: () => listAllMaterialsAdmin(),
        });
        const inserted = (latest ?? []).find((row) => row.title === form.title);
        if (inserted) {
          await updateMaterialAdmin({
            data: {
              materialId: inserted.id,
              adminStarRating: form.adminStarRating ? Number(form.adminStarRating) : null,
              adminMarketingSummary: form.adminMarketingSummary || null,
            },
          });
        }
      }

      toast.success(t("materials.upload_success"));
      resetForm();
      setAddOpen(false);
      await invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-[color:var(--ink)]/65">
          <BookOpen className="h-4 w-4" aria-hidden />
          {materialsQuery.data
            ? `${materialsQuery.data.length} listing${materialsQuery.data.length === 1 ? "" : "s"}`
            : ""}
        </p>
        <div className="flex items-center gap-2">
          {/* Review blocker fix: payout export is scoped to one month of
              delivered_at (HKT); defaults to the current month. */}
          <Label htmlFor="payout-month" className="sr-only">
            Payout month
          </Label>
          <Input
            id="payout-month"
            type="month"
            value={payoutMonth}
            onChange={(e) => setPayoutMonth(e.target.value)}
            className="h-9 w-[10.5rem]"
          />
          <Button
            variant="outline"
            onClick={() => payoutExportMutation.mutate(payoutMonth)}
            disabled={payoutExportMutation.isPending || !payoutMonth}
          >
            {payoutExportMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="mr-2 h-4 w-4" aria-hidden />
            )}
            Export payouts
          </Button>
          <Button onClick={() => setAddOpen(true)} className="font-medium">
            <FileUp className="mr-2 h-4 w-4" aria-hidden />
            Add listing
          </Button>
        </div>
      </div>

      {/* -----------------------------------------------------------------
          Gig review queue (#326/#327): pending freestyle listings with the
          cover, category, delivery type, turnaround and integrity state —
          red-flag copy needs a human decision, never an auto-reject.
      ------------------------------------------------------------------ */}
      <GigReviewQueue />

      {/* -----------------------------------------------------------------
          #392 folder + course review queue: folders with itemised children,
          courses with lesson titles + the ACTUAL embeds rendered on-screen —
          the human eye is the reject path for WA/phone/IG/QR in videos.
      ------------------------------------------------------------------ */}
      <ListingReviewQueue />

      <ConsoleTable>
        <ConsoleTableHead>
          <ConsoleTh className="w-[30%]">Title</ConsoleTh>
          <ConsoleTh>Tutor</ConsoleTh>
          <ConsoleTh>Price</ConsoleTh>
          <ConsoleTh>Rating</ConsoleTh>
          <ConsoleTh>Commission</ConsoleTh>
          <ConsoleTh>Status</ConsoleTh>
          <ConsoleTh className="text-right">Actions</ConsoleTh>
        </ConsoleTableHead>
        <ConsoleTableBody>
          {materialsQuery.isLoading ? (
            <ConsoleTableSkeletonRows columns={7} />
          ) : (materialsQuery.data ?? []).length === 0 ? (
            <ConsoleTableEmpty
              colSpan={7}
              title="No listings yet"
              description="No study materials uploaded yet."
            />
          ) : (
            (materialsQuery.data ?? []).map((row) => (
              <tr key={row.id} className="border-b border-border last:border-b-0">
                <ConsoleTd className="max-w-[16rem]">
                  <span className="block truncate font-medium text-[color:var(--ink)]">
                    {row.title}
                  </span>
                  <span className="text-xs text-[color:var(--ink)]/55">
                    {formatMaterialTypeLabel(row.material_type, t)}
                    {row.word_count != null
                      ? ` · ${t("notes.card.word_count", { count: row.word_count })}`
                      : ""}
                  </span>
                </ConsoleTd>
                <ConsoleTd>
                  <span className="text-sm">{row.tutors?.display_name ?? "—"}</span>
                  <span className="block text-xs text-[color:var(--ink)]/55">
                    {row.tutors?.tutor_code ?? ""}
                  </span>
                </ConsoleTd>
                <ConsoleTd>${Number(row.price_hkd).toFixed(0)}</ConsoleTd>
                <ConsoleTd>
                  <span className="inline-flex items-center gap-1 text-sm">
                    <Star
                      className={
                        row.admin_star_rating
                          ? "h-4 w-4 fill-amber-400 text-amber-500"
                          : "h-4 w-4 text-muted-foreground/40"
                      }
                      aria-hidden
                    />
                    {row.admin_star_rating ? Number(row.admin_star_rating).toFixed(1) : "—"}
                  </span>
                </ConsoleTd>
                <ConsoleTd>
                  <select
                    value={row.commission_status}
                    onChange={(event) =>
                      updateMutation.mutate({
                        materialId: row.id,
                        commissionStatus: event.target.value as "pending" | "invoiced" | "settled",
                      })
                    }
                    className="h-8 rounded-md border border-border bg-transparent px-1.5 text-xs"
                    aria-label="Commission status"
                  >
                    <option value="pending">Pending</option>
                    <option value="invoiced">Invoiced</option>
                    <option value="settled">Settled</option>
                  </select>
                </ConsoleTd>
                <ConsoleTd>
                  <button
                    type="button"
                    onClick={() =>
                      updateMutation.mutate({
                        materialId: row.id,
                        isPublished: row.status !== "published",
                      })
                    }
                    className={
                      row.status === "published"
                        ? "rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                        : row.status === "pending_review"
                          ? "rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700"
                          : "rounded-md bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-slate-600"
                    }
                  >
                    {row.status === "published"
                      ? "Published"
                      : row.status === "pending_review"
                        ? "Pending review"
                        : row.status === "rejected"
                          ? "Rejected"
                          : row.status === "hidden"
                            ? "Hidden"
                            : "Draft"}
                  </button>
                </ConsoleTd>
                <ConsoleTd className="text-right">
                  <div className="inline-flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadMutation.mutate(row.id)}
                      aria-label="Download original file"
                    >
                      <Download className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(row)}
                      aria-label="Edit trust fields"
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </ConsoleTd>
              </tr>
            ))
          )}
        </ConsoleTableBody>
      </ConsoleTable>

      {/* -----------------------------------------------------------------
          Orders desk (#203): the manual cashier queue. Staff match the FPS
          transfer, mark paid, then release, release stamps the per-order
          copy (order id + buyer id) and flips the buyer's Download on.
      ------------------------------------------------------------------ */}
      <MaterialsOrdersDesk />

      {/* Add listing dialog, same watermarking pipeline as the tutor flow. */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add study material listing</DialogTitle>
            <DialogDescription>
              Uploads run the same watermarking pipeline: the original is stored privately and a
              watermarked preview is generated for the public listing.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleAdd();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="admin-material-tutor">Tutor (author)</Label>
                <select
                  id="admin-material-tutor"
                  value={form.tutorId}
                  onChange={(event) => setField({ tutorId: event.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  required
                >
                  <option value="">Select a tutor…</option>
                  {(tutorsQuery.data ?? []).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.display_name} ({option.tutor_code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="admin-material-title">{t("materials.field_title")}</Label>
                <Input
                  id="admin-material-title"
                  value={form.title}
                  onChange={(event) => setField({ title: event.target.value })}
                  required
                  minLength={3}
                  maxLength={160}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-material-price">{t("materials.field_price")}</Label>
                <Input
                  id="admin-material-price"
                  type="number"
                  min={0}
                  step="1"
                  value={form.price}
                  onChange={(event) => setField({ price: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-material-curriculum">{t("materials.field_curriculum")}</Label>
                <select
                  id="admin-material-curriculum"
                  value={form.curriculumTag}
                  onChange={(event) =>
                    setField({ curriculumTag: event.target.value, subjectTag: "" })
                  }
                  required
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="" disabled>
                    {t("notes.form.curriculum_placeholder")}
                  </option>
                  {NOTE_CURRICULA.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry === "Other" ? t("notes.form.curriculum_other") : entry}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-material-subject">{t("materials.field_subject")}</Label>
                <select
                  id="admin-material-subject"
                  value={form.subjectTag}
                  onChange={(event) => setField({ subjectTag: event.target.value })}
                  required
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="" disabled>
                    {t("notes.form.subject_placeholder")}
                  </option>
                  {getSubjectOptionsForCategory(form.curriculumTag || undefined).map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-material-school">{t("materials.field_school_tag")}</Label>
                <Input
                  id="admin-material-school"
                  value={form.schoolTag}
                  onChange={(event) => setField({ schoolTag: event.target.value })}
                  maxLength={160}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-material-type">{t("notes.form.field_type")}</Label>
                <select
                  id="admin-material-type"
                  value={form.materialType}
                  onChange={(event) =>
                    setField({
                      materialType: event.target.value as typeof form.materialType,
                      ...(event.target.value !== "exemplar"
                        ? { gradeAchieved: "", exemplarPermission: false }
                        : {}),
                    })
                  }
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {MATERIAL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`notes.form.type_${type}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-material-topic">{t("notes.form.field_topic")}</Label>
                <Input
                  id="admin-material-topic"
                  value={form.topic}
                  onChange={(event) => setField({ topic: event.target.value })}
                  maxLength={40}
                />
              </div>
              {form.materialType === "exemplar" ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-material-grade">{t("notes.form.field_grade")}</Label>
                    <Input
                      id="admin-material-grade"
                      value={form.gradeAchieved}
                      onChange={(event) => setField({ gradeAchieved: event.target.value })}
                      maxLength={20}
                      placeholder={t("notes.form.grade_placeholder")}
                    />
                    <p className="text-xs text-muted-foreground">{t("notes.form.grade_hint")}</p>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
                      <input
                        type="checkbox"
                        checked={form.exemplarPermission}
                        onChange={(event) => setField({ exemplarPermission: event.target.checked })}
                        className="mt-1 h-4 w-4 shrink-0"
                      />
                      <span>{t("notes.form.exemplar_permission")}</span>
                    </label>
                  </div>
                </>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="admin-material-word-count">
                  {t("notes.form.field_word_count")}
                </Label>
                <Input
                  id="admin-material-word-count"
                  type="number"
                  min={1}
                  step="1"
                  value={form.wordCount}
                  onChange={(event) => setField({ wordCount: event.target.value })}
                  placeholder="12000"
                />
                <p className="text-xs text-muted-foreground">{t("notes.form.word_count_hint")}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-material-rating">Star rating (optional)</Label>
                <Input
                  id="admin-material-rating"
                  type="number"
                  min={1}
                  max={5}
                  step="0.1"
                  value={form.adminStarRating}
                  onChange={(event) => setField({ adminStarRating: event.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="admin-material-summary">Marketing summary (optional)</Label>
                <textarea
                  id="admin-material-summary"
                  value={form.adminMarketingSummary}
                  onChange={(event) => setField({ adminMarketingSummary: event.target.value })}
                  rows={2}
                  maxLength={4000}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="admin-material-file">{t("materials.field_file")}</Label>
                <Input
                  id="admin-material-file"
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf,.apkg"
                  required
                />
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
              <Checkbox
                id="admin-material-legal"
                checked={legalAgreed}
                onCheckedChange={(checked) => setLegalAgreed(checked === true)}
                required
              />
              <Label
                htmlFor="admin-material-legal"
                className="text-xs font-medium leading-relaxed text-muted-foreground"
              >
                {t("materials.legal_checkbox")}
              </Label>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting || !legalAgreed} className="font-medium">
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <FileUp className="mr-2 h-4 w-4" aria-hidden />
                )}
                {t("materials.upload_button")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit trust fields dialog. */}
      <EditMaterialDialog
        material={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSave={(patch) => {
          updateMutation.mutate(
            {
              materialId: editing?.id ?? "",
              adminStarRating: patch.rating,
              adminMarketingSummary: patch.summary,
            },
            {
              onSuccess: () => setEditing(null),
            },
          );
        }}
      />
    </div>
  );
}

/** Rejection presets for gig listings (the value is stored in rejection_reason). */
const GIG_REJECT_PRESETS: { labelKey: string; value: string }[] = [
  {
    labelKey: "gigs.admin_reject_preset_integrity",
    value:
      "Academic integrity: this listing offers to complete graded work for the student, which MatchMax does not allow.",
  },
  {
    labelKey: "gigs.admin_reject_preset_scarcity",
    value:
      "Not allowed on MatchMax: seat-scarcity or tutor-recruiting copy must not appear in listings.",
  },
];

/**
 * #326/#327: the gig review queue. Pending freestyle listings with cover
 * thumb, category, delivery type, turnaround, and, for document_review —
 * the academic-integrity state (approving without the recorded confirmation
 * is blocked server-side; the button mirrors that). Red-flag copy shows a
 * human-review banner: a hint to staff, never an auto-reject. Gig approval
 * requires no file stamping, gigs carry no original/preview pipeline.
 */
function GigReviewQueue() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<PendingGigReviewRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [presetKey, setPresetKey] = useState("");

  const reviewsQuery = useQuery({
    queryKey: ["admin", "gig-reviews"],
    queryFn: listPendingGigReviews,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "gig-reviews"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "materials"] });
  };

  const reviewMutation = useMutation({
    mutationFn: (input: { materialId: string; approve: boolean; reason?: string }) =>
      reviewGigListing({ data: input }),
    onSuccess: () => {
      toast.success(t("gigs.admin_review_decided"));
      setRejectTarget(null);
      setRejectReason("");
      void invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Review failed."),
  });

  const rows = reviewsQuery.data ?? [];
  if (reviewsQuery.isLoading || rows.length === 0) return null;

  return (
    <section className="space-y-3 rounded-md border border-amber-500/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-medium">{t("gigs.admin_review_title")}</h3>
        <p className="text-sm text-[color:var(--ink)]/65">
          {t("gigs.admin_review_count", { count: rows.length })}
        </p>
      </div>
      <div className="space-y-3">
        {rows.map((row) => {
          const flags = findIntegrityRedFlags(`${row.title}\n${row.description ?? ""}`);
          const integrityMissing =
            row.gig_category === "document_review" && !row.integrity_confirmed_at;
          const coverUrl = row.cover_image_path
            ? (supabase.storage.from("materials-previews").getPublicUrl(row.cover_image_path).data
                ?.publicUrl ?? "")
            : "";
          return (
            <div key={row.id} className="space-y-2 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-start gap-3">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={t("gigs.admin_cover_alt")}
                    className="h-12 w-12 shrink-0 rounded-md border border-border object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground"
                    aria-hidden
                  >
                    <ImageIcon className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[color:var(--ink)]">{row.title}</p>
                  <p className="text-xs text-[color:var(--ink)]/55">
                    {row.tutors?.display_name ?? "—"} ({row.tutors?.tutor_code ?? ""}) · HK$
                    {Number(row.price_hkd).toFixed(0)}
                  </p>
                  {row.description && (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--ink)]/65">
                      {row.description}
                    </p>
                  )}
                </div>
                <div className="text-xs text-[color:var(--ink)]/65">
                  <p>{t(gigCategoryLabelKey(row.gig_category ?? "other"))}</p>
                  <p>{t(gigDeliveryLabelKey(row.gig_delivery_type ?? "file_back"))}</p>
                  <p>
                    {row.turnaround_note ||
                      t("gigs.admin_turnaround_hours", {
                        hours: row.turnaround_hours ?? DEFAULT_TURNAROUND_HOURS,
                      })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {row.gig_category === "document_review" && (
                    <span
                      className={
                        integrityMissing
                          ? "rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-700"
                          : "rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                      }
                    >
                      {integrityMissing
                        ? t("gigs.admin_review_integrity_missing")
                        : t("gigs.admin_review_integrity_ok")}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={integrityMissing || reviewMutation.isPending}
                      onClick={() => reviewMutation.mutate({ materialId: row.id, approve: true })}
                    >
                      <Check className="mr-1 h-4 w-4" aria-hidden />
                      {t("gigs.admin_review_approve")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t("gigs.admin_review_reject")}
                      onClick={() => {
                        setRejectReason("");
                        setPresetKey("");
                        setRejectTarget(row);
                      }}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </div>
              {flags.length > 0 && (
                <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2">
                  <p className="text-xs font-medium text-amber-800">
                    {t("gigs.admin_review_red_flag_banner")}
                  </p>
                  <p className="mt-1 break-all font-mono text-[10px] text-amber-700">
                    {flags.join(" · ")}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reject dialog: preset chips fill an editable reason that is stored
          in rejection_reason (the tutor sees it in Account). */}
      <Dialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("gigs.admin_review_reject_title")}</DialogTitle>
            <DialogDescription>{rejectTarget?.title ?? ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gig-reject-preset">{t("gigs.admin_reject_preset_label")}</Label>
              <select
                id="gig-reject-preset"
                value={presetKey}
                onChange={(event) => {
                  setPresetKey(event.target.value);
                  const preset = GIG_REJECT_PRESETS.find((p) => p.labelKey === event.target.value);
                  if (preset) setRejectReason(preset.value);
                }}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">{t("gigs.admin_reject_preset_placeholder")}</option>
                {GIG_REJECT_PRESETS.map((preset) => (
                  <option key={preset.labelKey} value={preset.labelKey}>
                    {t(preset.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gig-reject-reason">
                {t("gigs.admin_review_reject_reason_label")}
              </Label>
              <textarea
                id="gig-reject-reason"
                rows={3}
                maxLength={500}
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              {t("gigs.admin_desk_cancel")}
            </Button>
            <Button
              className="font-medium"
              disabled={rejectReason.trim().length < 3 || reviewMutation.isPending}
              onClick={() =>
                rejectTarget &&
                reviewMutation.mutate({
                  materialId: rejectTarget.id,
                  approve: false,
                  reason: rejectReason.trim(),
                })
              }
            >
              {reviewMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {t("gigs.admin_review_reject_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Reject presets for the #392 shop listings (stored in rejection_reason). */
const LISTING_REJECT_PRESETS: { value: string }[] = [
  {
    value:
      "Contact details: a WhatsApp number, phone, Instagram handle or QR code is visible in the listing or its videos. Remove them and resubmit, buyers are matched through MatchMax only.",
  },
  {
    value:
      "Not allowed on MatchMax: the listing copy or videos advertise off-platform tutoring or tutor-recruiting.",
  },
];

/**
 * #392: the folder + course review queue. Folders show every child (title +
 * price); courses show lesson titles + provider chips AND render the ACTUAL
 * embeds on-screen so staff can watch each video for WhatsApp numbers,
 * phone numbers, Instagram handles or QR codes (the contact filter only
 * covers copy, the VIDEO is the human-review reject path). Uses the
 * generalized reviewListing for the decision; rejection presets store the
 * reason the tutor sees.
 */
function ListingReviewQueue() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<PendingListingReviewRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const reviewsQuery = useQuery({
    queryKey: ["admin", "listing-reviews"],
    queryFn: listPendingListingReviews,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "listing-reviews"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "materials"] });
  };

  const reviewMutation = useMutation({
    mutationFn: (input: { materialId: string; approve: boolean; reason?: string }) =>
      reviewListing({ data: input }),
    onSuccess: () => {
      toast.success(t("gigs.admin_review_decided"));
      setRejectTarget(null);
      setRejectReason("");
      void invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Review failed."),
  });

  const rows = reviewsQuery.data ?? [];
  if (reviewsQuery.isLoading || rows.length === 0) return null;

  return (
    <section className="space-y-3 rounded-md border border-amber-500/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-medium">{t("shop.admin_review_title")}</h3>
        <p className="text-sm text-[color:var(--ink)]/65">
          {t("shop.admin_review_count", { count: rows.length })}
        </p>
      </div>
      <p className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs font-medium text-amber-800">
        {t("shop.admin_review_video_banner")}
      </p>
      <div className="space-y-3">
        {rows.map((row) => {
          const isCourse =
            row.material_type === "video_course" || row.material_type === "general_course";
          const coverUrl = row.cover_image_path
            ? (supabase.storage.from("materials-previews").getPublicUrl(row.cover_image_path).data
                ?.publicUrl ?? "")
            : "";
          return (
            <div key={row.id} className="space-y-2 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-start gap-3">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={t("gigs.admin_cover_alt")}
                    className="h-12 w-12 shrink-0 rounded-md border border-border object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground"
                    aria-hidden
                  >
                    <ImageIcon className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[color:var(--ink)]">{row.title}</p>
                  <p className="text-xs text-[color:var(--ink)]/55">
                    {row.tutors?.display_name ?? "—"} ({row.tutors?.tutor_code ?? ""}) · HK$
                    {Number(row.price_hkd).toFixed(0)}
                  </p>
                  {row.description ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--ink)]/65">
                      {row.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-[color:var(--ink)]">
                    {shopKindLabel(row.material_type, t)}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={reviewMutation.isPending}
                      onClick={() => reviewMutation.mutate({ materialId: row.id, approve: true })}
                    >
                      <Check className="mr-1 h-4 w-4" aria-hidden />
                      {t("gigs.admin_review_approve")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t("gigs.admin_review_reject")}
                      onClick={() => {
                        setRejectReason("");
                        setRejectTarget(row);
                      }}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </div>

              {isCourse ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[color:var(--ink)]/70">
                    {t("shop.admin_review_lessons", { count: row.lessons.length })}
                  </p>
                  <ul className="space-y-2">
                    {row.lessons.map((lesson) => {
                      const embed = validateCourseVideoUrl(lesson.videoUrl);
                      return (
                        <li
                          key={`${row.id}-${lesson.position}`}
                          className="rounded-md border border-border p-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-medium text-[color:var(--ink)]">
                              {lesson.position}. {lesson.title}
                            </p>
                            <span className="flex items-center gap-2 text-[11px] text-[color:var(--ink)]/60">
                              {lesson.videoProvider ? (
                                <span className="rounded-md bg-muted/50 px-1.5 py-0.5 font-medium uppercase">
                                  {lesson.videoProvider}
                                </span>
                              ) : null}
                              {lesson.hasPdf ? (
                                <span className="rounded-md bg-muted/50 px-1.5 py-0.5 font-medium">
                                  PDF
                                </span>
                              ) : null}
                            </span>
                          </div>
                          {embed ? (
                            <div className="mt-2 aspect-video w-full overflow-hidden rounded-md border border-border bg-muted/20">
                              <iframe
                                src={embed.embedUrl}
                                title={lesson.title}
                                loading="lazy"
                                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="h-full w-full"
                              />
                            </div>
                          ) : (
                            <p className="mt-1 text-[11px] text-[color:var(--ink)]/50">
                              {t("shop.admin_review_no_embed")}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-[color:var(--ink)]/70">
                    {t("shop.admin_review_children", { count: row.children.length })}
                  </p>
                  <ul className="space-y-1">
                    {row.children.map((child) => (
                      <li
                        key={child.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1 text-xs"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium text-[color:var(--ink)]">
                          {child.title}
                        </span>
                        <span className="shrink-0 text-[color:var(--ink)]/60">
                          {formatMaterialTypeLabel(child.materialType, t)}
                        </span>
                        <span className="shrink-0 font-medium text-[color:var(--ink)]">
                          HK${Number(child.priceHkd).toFixed(0)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reject dialog, same shape as the gig queue. */}
      <Dialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("gigs.admin_review_reject_title")}</DialogTitle>
            <DialogDescription>{rejectTarget?.title ?? ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="listing-reject-preset">{t("gigs.admin_reject_preset_label")}</Label>
              <select
                id="listing-reject-preset"
                value=""
                onChange={(event) => {
                  const preset = LISTING_REJECT_PRESETS.find((p) => p.value === event.target.value);
                  if (preset) setRejectReason(preset.value);
                }}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">{t("gigs.admin_reject_preset_placeholder")}</option>
                <option value={LISTING_REJECT_PRESETS[0].value}>
                  {t("shop.admin_preset_contact")}
                </option>
                <option value={LISTING_REJECT_PRESETS[1].value}>
                  {t("shop.admin_preset_offplatform")}
                </option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="listing-reject-reason">
                {t("gigs.admin_review_reject_reason_label")}
              </Label>
              <textarea
                id="listing-reject-reason"
                rows={3}
                maxLength={500}
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              {t("gigs.admin_desk_cancel")}
            </Button>
            <Button
              className="font-medium"
              disabled={rejectReason.trim().length < 3 || reviewMutation.isPending}
              onClick={() =>
                rejectTarget &&
                reviewMutation.mutate({
                  materialId: rejectTarget.id,
                  approve: false,
                  reason: rejectReason.trim(),
                })
              }
            >
              {reviewMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {t("gigs.admin_review_reject_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function EditMaterialDialog({
  material,
  onOpenChange,
  onSave,
}: {
  material: AdminMaterialRow | null;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: { rating: number | null; summary: string | null }) => void;
}) {
  const [rating, setRating] = useState(
    material?.admin_star_rating != null ? String(material.admin_star_rating) : "",
  );
  const [summary, setSummary] = useState(material?.admin_marketing_summary ?? "");

  // Re-sync local state when a different row is opened.
  const [lastId, setLastId] = useState<string | null>(null);
  if (material && material.id !== lastId) {
    setLastId(material.id);
    setRating(material.admin_star_rating != null ? String(material.admin_star_rating) : "");
    setSummary(material.admin_marketing_summary ?? "");
  }

  return (
    <Dialog open={Boolean(material)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit “{material?.title ?? ""}”</DialogTitle>
          <DialogDescription>
            Stars render on the marketplace card; leave empty for the “New Listing” badge.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-material-rating">Star rating (1.0 – 5.0)</Label>
            <Input
              id="edit-material-rating"
              type="number"
              min={1}
              max={5}
              step="0.1"
              value={rating}
              onChange={(event) => setRating(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-material-summary">Marketing summary</Label>
            <textarea
              id="edit-material-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={3}
              maxLength={4000}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() =>
              onSave({
                rating: rating ? Number(rating) : null,
                summary: summary || null,
              })
            }
            className="font-medium"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
