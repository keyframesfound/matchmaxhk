import { Link } from "@tanstack/react-router";
import { Instagram, Linkedin, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { LanguageToggle } from "@/components/brand/LanguageToggle";

const footerPages = [
  { name: "Home", to: "/" },
  { name: "How it works", to: "/how-it-works" },
  { name: "Find tutors", to: "/tutors" },
  { name: "FAQ", to: "/faq" },
  { name: "Consulting", to: "/consulting" },
  { name: "Privacy", to: "/privacy-policy" },
] as const;

export function SiteFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start">
            <div>
              <Logo />
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                {t("footer.tagline")}
              </p>

              <div className="mt-5 flex items-center gap-3">
                <a
                  href="https://www.linkedin.com/company/matchmax/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="MatchMax on LinkedIn"
                  className="rounded-full border border-border p-2 text-muted-foreground transition hover:scale-110 hover:border-[color:var(--brand-teal)] hover:text-[color:var(--brand-teal)] active:scale-90"
                >
                  <Linkedin className="h-5 w-5" aria-hidden="true" />
                </a>
                <a
                  href="https://www.instagram.com/match_max/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="MatchMax on Instagram"
                  className="rounded-full border border-border p-2 text-muted-foreground transition hover:scale-110 hover:border-[color:var(--brand-teal)] hover:text-[color:var(--brand-teal)] active:scale-90"
                >
                  <Instagram className="h-5 w-5" aria-hidden="true" />
                </a>
                <a
                  href="mailto:matchmaxedu@gmail.com"
                  aria-label="Email MatchMax"
                  className="rounded-full border border-border p-2 text-muted-foreground transition hover:scale-110 hover:border-[color:var(--brand-teal)] hover:text-[color:var(--brand-teal)] active:scale-90"
                >
                  <Mail className="h-5 w-5" aria-hidden="true" />
                </a>
              </div>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Explore pages
              </h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {footerPages.map((page) => (
                  <Button
                    key={page.to}
                    asChild
                    variant="outline"
                    className="justify-start border-border bg-background text-foreground hover:border-[color:var(--brand-teal)] hover:text-[color:var(--brand-navy)]"
                  >
                    <Link to={page.to}>{page.name}</Link>
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row">
            <p>© {year} MatchMax. {t("footer.rights")}</p>
            <LanguageToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}
