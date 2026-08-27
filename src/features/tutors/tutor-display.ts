import type { Tutor } from "@/features/tutors/queries";

export type TutorSubjectChip = {
  subject: string;
  grade: string | null;
};

export function formatTutorCode(code?: string | null) {
  const normalized = (code ?? "").trim().toUpperCase();
  if (!normalized) return "MM-XXXX";
  if (/^MM-\d{4}$/.test(normalized)) return normalized;
  if (/^\d{4}$/.test(normalized)) return `MM-${normalized}`;
  if (/^MM-/.test(normalized)) return normalized;
  return normalized;
}

export function buildTutorWhatsAppUrl(whatsappNumber: string | undefined, tutorCode: string) {
  const digits = (whatsappNumber ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";

  const message = `Hi MatchMax! I'd like to request tutor ${formatTutorCode(tutorCode)}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function normalizeSubjectKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function formatTutorGradeLabel(grade?: string | null): string | null {
  const trimmed = grade?.trim() ?? "";
  if (!trimmed) return null;
  return /^grade\s+/i.test(trimmed) ? trimmed : `Grade ${trimmed}`;
}

export function getTutorSubjectChips(
  tutor: Pick<Tutor, "subjects" | "exam_results">,
): TutorSubjectChip[] {
  const gradeLookup = new Map<string, string>();
  for (const result of tutor.exam_results ?? []) {
    for (const entry of result.subjects ?? []) {
      const subject = (entry.subject ?? "").trim();
      const grade = (entry.grade ?? "").trim();
      if (!subject || !grade) continue;
      const key = normalizeSubjectKey(subject);
      if (!gradeLookup.has(key)) gradeLookup.set(key, grade);
    }
  }

  return (tutor.subjects ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
    .map((subject) => {
      const key = normalizeSubjectKey(subject);
      let grade = gradeLookup.get(key);

      if (!grade) {
        for (const [candidateKey, candidateGrade] of gradeLookup.entries()) {
          if (candidateKey.includes(key) || key.includes(candidateKey)) {
            grade = candidateGrade;
            break;
          }
        }
      }

      return { subject, grade: formatTutorGradeLabel(grade) };
    });
}

const SYSTEM_SHORT_LABELS: Record<string, string> = {
  ib: "IBDP",
  dse: "HKDSE",
  alevel: "A-Level",
  igcse: "IGCSE",
  ap: "AP",
  sat: "SAT",
};

export function getExamSystemShortLabel(systemId: string): string {
  return SYSTEM_SHORT_LABELS[systemId] ?? "";
}

type TaughtSubjectGroup = {
  base: string;
  systemId: string;
  levels: Set<string>;
};

function findExamSystemForSubject(
  subjectBase: string,
  examResults: Tutor["exam_results"],
): string {
  const baseKey = normalizeSubjectKey(subjectBase);
  for (const result of examResults ?? []) {
    for (const entry of result.subjects ?? []) {
      const entryKey = normalizeSubjectKey(
        (entry.subject ?? "").replace(/\b(HL|SL)\b\s*$/i, ""),
      );
      if (!entryKey) continue;
      if (
        entryKey === baseKey ||
        entryKey.includes(baseKey) ||
        baseKey.includes(entryKey)
      ) {
        return String(result.system);
      }
    }
  }
  return "";
}

/**
 * Returns a single readable sentence for the subjects the tutor teaches,
 * e.g. "IBDP: Geography (HL / SL), Chinese A (SL)".
 */
export function getTutorSubjectSentence(
  tutor: Pick<Tutor, "subjects" | "exam_results">,
): string {
  const groups: TaughtSubjectGroup[] = [];

  for (const raw of tutor.subjects ?? []) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const levelMatch = trimmed.match(/\b(HL|SL)\b\s*$/i);
    const level = levelMatch ? levelMatch[1].toUpperCase() : null;
    const base = levelMatch ? trimmed.slice(0, levelMatch.index).trim() : trimmed;
    const baseKey = normalizeSubjectKey(base);

    const systemId = findExamSystemForSubject(base, tutor.exam_results);
    const prefix = getExamSystemShortLabel(systemId);
    const groupKey = `${prefix}:${baseKey}`;

    let group = groups.find((g) => normalizeSubjectKey(g.base) === baseKey && g.systemId === systemId);
    if (!group) {
      group = { base, systemId, levels: new Set<string>() };
      groups.push(group);
    }
    if (level) group.levels.add(level);
  }

  const parts = groups.map((g) => {
    const prefix = getExamSystemShortLabel(g.systemId);
    const levels = [...g.levels].sort();
    let suffix = "";
    if (levels.length === 2) {
      suffix = " (HL / SL)";
    } else if (levels.length === 1) {
      suffix = ` (${levels[0]})`;
    }
    return `${prefix ? `${prefix}: ` : ""}${g.base}${suffix}`;
  });

  return parts.join(", ");
}

/**
 * Legacy single-label formatter. Kept for hero chips and other call sites.
 */
export function formatTaughtSubjectLabel(
  subject: string,
  tutor: Pick<Tutor, "exam_results">,
): string {
  const raw = subject.trim();
  if (!raw) return "";

  const levelMatch = raw.match(/\b(HL|SL)\b\s*$/i);
  const level = levelMatch ? levelMatch[1].toUpperCase() : null;
  const base = levelMatch ? raw.slice(0, levelMatch.index).trim() : raw;
  const systemId = findExamSystemForSubject(base, tutor.exam_results);
  const prefix = getExamSystemShortLabel(systemId);
  const suffix = level ? ` (${level})` : "";
  return `${prefix ? `${prefix}: ` : ""}${base}${suffix}`;
}

