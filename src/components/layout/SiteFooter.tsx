import { useTranslation } from "react-i18next";
import { Logo } from "@/components/brand/Logo";
import { LanguageToggle } from "@/components/brand/LanguageToggle";

export function SiteFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-muted/40 pt-16 pb-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t("footer.tagline")}
            </p>
          </div>
          <div>
            <h4 className="mb-4 text-xs font-bold tracking-widest text-muted-foreground uppercase">
              {t("footer.quick_links")}
            </h4>
            <ul className="space-y-3 text-sm font-semibold">
              <li><a href="#" className="hover:text-[color:var(--brand-teal)]">{t("footer.about")}</a></li>
              <li><a href="/#how" className="hover:text-[color:var(--brand-teal)]">{t("footer.how")}</a></li>
              <li><a href="#" className="hover:text-[color:var(--brand-teal)]">{t("footer.verification")}</a></li>
              <li><a href="#" className="hover:text-[color:var(--brand-teal)]">{t("footer.districts")}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-xs font-bold tracking-widest text-muted-foreground uppercase">
              {t("footer.support")}
            </h4>
            <ul className="space-y-3 text-sm font-semibold">
              <li><a href="#" className="hover:text-[color:var(--brand-teal)]">{t("footer.help")}</a></li>
              <li><a href="#" className="hover:text-[color:var(--brand-teal)]">{t("footer.contact")}</a></li>
              <li><a href="#" className="hover:text-[color:var(--brand-teal)]">{t("footer.privacy")}</a></li>
              <li><a href="#" className="hover:text-[color:var(--brand-teal)]">{t("footer.terms")}</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {year} MatchMax. {t("footer.rights")}</p>
          <LanguageToggle />
        </div>
      </div>
    </footer>
  );
}
