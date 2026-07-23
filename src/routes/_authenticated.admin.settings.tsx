import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/useAuth";
import { fetchPublishedTutors } from "@/features/tutors/queries";
import { DEFAULT_SUBJECT_OPTIONS } from "@/features/tutors/subjects";

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
  students_matched: string;
  hero_tutor_code: string;
  subject_options: string[];
  popular_subjects: string[];
};

const STRING_KEYS = ["brand_name", "contact_email", "whatsapp_number", "whatsapp_template", "students_matched", "hero_tutor_code"] as const;
const ARRAY_KEYS = ["subject_options", "popular_subjects"] as const;
const ALL_KEYS = [...STRING_KEYS, ...ARRAY_KEYS] as const;

const DEFAULT_POPULAR_SUBJECTS = [
  "Mathematics", "English", "Chinese", "Physics", "Chemistry",
  "Biology", "Economics", "DSE", "IB",
];

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
      const { data, error } = await supabase.from("app_settings").select("key, value").in("key", ALL_KEYS as unknown as string[]);
      if (error) throw error;
      const map: Settings = {
        brand_name: "MatchMax",
        contact_email: "",
        whatsapp_number: "",
        whatsapp_template: "Hi, I'd like to contact tutor {tutor_code} via MatchMax.",
        students_matched: "0",
        hero_tutor_code: "",
        subject_options: DEFAULT_SUBJECT_OPTIONS,
        popular_subjects: DEFAULT_POPULAR_SUBJECTS,
      };
      (data ?? []).forEach((row) => {
        const v = row.value as unknown;
        if ((ARRAY_KEYS as readonly string[]).includes(row.key)) {
          if (Array.isArray(v)) {
            const arr = (v as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0);
            if (arr.length > 0) (map as unknown as Record<string, string[]>)[row.key] = arr;
          }
        } else if ((STRING_KEYS as readonly string[]).includes(row.key)) {
          (map as unknown as Record<string, string>)[row.key] = typeof v === "string" ? v : "";
        }
      });
      return map;
    },
  });

  const { data: tutors = [] } = useQuery({
    queryKey: ["admin", "settings", "published_tutors"],
    queryFn: () => fetchPublishedTutors(),
  });

  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => { if (data) setForm(data); }, [data]);
  const [subjectDraft, setSubjectDraft] = useState("");

  const tutorOptions = useMemo(
    () => tutors.map((tut) => ({ value: tut.tutor_code, label: `${tut.display_name} — ${tut.tutor_code}` })),
    [tutors],
  );

  const save = useMutation({
    mutationFn: async (payload: Settings) => {
      const rows = [
        ...STRING_KEYS.map((k) => ({ key: k, value: (payload[k] ?? "") as unknown as string })),
        { key: "subject_options", value: payload.subject_options as unknown as string },
        { key: "popular_subjects", value: payload.popular_subjects as unknown as string },
      ];
      const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("admin.saved"));
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["landing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addSubject(raw: string) {
    if (!form) return;
    const v = raw.trim();
    if (!v) return;
    if (form.subject_options.some((s) => s.toLowerCase() === v.toLowerCase())) return;
    setForm({ ...form, subject_options: [...form.subject_options, v] });
    setSubjectDraft("");
  }

  function removeSubject(s: string) {
    if (!form) return;
    setForm({ ...form, subject_options: form.subject_options.filter((x) => x !== s) });
  }

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
              <div className="space-y-2">
                <Label>Students matched (landing page stat)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.students_matched}
                  onChange={(e) => setForm({ ...form, students_matched: e.target.value })}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">Shown on the homepage trust bar.</p>
              </div>

              <div className="space-y-2">
                <Label>Landing hero tutor</Label>
                <SearchableSelect
                  value={form.hero_tutor_code}
                  onChange={(v) => setForm({ ...form, hero_tutor_code: v })}
                  options={tutorOptions}
                  placeholder="Auto (top-rated this week)"
                  searchPlaceholder="Search tutors…"
                  
                />
                <div className="flex items-center gap-3">
                  <p className="text-xs text-muted-foreground">
                    Featured in the hero card on the homepage. Leave blank to auto-pick the top weekly tutor.
                  </p>
                  {form.hero_tutor_code && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-[color:var(--brand-teal)] hover:underline"
                      onClick={() => setForm({ ...form, hero_tutor_code: "" })}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Browse-page subjects</Label>
                <p className="text-xs text-muted-foreground">
                  Options shown in the "Any subject" filter on the Browse Tutors page.
                </p>
                {form.subject_options.length > 0 && (
                  <div className="flex flex-wrap gap-2 rounded-md border border-border bg-background p-2">
                    {form.subject_options.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-teal)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--brand-navy)]"
                      >
                        {s}
                        <button
                          type="button"
                          onClick={() => removeSubject(s)}
                          className="rounded-full p-0.5 hover:bg-black/10"
                          aria-label={`Remove ${s}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="flex-1">
                    <SearchableSelect
                      value=""
                      onChange={(v) => addSubject(v)}
                      options={DEFAULT_SUBJECT_OPTIONS
                        .filter((s) => !form.subject_options.some((x) => x.toLowerCase() === s.toLowerCase()))
                        .map((s) => ({ value: s, label: s }))}
                      placeholder="Add from suggested subjects…"
                      searchPlaceholder="Search subjects…"
                      
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={subjectDraft}
                      onChange={(e) => setSubjectDraft(e.target.value)}
                      placeholder="Add custom subject"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); addSubject(subjectDraft); }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={() => addSubject(subjectDraft)}>Add</Button>
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    className="text-xs font-semibold text-[color:var(--brand-teal)] hover:underline"
                    onClick={() => setForm({ ...form, subject_options: DEFAULT_SUBJECT_OPTIONS })}
                  >
                    Reset to defaults
                  </button>
                  <button
                    type="button"
                    className="text-xs font-semibold text-muted-foreground hover:underline"
                    onClick={() => setForm({ ...form, subject_options: [] })}
                  >
                    Clear all
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Landing page "Popular subjects"</Label>
                <p className="text-xs text-muted-foreground">
                  Quick-link chips shown in the Popular subjects section of the homepage. Each links to /tutors filtered by that subject.
                </p>
                {form.popular_subjects.length > 0 && (
                  <div className="flex flex-wrap gap-2 rounded-md border border-border bg-background p-2">
                    {form.popular_subjects.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-navy)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--brand-navy)]"
                      >
                        {s}
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, popular_subjects: form.popular_subjects.filter((x) => x !== s) })}
                          className="rounded-full p-0.5 hover:bg-black/10"
                          aria-label={`Remove ${s}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex-1">
                  <SearchableSelect
                    value=""
                    onChange={(v) => {
                      const val = v.trim();
                      if (!val) return;
                      if (form.popular_subjects.some((x) => x.toLowerCase() === val.toLowerCase())) return;
                      setForm({ ...form, popular_subjects: [...form.popular_subjects, val] });
                    }}
                    options={form.subject_options
                      .filter((s) => !form.popular_subjects.some((x) => x.toLowerCase() === s.toLowerCase()))
                      .map((s) => ({ value: s, label: s }))}
                    placeholder="Add a popular subject…"
                    searchPlaceholder="Search subjects…"
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    className="text-xs font-semibold text-[color:var(--brand-teal)] hover:underline"
                    onClick={() => setForm({ ...form, popular_subjects: DEFAULT_POPULAR_SUBJECTS })}
                  >
                    Reset to defaults
                  </button>
                  <button
                    type="button"
                    className="text-xs font-semibold text-muted-foreground hover:underline"
                    onClick={() => setForm({ ...form, popular_subjects: [] })}
                  >
                    Clear all
                  </button>
                </div>
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
