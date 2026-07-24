import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, BadgeCheck, Sparkles, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/become-a-tutor")({
  head: () => ({
    meta: [
      { title: "Become a tutor — MatchMax" },
      {
        name: "description",
        content:
          "Join MatchMax as a tutor. Contact our team on WhatsApp to get verified and start receiving case leads.",
      },
      { property: "og:title", content: "Become a tutor — MatchMax" },
      {
        property: "og:description",
        content:
          "Join Hong Kong's smart tutoring marketplace and receive matched case leads from parents.",
      },
      { property: "og:url", content: "https://maxmatch.app/become-a-tutor" },
    ],
    links: [{ rel: "canonical", href: "https://maxmatch.app/become-a-tutor" }],
  }),
  component: BecomeATutor,
});

function BecomeATutor() {
  const { data: whatsapp } = useQuery({
    queryKey: ["settings", "whatsapp_number"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "whatsapp_number")
        .maybeSingle();
      if (error) return null;
      const v = data?.value;
      return typeof v === "string" && v.trim() ? v.trim() : null;
    },
  });

  const digits = whatsapp?.replace(/[^\d]/g, "") ?? "";
  const waLink = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent("Hi MatchMax, I'd like to join as a tutor.")}`
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden py-20 sm:py-28">
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(ellipse at top right, color-mix(in oklab, #2ED5DE 20%, transparent) 0%, transparent 55%)",
            }}
          />
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--brand-teal)]/30 bg-[color:var(--brand-teal)]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[color:var(--brand-teal)]">
              <Sparkles className="h-3.5 w-3.5" />
              Join MatchMax
            </span>
            <h1 className="mt-6 text-5xl font-black leading-[1.05] tracking-tight text-[color:var(--brand-navy)] sm:text-6xl">
              Become a MatchMax tutor
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              We hand-pick every tutor on MatchMax. To get verified and start receiving case leads,
              message our team on WhatsApp — we'll walk you through the short onboarding.
            </p>

            <div className="mt-10 rounded-3xl border border-border bg-card p-8 shadow-brand">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Step 1
              </p>
              <h2 className="mt-2 text-2xl font-black text-[color:var(--brand-navy)]">
                Contact us on WhatsApp
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                {whatsapp
                  ? `Send a short intro (subjects, levels, districts, availability) to ${whatsapp}. We reply within one working day.`
                  : "Our WhatsApp contact number is coming soon. Please check back shortly."}
              </p>

              {waLink ? (
                <Button
                  asChild
                  size="lg"
                  className="mt-6 h-14 bg-[#25D366] px-8 text-base font-bold text-white hover:bg-[#1ebe57]"
                >
                  <a href={waLink} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-2 h-5 w-5" /> Message us on WhatsApp
                  </a>
                </Button>
              ) : (
                <Button size="lg" disabled className="mt-6 h-14 px-8 text-base font-bold">
                  <MessageCircle className="mr-2 h-5 w-5" /> WhatsApp — number coming soon
                </Button>
              )}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                { t: "Verified profile", d: "We check credentials and teaching background." },
                { t: "Set your own rate", d: "Full control over your hourly pricing." },
                { t: "Quality case leads", d: "Only matched families are introduced to you." },
                { t: "No hidden fees", d: "Transparent pricing, no surprise commissions." },
              ].map((f) => (
                <div key={f.t} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <BadgeCheck className="h-4 w-4 text-[color:var(--brand-teal)]" /> {f.t}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button asChild variant="outline" className="font-bold">
                <Link to="/">
                  Back to home <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" className="font-bold">
                <Link to="/tutors">Browse existing tutors</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
