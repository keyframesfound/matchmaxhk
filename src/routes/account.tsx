import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Download,
  Eye,
  FilePlus2,
  Loader2,
  Pencil,
  Plus,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";
import {
  getMyMaterials,
  setNoteHidden,
  type MyMaterialsRow,
} from "@/features/materials/note-drafts.functions";
import { getBoughtMaterials } from "@/features/materials/checkout.functions";
import { getOwnedMaterialUrl } from "@/features/materials/orders.functions";

/**
 * P6 (#286) marketplace slice + P8 (#288) + P13 (#293): the Account page's
 * store blocks. Tutor side: My notes (every status, edit, hide, stats) with
 * the Add-a-note empty state. Parent side: Bought (delivered orders with
 * Download; refunded rows keep their label and lose the button). The full
 * Carousell-order account page (identity header, profile blocks, Saved)
 * remains open on #286 — this PR ships the marketplace-owned blocks.
 */

export const Route = createFileRoute("/account")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Account | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: AccountPage,
});

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-500/10 text-slate-600",
  pending_review: "bg-amber-500/10 text-amber-700",
  published: "bg-emerald-500/10 text-emerald-700",
  hidden: "bg-slate-500/10 text-slate-600",
  rejected: "bg-[#F4212E]/10 text-[#B42318]",
};

function AccountPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const materialsQuery = useQuery({
    queryKey: ["account", "my-materials", user?.id],
    queryFn: () => getMyMaterials(),
    enabled: Boolean(user),
  });

  const boughtQuery = useQuery({
    queryKey: ["account", "bought", user?.id],
    queryFn: () => getBoughtMaterials(),
    enabled: Boolean(user),
  });

  const hideMutation = useMutation({
    mutationFn: (input: { materialId: string; hidden: boolean }) => setNoteHidden({ data: input }),
    onSuccess: () => {
      toast.success(t("account.notes_updated"));
      void queryClient.invalidateQueries({ queryKey: ["account", "my-materials"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("account.notes_update_failed")),
  });

  const downloadMutation = useMutation({
    mutationFn: (materialId: string) => getOwnedMaterialUrl({ data: { materialId } }),
    onSuccess: (result) => window.open(result.signedUrl, "_blank", "noopener"),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("orders.download_failed")),
  });

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">{t("orders.sign_in_required")}</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const materials: MyMaterialsRow[] = materialsQuery.data ?? [];
  const bought = boughtQuery.data ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-normal">{t("account.title")}</h1>
        {/* My notes (tutor side, P8) */}
        <section className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <BookOpen className="h-5 w-5" aria-hidden />
              {t("account.my_notes")}
            </h2>
            <Button variant="outline" className="font-semibold" asChild>
              <a href="/account/notes/new">
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                {t("account.add_note")}
              </a>
            </Button>
          </div>

          {materialsQuery.isLoading ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-border bg-card">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : materials.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <FilePlus2 className="h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">{t("account.no_notes")}</p>
              <Button variant="solid" color="accent" className="font-bold" asChild>
                <a href="/account/notes/new">
                  <Plus className="mr-2 h-4 w-4" aria-hidden />
                  {t("account.add_note")}
                </a>
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {materials.map((material) => (
                <li
                  key={material.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{material.title}</p>
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-bold ${STATUS_BADGE[material.status] ?? "bg-slate-500/10 text-slate-600"}`}
                      >
                        {t(`account.status_${material.status}`)}
                      </span>
                      {material.editStatus === "pending_review" && (
                        <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-700">
                          {t("account.edit_pending")}
                        </span>
                      )}
                    </div>
                    {material.status === "rejected" && material.rejectionReason && (
                      <p className="mt-1 text-xs text-[#B42318]">
                        {t("account.rejection_reason", { reason: material.rejectionReason })}
                      </p>
                    )}
                    <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{t("notes.price", { amount: material.priceHkd })}</span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" aria-hidden />
                        {material.viewCount}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ShoppingCart className="h-3 w-3" aria-hidden />
                        {material.soldCount}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" aria-label={t("account.edit_note")} asChild>
                      <a href={`/account/notes/${material.id}/edit`}>
                        <Pencil className="h-4 w-4" aria-hidden />
                      </a>
                    </Button>
                    {(material.status === "published" || material.status === "hidden") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={
                          material.status === "published"
                            ? t("account.hide_note")
                            : t("account.unhide_note")
                        }
                        onClick={() =>
                          hideMutation.mutate({
                            materialId: material.id,
                            hidden: material.status === "published",
                          })
                        }
                      >
                        <Eye className="h-4 w-4" aria-hidden />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Bought (parent side, P13) */}
        <section className="mt-12 space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Download className="h-5 w-5" aria-hidden />
            {t("account.bought")}
          </h2>
          {boughtQuery.isLoading ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-border bg-card">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : bought.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              {t("account.no_bought")}{" "}
              <Link
                to="/tutors"
                search={{ view: "materials" }}
                className="text-[color:var(--brand-link)] hover:underline"
              >
                {t("account.browse_notes")}
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {bought.map((row) => (
                <li
                  key={row.orderId}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{row.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleDateString()}
                      {" · "}
                      {t("notes.price", { amount: row.grossHkd })}
                    </p>
                  </div>
                  {row.action === "download" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-semibold"
                      disabled={downloadMutation.isPending}
                      onClick={() => downloadMutation.mutate(row.materialId)}
                    >
                      {downloadMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Download className="mr-2 h-4 w-4" aria-hidden />
                      )}
                      {t("orders.download_button")}
                    </Button>
                  )}
                  {row.action === "refunded" && (
                    <span className="rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-700">
                      {t("orders.refunded_badge")}
                    </span>
                  )}
                  {row.action === "preparing" && (
                    <span className="rounded-md bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
                      {t("orders.preparing_badge")}
                    </span>
                  )}
                  {row.action === "pay" && (
                    <Link
                      to="/orders/$orderId"
                      params={{ orderId: row.orderId }}
                      className="text-xs font-semibold text-[color:var(--brand-link)] hover:underline"
                    >
                      {t("account.finish_payment")}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
