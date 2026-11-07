import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2, FileText, GraduationCap, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

type JoinOption = {
  key: "tutor" | "notes" | "centre";
  icon: LucideIcon;
  link: { to: string; search?: Record<string, string> };
};

// Option 3 (talks, workshops, activities) is parked by the CEO's year-1
// academics lock on #576, so the chooser ships the three academic routes.
const OPTIONS: JoinOption[] = [
  { key: "tutor", icon: GraduationCap, link: { to: "/join", search: { path: "tutor" } } },
  { key: "notes", icon: FileText, link: { to: "/account/notes/new" } },
  { key: "centre", icon: Building2, link: { to: "/business/join" } },
];

export function JoinChooser() {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {OPTIONS.map(({ key, icon: Icon, link }) => (
        <Link
          key={key}
          {...link}
          className="group flex h-full flex-col rounded-2xl border border-border p-5 transition-colors hover:border-[color:var(--ink)]/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
        >
          <Icon className="h-5 w-5 text-[color:var(--ink)]" aria-hidden />
          <h2 className="mt-3 text-base font-bold text-[color:var(--ink)]">
            {t(`join_flow.option_${key}`)}
          </h2>
          <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
            {t(`join_flow.option_${key}_desc`)}
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--ink)]">
            {t(`join_flow.option_${key}_cta`)}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </span>
        </Link>
      ))}
    </div>
  );
}
