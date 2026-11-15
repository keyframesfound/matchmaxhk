import type { ExploreTypeahead } from "@/features/search/search.functions";

/**
 * #771 §2.3 — Explore keyword typeahead, pure half.
 *
 * One ranked list for the Explore keyword fields, sharing the #553 suggestion
 * language: public `#tags` first, then Subjects · Tutors · Schools, capped at
 * 8 rows so the panel never grows into a scrolling wall. Server order is
 * already tag → subject → tutor → school; this only flattens and caps.
 */

export const SUGGESTION_LIMIT = 8;

export type ExploreSuggestion =
  | { kind: "tag"; value: string; label: string }
  | { kind: "subject"; value: string; label: string }
  | { kind: "tutor"; value: string; label: string; hint: string }
  | { kind: "school"; value: string; label: string };

export const EMPTY_EXPLORE_TYPEAHEAD: ExploreTypeahead = {
  tags: [],
  subjects: [],
  tutors: [],
  schools: [],
};

export function toExploreSuggestions(data: ExploreTypeahead | undefined): ExploreSuggestion[] {
  if (!data) return [];
  const list: ExploreSuggestion[] = [
    ...data.tags.map((tag) => ({ kind: "tag" as const, value: tag, label: `#${tag}` })),
    ...data.subjects.map((subject) => ({
      kind: "subject" as const,
      value: subject,
      label: subject,
    })),
    ...data.tutors.map((tutor) => ({
      kind: "tutor" as const,
      value: tutor.code,
      label: tutor.name,
      hint: tutor.code,
    })),
    ...data.schools.map((school) => ({ kind: "school" as const, value: school, label: school })),
  ];
  return list.slice(0, SUGGESTION_LIMIT);
}
