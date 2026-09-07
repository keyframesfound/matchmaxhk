import { useCallback, useEffect, useRef, useState } from "react";

type DraftEnvelope<T> = { value: T; at: number };

const SAVE_DEBOUNCE_MS = 600;

export function useFormDraft<T>(key: string) {
  const storageKey = `matchmax.draft.${key}`;
  const [restored, setRestored] = useState<T | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftEnvelope<T> | null;
        if (
          parsed &&
          typeof parsed === "object" &&
          parsed.value &&
          typeof parsed.value === "object"
        ) {
          setRestored(parsed.value);
          setSavedAt(typeof parsed.at === "number" ? parsed.at : null);
        }
      }
    } catch {
      // Corrupt or unavailable draft — start fresh.
    }
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [storageKey]);

  const saveDraft = useCallback(
    (value: T) => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        try {
          sessionStorage.setItem(storageKey, JSON.stringify({ value, at: Date.now() }));
          setSavedAt(Date.now());
        } catch {
          // Storage unavailable — drafts are best-effort.
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [storageKey],
  );

  const clearDraft = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setSavedAt(null);
  }, [storageKey]);

  return { restored, savedAt, saveDraft, clearDraft };
}
