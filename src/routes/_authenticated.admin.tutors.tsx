import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { z } from "zod";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/useAuth";
import { fetchAllTutors, HK_DISTRICTS, type Tutor } from "@/features/tutors/queries";

export const Route = createFileRoute("/_authenticated/admin/tutors")({
  head: () => ({
    meta: [
      { title: "Tutors — MatchMax admin" },
      { name: "description", content: "Manage tutors on MatchMax." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminTutors,
});

const formSchema = z.object({
  display_name: z.string().trim().min(1).max(120),
  headline: z.string().trim().max(200).optional().or(z.literal("")),
  subjects_csv: z.string().trim().min(1).max(300),
  district: z.string().trim().max(80).optional().or(z.literal("")),
  hourly_rate: z.coerce.number().int().min(0).max(100000),
  badge: z.string().trim().max(80).optional().or(z.literal("")),
  bio: z.string().trim().max(2000).optional().or(z.literal("")),
  photo_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  tutor_code: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9-]+$/, "Letters, numbers, dashes only"),
  rating: z.coerce.number().min(0).max(5),
  weekly_rating: z.coerce.number().min(0).max(5),
  weekly_score: z.coerce.number().int().min(0).max(100000),
  is_published: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

const empty: FormValues = {
  display_name: "",
  headline: "",
  subjects_csv: "",
  district: "",
  hourly_rate: 0,
  badge: "",
  bio: "",
  photo_url: "",
  tutor_code: "",
  rating: 0,
  weekly_rating: 0,
  weekly_score: 0,
  is_published: true,
};

function tutorToForm(t: Tutor): FormValues {
  return {
    display_name: t.display_name,
    headline: t.headline ?? "",
    subjects_csv: (t.subjects ?? []).join(", "),
    district: t.district ?? "",
    hourly_rate: t.hourly_rate,
    badge: t.badge ?? "",
    bio: t.bio ?? "",
    photo_url: t.photo_url ?? "",
    tutor_code: t.tutor_code,
    rating: Number(t.rating),
    weekly_rating: Number(t.weekly_rating),
    weekly_score: t.weekly_score,
    is_published: t.is_published,
  };
}

function formToPayload(v: FormValues) {
  return {
    display_name: v.display_name,
    headline: v.headline || null,
    subjects: v.subjects_csv.split(",").map((s) => s.trim()).filter(Boolean),
    district: v.district || null,
    hourly_rate: v.hourly_rate,
    badge: v.badge || null,
    bio: v.bio || null,
    photo_url: v.photo_url || null,
    tutor_code: v.tutor_code.trim(),
    rating: v.rating,
    weekly_rating: v.weekly_rating,
    weekly_score: v.weekly_score,
    is_published: v.is_published,
  };
}

function AdminTutors() {
  const { t } = useTranslation();
  const { hasAnyRole, loading, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tutor | null>(null);
  const [form, setForm] = useState<FormValues>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !hasAnyRole(["admin", "super_admin"])) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, hasAnyRole, navigate]);

  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ["admin", "tutors"],
    queryFn: fetchAllTutors,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tutors;
    return tutors.filter((r) =>
      r.display_name.toLowerCase().includes(q) ||
      r.tutor_code.toLowerCase().includes(q) ||
      (r.subjects ?? []).some((s) => s.toLowerCase().includes(q)),
    );
  }, [tutors, search]);

  const save = useMutation({
    mutationFn: async (payload: ReturnType<typeof formToPayload> & { id?: string }) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from("tutors").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tutors").insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t("admin.saved"));
      queryClient.invalidateQueries({ queryKey: ["admin", "tutors"] });
      queryClient.invalidateQueries({ queryKey: ["landing", "featured_tutors"] });
      queryClient.invalidateQueries({ queryKey: ["tutors", "published"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(empty);
      setErrors({});
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tutors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tutor deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "tutors"] });
      queryClient.invalidateQueries({ queryKey: ["landing", "featured_tutors"] });
      queryClient.invalidateQueries({ queryKey: ["tutors", "published"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openAdd() {
    setEditing(null);
    setForm(empty);
    setErrors({});
    setDialogOpen(true);
  }
  function openEdit(row: Tutor) {
    setEditing(row);
    setForm(tutorToForm(row));
    setErrors({});
    setDialogOpen(true);
  }
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[issue.path[0] as string] = issue.message;
      setErrors(errs);
      return;
    }
    save.mutate({ ...formToPayload(parsed.data), ...(editing ? { id: editing.id } : {}) });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
                Tutors
              </h1>
              <p className="mt-2 text-muted-foreground">Add, edit or remove tutors shown on MatchMax.</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAdd} className="bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]">
                  <Plus className="mr-2 h-4 w-4" /> Add tutor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit tutor" : "Add tutor"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Display name" error={errors.display_name}>
                      <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
                    </Field>
                    <Field label="Tutor code (unique)" error={errors.tutor_code}>
                      <Input value={form.tutor_code} onChange={(e) => setForm({ ...form, tutor_code: e.target.value })} placeholder="MM-1042" />
                    </Field>
                  </div>
                  <Field label="Headline" error={errors.headline}>
                    <Input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} placeholder="DSE Mathematics · M2" />
                  </Field>
                  <Field label="Subjects (comma separated)" error={errors.subjects_csv}>
                    <Input value={form.subjects_csv} onChange={(e) => setForm({ ...form, subjects_csv: e.target.value })} placeholder="Mathematics, Physics" />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="District" error={errors.district}>
                      <Select value={form.district || "__none"} onValueChange={(v) => setForm({ ...form, district: v === "__none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">—</SelectItem>
                          {HK_DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Hourly rate (HKD)" error={errors.hourly_rate}>
                      <Input type="number" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: Number(e.target.value) })} />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Badge (short credential)" error={errors.badge}>
                      <Input value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder="PhD Cambridge" />
                    </Field>
                    <Field label="Photo URL" error={errors.photo_url}>
                      <Input value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} placeholder="https://…" />
                    </Field>
                  </div>
                  <Field label="Bio" error={errors.bio}>
                    <Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Overall rating (0-5)" error={errors.rating}>
                      <Input type="number" step="0.1" value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })} />
                    </Field>
                    <Field label="This week rating (0-5)" error={errors.weekly_rating}>
                      <Input type="number" step="0.1" value={form.weekly_rating} onChange={(e) => setForm({ ...form, weekly_rating: Number(e.target.value) })} />
                    </Field>
                    <Field label="Weekly rank score" error={errors.weekly_score}>
                      <Input type="number" value={form.weekly_score} onChange={(e) => setForm({ ...form, weekly_score: Number(e.target.value) })} />
                    </Field>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <Switch id="pub" checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
                    <Label htmlFor="pub">Published (visible to visitors)</Label>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={save.isPending} className="bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]">
                      {save.isPending ? "Saving…" : (editing ? "Save changes" : "Add tutor")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mt-8">
            <Input placeholder="Search by name, code, or subject…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Subjects</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Week</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No tutors yet. Click “Add tutor” to create one.</td></tr>
                )}
                {filtered.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{row.display_name}</p>
                      <p className="text-xs text-muted-foreground">{row.tutor_code}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{(row.subjects ?? []).join(", ")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.district ?? "—"}</td>
                    <td className="px-4 py-3">HK${row.hourly_rate}</td>
                    <td className="px-4 py-3">{Number(row.rating).toFixed(1)}★</td>
                    <td className="px-4 py-3">{row.weekly_score}</td>
                    <td className="px-4 py-3">
                      <span className={row.is_published ? "text-[color:var(--brand-teal)]" : "text-muted-foreground"}>
                        {row.is_published ? "Published" : "Hidden"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm(`Delete tutor "${row.display_name}"?`)) remove.mutate(row.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
