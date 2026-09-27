// Issue #125: granular per-field approval/flagging for tutor profiles.
//
// Admins flag individual profile fields from the TutorEditor review panel.
// A flagged field is hidden from every public surface while the rest of the
// profile stays live; flagging a crucial field forces the whole profile to
// Hidden / Action Required. The flag registry is `tutors.field_flags`
// (key per field, value { "at": iso }) and the internal per-field notes live
// in the admin-only `tutor_field_flags` table so anon readers of published
// tutor rows never see them.

export type TutorFieldFlags = Record<string, { at?: string }>;

export type TutorFieldFlagDef = {
  key: string;
  label: string;
  /** Crucial flags block publishing until resolved (Hidden / Action Required). */
  crucial: boolean;
};

/**
 * Every publicly-rendered profile field an admin can flag, in review-panel
 * order. `name` is special: the tutor code is the profile's routing key, so
 * it is never stripped client-side — flagging it (crucial) unpublishes the
 * whole profile, which is the hiding mechanism.
 */
export const TUTOR_FIELD_FLAG_FIELDS: TutorFieldFlagDef[] = [
  { key: "name", label: "Tutor code (public name)", crucial: true },
  { key: "photo", label: "Profile photo (identity)", crucial: true },
  { key: "undergrad_university", label: "Undergraduate university", crucial: true },
  { key: "undergrad_degree", label: "Undergraduate degree / major", crucial: true },
  { key: "gender", label: "Gender", crucial: false },
  { key: "card_highlights", label: "Card highlights", crucial: false },
  { key: "academic_headline", label: "Academic headline", crucial: false },
  { key: "postgrad", label: "Postgraduate degree", crucial: false },
  { key: "secondary_school", label: "Secondary school", crucial: false },
  { key: "bio", label: "Qualifications summary (bio)", crucial: false },
  { key: "self_introduction", label: "Self-introduction (簡介)", crucial: false },
  { key: "achievements", label: "Achievements", crucial: false },
  { key: "exam_results", label: "Exam results", crucial: false },
  { key: "subjects", label: "Subjects taught", crucial: false },
  { key: "ia_ee_tok", label: "IA / EE / TOK support", crucial: false },
  { key: "pricing", label: "Pricing (tiers + hourly rate)", crucial: false },
  { key: "languages", label: "Lesson languages", crucial: false },
  { key: "location", label: "Lesson locations", crucial: false },
  { key: "experience_years", label: "Experience (years)", crucial: false },
];

export const CRUCIAL_FIELD_FLAG_KEYS: string[] = TUTOR_FIELD_FLAG_FIELDS.filter(
  (field) => field.crucial,
).map((field) => field.key);

/** Tolerant parser for the tutors.field_flags JSONB column. */
export function normalizeFieldFlags(raw: unknown): TutorFieldFlags {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const flags: TutorFieldFlags = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const trimmed = key.trim();
    if (!trimmed) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const entry = value as Record<string, unknown>;
      const at = typeof entry.at === "string" ? entry.at : undefined;
      flags[trimmed] = at ? { at } : {};
    } else {
      flags[trimmed] = {};
    }
  }
  return flags;
}

export function hasCrucialFieldFlag(flags: TutorFieldFlags): boolean {
  return CRUCIAL_FIELD_FLAG_KEYS.some((key) => Object.prototype.hasOwnProperty.call(flags, key));
}

export function getTutorFlagInfo(flags: TutorFieldFlags): { count: number; hasCrucial: boolean } {
  const keys = Object.keys(flags);
  return { count: keys.length, hasCrucial: hasCrucialFieldFlag(flags) };
}

/**
 * Nulls every flagged field on a raw tutors row BEFORE normalize() runs, so
 * public fetchers never ship hidden values to the client and normalize()'s
 * existing fallbacks take over (default gender photos, card-highlight
 * fallbacks, "not specified" strings). Public fetchers only; fetchAllTutors
 * must see the unmodified row.
 */
export function stripFlaggedTutorRow<T extends Record<string, unknown>>(row: T): T {
  const flags = normalizeFieldFlags(row.field_flags);
  const flagged = Object.keys(flags);
  if (flagged.length === 0) return row;

  const stripped: Record<string, unknown> = { ...row };
  for (const key of flagged) {
    switch (key) {
      case "photo":
        stripped.photo_url = null;
        break;
      case "gender":
        stripped.gender = null;
        break;
      case "card_highlights":
        // headline is the legacy fallback for card highlights — hide both.
        stripped.card_highlights = [];
        stripped.headline = null;
        break;
      case "academic_headline":
        stripped.academic_headline = null;
        break;
      case "undergrad_university":
        stripped.undergrad_university = null;
        break;
      case "undergrad_degree":
        stripped.undergrad_degree = null;
        break;
      case "postgrad":
        stripped.postgrad_university = null;
        stripped.postgrad_degree = null;
        break;
      case "secondary_school":
        stripped.secondary_school = null;
        break;
      case "bio":
        stripped.qualifications_summary = null;
        break;
      case "self_introduction":
        stripped.self_introduction = null;
        break;
      case "achievements":
        stripped.achievements = [];
        break;
      case "exam_results":
        stripped.exam_results = [];
        break;
      case "subjects":
        stripped.subjects = [];
        break;
      case "ia_ee_tok":
        stripped.ia_ee_tok_support = [];
        stripped.ia_ee_tok_notes = null;
        break;
      case "pricing":
        stripped.pricing_tiers = [];
        stripped.hourly_rate = 0;
        break;
      case "languages":
        stripped.languages = [];
        break;
      case "location":
        stripped.stations = [];
        stripped.district = null;
        break;
      case "experience_years":
        stripped.experience_years = null;
        break;
      default:
        break;
    }
  }
  return stripped as T;
}

/**
 * WhatsApp-ready summary of every flagged field + its internal note, for Tim
 * to paste when he messages the tutor about corrections.
 */
export function buildFlagSummaryText(
  tutorCode: string,
  flags: TutorFieldFlags,
  notes: Record<string, string>,
): string {
  const flaggedKeys = Object.keys(flags);
  if (flaggedKeys.length === 0) return "";
  const lines: string[] = [
    `MatchMax tutor ${tutorCode || "(no code yet)"} — fields to fix before going live:`,
  ];
  for (const key of flaggedKeys) {
    const def = TUTOR_FIELD_FLAG_FIELDS.find((field) => field.key === key);
    const note = (notes[key] ?? "").trim();
    lines.push(`• ${def?.label ?? key}${note ? `: ${note}` : ""}`);
  }
  return lines.join("\n");
}
