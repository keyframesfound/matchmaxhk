import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createCase, type CaseFormInput } from "@/lib/cases.functions";
import { DEFAULT_SUBJECT_OPTIONS } from "@/features/tutors/subjects";
import { HK_DISTRICTS } from "@/features/tutors/queries";
import { EXAM_SYSTEMS } from "@/features/tutors/examSystems";

export const Route = createFileRoute("/_authenticated/post-case")({
  head: () => ({
    meta: [
      { title: "Post a case — MatchMax" },
      { name: "description", content: "Tell us what you need and we'll match you with qualified Hong Kong tutors." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PostCasePage,
});

const LEVELS = ["Pre-primary", "P1", "P2", "P3", "P4", "P5", "P6", "S1", "S2", "S3", "S4", "S5", "S6", "University", "Adult"];

function PostCasePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createFn = useServerFn(createCase);
  const [form, setForm] = useState<CaseFormInput>({
    title: "",
    description: "",
    subject: "",
    exam_system: null,
    student_level: "P4",
    student_grade_current: "",
    student_school: "",
    district: "",
    mode: "either",
    sessions_per_week: 1,
    session_length_minutes: 90,
    start_date: null,
    schedule_note: "",
    preferred_gender: "any",
    language_of_instruction: "either",
    preferred_tutor_type: "any",
    urgency: "normal",
    budget_min: 300,
    budget_max: 600,
    contact_name: "",
    contact_phone: "",
    whatsapp_ok: true,
  });

  const mutation = useMutation({
    mutationFn: (data: CaseFormInput) => createFn({ data }),
    onSuccess: (res) => {
      toast.success("Case submitted. We'll notify you when matches are ready.");
      qc.setQueryData(["case-matches", res.caseId], res.matches ?? []);
      navigate({ to: "/post-case/success/$caseId", params: { caseId: res.caseId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof CaseFormInput>(k: K, v: CaseFormInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <h1 className="text-3xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">Post a tutoring case</h1>
          <p className="mt-2 text-sm text-muted-foreground">The more you tell us, the better we match. Only admins &amp; you can see your contact info.</p>

          <form
            className="mt-8 space-y-8"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate(form);
            }}
          >
            <Section title="What do you need help with?">
              <Field label="Case title">
                <Input required maxLength={120} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. DSE Maths tutor for S5 student in Sha Tin" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Subject">
                  <Select value={form.subject} onValueChange={(v) => set("subject", v)}>
                    <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {DEFAULT_SUBJECT_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Exam system (optional)">
                  <Select value={form.exam_system ?? "none"} onValueChange={(v) => set("exam_system", v === "none" ? null : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not applicable</SelectItem>
                      {EXAM_SYSTEMS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Describe the goal (optional)">
                <Textarea rows={4} maxLength={2000} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="Current struggles, target grade, exam date, etc." />
              </Field>
            </Section>

            <Section title="Student">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Level">
                  <Select value={form.student_level} onValueChange={(v) => set("student_level", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Current grade / mark (optional)">
                  <Input maxLength={80} value={form.student_grade_current ?? ""} onChange={(e) => set("student_grade_current", e.target.value)} />
                </Field>
              </div>
              <Field label="School (optional)">
                <Input maxLength={120} value={form.student_school ?? ""} onChange={(e) => set("student_school", e.target.value)} />
              </Field>
            </Section>

            <Section title="Logistics">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="District">
                  <Select value={form.district ?? ""} onValueChange={(v) => set("district", v)}>
                    <SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {HK_DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Mode">
                  <Select value={form.mode} onValueChange={(v) => set("mode", v as CaseFormInput["mode"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_person">In person</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="either">Either</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Sessions per week">
                  <Input type="number" min={1} max={14} value={form.sessions_per_week} onChange={(e) => set("sessions_per_week", Math.max(1, Number(e.target.value) || 1))} />
                </Field>
                <Field label="Session length (min)">
                  <Input type="number" min={30} max={240} step={15} value={form.session_length_minutes} onChange={(e) => set("session_length_minutes", Math.max(30, Number(e.target.value) || 60))} />
                </Field>
                <Field label="Preferred start date (optional)">
                  <Input type="date" value={form.start_date ?? ""} onChange={(e) => set("start_date", e.target.value || null)} />
                </Field>
                <Field label="Urgency">
                  <Select value={form.urgency} onValueChange={(v) => set("urgency", v as CaseFormInput["urgency"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High — asap</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Schedule notes (optional)">
                <Input maxLength={400} value={form.schedule_note ?? ""} onChange={(e) => set("schedule_note", e.target.value)} placeholder="e.g. Weekday evenings after 7pm, weekends flexible" />
              </Field>
            </Section>

            <Section title="Preferences">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Preferred tutor gender">
                  <Select value={form.preferred_gender} onValueChange={(v) => set("preferred_gender", v as CaseFormInput["preferred_gender"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Language of instruction">
                  <Select value={form.language_of_instruction} onValueChange={(v) => set("language_of_instruction", v as CaseFormInput["language_of_instruction"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="either">Either</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="zh-HK">Cantonese</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Tutor type">
                  <Select value={form.preferred_tutor_type} onValueChange={(v) => set("preferred_tutor_type", v as CaseFormInput["preferred_tutor_type"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="university">University student</SelectItem>
                      <SelectItem value="full_time">Full-time tutor</SelectItem>
                      <SelectItem value="experienced">Experienced (5+ yrs)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Section>

            <Section title="Budget (HKD / hour)">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Min">
                  <Input type="number" min={0} max={100000} value={form.budget_min ?? 0} onChange={(e) => set("budget_min", Number(e.target.value) || 0)} />
                </Field>
                <Field label="Max">
                  <Input type="number" min={0} max={100000} value={form.budget_max ?? 0} onChange={(e) => set("budget_max", Number(e.target.value) || 0)} />
                </Field>
              </div>
            </Section>

            <Section title="Contact">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your name">
                  <Input required maxLength={80} value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
                </Field>
                <Field label="Phone / WhatsApp">
                  <Input required maxLength={20} value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} placeholder="+852 …" />
                </Field>
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
                <Switch checked={form.whatsapp_ok} onCheckedChange={(v) => set("whatsapp_ok", v)} />
                <span className="text-sm">OK to contact me on WhatsApp</span>
              </label>
              <p className="text-xs text-muted-foreground">Your contact details are only visible to you and the MatchMax team. Tutors won't see them until we release your info.</p>
            </Section>

            <div className="flex items-center justify-end gap-3">
              <Button type="submit" size="lg" disabled={mutation.isPending} className="bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]">
                {mutation.isPending ? "Submitting…" : "Submit case & see matches"}
              </Button>
            </div>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
      <h2 className="text-lg font-bold text-[color:var(--brand-navy)]">{title}</h2>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
