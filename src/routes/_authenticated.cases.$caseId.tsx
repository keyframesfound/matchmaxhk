import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Clock, Wallet, ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPublicCase, expressInterest } from "@/lib/cases.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/useAuth";

export const Route = createFileRoute("/_authenticated/cases/$caseId")({
  head: () => ({ meta: [{ title: "Case — MatchMax" }, { name: "robots", content: "noindex" }] }),
  component: CaseDetail,
});

type CaseRow = {
  id: string; title: string; subject: string; exam_system: string | null; student_level: string;
  student_grade_current: string | null; district: string | null; mode: string; sessions_per_week: number;
  session_length_minutes: number; budget_min: number | null; budget_max: number | null; urgency: string;
  language_of_instruction: string; preferred_gender: string; preferred_tutor_type: string;
  schedule_note: string | null; description: string | null; created_at: string; status: string;
};

function CaseDetail() {
  const { caseId } = Route.useParams();
  const { user, hasAnyRole } = useAuth();
  const getFn = useServerFn(getPublicCase);
  const expressFn = useServerFn(expressInterest);
  const qc = useQueryClient();

  const { data: c, isLoading } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getFn({ data: { caseId } }) as Promise<CaseRow | null>,
  });

  const { data: myTutors = [] } = useQuery({
    queryKey: ["my-tutor-profiles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const admin = hasAnyRole(["admin", "super_admin"]);
      const q = supabase.from("tutors").select("id, display_name, tutor_code");
      const { data } = admin ? await q.limit(200) : await q.eq("created_by", user!.id);
      return (data ?? []) as { id: string; display_name: string; tutor_code: string }[];
    },
  });

  const [tutorId, setTutorId] = useState<string>("");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () => expressFn({ data: { caseId, tutorId, note: note || null } }),
    onSuccess: () => {
      toast.success("Interest submitted. The MatchMax team will follow up.");
      setNote("");
      qc.invalidateQueries({ queryKey: ["my-interests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Shell><p className="text-sm text-muted-foreground">Loading…</p></Shell>;
  if (!c) return <Shell><p className="text-sm text-muted-foreground">Case not found or no longer public.</p></Shell>;

  return (
    <Shell>
      <Link to="/cases" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to cases
      </Link>
      <div className="mt-6 rounded-3xl border border-border bg-card p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[color:var(--brand-teal)]/10 px-3 py-1 text-xs font-bold text-[color:var(--brand-teal)]">{c.subject}</span>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{c.student_level}</span>
          {c.exam_system && <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{c.exam_system.toUpperCase()}</span>}
          {c.urgency === "high" && <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">Urgent</span>}
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-[color:var(--brand-navy)]">{c.title}</h1>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{c.district ?? "Flexible"}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{c.sessions_per_week} sessions / week · {c.session_length_minutes} min · {c.mode}</span>
          {(c.budget_min || c.budget_max) && <span className="inline-flex items-center gap-1"><Wallet className="h-4 w-4" />HK${c.budget_min ?? 0}–{c.budget_max ?? "?"}/hr</span>}
        </div>

        {c.description && (
          <div className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">About the case</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm">{c.description}</p>
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Detail label="Preferred tutor" value={c.preferred_tutor_type.replace("_", " ")} />
          <Detail label="Gender" value={c.preferred_gender} />
          <Detail label="Language" value={c.language_of_instruction === "zh-HK" ? "Cantonese" : c.language_of_instruction === "en" ? "English" : "Either"} />
          {c.schedule_note && <Detail label="Schedule" value={c.schedule_note} />}
          {c.student_grade_current && <Detail label="Current grade" value={c.student_grade_current} />}
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-border bg-card p-8">
        <h2 className="text-lg font-bold text-[color:var(--brand-navy)]">Express interest</h2>
        <p className="mt-1 text-sm text-muted-foreground">Select which of your tutor profiles is a match. The MatchMax team reviews interest and releases parent contact info.</p>
        {myTutors.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-muted/50 p-4 text-sm">
            No tutor profile yet. <Link to="/become-a-tutor" className="font-semibold text-[color:var(--brand-teal)] underline">Apply to be a tutor</Link> first.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <Select value={tutorId} onValueChange={setTutorId}>
              <SelectTrigger><SelectValue placeholder="Choose tutor profile" /></SelectTrigger>
              <SelectContent className="max-h-64">
                {myTutors.map((t) => <SelectItem key={t.id} value={t.id}>{t.display_name} ({t.tutor_code})</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea rows={4} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short note to the family (optional)" />
            <Button disabled={!tutorId || mutation.isPending} onClick={() => mutation.mutate()} className="bg-[color:var(--brand-navy)] text-white hover:bg-[color:var(--brand-royal)]">
              {mutation.isPending ? "Submitting…" : "Submit interest"}
            </Button>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm capitalize">{value}</p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1"><div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">{children}</div></main>
      <SiteFooter />
    </div>
  );
}
