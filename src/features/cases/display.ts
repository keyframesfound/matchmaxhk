// Dual-notation display labels: international schools use "Year X",
// local schools use "S1–S6". Stored student_level values stay unchanged.
const STUDENT_LEVEL_BOARD_LABELS: Record<string, string> = {
  "Junior secondary": "Year 7–9 / S1–S3",
  "Senior secondary": "Year 10–13 / S4–S6",
};

export function formatStudentLevel(level: string | null | undefined): string {
  const value = (level ?? "").trim();
  if (!value) return "";
  return STUDENT_LEVEL_BOARD_LABELS[value] ?? value;
}

export function formatCaseTitle(studentLevel: string, subjects: string[]): string {
  const levelLabel = formatStudentLevel(studentLevel) || studentLevel;
  const subjectPart = subjects.filter(Boolean).slice(0, 2).join(", ");
  const extra =
    subjects.filter(Boolean).length > 2 ? ` +${subjects.filter(Boolean).length - 2} more` : "";
  return subjectPart ? `${levelLabel}: ${subjectPart}${extra}` : levelLabel;
}

export function buildCaseApplyWhatsAppUrl(whatsappNumber: string, caseCode: string): string {
  const digits = whatsappNumber.replace(/[^\d]/g, "");
  const message = `Hi MatchMax! I'd like to apply for case ${caseCode}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
