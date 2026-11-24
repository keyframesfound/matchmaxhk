/**
 * #794 §2.6 — presentation labels for progress checkpoints.
 *
 * The ladders themselves live in ./progress-evidence.ts (pure rules, server
 * authority). These maps only name them in the UI, in one place, so the case
 * workspace and /u/{handle} never disagree about how a scale is spelled.
 *
 * The maps hold locale keys, not copy. Callers pass the `t` they got from
 * useTranslation() so a locale switch re-renders the labels; never import the
 * i18n singleton here.
 */

import type { TFunction } from "i18next";

import type { CheckpointType, ScaleType, VerificationKind } from "./progress-evidence";

/** Scale names, shared by the capture form and the public card. */
export const SCALE_LABEL_KEYS: Record<ScaleType, string> = {
  dse: "progress_public.scale.dse",
  ibdp: "progress_public.scale.ibdp",
  igcse: "progress_public.scale.igcse",
  alevel: "progress_public.scale.alevel",
  letter: "progress_public.scale.letter",
  percent: "progress_public.scale.percent",
};

/**
 * An example legal value per scale. These are literals ("5*", "A", "82"), not
 * copy: they render as the result placeholder and inside the invalid-value
 * error, and they read the same in every locale.
 */
export const SCALE_PLACEHOLDERS: Record<ScaleType, string> = {
  dse: "5*",
  ibdp: "6",
  igcse: "8",
  alevel: "A",
  letter: "B",
  percent: "82",
};

export const ASSESSMENT_LABEL_KEYS: Record<CheckpointType, string> = {
  school_quiz: "progress_public.assessment.school_quiz",
  quiz: "progress_public.assessment.quiz",
  term_exam: "progress_public.assessment.term_exam",
  mock: "progress_public.assessment.mock",
  predicted: "progress_public.assessment.predicted",
  public_exam: "progress_public.assessment.public_exam",
};

export const VERIFICATION_LABEL_KEYS: Record<VerificationKind, string> = {
  parent_attested: "progress_public.verification.parent_attested",
  desk_checked: "progress_public.verification.desk_checked",
  tutor_unconfirmed: "progress_public.verification.tutor_unconfirmed",
};

export const SCALE_TYPE_OPTIONS = Object.keys(SCALE_LABEL_KEYS) as ScaleType[];

export function scaleLabel(t: TFunction, scale: ScaleType): string {
  return t(SCALE_LABEL_KEYS[scale]);
}

export function assessmentLabel(t: TFunction, type: CheckpointType): string {
  return t(ASSESSMENT_LABEL_KEYS[type]);
}

export function verificationLabel(t: TFunction, kind: VerificationKind): string {
  return t(VERIFICATION_LABEL_KEYS[kind]);
}
