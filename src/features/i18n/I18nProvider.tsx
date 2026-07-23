import { type ReactNode, useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "./config";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(i18n.isInitialized);

  useEffect(() => {
    if (i18n.isInitialized) {
      setReady(true);
      return;
    }
    const onInit = () => setReady(true);
    i18n.on("initialized", onInit);
    return () => {
      i18n.off("initialized", onInit);
    };
  }, []);

  if (!ready) return <>{children}</>;
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
