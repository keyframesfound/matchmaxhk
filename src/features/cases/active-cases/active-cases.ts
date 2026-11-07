// Issues #633 + #635: the public Tier 1 projection of a profile's cases. Pure
// and server-side only, so the masks are applied before anything leaves the
// server. Public by default; each party may hide a case from their own profile,
// and the strictest mask of either party wins on shared fields.

const ACTIVITY_WINDOW_MS = 45 * 24 * 60 * 60 * 1000;
const PAST_SOR_STATUSES = new Set(["closed", "replaced"]);
/**
 * Parents of cases created before this feature never agreed to publication, and
 * many students are minors. Their student name stays masked until the parent
 * chooses otherwise in the Privacy sheet. Later cases follow the #635 default.
 */
const STUDENT_NAME_CONSENT_CUTOFF = Date.parse("2026-11-08T00:00:00+08:00");

export type PartyVisibility = {
  show: boolean;
  maskRate: boolean;
  maskStudent: boolean;
  maskDistrict: boolean;
};

export const DEFAULT_PARTY_VISIBILITY: PartyVisibility = {
  show: true,
  maskRate: false,
  maskStudent: false,
  maskDistrict: false,
};

export type ActiveCaseRow = {
  id: string;
  caseCode: string;
  createdAt: string;
  sorStatus: string | null;
  caseType: string | null;
  organisationId: string | null;
  subjects: string[];
  examSystem: string | null;
  studentLevel: string | null;
  mode: string | null;
  district: string | null;
  hourlyRateHkd: number | null;
  rateUnit: string | null;
  learnerNickname: string | null;
  endedAt: string | null;
  parentUserId: string | null;
  parentHandle: string | null;
  tutorUserId: string | null;
  tutorCode: string | null;
  tutorName: string | null;
};

export type ProfileSide = "tutor" | "parent" | "centre";

export type ActiveCaseCard = {
  caseCode: string;
  caseType: "private" | "centre" | "gig";
  subject: string;
  examSystem: string | null;
  studentLevel: string | null;
  mode: string | null;
  area: string | null;
  areaMasked: boolean;
  rateHkd: number | null;
  rateUnit: string | null;
  studentName: string | null;
  counterparty: { kind: "parent" | "tutor"; label: string | null; href: string | null } | null;
  hidden?: boolean;
  caseId?: string;
  privacy?: PartyVisibility;
};

export type ActiveCasesProjection = {
  activeCount: number;
  pastCount: number;
  recent45d: boolean;
  hiddenCount: number;
  active: ActiveCaseCard[];
  past: ActiveCaseCard[];
};

export const visibilityKey = (caseId: string, userId: string) => `${caseId}:${userId}`;

function caseTypeOf(row: ActiveCaseRow): ActiveCaseCard["caseType"] {
  if (row.organisationId) return "centre";
  return row.caseType === "activity" ? "gig" : "private";
}

function counterpartyOf(
  row: ActiveCaseRow,
  side: ProfileSide,
  visibilityOf: (userId: string | null) => PartyVisibility,
): ActiveCaseCard["counterparty"] {
  if (side === "tutor") {
    const shown = visibilityOf(row.parentUserId).show && row.parentHandle;
    return { kind: "parent", label: null, href: shown ? `/u/${row.parentHandle}` : null };
  }
  const shown = visibilityOf(row.tutorUserId).show && row.tutorCode;
  return shown
    ? { kind: "tutor", label: row.tutorName || row.tutorCode, href: `/tutors/${row.tutorCode}` }
    : { kind: "tutor", label: null, href: null };
}

export function projectActiveCases(
  rows: ActiveCaseRow[],
  visibility: ReadonlyMap<string, PartyVisibility>,
  profile: { side: ProfileSide; ownerUserId: string | null },
  opts: { ownerView: boolean; now: Date },
): ActiveCasesProjection {
  const started = rows.filter((row) => row.sorStatus !== null);
  const isPast = (row: ActiveCaseRow) => PAST_SOR_STATUSES.has(row.sorStatus ?? "");

  const toCard = (row: ActiveCaseRow): { card: ActiveCaseCard; hidden: boolean } => {
    const parentDefault: PartyVisibility = {
      ...DEFAULT_PARTY_VISIBILITY,
      maskStudent: Date.parse(row.createdAt) < STUDENT_NAME_CONSENT_CUTOFF,
    };
    const visibilityOf = (userId: string | null): PartyVisibility =>
      (userId ? visibility.get(visibilityKey(row.id, userId)) : undefined) ??
      (userId === row.parentUserId ? parentDefault : DEFAULT_PARTY_VISIBILITY);
    const parent = visibilityOf(row.parentUserId);
    const tutor = visibilityOf(row.tutorUserId);
    const own = visibilityOf(profile.ownerUserId);
    const areaMasked = Boolean(row.district) && (parent.maskDistrict || tutor.maskDistrict);
    const card: ActiveCaseCard = {
      caseCode: row.caseCode,
      caseType: caseTypeOf(row),
      subject: row.subjects[0] ?? "",
      examSystem: row.examSystem,
      studentLevel: row.studentLevel,
      mode: row.mode,
      area: areaMasked ? null : row.district,
      areaMasked,
      rateHkd: parent.maskRate || tutor.maskRate ? null : row.hourlyRateHkd,
      rateUnit: row.rateUnit,
      studentName: parent.maskStudent || tutor.maskStudent ? null : row.learnerNickname,
      counterparty: counterpartyOf(row, profile.side, visibilityOf),
    };
    const hidden = !own.show;
    return {
      card: opts.ownerView ? { ...card, hidden, caseId: row.id, privacy: own } : card,
      hidden,
    };
  };

  const cards = (subset: ActiveCaseRow[]) =>
    subset
      .map(toCard)
      .filter(({ hidden }) => opts.ownerView || !hidden)
      .map(({ card }) => card);

  const activeRows = started.filter((row) => !isPast(row));
  const pastRows = started.filter(isPast);
  const endedRecently = pastRows.some(
    (row) => row.endedAt && opts.now.getTime() - Date.parse(row.endedAt) <= ACTIVITY_WINDOW_MS,
  );

  return {
    activeCount: activeRows.length,
    pastCount: pastRows.length,
    recent45d: activeRows.length > 0 || endedRecently,
    hiddenCount: activeRows.map(toCard).filter(({ hidden }) => hidden).length,
    active: cards(activeRows),
    past: cards(pastRows),
  };
}
