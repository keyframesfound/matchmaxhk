import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/useAuth";
import { getMyEducationCv } from "@/features/account/academic-records.functions";
import {
  ACTIVATION_FORMATS,
  ACTIVATION_GENDERS,
  ACTIVATION_LANGUAGES,
  activationMissing,
  type ActivationField,
  type ActivationValues,
} from "@/features/tutor-application/activation";
import { MTR_STATION_OPTIONS } from "@/features/tutor-application/mtr";
import {
  MORE_TUTOR_STATUSES,
  PRIMARY_TUTOR_STATUSES,
  type TutorStatusCode,
} from "@/features/tutors/status-taxonomy";
import { TEACHING_CURRICULA } from "@/features/tutors/subjects";
import { supabase } from "@/integrations/supabase/client";
import { MAX_ACADEMIC_HEADLINE } from "@/lib/academic-headline";
import { activateTutorCard } from "@/lib/tutor-application.functions";
import { readStoredReferralCode } from "@/lib/referral";
import { RATE_MAX, RATE_MIN } from "@/features/tutors/rates";
import { cn } from "@/lib/utils";

const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const MAX_VISIBLE_STATIONS = 60;

const INITIAL: ActivationValues = {
  statusCode: null,
  institution: "",
  headline: "",
  curricula: [],
  subjects: [],
  format: null,
  stations: [],
  onlineRate: null,
  inpersonRate: null,
  languages: [],
  gender: null,
  phone: "",
  capAck: false,
  feeAck: false,
  legalAgreed: false,
};

function useTurnstileToken(onError: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let widget: string | null = null;
    const render = () => {
      if (!window.turnstile || !ref.current || widget) return;
      widget = window.turnstile.render(ref.current, {
        sitekey: import.meta.env.VITE_TURNSTILE_SITEKEY || "0x4AAAAAAEiLema3uiveM5pp",
        action: "tutor_application",
        callback: setToken,
        "expired-callback": () => setToken(null),
        "error-callback": () => {
          setToken(null);
          onError();
        },
      });
    };
    let script = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = TURNSTILE_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", render);
    render();
    return () => {
      script?.removeEventListener("load", render);
      if (widget && window.turnstile) window.turnstile.remove(widget);
    };
  }, [onError]);
  return { ref, token };
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
        active
          ? "border-[color:var(--ink)] bg-[color:var(--ink)]/5 text-[color:var(--ink)]"
          : "border-border text-[color:var(--ink)]/70 hover:border-[color:var(--ink)]/30",
      )}
    >
      {children}
    </button>
  );
}

function FieldBlock({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-[color:var(--ink)]">{label}</h2>
      {children}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </section>
  );
}

const toggled = <T,>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

function rateFrom(raw: string): number | null {
  const value = Number(raw);
  return raw.trim() !== "" && Number.isFinite(value) ? Math.trunc(value) : null;
}

/** #576 Stage 2: one short sheet, published straight to the card. */
export function ActivateTutorCard() {
  const { t } = useTranslation();
  const { user, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const activate = useServerFn(activateTutorCard);
  const [values, setValues] = useState<ActivationValues>(INITIAL);
  const [touched, setTouched] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [subjectQuery, setSubjectQuery] = useState("");
  const [stationQuery, setStationQuery] = useState("");
  const [captchaFailed, setCaptchaFailed] = useState(false);
  const onCaptchaError = useMemo(() => () => setCaptchaFailed(true), []);
  const { ref: captchaRef, token } = useTurnstileToken(onCaptchaError);
  const patch = (next: Partial<ActivationValues>) => {
    setTouched(true);
    setValues((current) => ({ ...current, ...next }));
  };

  const profile = useQuery({
    queryKey: ["join", "profile", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const needsPhone = !profile.data?.phone;

  // #545: existing academic records pre-fill Institution and Headline.
  const cv = useQuery({
    queryKey: ["education-cv", "myself"],
    queryFn: () => getMyEducationCv({ data: { childProfileId: null } }),
    retry: false,
  });
  const latestRecord = cv.data?.records[0];
  useEffect(() => {
    if (!latestRecord) return;
    setValues((current) => ({
      ...current,
      institution: current.institution || latestRecord.institution_or_issuer,
      headline:
        current.headline ||
        [latestRecord.title_or_program, latestRecord.grades_or_results]
          .filter(Boolean)
          .join(" · ")
          .slice(0, MAX_ACADEMIC_HEADLINE),
    }));
  }, [latestRecord]);

  const subjectOptions = useMemo(() => {
    const selected = TEACHING_CURRICULA.filter((c) => values.curricula.includes(c.value));
    const all = [...new Set(selected.flatMap((c) => c.subjects))];
    const query = subjectQuery.trim().toLowerCase();
    return query ? all.filter((s) => s.toLowerCase().includes(query)) : all;
  }, [values.curricula, subjectQuery]);
  const stationOptions = useMemo(() => {
    const query = stationQuery.trim().toLowerCase();
    const matches = query
      ? MTR_STATION_OPTIONS.filter((s) => s.toLowerCase().includes(query))
      : MTR_STATION_OPTIONS;
    return matches.slice(0, MAX_VISIBLE_STATIONS);
  }, [stationQuery]);

  const missing = activationMissing(values, { needsPhone });
  const errorFor = (field: ActivationField) =>
    touched && missing.includes(field) ? t(`join_flow.error_${field}`) : null;

  const publish = useMutation({
    mutationFn: () =>
      activate({
        data: {
          ...values,
          statusCode: values.statusCode as TutorStatusCode,
          format: values.format as ActivationValues["format"] & string,
          gender: values.gender as ActivationValues["gender"] & string,
          languages: values.languages as (typeof ACTIVATION_LANGUAGES)[number][],
          capAck: true,
          feeAck: true,
          legalAgreed: true,
          turnstileToken: token ?? "",
          referralCode: readStoredReferralCode(),
        },
      }),
    onSuccess: async (result) => {
      await refreshRoles();
      if (result.published) toast.success(t("join_flow.published_toast"));
      if (result.handle) {
        await navigate({
          to: "/u/$handle",
          params: { handle: result.handle },
          search: { edit: "open" },
        });
      } else {
        await navigate({ to: "/tutors/$tutorCode", params: { tutorCode: result.tutorCode } });
      }
    },
    onError: (error: Error) => {
      toast.error(
        error.message === "AGE_RESTRICTED" ? t("auth.dob_tutor_age_blocked") : error.message,
      );
    },
  });

  const canPublish = missing.length === 0 && Boolean(token) && !publish.isPending;

  return (
    <form
      className="mx-auto max-w-2xl space-y-7"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (canPublish) publish.mutate();
      }}
    >
      <FieldBlock label={t("join_flow.status_label")} error={errorFor("status")}>
        <div className="flex flex-wrap gap-2">
          {PRIMARY_TUTOR_STATUSES.map((code) => (
            <Chip
              key={code}
              active={values.statusCode === code}
              onClick={() => patch({ statusCode: code })}
            >
              {t(`tutor_status.${code}`)}
            </Chip>
          ))}
          {showMore
            ? MORE_TUTOR_STATUSES.map((code) => (
                <Chip
                  key={code}
                  active={values.statusCode === code}
                  onClick={() => patch({ statusCode: code })}
                >
                  {t(`tutor_status.${code}`)}
                </Chip>
              ))
            : null}
          {showMore ? null : (
            <Chip active={false} onClick={() => setShowMore(true)}>
              {t("join_flow.status_more")}
            </Chip>
          )}
        </div>
      </FieldBlock>

      <div className="grid gap-4 sm:grid-cols-2">
        <FieldBlock label={t("join_flow.institution_label")}>
          <Input
            maxLength={200}
            value={values.institution}
            placeholder={t("join_flow.institution_placeholder")}
            onChange={(event) => patch({ institution: event.target.value })}
          />
        </FieldBlock>
        <FieldBlock label={t("join_flow.headline_label")} error={errorFor("headline")}>
          <Input
            maxLength={MAX_ACADEMIC_HEADLINE}
            value={values.headline}
            placeholder={t("join_flow.headline_placeholder")}
            onChange={(event) => patch({ headline: event.target.value })}
          />
        </FieldBlock>
      </div>

      <FieldBlock label={t("join_flow.subjects_label")} error={errorFor("subjects")}>
        <div className="flex flex-wrap gap-2">
          {TEACHING_CURRICULA.map((curriculum) => (
            <Chip
              key={curriculum.value}
              active={values.curricula.includes(curriculum.value)}
              onClick={() => patch({ curricula: toggled(values.curricula, curriculum.value) })}
            >
              {curriculum.label}
            </Chip>
          ))}
        </div>
        {values.curricula.length > 0 ? (
          <>
            <Input
              className="mt-2"
              value={subjectQuery}
              placeholder={t("join_flow.subjects_search")}
              onChange={(event) => setSubjectQuery(event.target.value)}
            />
            <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto py-1">
              {subjectOptions.map((subject) => (
                <Chip
                  key={subject}
                  active={values.subjects.includes(subject)}
                  onClick={() => patch({ subjects: toggled(values.subjects, subject) })}
                >
                  {subject}
                </Chip>
              ))}
            </div>
          </>
        ) : null}
      </FieldBlock>

      <FieldBlock label={t("join_flow.mode_label")} error={errorFor("format")}>
        <div className="flex flex-wrap gap-2">
          {ACTIVATION_FORMATS.map((format) => (
            <Chip key={format} active={values.format === format} onClick={() => patch({ format })}>
              {t(
                `join_flow.mode_${format === "Face to face" ? "in_person" : format.toLowerCase()}`,
              )}
            </Chip>
          ))}
        </div>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          {values.format && values.format !== "Face to face" ? (
            <div className="space-y-1">
              <Label htmlFor="join-online-rate">{t("join_flow.online_rate_label")}</Label>
              <Input
                id="join-online-rate"
                type="number"
                inputMode="numeric"
                min={RATE_MIN}
                max={RATE_MAX}
                value={values.onlineRate ?? ""}
                onChange={(event) => patch({ onlineRate: rateFrom(event.target.value) })}
              />
              {errorFor("onlineRate") ? (
                <p className="text-xs font-medium text-destructive">
                  {t("join_flow.error_rate", { min: RATE_MIN, max: RATE_MAX })}
                </p>
              ) : null}
            </div>
          ) : null}
          {values.format && values.format !== "Online" ? (
            <div className="space-y-1">
              <Label htmlFor="join-inperson-rate">{t("join_flow.inperson_rate_label")}</Label>
              <Input
                id="join-inperson-rate"
                type="number"
                inputMode="numeric"
                min={RATE_MIN}
                max={RATE_MAX}
                value={values.inpersonRate ?? ""}
                onChange={(event) => patch({ inpersonRate: rateFrom(event.target.value) })}
              />
              {errorFor("inpersonRate") ? (
                <p className="text-xs font-medium text-destructive">
                  {t("join_flow.error_rate", { min: RATE_MIN, max: RATE_MAX })}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </FieldBlock>

      {values.format && values.format !== "Online" ? (
        <FieldBlock label={t("join_flow.stations_label")} error={errorFor("stations")}>
          <Input
            value={stationQuery}
            placeholder={t("join_flow.stations_search")}
            onChange={(event) => setStationQuery(event.target.value)}
          />
          <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto py-1">
            {[...new Set([...values.stations, ...stationOptions])].map((station) => (
              <Chip
                key={station}
                active={values.stations.includes(station)}
                onClick={() => patch({ stations: toggled(values.stations, station) })}
              >
                {station}
              </Chip>
            ))}
          </div>
        </FieldBlock>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FieldBlock label={t("join_flow.languages_label")} error={errorFor("languages")}>
          <div className="flex flex-wrap gap-2">
            {ACTIVATION_LANGUAGES.map((language) => (
              <Chip
                key={language}
                active={values.languages.includes(language)}
                onClick={() => patch({ languages: toggled(values.languages, language) })}
              >
                {t(`join_flow.language_${language.toLowerCase()}`)}
              </Chip>
            ))}
          </div>
        </FieldBlock>
        <FieldBlock label={t("join_flow.gender_label")} error={errorFor("gender")}>
          <div className="flex flex-wrap gap-2">
            {ACTIVATION_GENDERS.map((gender) => (
              <Chip
                key={gender}
                active={values.gender === gender}
                onClick={() => patch({ gender })}
              >
                {t(`join_flow.gender_${gender}`)}
              </Chip>
            ))}
          </div>
        </FieldBlock>
      </div>

      {needsPhone && profile.isSuccess ? (
        <FieldBlock label={t("join_flow.phone_label")} error={errorFor("phone")}>
          <Input
            type="tel"
            autoComplete="tel"
            maxLength={60}
            value={values.phone}
            onChange={(event) => patch({ phone: event.target.value })}
          />
        </FieldBlock>
      ) : null}

      <div className="space-y-3 rounded-xl border border-border p-4">
        {(
          [
            ["capAck", "join_flow.ack_cap57"],
            ["feeAck", "join_flow.ack_fee"],
            ["legalAgreed", "join_flow.ack_terms"],
          ] as const
        ).map(([key, copy]) => (
          <label key={key} className="flex cursor-pointer items-start gap-2.5 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={values[key]}
              onCheckedChange={(checked) => patch({ [key]: checked === true })}
            />
            <span className="text-[color:var(--ink)]">{t(copy)}</span>
          </label>
        ))}
        {errorFor("acks") ? (
          <p className="text-xs font-medium text-destructive">{t("join_flow.error_acks")}</p>
        ) : null}
      </div>

      <div ref={captchaRef} />
      {captchaFailed ? (
        <p className="text-xs font-medium text-destructive">{t("join_flow.error_captcha")}</p>
      ) : null}

      <Button
        type="submit"
        variant="solid"
        color="blue"
        size="lg"
        loading={publish.isPending}
        disabled={!canPublish}
        className="w-full font-bold"
      >
        {t("join_flow.publish")}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{t("join_flow.publish_hint")}</p>
    </form>
  );
}
