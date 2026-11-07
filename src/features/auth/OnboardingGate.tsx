import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, GraduationCap, Search, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/useAuth";
import { TosAcceptanceGate } from "@/features/auth/TosAcceptanceGate";
import { GateOverlayContext } from "@/features/auth/gate-overlay";
import { supabase } from "@/integrations/supabase/client";
import { HANDLE_MAX, HANDLE_MIN, normalizeHandle } from "@/features/auth/handle";
import { phoneIsValid } from "@/features/tutor-application/activation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Blocks the entire app behind a first-run dialog for any signed-in user who
 * has not completed onboarding yet: a required display name,
 * @handle and phone (#576 Stage 1 — never a Parent vs Tutor choice, per #459). Internal roles (admins/staff) skip straight
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
  const { user } = useAuth();
  const [name, setName] = useState(displayName ?? fallbackName);
  const [phone, setPhone] = useState("");
  const [handle, setHandle] = useState("");
  const [handleError, setHandleError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const cleanHandle = normalizeHandle(handle);
  const canSave = Boolean(name.trim()) && cleanHandle !== null && phoneIsValid(phone);
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

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || !cleanHandle) return;
    if (submitting) return;
    // #522: under-18 needs the parental awareness checkbox; under-16 cannot
    // activate Teaching.
    if (dob && age !== null && age < 18 && !parentAware) {
      toast.error(t("auth.dob_parent_aware_required"));
      return;
    }
    setSubmitting(true);
    setHandleError(null);
    const { error } = await supabase.rpc("complete_onboarding", {
      _choice: null,
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
    // Best-effort: the RPC above is what completes onboarding, and the phone is
    // asked for again at activation if this write ever fails.
    const avatar = user?.user_metadata?.avatar_url;
    const { error: contactError } = await supabase
      .from("profiles")
      .update({
        phone: phone.trim(),
        ...(typeof avatar === "string" ? { avatar_url: avatar } : {}),
      })
      .eq("id", user?.id ?? "");
    if (contactError) console.warn("[onboarding] phone save failed:", contactError.message);
    onDone();
  }

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

        {/* #576 Stage 1: Name, @handle and Phone are the only required fields. */}
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

        {/* #576 Stage 1: phone is the WhatsApp concierge handoff. */}
        <div className="mt-4 space-y-2">
          <Label htmlFor="onboarding-phone" className="text-[color:var(--ink)]">
            {t("auth.onboarding_phone_label")}
          </Label>
          <Input
            id="onboarding-phone"
            type="tel"
            value={phone}
            maxLength={60}
            autoComplete="tel"
            placeholder={t("auth.onboarding_phone_placeholder")}
            onChange={(event) => setPhone(event.target.value)}
            className="bg-[color:var(--surface)]"
          />
        </div>

        {/* #522: DOB card — optional, 5-second flow. HK age tiers: under-18
            needs the parental awareness checkbox; under-13 collects the
            parent/guardian contact; under-16 cannot activate Teaching. */}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            {t("auth.dob_label")}
          </summary>
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
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={showBirthday}
                onChange={(event) => setShowBirthday(event.target.checked)}
              />
              {t("auth.dob_show_birthday")}
            </label>
          </div>
        </details>
        <div className="mt-6">
          <Button
            variant="solid"
            color="neutral"
            loading={submitting}
            disabled={!canSave}
            onClick={save}
            className="h-12 w-full rounded-xl text-base font-bold"
          >
            {t("auth.onboarding_next")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
