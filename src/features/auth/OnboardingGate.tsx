import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, GraduationCap, Search, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/useAuth";
import { TosAcceptanceGate } from "@/features/auth/TosAcceptanceGate";
import { GateOverlayContext } from "@/features/auth/gate-overlay";
import { supabase } from "@/integrations/supabase/client";
import { HANDLE_MAX, HANDLE_MIN, normalizeHandle } from "@/features/auth/handle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type OnboardingChoice = "parent" | "tutor";

/**
 * Blocks the entire app behind a first-run dialog for any signed-in user who
 * has not completed onboarding yet: a required display name plus OPTIONAL
 * parent/tutor intent pills with a Skip (#459 §A — zero lock-in; the old
 * blocking XOR choice is gone). Internal roles (admins/staff) skip straight
 * to the Terms gate. Once saved the ToS acceptance gate takes over, so
 * first-time users see onboarding first, then the ToS dialog.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { user, loading, hasAnyRole } = useAuth();
  const [onboardedFor, setOnboardedFor] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  // The user id whose profile check has FINISHED. Until it matches, the
  // dialog stays closed: otherwise it flashes open for one frame on every
  // page load (user known, check not started yet) and then disappears.
  const [checkedFor, setCheckedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setOnboardedFor(null);
      setDisplayName(null);
      setCheckedFor(null);
      return;
    }
    if (onboardedFor === user.id) return;
    let active = true;
    setChecking(true);
    void supabase
      .from("profiles")
      .select("onboarding_completed_at, display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        // Missing row or error counts as not onboarded (fail closed); the
        // dialog's RPC sets the flag, which repairs a missing profile too.
        setOnboardedFor(data?.onboarding_completed_at ? user.id : null);
        setDisplayName(data?.display_name ?? null);
        setChecking(false);
        setCheckedFor(user.id);
      });
    return () => {
      active = false;
    };
  }, [user, onboardedFor]);

  // Report the blocking-dialog state so page popups (coach tours) can
  // hold off. Internal roles skip onboarding entirely, hence the !isInternal.
  const isInternal = hasAnyRole(["admin", "staff", "super_admin"]);
  const checkDone = Boolean(user && (onboardedFor === user.id || checkedFor === user.id));
  const onboardingPending =
    loading || Boolean(user && !isInternal && (checking || !checkDone || onboardedFor !== user.id));
  const showOnboarding = Boolean(
    user && !loading && !checking && checkDone && !isInternal && onboardedFor !== user.id,
  );

  return (
    <GateOverlayContext.Provider value={onboardingPending}>
      {user && showOnboarding ? (
        // Onboarding first: keep the TOS gate unmounted so the two dialogs
        // stay strictly sequential instead of stacking.
        <>
          {children}
          <OnboardingRoleDialog
            displayName={displayName}
            fallbackName={
              typeof user.user_metadata?.name === "string" ? user.user_metadata.name : ""
            }
            onDone={() => setOnboardedFor(user.id)}
          />
        </>
      ) : (
        <TosAcceptanceGate>{children}</TosAcceptanceGate>
      )}
    </GateOverlayContext.Provider>
  );
}

function OnboardingRoleDialog({
  displayName,
  fallbackName,
  onDone,
}: {
  displayName: string | null;
  fallbackName: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { refreshRoles } = useAuth();
  const [name, setName] = useState(displayName ?? fallbackName);
  const [choice, setChoice] = useState<OnboardingChoice | null>(null);
  const [handle, setHandle] = useState("");
  const [handleError, setHandleError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const cleanHandle = normalizeHandle(handle);
  const canSave = Boolean(name.trim()) && cleanHandle !== null;
  // #522: optional DOB card (day/month/year selects, 2000–2012 fast reach).
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [parentAware, setParentAware] = useState(false);
  const [parentContact, setParentContact] = useState("");
  const [showBirthday, setShowBirthday] = useState(false);
  const dobIso =
    dobDay && dobMonth && dobYear
      ? `${dobYear}-${dobMonth.padStart(2, "0")}-${dobDay.padStart(2, "0")}`
      : null;
  const dob = dobIso ? new Date(`${dobIso}T00:00:00`) : null;
  const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.2425 * 24 * 3600 * 1000)) : null;

  async function save(nextChoice: OnboardingChoice | null) {
    const trimmed = name.trim();
    if (!trimmed || !cleanHandle) return;
    if (submitting) return;
    // #522: under-18 needs the parental awareness checkbox; under-16 cannot
    // activate Teaching.
    if (dob && age !== null && age < 18 && !parentAware) {
      toast.error(t("auth.dob_parent_aware_required"));
      return;
    }
    if (nextChoice === "tutor" && dob && age !== null && age < 16) {
      toast.error(t("auth.dob_tutor_age_blocked"));
      return;
    }
    setSubmitting(true);
    setHandleError(null);
    const { error } = await supabase.rpc("complete_onboarding", {
      _choice: nextChoice,
      _display_name: trimmed,
      _handle: cleanHandle,
      _date_of_birth: dobIso,
      _show_birthday_public: showBirthday,
      _parent_guardian_contact:
        dob && age !== null && age < 13 ? parentContact.trim() || null : null,
    });
    if (error) {
      // The handle is the only field the server can reject on its own.
      if (error.message.includes("HANDLE_TAKEN")) {
        setHandleError(t("auth.onboarding_handle_taken"));
      } else if (error.message.includes("HANDLE_INVALID")) {
        setHandleError(t("auth.onboarding_handle_hint", { min: HANDLE_MIN, max: HANDLE_MAX }));
      } else {
        toast.error(t("auth.onboarding_error"));
      }
      setSubmitting(false);
      return;
    }
    if (nextChoice) await refreshRoles();
    onDone();
  }

  const options: { value: OnboardingChoice; icon: LucideIcon; label: string; desc: string }[] = [
    {
      value: "parent",
      icon: Search,
      label: t("auth.onboarding_parent_label"),
      desc: t("auth.onboarding_parent_desc"),
    },
    {
      value: "tutor",
      icon: GraduationCap,
      label: t("auth.onboarding_tutor_label"),
      desc: t("auth.onboarding_tutor_desc"),
    },
  ];

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="top-auto bottom-0 left-1/2 w-full max-w-[520px] translate-x-[-50%] translate-y-0 gap-0 rounded-t-3xl border-0 bg-[color:var(--surface)] p-6 pb-8 data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-1/2 sm:top-1/2 sm:bottom-auto sm:translate-y-[-50%] sm:rounded-3xl sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95"
      >
        <DialogTitle className="text-2xl font-bold tracking-tight text-[color:var(--ink)]">
          {t("auth.onboarding_title")}
        </DialogTitle>
        <DialogDescription className="mt-2 text-base leading-relaxed text-muted-foreground">
          {t("auth.onboarding_subtitle")}
        </DialogDescription>

        {/* #459 §4.1: Display Name + Handle are the only required fields. */}
        <div className="mt-6 space-y-2">
          <Label htmlFor="onboarding-name" className="text-[color:var(--ink)]">
            {t("auth.onboarding_name_label")}
          </Label>
          <Input
            id="onboarding-name"
            value={name}
            maxLength={80}
            autoComplete="name"
            placeholder={t("auth.onboarding_name_placeholder")}
            onChange={(event) => setName(event.target.value)}
            className="bg-[color:var(--surface)]"
          />
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="onboarding-handle" className="text-[color:var(--ink)]">
            {t("auth.onboarding_handle_label")}
          </Label>
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground"
            >
              @
            </span>
            <Input
              id="onboarding-handle"
              value={handle}
              maxLength={HANDLE_MAX + 1}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={Boolean(handleError)}
              aria-describedby="onboarding-handle-hint"
              placeholder={t("auth.onboarding_handle_placeholder")}
              onChange={(event) => {
                setHandle(event.target.value);
                setHandleError(null);
              }}
              className="bg-[color:var(--surface)] pl-7"
            />
          </div>
          <p
            id="onboarding-handle-hint"
            className={`text-xs ${handleError ? "font-semibold text-destructive" : "text-muted-foreground"}`}
          >
            {handleError ?? t("auth.onboarding_handle_hint", { min: HANDLE_MIN, max: HANDLE_MAX })}
          </p>
        </div>

        <p className="mt-5 text-sm font-medium text-muted-foreground">
          {t("auth.onboarding_intent_optional")}
        </p>
        <div
          role="radiogroup"
          aria-label={t("auth.onboarding_intent_optional")}
          className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {options.map((option) => {
            const selected = choice === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={submitting}
                onClick={() => setChoice(option.value)}
                className={`relative flex flex-col items-start gap-3 rounded-2xl border-2 bg-[color:var(--surface)] p-4 pr-9 text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:outline-none disabled:cursor-not-allowed ${
                  selected
                    ? "border-[color:var(--ink)]"
                    : "border-border hover:border-[color:var(--ink)]/50"
                }`}
              >
                <span
                  aria-hidden
                  className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center"
                >
                  {selected ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--ink)]">
                      <Check className="h-3 w-3 text-[color:var(--surface)]" strokeWidth={3} />
                    </span>
                  ) : (
                    <span className="h-5 w-5 rounded-full border-2 border-[color:var(--muted-foreground)]/40" />
                  )}
                </span>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--primary)]/10 text-[color:var(--primary)]">
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-bold text-[color:var(--ink)]">{option.label}</span>
                  <span className="text-sm leading-snug text-muted-foreground">{option.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
        {/* #522: DOB card — optional, 5-second flow. HK age tiers: under-18
            needs the parental awareness checkbox; under-13 collects the
            parent/guardian contact; under-16 cannot activate Teaching. */}
        <div className="mt-5 space-y-2">
          <Label htmlFor="onboarding-dob-day" className="text-[color:var(--ink)]">
            {t("auth.dob_label")}
          </Label>
          <div className="grid grid-cols-3 gap-2">
            <select
              id="onboarding-dob-day"
              value={dobDay}
              onChange={(event) => setDobDay(event.target.value)}
              className="h-10 rounded-xl border border-border bg-[color:var(--surface)] px-3 text-sm"
              aria-label={t("auth.dob_day")}
            >
              <option value="">{t("auth.dob_day")}</option>
              {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={dobMonth}
              onChange={(event) => setDobMonth(event.target.value)}
              className="h-10 rounded-xl border border-border bg-[color:var(--surface)] px-3 text-sm"
              aria-label={t("auth.dob_month")}
            >
              <option value="">{t("auth.dob_month")}</option>
              {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={dobYear}
              onChange={(event) => setDobYear(event.target.value)}
              className="h-10 rounded-xl border border-border bg-[color:var(--surface)] px-3 text-sm"
              aria-label={t("auth.dob_year")}
            >
              <option value="">{t("auth.dob_year")}</option>
              {Array.from({ length: 80 }, (_, i) => String(new Date().getFullYear() - i)).map(
                (y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ),
              )}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">🔒 {t("auth.dob_privacy")}</p>
          {dob && age !== null && age < 18 && (
            <label className="flex items-start gap-2 rounded-xl border border-border bg-[color:var(--card-tint)] p-3 text-sm text-[color:var(--ink)]">
              <input
                type="checkbox"
                checked={parentAware}
                onChange={(event) => setParentAware(event.target.checked)}
                className="mt-0.5"
              />
              {t("auth.dob_parent_aware")}
            </label>
          )}
          {dob && age !== null && age < 13 && (
            <div className="space-y-1.5">
              <Label htmlFor="onboarding-parent-contact" className="text-[color:var(--ink)]">
                {t("auth.dob_parent_contact")}
              </Label>
              <Input
                id="onboarding-parent-contact"
                value={parentContact}
                maxLength={120}
                placeholder="+852 … or parent@email.com"
                onChange={(event) => setParentContact(event.target.value)}
                className="bg-[color:var(--surface)]"
              />
            </div>
          )}
          {dob && age !== null && age < 16 && choice === "tutor" && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs font-medium text-destructive">
              {t("auth.dob_tutor_age_blocked")}
            </p>
          )}
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showBirthday}
              onChange={(event) => setShowBirthday(event.target.checked)}
            />
            {t("auth.dob_show_birthday")}
          </label>
        </div>

        {/* #459 §4.1 / §10: picking Tutor shows the Cap.57 self-employed note. */}
        {choice === "tutor" ? (
          <p className="mt-3 rounded-xl border border-border bg-[color:var(--card-tint)] p-3 text-xs leading-relaxed text-muted-foreground">
            {t("auth.onboarding_cap57")}
          </p>
        ) : null}
        {/* #459 §A: intent pills are optional — Skip records the name and
            adds no role; Continue records the chosen intent alongside it. */}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            variant="solid"
            color="neutral"
            loading={submitting}
            disabled={!canSave}
            onClick={() => save(choice)}
            className="h-12 flex-1 rounded-xl text-base font-bold"
          >
            {t("auth.onboarding_next")}
          </Button>
          <Button
            variant="ghost"
            disabled={submitting || !canSave}
            onClick={() => save(null)}
            className="h-12 flex-1 rounded-xl text-base font-semibold"
          >
            {t("auth.onboarding_skip")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
