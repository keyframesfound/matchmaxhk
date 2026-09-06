import * as React from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, Check, Sparkles, X } from "lucide-react";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";

export const Route = createFileRoute("/pricing")({
  beforeLoad: () => {
    if (!CENTRE_MARKET_ENABLED) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Plans for Tutoring Businesses | MatchMax" },
      {
        name: "description",
        content:
          "Compare MatchMax plans: free tutor profiles, Business and Enterprise plans for tutoring centres and education companies in Hong Kong.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Plans for Tutoring Businesses | MatchMax" },
      { property: "og:url", content: "https://matchmax.hk/pricing" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/pricing" }],
  }),
  component: PricingPage,
});

type CellValue = boolean | string;

type Feature = {
  label: string;
  values: [CellValue, CellValue, CellValue];
};

type FeatureGroup = {
  section: string;
  features: Feature[];
};

const plans = [
  {
    name: "Basic",
    audience: "Tutor profile",
    price: "Free",
    cadence: "For individual tutors",
    highlighted: false,
    cta: { label: "Create free profile", to: "/join" },
  },
  {
    name: "Business",
    audience: "For centres & small teams",
    price: "Custom",
    cadence: "Billed offline",
    highlighted: true,
    cta: { label: "Get started", to: "/business/join" },
  },
  {
    name: "Enterprise",
    audience: "For schools & larger centres",
    price: "Custom",
    cadence: "Billed offline",
    highlighted: false,
    cta: { label: "Get started", to: "/business/join", search: { plan: "enterprise" } },
  },
] as const;

const groups: FeatureGroup[] = [
  {
    section: "Profile & listings",
    features: [
      { label: "Public tutor profile", values: [true, false, false] },
      { label: "Business profile with logo & branding", values: [false, true, true] },
      { label: "Published courses", values: [false, "Up to 10", "Unlimited"] },
      { label: "Public course directory listing", values: [false, true, true] },
    ],
  },
  {
    section: "Enquiries & team",
    features: [
      { label: "WhatsApp enquiries", values: [true, true, true] },
      { label: "Email enquiries", values: [false, true, true] },
      { label: "Course images hosted on Cloudflare CDN", values: [false, true, true] },
      { label: "Admin team members", values: [false, "Owner + 1 admin", "Owner + 20 admins"] },
    ],
  },
  {
    section: "Growth & support",
    features: [
      { label: "Priority placement in course directory", values: [false, false, true] },
      { label: "Dedicated support", values: [false, false, true] },
    ],
  },
];

function Cell({ value, highlighted }: { value: CellValue; highlighted: boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <span
        className={cn(
          "mx-auto flex size-5 items-center justify-center rounded-md",
          highlighted ? "bg-[color:var(--foreground)]" : "bg-[color:var(--foreground)]/10",
        )}
      >
        <Check
          className={cn(
            "size-3.5",
            highlighted ? "text-[color:var(--background)]" : "text-[color:var(--foreground)]",
          )}
          aria-hidden
        />
        <span className="sr-only">Included</span>
      </span>
    ) : (
      <span className="mx-auto flex size-5 items-center justify-center rounded-md bg-muted">
        <X className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="sr-only">Not included</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "text-sm font-medium",
        highlighted ? "text-[color:var(--ink)]" : "text-muted-foreground",
      )}
    >
      {value}
    </span>
  );
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
              tutors every month. Compare plans side by side and upgrade as you grow.
            </p>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <div className="mb-10 max-w-2xl">
              <Badge variant="outline" className="mb-4 gap-1.5">
                <Sparkles
                  className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]"
                  aria-hidden
                />
                Compare plans
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight text-[color:var(--ink)] sm:text-4xl">
                Find the right plan for your team
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Individual tutors can join free with a public tutor profile. Centres and schools
                list courses on the Business or Enterprise plan.
              </p>
            </div>

            <div className="relative">
              <Badge className="absolute bottom-full left-[68%] z-20 mb-2 -translate-x-1/2 border-none bg-[color:var(--foreground)] font-bold text-[color:var(--background)]">
                Most popular
              </Badge>
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table className="table-fixed text-sm">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="sticky top-0 z-20 w-[36%] border-b border-border bg-background align-bottom">
                        <span className="inline-block pb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          Features
                        </span>
                      </TableHead>
                      {plans.map((plan) => (
                        <TableHead
                          key={plan.name}
                          className={cn(
                            "sticky top-0 z-20 border-b border-border text-center align-bottom",
                            plan.highlighted
                              ? "bg-[color:var(--foreground)]/[0.03]"
                              : "bg-background",
                          )}
                        >
                          <div className="flex flex-col items-center gap-1 py-3">
                            <span className="text-sm font-semibold text-[color:var(--ink)]">
                              {plan.name}
                            </span>
                            <span className="text-lg font-bold text-[color:var(--ink)]">
                              {plan.price}
                            </span>
                            <span className="text-xs font-normal text-muted-foreground">
                              {plan.cadence}
                            </span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {groups.map((group) => (
                      <React.Fragment key={group.section}>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableCell
                            colSpan={4}
                            className="py-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--ink)]"
                          >
                            {group.section}
                          </TableCell>
                        </TableRow>
                        {group.features.map((feature) => (
                          <TableRow key={`${group.section}-${feature.label}`}>
                            <TableCell className="py-3 font-medium text-[color:var(--ink)]">
                              {feature.label}
                            </TableCell>
                            {feature.values.map((value, i) => (
                              <TableCell
                                key={`${feature.label}-${plans[i].name}`}
                                className={cn(
                                  "py-3 text-center",
                                  plans[i].highlighted && "bg-[color:var(--foreground)]/[0.03]",
                                )}
                              >
                                <Cell value={value} highlighted={plans[i].highlighted} />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </React.Fragment>
                    ))}

                    <TableRow className="hover:bg-transparent">
                      <TableCell className="py-4" />
                      {plans.map((plan) => (
                        <TableCell
                          key={`cta-${plan.name}`}
                          className={cn(
                            "py-4 text-center",
                            plan.highlighted && "bg-[color:var(--foreground)]/[0.03]",
                          )}
                        >
                          <Button
                            asChild
                            size="sm"
                            variant={plan.highlighted ? "solid" : "outline"}
                            color={plan.highlighted ? "blue" : undefined}
                            className="w-full font-bold"
                          >
                            {plan.name === "Enterprise" ? (
                              <Link to="/business/join" search={{ plan: "enterprise" }}>
                                {plan.cta.label}
                                <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
                              </Link>
                            ) : (
                              <Link to={plan.cta.to}>
                                {plan.cta.label}
                                <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
                              </Link>
                            )}
                          </Button>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Business and Enterprise plans are billed offline — create your account and our team
              will contact you to activate it. Questions? Check the FAQ on the How it Works page.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
