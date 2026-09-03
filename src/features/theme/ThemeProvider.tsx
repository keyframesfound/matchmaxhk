import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "matchmax-theme";

type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isTheme(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function systemPrefersDark() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: ThemePreference) {
  if (typeof document === "undefined") return;
  const dark = theme === "dark" || (theme === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<ThemePreference>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");
  const loadedForUser = useRef<string | null>(null);

  const sync = useCallback((next: ThemePreference) => {
    applyTheme(next);
    setResolvedTheme(
      next === "dark" || (next === "system" && systemPrefersDark()) ? "dark" : "light",
    );
  }, []);

  // Adopt whatever is stored on this device on first client render.
  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initial = isTheme(stored) ? stored : "dark";
    setThemeState(initial);
    sync(initial);
  }, [sync]);

  // Follow the OS setting while on "system".
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => sync("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme, sync]);

  // Load the account-level preference once per signed-in user.
  useEffect(() => {
    if (!user) {
      loadedForUser.current = null;
      return;
    }
    if (loadedForUser.current === user.id) return;
    loadedForUser.current = user.id;
    let active = true;
    void supabase
      .from("profiles")
      .select("theme_preference")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const next = data?.theme_preference;
        if (isTheme(next)) {
          setThemeState(next);
          sync(next);
          window.localStorage.setItem(THEME_STORAGE_KEY, next);
        }
      });
    return () => {
      active = false;
    };
  }, [user, sync]);

  const setTheme = useCallback(
    (next: ThemePreference) => {
      setThemeState(next);
      sync(next);
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      if (user) {
        void supabase.from("profiles").update({ theme_preference: next }).eq("id", user.id);
      }
    },
    [sync, user],
  );

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
