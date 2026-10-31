import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Mail, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  CHILD_SOFT_LIMIT,
  ChildInput,
  shouldWarnChildCount,
  type ChildProfile,
} from "@/features/children/children";
import {
  archiveChild,
  listMyChildren,
  saveChild,
  setChildRetain,
} from "@/features/children/children.functions";
import { startChildClaim } from "@/features/children/claim.functions";

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
  // #459 slice 6: child id with the claim-invite dialog open.
  const [inviting, setInviting] = useState<string | null>(null);
  const invitingChild = children.find((child) => child.id === inviting) ?? null;

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

  // #459 §C: a pure student never sees the "My children" block. Until the
  // first child exists this collapses to a single quiet add-a-child entry.
  if (childrenQuery.isSuccess && children.length === 0 && editing !== "new") {
    return (
      <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
        <p className="min-w-0 text-sm text-muted-foreground">{t("children.add_first_hint")}</p>
        <Button type="button" variant="outline" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" aria-hidden />
          {t("children.add_first")}
        </Button>
      </section>
    );
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
                {child.status === "claimed_independent" ? <RetainToggles child={child} /> : null}
              </div>
              <div className="flex shrink-0 gap-1">
                {/* #459 slice 6: managed children only — claimed ones own
                    their account already. */}
                {child.status === "managed_by_parent" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setInviting(child.id)}
                  >
                    <Mail className="h-4 w-4" aria-hidden />
                    {t("children.claim.invite_cta")}
                  </Button>
                ) : null}
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

      {/* #459 slice 6: email-only claim invite (the WhatsApp channel is
          excluded per the owner's instruction). */}
      <Dialog open={Boolean(invitingChild)} onOpenChange={(open) => !open && setInviting(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-lg font-bold text-[color:var(--ink)]">
            {t("children.claim.invite_title", { name: invitingChild?.nickname ?? "" })}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {t("children.claim.invite_desc")}
          </DialogDescription>
          {invitingChild ? (
            <ClaimInviteForm childId={invitingChild.id} onDone={() => setInviting(null)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** #459 §4.4: what the parent keeps after the child claims their account. */
function RetainToggles({ child }: { child: ChildProfile }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const retain = useMutation({
    mutationFn: (next: { canViewSchedule: boolean; canManageBilling: boolean }) =>
      setChildRetain({ data: { id: child.id, ...next } }),
    onSuccess: () => {
      toast.success(t("children.retain.saved"));
      void queryClient.invalidateQueries({ queryKey: CHILDREN_QUERY_KEY });
    },
    onError: () => toast.error(t("children.error")),
  });
  const current = {
    canViewSchedule: child.canViewSchedule,
    canManageBilling: child.canManageBilling,
  };

  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground">{t("children.retain.claimed")}</p>
      <label className="flex items-center gap-2 text-sm text-[color:var(--ink)]">
        <Switch
          checked={child.canViewSchedule}
          disabled={retain.isPending}
          onCheckedChange={(checked) => retain.mutate({ ...current, canViewSchedule: checked })}
        />
        {t("children.retain.view_schedule")}
      </label>
      <label className="flex items-center gap-2 text-sm text-[color:var(--ink)]">
        <Switch
          checked={child.canManageBilling}
          disabled={retain.isPending}
          onCheckedChange={(checked) => retain.mutate({ ...current, canManageBilling: checked })}
        />
        {t("children.retain.manage_billing")}
      </label>
    </div>
  );
}

function ClaimInviteForm({ childId, onDone }: { childId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");

  const invite = useMutation({
    mutationFn: () => startChildClaim({ data: { studentId: childId, email: email.trim() } }),
    onSuccess: (res) => {
      toast.success(
        res.delivered ? t("children.claim.invite_sent") : t("children.claim.invite_send_failed"),
      );
      onDone();
    },
    onError: (e) => {
      toast.error(
        t(`children.claim.err_${e.message}`, { defaultValue: t("children.claim.error") }),
      );
    },
  });

  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        invite.mutate();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="claim-invite-email" className="text-[color:var(--ink)]">
          {t("children.claim.invite_email_label")}
        </Label>
        <Input
          id="claim-invite-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t("children.claim.invite_email_placeholder")}
          autoComplete="email"
          required
          className="bg-[color:var(--surface)]"
        />
        <p className="text-xs text-muted-foreground">{t("children.claim.invite_hint")}</p>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          {t("children.cancel")}
        </Button>
        <Button type="submit" disabled={invite.isPending} className="font-bold">
          {invite.isPending ? t("children.claim.invite_sending") : t("children.claim.invite_send")}
        </Button>
      </div>
    </form>
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
