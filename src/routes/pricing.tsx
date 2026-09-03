import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Minus } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Plans for Tutoring Businesses | MatchMax" },
      {
        name: "description",
        content:
          "List your courses on MatchMax. Business and Enterprise plans for tutoring centres and education companies in Hong Kong.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Plans for Tutoring Businesses | MatchMax" },
      { property: "og:url", content: "https://matchmax.hk/pricing" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/pricing" }],
  }),
  component: PricingPage,
});

type PlanFeature = { label: string; business: string | boolean; enterprise: string | boolean };

const FEATURES: PlanFeature[] = [
  { label: "Published courses", business: "Up to 10", enterprise: "Unlimited" },
  { label: "Admin team members", business: "Owner + 1 admin", enterprise: "Owner + 20 admins" },
  { label: "Course images hosted on Cloudflare CDN", business: true, enterprise: true },
  { label: "Business profile with logo & branding", business: true, enterprise: true },
  { label: "Public course directory listing", business: true, enterprise: true },
  { label: "WhatsApp & email enquiries", business: true, enterprise: true },
  { label: "Priority placement in course directory", business: false, enterprise: true },
  { label: "Dedicated support", business: false, enterprise: true },
];

function FeatureValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return <Check className="mx-auto h-5 w-5 text-emerald-600" aria-label="Included" />;
  }
  if (value === false) {
    return <Minus className="mx-auto h-5 w-5 text-muted-foreground/50" aria-label="Not included" />;
  }
  return <span className="text-sm font-semibold text-[color:var(--ink)]">{value}</span>;
}

function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="hero-startup-bg border-b border-border py-16">
          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
            <h1 className="text-4xl font-black tracking-tight text-[color:var(--ink)] sm:text-5xl">
              For tutoring businesses
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Put your courses in front of thousands of Hong Kong parents and students searching for
              tutors every month. Create your account, post courses, and manage your team.
            </p>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="w-2/5 p-4 text-sm font-semibold text-muted-foreground sm:p-6">
                      Compare plans
                    </th>
                    <th className="w-3/10 border-l border-border p-4 text-center sm:p-6">
                      <p className="text-base font-bold text-[color:var(--ink)]">Business</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        For individual tutors & small centres
                      </p>
                    </th>
                    <th className="w-3/10 border-l border-border p-4 text-center sm:p-6">
                      <p className="text-base font-bold text-[color:var(--ink)]">Enterprise</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        For schools & larger centres
                      </p>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURES.map((feature, index) => (
                    <tr
                      key={feature.label}
                      className={
                        index % 2 === 1
                          ? "border-b border-border bg-muted/40"
                          : "border-b border-border"
                      }
                    >
                      <td className="p-4 text-sm font-medium text-[color:var(--ink)] sm:p-6">
                        {feature.label}
                      </td>
                      <td className="border-l border-border p-4 text-center sm:p-6">
                        <FeatureValue value={feature.business} />
                      </td>
                      <td className="border-l border-border p-4 text-center sm:p-6">
                        <FeatureValue value={feature.enterprise} />
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="p-4 sm:p-6" />
                    <td className="border-l border-border p-4 text-center sm:p-6">
                      <Button
                        asChild
                        className="w-full bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
                      >
                        <Link to="/business/join">Get started</Link>
                      </Button>
                    </td>
                    <td className="border-l border-border p-4 text-center sm:p-6">
                      <Button
                        asChild
                        className="w-full bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
                      >
                        <Link to="/business/join" search={{ plan: "enterprise" }}>
                          Get started
                        </Link>
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Plans are billed offline — create your account and our team will contact you to
              activate it. Questions? Reach us via the Help Centre.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
