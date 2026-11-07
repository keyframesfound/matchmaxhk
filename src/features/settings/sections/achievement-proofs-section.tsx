import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { materialCoverUrl } from "@/features/materials/material-card";
import { saveMyAchievementProofs, uploadAchievementProof } from "@/features/tutors/proof.functions";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { selectRows } from "@/features/cases/desk-db";

/**
 * Issue #575 — attach PUBLIC photo proofs to achievements ("My tutor
 * profile"). The warning is explicit: the photo becomes public, sensitive
 * documents (HKID etc.) do not belong here — staff verification files are a
 * separate, private flow.
 */

export const getMyAchievementProofs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = asAdminDb((await import("@/integrations/supabase/client.server")).supabaseAdmin);
    const rows = await selectRows<{ achievements: unknown }>(db, "tutors", "achievements", [
      { col: "user_id", op: "eq", value: context.userId },
    ]);
    const raw = Array.isArray(rows[0]?.achievements) ? (rows[0]!.achievements as unknown[]) : [];
    return raw
      .map((value) => {
        const entry = value as Record<string, unknown> | null;
        const shortText = typeof entry?.short_text === "string" ? entry.short_text : "";
        if (!shortText) return null;
        return {
          short_text: shortText,
          proof_image_path:
            typeof entry?.proof_image_path === "string" ? entry.proof_image_path : null,
        };
      })
      .filter((v): v is { short_text: string; proof_image_path: string | null } => v !== null)
      .slice(0, 3);
  });

export function AchievementProofsSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetcher = useServerFn(getMyAchievementProofs);
  const uploader = useServerFn(uploadAchievementProof);
  const saver = useServerFn(saveMyAchievementProofs);
  const { data, isLoading } = useQuery({
    queryKey: ["achievement-proofs"],
    queryFn: () => fetcher(),
  });
  const [pending, setPending] = useState<Record<number, string>>({});
  const [uploading, setUploading] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const activeIndex = useRef<number | null>(null);

  const save = useMutation({
    mutationFn: (achievements: { short_text: string; proof_image_path?: string }[]) =>
      saver({ data: { achievements } }),
    onSuccess: () => {
      toast.success(t("settings.proofs.saved"));
      setPending({});
      void queryClient.invalidateQueries({ queryKey: ["achievement-proofs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pickFile = (index: number) => {
    activeIndex.current = index;
    fileInput.current?.click();
  };

  const onFile = async (file: File | null) => {
    const index = activeIndex.current;
    if (!file || index === null) return;
    setUploading(index);
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Could not read the file."));
        reader.readAsDataURL(file);
      });
      const { path } = await uploader({
        data: {
          filename: file.name,
          contentType: file.type,
          size: file.size,
          content,
        },
      });
      setPending((prev) => ({ ...prev, [index]: path }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(null);
      activeIndex.current = null;
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const proofFor = (
    item: { short_text: string; proof_image_path: string | null },
    index: number,
  ): string | null => pending[index] ?? item.proof_image_path;

  return (
    <section className="space-y-3" data-testid="achievement-proofs">
      <div>
        <h3 className="text-base font-bold">{t("settings.proofs.title")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("settings.proofs.warning")}</p>
      </div>
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("settings.proofs.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {data.map((item, index) => {
            const path = proofFor(item, index);
            const url = materialCoverUrl(path);
            return (
              <li
                key={`${item.short_text}-${index}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[color:var(--ink)]">
                  {item.short_text}
                </span>
                {url ? (
                  <img src={url} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : null}
                {uploading === index ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => pickFile(index)}
                    >
                      <ImagePlus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      {path ? t("settings.proofs.replace") : t("settings.proofs.attach")}
                    </Button>
                    {path ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPending((prev) => ({ ...prev, [index]: "" }))}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                        {t("settings.proofs.remove")}
                      </Button>
                    ) : null}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {data && data.length > 0 ? (
        <Button
          type="button"
          size="sm"
          disabled={save.isPending || uploading !== null}
          onClick={() =>
            save.mutate(
              data.map((item, index) => {
                const path = pending[index] ?? item.proof_image_path;
                return {
                  short_text: item.short_text,
                  ...(path ? { proof_image_path: path } : {}),
                };
              }),
            )
          }
        >
          {save.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : null}
          {t("settings.proofs.save")}
        </Button>
      ) : null}
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />
    </section>
  );
}
