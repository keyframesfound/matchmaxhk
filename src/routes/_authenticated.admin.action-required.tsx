import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, ListChecks, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConsolePanel } from "@/components/ui/console-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createAdminAction,
  dismissAdminAction,
  listAdminOpenActions,
  type AdminActionResult,
} from "@/features/cases/action-required.functions";

export const Route = createFileRoute("/_authenticated/admin/action-required")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Appoint Action | MatchMax Admin" }],
  }),
  component: AdminActionRequiredPage,
});

/**
 * #561 admin "Appoint Action" tool: create a free-form Action Required task
 * for any user (title, body, urgency, deep-link, CTA, optional expiry) and
 * review/dismiss the open actions on that user.
 */
function AdminActionRequiredPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [titleZh, setTitleZh] = useState("");
  const [body, setBody] = useState("");
  const [urgency, setUrgency] = useState<"high" | "medium" | "low">("medium");
  const [link, setLink] = useState("");
  const [ctaLabelEn, setCtaLabelEn] = useState("");
  const [ctaLabelZh, setCtaLabelZh] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [expiryOn, setExpiryOn] = useState(false);

  const listQuery = useQuery({
    queryKey: ["admin-actions", email],
    queryFn: () => listAdminOpenActions({ data: { userEmail: email.trim().toLowerCase() } }),
    enabled: email.includes("@"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-actions"] });

  const createMutation = useMutation({
    mutationFn: () =>
      createAdminAction({
        data: {
          userEmail: email.trim().toLowerCase(),
          titleEn,
          titleZh: titleZh || undefined,
          body,
          urgency,
          link: link.trim() || undefined,
          ctaLabelEn: ctaLabelEn.trim() || undefined,
          ctaLabelZh: ctaLabelZh.trim() || undefined,
          expiresInDays: expiryOn && expiresInDays ? Number(expiresInDays) : undefined,
        },
      }),
    onSuccess: (res: AdminActionResult) => {
      if (res.ok) {
        toast.success(t("admin.ar_created"));
        setTitleEn("");
        setTitleZh("");
        setBody("");
        setLink("");
        setCtaLabelEn("");
        setCtaLabelZh("");
        invalidate();
      } else {
        toast.error(res.error ?? t("admin.ar_error"));
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dismissMutation = useMutation({
    mutationFn: (deliveryId: string) => dismissAdminAction({ data: { deliveryId } }),
    onSuccess: () => {
      toast.success(t("admin.ar_dismissed_ok"));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <ConsolePanel className="p-6">
        <div className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-[color:var(--ink)]" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-[color:var(--ink)]">{t("admin.ar_title")}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.ar_subtitle")}</p>

        <div className="mt-5 grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="ar-email">{t("admin.ar_user_email")}</Label>
            <Input
              id="ar-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ar-title-en">{t("admin.ar_title_en")}</Label>
            <Input
              id="ar-title-en"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ar-title-zh">{t("admin.ar_title_zh")}</Label>
            <Input
              id="ar-title-zh"
              value={titleZh}
              onChange={(e) => setTitleZh(e.target.value)}
              maxLength={200}
              placeholder={t("admin.ar_optional")}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ar-body">{t("admin.ar_body")}</Label>
            <Textarea
              id="ar-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              rows={3}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>{t("admin.ar_urgency")}</Label>
              <Select value={urgency} onValueChange={(v) => setUrgency(v as typeof urgency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">{t("admin.ar_urgency_high")}</SelectItem>
                  <SelectItem value="medium">{t("admin.ar_urgency_medium")}</SelectItem>
                  <SelectItem value="low">{t("admin.ar_urgency_low")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ar-link">{t("admin.ar_link")}</Label>
              <Input
                id="ar-link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="/dashboard#my-tutor"
                maxLength={300}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ar-cta-en">{t("admin.ar_cta_en")}</Label>
              <Input
                id="ar-cta-en"
                value={ctaLabelEn}
                onChange={(e) => setCtaLabelEn(e.target.value)}
                maxLength={60}
                placeholder={t("admin.ar_optional")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ar-cta-zh">{t("admin.ar_cta_zh")}</Label>
              <Input
                id="ar-cta-zh"
                value={ctaLabelZh}
                onChange={(e) => setCtaLabelZh(e.target.value)}
                maxLength={60}
                placeholder={t("admin.ar_optional")}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={expiryOn} onCheckedChange={setExpiryOn} id="ar-expiry" />
            <Label htmlFor="ar-expiry" className="text-sm">
              {t("admin.ar_expiry")}
            </Label>
            {expiryOn && (
              <Input
                type="number"
                min={1}
                max={90}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                className="w-24"
              />
            )}
          </div>
          <div>
            <Button
              type="button"
              disabled={
                createMutation.isPending ||
                !email.includes("@") ||
                titleEn.length < 3 ||
                body.length < 3
              }
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("admin.ar_create")}
            </Button>
          </div>
        </div>
      </ConsolePanel>

      <ConsolePanel className="p-6">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-[color:var(--ink)]" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-[color:var(--ink)]">
            {t("admin.ar_open_list")}
          </h2>
        </div>
        {!email.includes("@") ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("admin.ar_enter_email_first")}</p>
        ) : listQuery.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("admin.ar_loading")}</p>
        ) : !listQuery.data?.profileFound ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("admin.ar_user_not_found")}</p>
        ) : listQuery.data.actions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("admin.ar_none")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-[color:var(--ink)]/10">
            {listQuery.data.actions.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[color:var(--ink)]">
                    {a.admin_title ?? a.event_type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.action_type || a.event_type} · {a.urgency} · {a.status} ·{" "}
                    {t("admin.ar_reminders", { count: a.reminder_count })}
                  </p>
                </div>
                {a.status === "open" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => dismissMutation.mutate(a.id)}
                    disabled={dismissMutation.isPending}
                  >
                    {t("admin.ar_dismiss")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </ConsolePanel>
    </div>
  );
}
