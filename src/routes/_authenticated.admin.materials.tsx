import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BookOpen, Download, FileUp, Loader2, Pencil, Star } from "lucide-react";
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
  updateMaterialAdmin,
  type AdminMaterialRow,
} from "@/features/materials/materials.functions";
import { exportTutorPayoutCsv } from "@/features/materials/orders.functions";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/materials")({
  head: () => ({
    meta: [
      { title: "Study Materials — MatchMax Admin" },
      { name: "description", content: "Manage the study materials marketplace listings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminMaterials,
});

const DOCUMENT_TYPES = [
  "custom_notes",
  "past_paper_solutions",
  "ia",
  "ee",
  "tok_essay",
  "mock_exam",
] as const;

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
    documentType: "custom_notes" as (typeof DOCUMENT_TYPES)[number],
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
  // excluded server-side, so what downloads here is exactly the payable set.
  const payoutExportMutation = useMutation({
    mutationFn: () => exportTutorPayoutCsv(),
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
      documentType: "custom_notes",
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
          subjectTag: form.subjectTag || undefined,
          documentType: form.documentType,
          yearTag: form.yearTag || undefined,
          pageCount: form.pageCount ? Number(form.pageCount) : undefined,
          legalAgreed: true,
          tutorId: form.tutorId,
        },
      });

      // Trust fields (rating / summary) ride the admin update fn — look the
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
          <Button
            variant="outline"
            onClick={() => payoutExportMutation.mutate()}
            disabled={payoutExportMutation.isPending}
          >
            {payoutExportMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="mr-2 h-4 w-4" aria-hidden />
            )}
            Export payouts
          </Button>
          <Button onClick={() => setAddOpen(true)} className="font-bold">
            <FileUp className="mr-2 h-4 w-4" aria-hidden />
            Add listing
          </Button>
        </div>
      </div>

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
                  <span className="block truncate font-semibold text-[color:var(--ink)]">
                    {row.title}
                  </span>
                  <span className="text-xs text-[color:var(--ink)]/55">
                    {t(`materials.doc_type_${row.document_type}`)}
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
                      updateMutation.mutate({ materialId: row.id, isPublished: !row.is_published })
                    }
                    className={
                      row.is_published
                        ? "rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-700"
                        : "rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-700"
                    }
                  >
                    {row.is_published ? "Published" : "Pending review"}
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

      {/* Add listing dialog — same watermarking pipeline as the tutor flow. */}
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
                <Input
                  id="admin-material-curriculum"
                  value={form.curriculumTag}
                  onChange={(event) => setField({ curriculumTag: event.target.value })}
                  required
                  maxLength={160}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-material-subject">{t("materials.field_subject")}</Label>
                <Input
                  id="admin-material-subject"
                  value={form.subjectTag}
                  onChange={(event) => setField({ subjectTag: event.target.value })}
                  maxLength={160}
                />
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
                <Label htmlFor="admin-material-doc-type">
                  {t("materials.field_document_type")}
                </Label>
                <select
                  id="admin-material-doc-type"
                  value={form.documentType}
                  onChange={(event) =>
                    setField({ documentType: event.target.value as typeof form.documentType })
                  }
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {DOCUMENT_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {t(`materials.doc_type_${value}`)}
                    </option>
                  ))}
                </select>
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
                  accept="application/pdf,.pdf"
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
              <Button type="submit" disabled={submitting || !legalAgreed} className="font-bold">
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
            className="font-bold"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
