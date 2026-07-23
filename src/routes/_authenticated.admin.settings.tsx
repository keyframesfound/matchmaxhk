import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/useAuth";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings — MatchMax admin" },
      { name: "description", content: "MatchMax site-wide settings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSettings,
});

type Settings = {
  brand_name: string;
  contact_email: string;
  whatsapp_number: string;
  whatsapp_template: string;
};

const KEYS: (keyof Settings)[] = ["brand_name", "contact_email", "whatsapp_number", "whatsapp_template"];

function AdminSettings() {
  const { t } = useTranslation();
  const { hasAnyRole, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!loading && !hasAnyRole(["admin", "super_admin"])) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, hasAnyRole, navigate]);

  const { data } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async (): Promise<Settings> => {
      const { data, error } = await supabase.from("app_settings").select("key, value").in("key", KEYS);
      if (error) throw error;
      const map: Settings = {
        brand_name: "MatchMax",
        contact_email: "",
        whatsapp_number: "",
        whatsapp_template: "Hi, I'd like to contact tutor {tutor_code} via MatchMax.",
      };
      (data ?? []).forEach((row) => {
        (map as Record<string, string>)[row.key] = typeof row.value === "string" ? row.value : "";
      });
      return map;
    },
  });

  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: async (payload: Settings) => {
      const rows = KEYS.map((k) => ({ key: k, value: payload[k] ?? "" }));
      const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("admin.saved"));
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <h1 className="text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
            {t("admin.settings_title")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("admin.settings_subtitle")}</p>

          {form && (
            <form
              className="mt-8 space-y-6 rounded-3xl border border-border bg-card p-8"
              onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}
            >
              <div className="space-y-2">
                <Label>{t("admin.brand_name")}</Label>
                <Input value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.contact_email")}</Label>
                <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.whatsapp_number")}</Label>
                <Input placeholder="+852 5555 1234" value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.whatsapp_template")}</Label>
                <Textarea rows={4} value={form.whatsapp_template} onChange={(e) => setForm({ ...form, whatsapp_template: e.target.value })} />
                <p className="text-xs text-muted-foreground">Use <code>{"{tutor_code}"}</code> as a placeholder.</p>
              </div>
              <Button
                type="submit"
                disabled={save.isPending}
                className="bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]"
              >
                {save.isPending ? t("common.loading") : t("admin.save")}
              </Button>
            </form>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
