import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CHILD_SOFT_LIMIT,
  ChildInput,
  shouldWarnChildCount,
  type ChildProfile,
} from "@/features/children/children";
import { archiveChild, listMyChildren, saveChild } from "@/features/children/children.functions";

export const CHILDREN_QUERY_KEY = ["account", "children"] as const;

type Draft = { nickname: string; school: string; curriculum: string; gradYear: string };

const EMPTY_DRAFT: Draft = { nickname: "", school: "", curriculum: "", gradYear: "" };

function toDraft(child: ChildProfile): Draft {
  return {
    nickname: child.nickname,
    school: child.school ?? "",
    curriculum: child.curriculum ?? "",
    gradYear: child.gradYear ? String(child.gradYear) : "",
  };
}

/** Issue #459: parent-managed child sub-profiles on /account. */
export function MyChildrenSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // null = no form open; "new" = adding; otherwise the child id being edited.
  const [editing, setEditing] = useState<string | null>(null);

  const childrenQuery = useQuery({
    queryKey: CHILDREN_QUERY_KEY,
    queryFn: () => listMyChildren(),
  });
  const children = childrenQuery.data ?? [];

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveChild({ data: { id } }),
    onSuccess: () => {
      toast.success(t("children.removed"));
      void queryClient.invalidateQueries({ queryKey: CHILDREN_QUERY_KEY });
    },
    onError: () => toast.error(t("children.error")),
  });

  function confirmArchive(child: ChildProfile) {
    if (window.confirm(t("children.archive_confirm", { name: child.nickname }))) {
      archiveMutation.mutate(child.id);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-[color:var(--ink)]">{t("children.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("children.desc")}</p>
        </div>
        {editing !== "new" ? (
          <Button type="button" variant="outline" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" aria-hidden />
            {t("children.add")}
          </Button>
        ) : null}
      </div>

      {shouldWarnChildCount(children.length) ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {t("children.soft_limit", { count: CHILD_SOFT_LIMIT })}
        </p>
      ) : null}

      {editing === "new" ? (
        <ChildForm initial={EMPTY_DRAFT} childId={null} onDone={() => setEditing(null)} />
      ) : null}

      {childrenQuery.isSuccess && children.length === 0 && editing !== "new" ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("children.empty")}</p>
      ) : null}

      <ul className="mt-4 divide-y divide-border">
        {children.map((child) =>
          editing === child.id ? (
            <li key={child.id} className="py-3">
              <ChildForm
                initial={toDraft(child)}
                childId={child.id}
                onDone={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={child.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-[color:var(--ink)]">{child.nickname}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {[child.school, child.curriculum, child.gradYear].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(child.id)}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                  {t("children.edit")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={archiveMutation.isPending}
                  onClick={() => confirmArchive(child)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  {t("children.archive")}
                </Button>
              </div>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

type ChildFormProps = { initial: Draft; childId: string | null; onDone: () => void };

function ChildForm({ initial, childId, onDone }: ChildFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(initial);
  const idPrefix = `child-${childId ?? "new"}`;

  const saveMutation = useMutation({
    mutationFn: () => {
      const child = ChildInput.parse({
        nickname: draft.nickname,
        school: draft.school,
        curriculum: draft.curriculum,
        gradYear: draft.gradYear ? Number(draft.gradYear) : null,
      });
      return saveChild({ data: { id: childId, child } });
    },
    onSuccess: () => {
      toast.success(t("children.saved"));
      void queryClient.invalidateQueries({ queryKey: CHILDREN_QUERY_KEY });
      onDone();
    },
    onError: () => toast.error(t("children.error")),
  });

  const update = (patch: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...patch }));

  return (
    <form
      className="mt-4 grid gap-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        saveMutation.mutate();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-nickname`}>{t("children.nickname")}</Label>
        <Input
          id={`${idPrefix}-nickname`}
          value={draft.nickname}
          onChange={(event) => update({ nickname: event.target.value })}
          placeholder={t("children.nickname_placeholder")}
          maxLength={40}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-school`}>{t("children.school")}</Label>
        <Input
          id={`${idPrefix}-school`}
          value={draft.school}
          onChange={(event) => update({ school: event.target.value })}
          maxLength={120}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-curriculum`}>{t("children.curriculum")}</Label>
        <Input
          id={`${idPrefix}-curriculum`}
          value={draft.curriculum}
          onChange={(event) => update({ curriculum: event.target.value })}
          placeholder={t("children.curriculum_placeholder")}
          maxLength={40}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-grad-year`}>{t("children.grad_year")}</Label>
        <Input
          id={`${idPrefix}-grad-year`}
          type="number"
          inputMode="numeric"
          min={2000}
          max={2100}
          value={draft.gradYear}
          onChange={(event) => update({ gradYear: event.target.value })}
        />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={saveMutation.isPending} className="font-bold">
          {saveMutation.isPending ? t("children.saving") : t("children.save")}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t("children.cancel")}
        </Button>
      </div>
    </form>
  );
}
