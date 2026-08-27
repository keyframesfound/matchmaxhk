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
