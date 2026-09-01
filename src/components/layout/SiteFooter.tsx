import { Link } from "@tanstack/react-router";
import { Instagram, Linkedin, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LanguageToggle } from "@/components/brand/LanguageToggle";

const productLinks = [
  { name: "Find tutors", to: "/tutors" },
  { name: "How it works", to: "/how-it-works" },
  { name: "Saved Posts", to: "/saved-posts" },
  { name: "Join as tutor", to: "/join" },
] as const;

const companyLinks = [
  { name: "FAQ", to: "/faq" },
  { name: "Privacy policy", to: "/privacy-policy" },
] as const;

const supportLinks = [
  { name: "Home", to: "/" },
  { name: "Help center", to: "/faq" },
] as const;

export function SiteFooter({
  className,
  hideDivider = false,
}: {
  className?: string;
  hideDivider?: boolean;
}) {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className={`border-t border-border bg-background ${className ?? ""}`}>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <h3 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
              MatchMax
            </h3>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-foreground/70">
              {t("footer.tagline")}
            </p>

            <div className="mt-5 flex gap-4">
              <a
                className="text-foreground/60 transition-colors hover:text-brand"
                href="https://www.linkedin.com/company/matchmax/"
                rel="noopener noreferrer"
                target="_blank"
                aria-label="MatchMax on LinkedIn"
              >
                <Linkedin className="h-5 w-5" aria-hidden="true" />
              </a>
              <a
                className="text-foreground/60 transition-colors hover:text-brand"
                href="https://www.instagram.com/match_max/"
                rel="noopener noreferrer"
                target="_blank"
                aria-label="MatchMax on Instagram"
              >
                <Instagram className="h-5 w-5" aria-hidden="true" />
              </a>
              <a
                className="text-foreground/60 transition-colors hover:text-brand"
                href="mailto:matchmaxedu@gmail.com"
                aria-label="Email MatchMax"
              >
                <Mail className="h-5 w-5" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 lg:col-span-3">
            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-foreground">
                Product
              </h4>
              <ul className="space-y-3">
                {productLinks.map((link) => (
                  <li key={link.to}>
                    <Link
                      className="text-sm text-foreground/70 transition-colors hover:text-brand"
                      to={link.to}
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-foreground">
                Company
              </h4>
              <ul className="space-y-3">
                {companyLinks.map((link) => (
                  <li key={link.to}>
                    <Link
                      className="text-sm text-foreground/70 transition-colors hover:text-brand"
                      to={link.to}
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-foreground">
                Support
              </h4>
              <ul className="space-y-3">
                {supportLinks.map((link) => (
                  <li key={link.to}>
                    <Link
                      className="text-sm text-foreground/70 transition-colors hover:text-brand"
                      to={link.to}
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div
          className={`mt-12 flex flex-col items-center justify-between gap-4 pt-8 text-center sm:flex-row ${hideDivider ? "" : "border-t border-border"}`}
        >
          <p className="text-sm text-foreground/60">
            © {year} MatchMax. {t("footer.rights")}
          </p>
          <LanguageToggle />
        </div>
      </div>
    </footer>
  );
}
