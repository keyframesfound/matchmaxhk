import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, MapPin, MessageCircle, GraduationCap, Award, Languages, Clock, Pencil, Trash2, Plus, X, Globe } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { StarRating } from "@/components/ui/StarRating";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { fetchTutorByCode, getTutorLessonModeLabel, getTutorLocationLabel, type Tutor } from "@/features/tutors/queries";
import { getSystem } from "@/features/tutors/examSystems";
import { fetchReviewsForTutor, type TutorReview } from "@/features/tutors/reviews";
import { useAuth } from "@/features/auth/useAuth";

export const Route = createFileRoute("/tutors/$tutorCode")({
  loader: async ({ params }) => {
    const tutor = await fetchTutorByCode(params.tutorCode);
    if (!tutor) throw notFound();
    return { tutor };
  },
  head: ({ loaderData, params }) => {
    const url = `https://maxmatch.app/tutors/${params.tutorCode}`;
    if (!loaderData) {
      return {
        meta: [{ title: "Tutor not found — MatchMax" }, { name: "robots", content: "noindex" }],
        links: [{ rel: "canonical", href: url }],
      };
    }
    const t = loaderData.tutor;
    const title = `${t.display_name} — MatchMax`;
    const subjects = (t.subjects ?? []).slice(0, 3).join(", ");
    const desc = t.headline ?? `${subjects} tutor · ${getTutorLessonModeLabel(t.lesson_mode)}${t.lesson_mode === "online" ? "" : t.district ? ` in ${t.district}` : ""}.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "og:type", content: "profile" },
        ...(t.photo_url ? [
          { property: "og:image", content: t.photo_url },
          { name: "twitter:image", content: t.photo_url },
        ] : []),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },

  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-3xl font-black text-[color:var(--brand-navy)]">Tutor not found</h1>
        <p className="mt-3 text-muted-foreground">This tutor code doesn’t match any published tutor.</p>
        <Button asChild className="mt-6"><Link to="/tutors">Browse all tutors</Link></Button>
      </main>
      <SiteFooter />
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-destructive">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </main>
      <SiteFooter />
    </div>
  ),
  component: TutorDetail,
});

function TutorDetail() {
  const { tutor } = Route.useLoaderData();
  const { user, hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(["admin", "super_admin"]);
  const queryClient = useQueryClient();

  const { data: reviews = [] } = useQuery({
    queryKey: ["tutor", tutor.id, "reviews"],
    queryFn: () => fetchReviewsForTutor(tutor.id),
  });

  const { data: whatsappNumber } = useQuery({
    queryKey: ["settings", "whatsapp_number"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "whatsapp_number")
        .maybeSingle();
      if (error) throw error;
      const v = data?.value;
      return typeof v === "string" ? v : "";
    },
  });

  // liveTutor: refresh rating/review_count after mutations
  const { data: liveTutor } = useQuery({
    queryKey: ["tutor", "byCode", tutor.tutor_code],
    queryFn: () => fetchTutorByCode(tutor.tutor_code),
    initialData: tutor,
  });
  const t: Tutor = liveTutor ?? tutor;

  const waDigits = (whatsappNumber ?? "").replace(/[^\d]/g, "");
  const waUrl = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(`I would like to request tutor ${t.tutor_code}`)}`
    : "";

  const myReview = useMemo(
    () => (user ? reviews.find((r) => r.author_user_id === user.id) ?? null : null),
    [reviews, user],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TutorReview | null>(null);
  const [adminMode, setAdminMode] = useState(false);

  function openWriteOwn() {
    setEditing(myReview);
    setAdminMode(false);
    setDialogOpen(true);
  }
  function openAdminAdd() {
    setEditing(null);
    setAdminMode(true);
    setDialogOpen(true);
  }
  function openAdminEdit(r: TutorReview) {
    setEditing(r);
    setAdminMode(true);
    setDialogOpen(true);
  }

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tutor_reviews").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review deleted");
      queryClient.invalidateQueries({ queryKey: ["tutor", tutor.id, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["tutor", "byCode", tutor.tutor_code] });
      queryClient.invalidateQueries({ queryKey: ["landing", "featured_tutors"] });
      queryClient.invalidateQueries({ queryKey: ["tutors", "published"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "tutors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        {/* Header */}
        <section className="border-b border-border bg-muted/30 py-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="flex flex-wrap items-start gap-6">
              {t.photo_url ? (
                <img src={t.photo_url} alt={t.display_name} className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
              ) : (
                <div className="h-24 w-24 shrink-0 rounded-2xl bg-brand-gradient-soft" />
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-black text-[color:var(--brand-navy)] sm:text-4xl">{t.display_name}</h1>
                {t.headline && <p className="mt-1 text-lg text-muted-foreground">{t.headline}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <StarRating value={Number(t.rating)} readOnly size={16} />
                  <span className="font-bold">{Number(t.rating).toFixed(1)}</span>
                  <span className="text-muted-foreground">
                    {t.review_count === 0 ? "· New" : `· ${t.review_count} review${t.review_count === 1 ? "" : "s"}`}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    {t.lesson_mode === "online" ? <Globe className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                    {getTutorLocationLabel(t)}
                  </span>
                  {t.badge && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-teal)]/10 px-3 py-1 text-xs font-bold text-[color:var(--brand-teal)]">
                      <BadgeCheck className="h-3 w-3" /> {t.badge}
                    </span>
                  )}
                  {(t.subjects ?? []).map((s) => (
                    <span key={s} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{s}</span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-[color:var(--brand-navy)]">HK${t.hourly_rate}<span className="ml-1 text-sm font-semibold text-muted-foreground">/hr</span></p>
                <p className="mt-1 text-xs text-muted-foreground">Tutor code: <strong>{t.tutor_code}</strong></p>
                {waUrl ? (
                  <Button asChild className="mt-3 bg-brand-gradient font-bold text-white shadow-teal">
                    <a href={waUrl} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" /> Request this tutor
                    </a>
                  </Button>
                ) : (
                  <Button disabled className="mt-3 bg-brand-gradient font-bold text-white shadow-teal">
                    <MessageCircle className="mr-2 h-4 w-4" /> Contact coming soon
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Body */}
        <section className="py-14">
          <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:px-6 lg:grid-cols-3 min-h-0">
            <div className="space-y-8 lg:col-span-2 min-h-0">
              {t.bio && (
                <div>
                  <h2 className="text-xl font-bold text-[color:var(--brand-navy)]">About</h2>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground break-words">{t.bio}</p>
                </div>
              )}

              {t.education.length > 0 && (
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-bold text-[color:var(--brand-navy)]">
                    <GraduationCap className="h-5 w-5" /> Education
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {t.education.map((e, i) => (
                      <li key={i} className="rounded-xl border border-border bg-card p-3 text-sm">
                        <p className="font-semibold text-foreground">{e.qualification}</p>
                        <p className="text-muted-foreground">
                          {e.institution}{e.year ? ` · ${e.year}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {t.exam_results.length > 0 && (
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-bold text-[color:var(--brand-navy)]">
                    <Award className="h-5 w-5" /> Exam results
                  </h2>
                  <div className="mt-3 space-y-3">
                    {t.exam_results.map((r, i) => {
                      const sys = getSystem(r.system);
                      return (
                        <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
                          <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            {sys?.label ?? r.system}
                          </div>
                          <table className="w-full text-sm">
                            <tbody>
                              {r.subjects.map((s, j) => (
                                <tr key={j} className="border-t border-border first:border-t-0">
                                  <td className="px-3 py-2 font-medium text-foreground">{s.subject}</td>
                                  <td className="px-3 py-2 text-right font-bold text-[color:var(--brand-navy)]">{s.grade}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}



              {/* Reviews */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-[color:var(--brand-navy)]">Reviews</h2>
                  <div className="flex gap-2">
                    {user && !isAdmin && (
                      <Button onClick={openWriteOwn} className="bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]">
                        {myReview ? "Edit your review" : "Write a review"}
                      </Button>
                    )}
                    {!user && (
                      <Button asChild variant="outline">
                        <Link to="/auth">Sign in to review</Link>
                      </Button>
                    )}
                    {isAdmin && (
                      <Button onClick={openAdminAdd} className="bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]">
                        <Plus className="mr-2 h-4 w-4" /> Add review
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {reviews.length === 0 && (
                    <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      No reviews yet. Be the first to share your experience.
                    </p>
                  )}
                  {reviews.map((r) => (
                    <article key={r.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{r.author_alias}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <StarRating value={r.rating} readOnly size={14} />
                            <span className="text-xs text-muted-foreground">
                              {new Date(r.created_at).toLocaleDateString()}
                              {!r.is_published && " · Hidden"}
                            </span>
                          </div>
                        </div>
                        {(isAdmin || r.author_user_id === user?.id) && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openAdminEdit(r)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm("Delete this review?")) remove.mutate(r.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {r.comment && <p className="mt-3 whitespace-pre-line text-sm text-foreground">{r.comment}</p>}
                    </article>
                  ))}
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Details</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {t.experience_years != null && (
                    <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-[color:var(--brand-teal)]" /> {t.experience_years} years of experience</li>
                  )}
                  {t.teaching_since != null && (
                    <li className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-[color:var(--brand-teal)]" /> Teaching since {t.teaching_since}</li>
                  )}
                  {t.languages.length > 0 && (
                    <li className="flex items-center gap-2"><Languages className="h-4 w-4 text-[color:var(--brand-teal)]" /> {t.languages.join(", ")}</li>
                  )}
                  {t.district && (
                    <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[color:var(--brand-teal)]" /> {t.district}</li>
                  )}
                </ul>
              </div>
            </aside>
          </div>
        </section>
      </main>
      <SiteFooter />

      <ReviewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tutorId={tutor.id}
        tutorCode={tutor.tutor_code}
        editing={editing}
        adminMode={adminMode}
      />
    </div>
  );
}

function ReviewDialog({
  open, onOpenChange, tutorId, tutorCode, editing, adminMode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tutorId: string;
  tutorCode: string;
  editing: TutorReview | null;
  adminMode: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [alias, setAlias] = useState(editing?.author_alias ?? "");
  const [rating, setRating] = useState(editing?.rating ?? 5);
  const [comment, setComment] = useState(editing?.comment ?? "");
  const [published, setPublished] = useState(editing?.is_published ?? true);

  // Reset when opening for a different review
  useMemo(() => {
    if (open) {
      setAlias(editing?.author_alias ?? (adminMode ? "" : user?.user_metadata?.display_name ?? user?.email?.split("@")[0] ?? ""));
      setRating(editing?.rating ?? 5);
      setComment(editing?.comment ?? "");
      setPublished(editing?.is_published ?? true);
    }
  }, [open, editing, adminMode, user]);

  const save = useMutation({
    mutationFn: async () => {
      const cleanAlias = alias.trim();
      if (!cleanAlias) throw new Error("Please enter a name / alias.");
      if (rating < 1 || rating > 5) throw new Error("Rating must be 1–5.");
      if (editing) {
        const { error } = await supabase
          .from("tutor_reviews")
          .update({
            author_alias: cleanAlias,
            rating,
            comment: comment.trim() || null,
            is_published: published,
          })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const payload: Record<string, unknown> = {
          tutor_id: tutorId,
          author_alias: cleanAlias,
          rating,
          comment: comment.trim() || null,
          is_published: published,
          created_by: user?.id ?? null,
          // In admin-authored mode we leave author_user_id null (anonymous on behalf of someone).
          author_user_id: adminMode ? null : user?.id ?? null,
        };
        const { error } = await supabase.from("tutor_reviews").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Review saved");
      queryClient.invalidateQueries({ queryKey: ["tutor", tutorId, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["tutor", "byCode", tutorCode] });
      queryClient.invalidateQueries({ queryKey: ["landing", "featured_tutors"] });
      queryClient.invalidateQueries({ queryKey: ["tutors", "published"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "tutors"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit review" : adminMode ? "Add review (as guest)" : "Write a review"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Display name / alias</Label>
            <Input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="e.g. Mrs. Chan" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Rating</Label>
            <StarRating value={rating} onChange={setRating} size={28} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Comment</Label>
            <Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was your experience with this tutor?" />
          </div>
          {adminMode && (
            <div className="flex items-center gap-3">
              <Switch id="rpub" checked={published} onCheckedChange={setPublished} />
              <Label htmlFor="rpub" className="text-sm">Published (visible publicly)</Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]"
          >
            {save.isPending ? "Saving…" : "Save review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
