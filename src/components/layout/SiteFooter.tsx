import { Link } from "@tanstack/react-router";
import { Instagram, Linkedin, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LanguageToggle } from "@/components/brand/LanguageToggle";

const productLinks = [
  { key: "footer.find_tutors", to: "/tutors" },
  { key: "footer.how", to: "/guide" },
  { key: "footer.request_tutor", to: "/tutor-requests" },
  { key: "footer.saved_posts", to: "/saved-posts" },
  { key: "footer.join_as_tutor", to: "/join" },
] as const;

const companyLinks = [
  { key: "footer.faq", to: "/guide", hash: "faq" },
  { key: "footer.playbook", to: "/tutor-playbook" },
  { key: "footer.terms", to: "/tos" },
  { key: "footer.privacy", to: "/privacy-policy" },
  { key: "footer.commitment", to: "/tos", hash: "community-commitment" },
] as const;

const supportLinks = [
  { key: "footer.help", to: "/help" },
  { key: "footer.home", to: "/" },
  { key: "footer.contact", href: "mailto:contact@matchmax.hk" },
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
      <div className="mx-auto max-w-7xl px-6 pt-12 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <h3
              className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl"
              style={{ fontFamily: "var(--font-wordmark)" }}
            >
              MatchMax
            </h3>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              {t("footer.tagline")}
            </p>

            <div className="mt-5 flex gap-4">
              <a
                className="text-muted-foreground transition-[color,transform] duration-150 hover:text-brand active:scale-90 motion-reduce:transition-none"
                href="https://www.linkedin.com/company/matchmax/"
                rel="noopener noreferrer"
                target="_blank"
                aria-label="MatchMax on LinkedIn"
              >
                <Linkedin className="h-5 w-5" aria-hidden="true" />
              </a>
              <a
                className="text-muted-foreground transition-[color,transform] duration-150 hover:text-brand active:scale-90 motion-reduce:transition-none"
                href="https://www.instagram.com/match_max/"
                rel="noopener noreferrer"
                target="_blank"
                aria-label="MatchMax on Instagram"
              >
                <Instagram className="h-5 w-5" aria-hidden="true" />
              </a>
              <a
                className="text-muted-foreground transition-[color,transform] duration-150 hover:text-brand active:scale-90 motion-reduce:transition-none"
                href="mailto:contact@matchmax.hk"
                aria-label="Email MatchMax"
              >
                <Mail className="h-5 w-5" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 lg:col-span-3">
            <div>
              <h4 className="mb-4 text-sm font-medium text-foreground">{t("footer.product")}</h4>
              <ul className="space-y-3">
                {productLinks.map((link) => (
                  <li key={link.to}>
                    <Link
                      className="relative text-sm text-muted-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-brand after:transition-transform after:duration-200 after:ease-out hover:text-brand hover:after:scale-x-100 motion-reduce:after:transition-none"
                      to={link.to}
                    >
                      {t(link.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-medium text-foreground">{t("footer.company")}</h4>
              <ul className="space-y-3">
                {companyLinks.map((link) => (
                  <li key={link.key}>
                    <Link
                      className="relative text-sm text-muted-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-brand after:transition-transform after:duration-200 after:ease-out hover:text-brand hover:after:scale-x-100 motion-reduce:after:transition-none"
                      to={link.to}
                      hash={"hash" in link ? link.hash : undefined}
                    >
                      {t(link.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-medium text-foreground">{t("footer.support")}</h4>
              <ul className="space-y-3">
                {supportLinks.map((link) => (
                  <li key={link.key}>
                    {"href" in link ? (
                      <a
                        className="relative text-sm text-muted-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-brand after:transition-transform after:duration-200 after:ease-out hover:text-brand hover:after:scale-x-100 motion-reduce:after:transition-none"
                        href={link.href}
                      >
                        {t(link.key)}
                      </a>
                    ) : (
                      <Link
                        className="relative text-sm text-muted-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-brand after:transition-transform after:duration-200 after:ease-out hover:text-brand hover:after:scale-x-100 motion-reduce:after:transition-none"
                        to={link.to}
                      >
                        {t(link.key)}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div
          className={`mt-12 flex flex-col items-center justify-between gap-4 pt-8 text-center sm:flex-row ${hideDivider ? "" : "border-t border-border"}`}
        >
          <p className="text-sm text-muted-foreground">
            © {year} MatchMax. {t("footer.rights")}
          </p>
          <LanguageToggle />
        </div>
      </div>
    </footer>
  );
}
