import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * #553 / #543 CEO lock: freestyle `#` tag chips. Type a tag and press
 * Enter, comma or space (or tap a suggestion) to add it; Backspace on an
 * empty input removes the last chip. Tags are stored without the `#`.
 */

export const TAG_MAX = 20;
export const TAG_MAX_LEN = 30;

/** Suggested tags; Mock / Exemplar / Flashcards are tags, not SKU types (#553). */
export const TAG_SUGGESTIONS = [
  "IA",
  "EE",
  "TOK",
  "SBA",
  "Paper1",
  "Paper2",
  "Mock",
  "Exemplar",
  "Flashcards",
  "Formula",
  "Revision",
  "PastPaper",
];

function normalizeTag(raw: string): string {
  return raw.replace(/^#+/, "").replace(/\s+/g, "").trim().slice(0, TAG_MAX_LEN);
}

export function TagChipsInput({
  id,
  tags,
  onChange,
  placeholder,
  suggestions = TAG_SUGGESTIONS,
}: {
  id?: string;
  tags: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const lower = new Set(tags.map((tag) => tag.toLowerCase()));

  const add = (raw: string) => {
    const tag = normalizeTag(raw);
    if (!tag || lower.has(tag.toLowerCase()) || tags.length >= TAG_MAX) return;
    onChange([...tags, tag]);
  };
  const remove = (tag: string) => onChange(tags.filter((x) => x !== tag));

  const query = normalizeTag(draft).toLowerCase();
  const visibleSuggestions = suggestions
    .filter((s) => !lower.has(s.toLowerCase()))
    .filter((s) => !query || s.toLowerCase().includes(query))
    .slice(0, 8);

  return (
    <div className="space-y-2">
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-[color:var(--surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[color:var(--ink)]"
          >
            #{tag}
            <button
              type="button"
              aria-label={t("notes.upload.tag_remove", { tag })}
              onClick={() => remove(tag)}
              className="rounded-full text-muted-foreground hover:text-[color:var(--ink)]"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => {
            const value = e.target.value;
            // Typing a separator commits the tag before it.
            if (/[,，、\s]$/.test(value)) {
              add(value.slice(0, -1));
              setDraft("");
            } else {
              setDraft(value);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
              setDraft("");
            } else if (e.key === "Backspace" && !draft && tags.length > 0) {
              remove(tags[tags.length - 1]);
            }
          }}
          onBlur={() => {
            if (draft.trim()) {
              add(draft);
              setDraft("");
            }
          }}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="h-8 min-w-[8rem] flex-1 bg-transparent px-1 text-sm outline-none"
        />
      </div>
      {visibleSuggestions.length > 0 && tags.length < TAG_MAX ? (
        <div className="flex flex-wrap gap-1.5">
          {visibleSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className={cn(
                "rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--ink)]",
              )}
            >
              + #{s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
