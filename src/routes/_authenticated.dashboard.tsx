import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Users2, ClipboardList, Inbox, UserCog, Settings2, GraduationCap, MessageSquarePlus, FolderKanban } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { useAuth, type AppRole } from "@/features/auth/useAuth";
import { ROLE_LABEL_KEY, primaryRole } from "@/features/auth/roleLabel";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — MatchMax" },
      { name: "description", content: "Your MatchMax dashboard — post a tutoring case, review matched leads, or manage your tutor profile in one place." },
      { property: "og:url", content: "https://maxmatch.app/dashboard" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://maxmatch.app/dashboard" }],
  }),
  component: Dashboard,
});


type Card = { icon: React.ComponentType<{ className?: string }>; titleKey: string; descKey: string; to?: string };

function roleCards(role: AppRole): Card[] {
  switch (role) {
    case "parent":
      return [
        { icon: FolderKanban, titleKey: "dashboard.parent.my_cases", descKey: "dashboard.parent.my_cases_desc", to: "/my-cases" },
      ];
    case "tutor":
      return [
        { icon: Inbox, titleKey: "dashboard.tutor.leads", descKey: "dashboard.tutor.leads_desc", to: "/cases" },
        { icon: UserCog, titleKey: "dashboard.tutor.profile", descKey: "dashboard.tutor.profile_desc" },
      ];
    case "staff":
      return [
        { icon: ClipboardList, titleKey: "dashboard.staff.review", descKey: "dashboard.staff.review_desc", to: "/admin/cases" },
        { icon: GraduationCap, titleKey: "dashboard.staff.tutors", descKey: "dashboard.staff.tutors_desc", to: "/admin/tutors" },
      ];
    case "admin":
    case "super_admin":
      return [
        { icon: ClipboardList, titleKey: "dashboard.admin.cases", descKey: "dashboard.admin.cases_desc", to: "/admin/cases" },
        { icon: GraduationCap, titleKey: "dashboard.admin.tutors", descKey: "dashboard.admin.tutors_desc", to: "/admin/tutors" },
        { icon: Users2, titleKey: "dashboard.admin.users", descKey: "dashboard.admin.users_desc", to: "/admin/users" },
        { icon: Settings2, titleKey: "dashboard.admin.settings", descKey: "dashboard.admin.settings_desc", to: "/admin/settings" },
      ];
  }
}


function titleKeyFor(role: AppRole): string {
  if (role === "super_admin" || role === "admin") return "dashboard.admin.title";
  if (role === "staff") return "dashboard.staff.title";
  if (role === "tutor") return "dashboard.tutor.title";
  return "dashboard.parent.title";
}

function Dashboard() {
  const { t } = useTranslation();
  const { user, roles } = useAuth();
  const role = primaryRole(roles);
  const cards = roleCards(role);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-[color:var(--brand-teal)]">
                {t("dashboard.welcome")}
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
                {t(titleKeyFor(role))}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <div className="rounded-full border border-border bg-card px-4 py-2 text-xs">
              <span className="mr-2 text-muted-foreground">{t("dashboard.your_role")}:</span>
              <span className="font-bold text-[color:var(--brand-navy)]">{t(ROLE_LABEL_KEY[role])}</span>
            </div>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(({ icon: Icon, titleKey, descKey, to }) => {
              const inner = (
                <div className="group flex h-full flex-col rounded-3xl border border-border bg-card p-8 transition-all hover:border-[color:var(--brand-teal)]/40 hover:shadow-brand">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-teal">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{t(titleKey)}</h3>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{t(descKey)}</p>
                  {!to && (
                    <span className="mt-4 inline-flex w-fit rounded-full bg-muted px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t("dashboard.coming_soon")}
                    </span>
                  )}
                </div>
              );
              return to ? (
                <Link key={titleKey} to={to}>{inner}</Link>
              ) : (
                <div key={titleKey}>{inner}</div>
              );
            })}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
