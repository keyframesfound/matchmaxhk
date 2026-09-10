import { type MouseEvent, useEffect, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

const PENDING_SAVE_KEY = "mm_pending_save";

export type PendingSave = {
  type: "tutor" | "case" | "course";
  id: string;
};

export function stashPendingSave(save: PendingSave) {
  try {
    sessionStorage.setItem(PENDING_SAVE_KEY, JSON.stringify(save));
  } catch {
    // sessionStorage unavailable (private mode etc.) — user just won't get auto-save
  }
}

export function takePendingSave(): PendingSave | null {
  try {
    const raw = sessionStorage.getItem(PENDING_SAVE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_SAVE_KEY);
    const parsed = JSON.parse(raw) as PendingSave;
    if (
      parsed &&
      (parsed.type === "tutor" || parsed.type === "case" || parsed.type === "course") &&
      typeof parsed.id === "string"
    ) {
      return parsed;
    }
  } catch {
    // ignore malformed stash
  }
  return null;
}

export function peekPendingSave(): PendingSave | null {
  try {
    const raw = sessionStorage.getItem(PENDING_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSave;
    if (
      parsed &&
      (parsed.type === "tutor" || parsed.type === "case" || parsed.type === "course") &&
      typeof parsed.id === "string"
    ) {
      return parsed;
    }
  } catch {
    // ignore malformed stash
  }
  return null;
}

function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function sameOriginPath(raw: string): string | null {
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

// Resolves a pending save for this button: from the ?save= URL param (Google
// OAuth may land in a fresh tab where sessionStorage didn't carry over) or
// from the sessionStorage stash. Returns true if a save should be resumed.
export function consumePendingSave(type: PendingSave["type"], id: string): boolean {
  const key = `${type}:${id}`;

  const params = new URLSearchParams(window.location.search);
  if (params.get("save") === key) {
    params.delete("save");
    const next = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
    window.history.replaceState(null, "", next);
    return true;
  }

  const stashed = peekPendingSave();
  if (stashed && stashed.type === type && stashed.id === id) {
    takePendingSave();
    return true;
  }
  return false;
}

// Portal'd dialog content bubbles synthetic events through the React tree
// (not the DOM tree), so clicks inside the sheet — the X, the overlay — would
// reach the clickable card this dialog is rendered in (e.g. opening the tutor
// profile). This barrier stops them at the JSX boundary.
function DialogEventBarrier({ children }: { children: ReactNode }) {
  return (
    <span
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {children}
    </span>
  );
}

// After a pending save resumes, scroll the post's card back into view — the
// auth round-trip reloads the page and lands at the top. Retried a few times
// because list content renders asynchronously; cancelled if the user scrolls
// manually first.
export function scrollPostIntoView(el: HTMLElement | null) {
  if (!el) return;
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };
  window.addEventListener("wheel", cancel, { once: true, passive: true });
  window.addEventListener("touchmove", cancel, { once: true, passive: true });
  const scroll = () => {
    if (!cancelled) el.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  [50, 350, 900].forEach((delay) => window.setTimeout(scroll, delay));
  window.setTimeout(cancel, 1500);
}

type AuthGateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  pendingSave?: PendingSave;
};

export function AuthGateDialog({
  open,
  onOpenChange,
  title = "Get Started",
  description = "Sign up or log in to save posts and pick up where you left off.",
  pendingSave,
}: AuthGateDialogProps) {
  useEffect(() => {
    if (open && pendingSave) {
      stashPendingSave(pendingSave);
    }
  }, [open, pendingSave]);

  async function signInWithGoogle() {
    const redirect = sameOriginPath(currentPath()) ?? "/tutors";
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${withSaveParam(redirect, pendingSave)}`,
        },
      });
      if (error) throw error;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed";
      toast.error(msg);
    }
  }

  function goWithEmail() {
    const redirect = sameOriginPath(currentPath()) ?? "/tutors";
    onOpenChange(false);
    window.location.assign(
      withSaveParam(`/auth?redirect=${encodeURIComponent(redirect)}`, pendingSave),
    );
  }

  return (
    <DialogEventBarrier>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="top-auto bottom-0 left-1/2 w-full max-w-[420px] translate-x-[-50%] translate-y-0 gap-0 rounded-t-3xl border-0 bg-[color:var(--surface)] p-6 pb-10 shadow-2xl data-[state=open]:slide-in-from-bottom-1/2 data-[state=closed]:slide-out-to-bottom-full sm:top-1/2 sm:bottom-auto sm:translate-y-[-50%] sm:rounded-3xl sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--muted)]">
            <Sparkles className="h-6 w-6 text-[color:var(--ink)]" aria-hidden="true" />
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight text-[color:var(--ink)]">
            {title}
          </DialogTitle>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">{description}</p>
          <div className="mt-6 space-y-3">
            <Button
              type="button"
              variant="solid"
              color="neutral"
              className="h-12 w-full rounded-full text-base font-bold"
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation();
                goWithEmail();
              }}
            >
              Continue with Email
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-full font-bold"
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation();
                void signInWithGoogle();
              }}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
                />
              </svg>
              Continue with Google
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DialogEventBarrier>
  );
}

function withSaveParam(path: string, pendingSave?: PendingSave): string {
  if (!pendingSave) return path;
  const saveValue = `${pendingSave.type}:${pendingSave.id}`;
  if (path.startsWith("/auth?")) {
    return `${path}&save=${encodeURIComponent(saveValue)}`;
  }
  const [base, query] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("save", saveValue);
  return `${base}?${params}`;
}
