import { type ReactNode, useEffect } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import i18n from "./config";

/** Issue #401: keep <html lang> in step with the active locale. */
function HtmlLangSync() {
  const { i18n } = useTranslation();
  useEffect(() => {
    const apply = () => {
      document.documentElement.lang = i18n.language?.startsWith("zh") ? "zh-HK" : "en";
    };
    apply();
    i18n.on("languageChanged", apply);
    return () => i18n.off("languageChanged", apply);
  }, [i18n]);
  return null;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <HtmlLangSync />
      {children}
    </I18nextProvider>
  );
}
