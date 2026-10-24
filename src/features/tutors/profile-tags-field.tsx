import * as React from "react";
import { useTranslation } from "react-i18next";
import { Hash } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_PROFILE_TAGS,
  normalizeProfileTag,
  parseProfileTags,
  PRESET_PROFILE_TAGS,
  type ProfileTagWithCount,
} from "@/features/tutors/profile-tags";

/**
 * Issue #217, shared editor for the up-to-five profile tags, used by the
 * tutor self-serve settings form and the admin TutorEditor. Typing Enter or
 * comma commits a tag; tags render as removable chips. The cap and the
 * contact-detail rule come from parseProfileTags; local (non-i18n) error
 * messages on purpose, the admin editor is English-only, so the shared
 * component stays language-neutral.
 *
 * Issue #311, as the tutor types, existing tags with their tutor counts
 * are suggested ("ia review · 12"); picking one saves that spelling. The
 * preset tags (examiner, ia review, tok, ee, sba, oral, past-paper
 * practice) show as one-tap chips when not already saved. Both honor the
 * 5-tag cap, picking or committing a sixth shows the too_many error.
 */

type ProfileTagsFieldProps = {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** Tags used by 3+ tutors, most-used first (from popularProfileTags). */
  suggestions?: ProfileTagWithCount[];
  id?: string;
};

export function ProfileTagsField({ tags, onChange, suggestions, id }: ProfileTagsFieldProps) {
  const inputId = React.useId();
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState("");

  const applyTags = (next: string[]) => {
    const result = parseProfileTags(next);
    if (!result.ok) {
      setError(
        result.error === "too_many"
          ? `Add no more than ${MAX_PROFILE_TAGS} tags`
          : `Tag "${result.tag}" looks like contact details, not allowed`,
      );
      return;
    }
    setError("");
    onChange(result.tags);
  };

  const commitDraft = () => {
    const tag = normalizeProfileTag(draft);
    setDraft("");
    if (!tag) return;
    if (tags.includes(tag)) {
      setError(`"${tag}" is already saved`);
      return;
    }
    applyTags([...tags, tag]);
  };

  const addTag = (tag: string) => {
    if (tags.includes(tag)) return;
    applyTags([...tags, tag]);
  };

  const removeTag = (tag: string) => {
    setError("");
    onChange(tags.filter((item) => item !== tag));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitDraft();
    }
  };

  const trimmedDraft = normalizeProfileTag(draft);
  const matches = (suggestions ?? []).filter((item) => item.tag.includes(trimmedDraft));
  const exactMatch = matches.some((item) => item.tag === trimmedDraft);
  // Only suggest while typing something new; never suggest the exact tag
  // being typed (it would duplicate the commit) or already-saved tags.
  const liveSuggestions = trimmedDraft
    ? exactMatch
      ? []
      : matches.filter((item) => !tags.includes(item.tag)).slice(0, 5)
    : [];
  const presetChips = trimmedDraft
    ? []
    : PRESET_PROFILE_TAGS.filter((tag) => !tags.includes(tag)).slice(
        0,
        MAX_PROFILE_TAGS - tags.length,
      );

  return (
    <div className="space-y-2">
      <Label htmlFor={id ?? inputId} className="text-[color:var(--ink)]">
        Profile tags
      </Label>
      <Input
        id={id ?? inputId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        placeholder="e.g. ia review, tok essay, press Enter after each (max 5)"
        className="bg-[color:var(--surface)]"
      />
      {liveSuggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {liveSuggestions.map((item) => (
            <button
              key={item.tag}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setDraft("");
                addTag(item.tag);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:border-[color:var(--brand-link)] hover:text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
            >
              <Hash className="h-3 w-3" aria-hidden="true" />
              {item.tag}
              <span aria-hidden="true">·</span>
              <span>{item.count}</span>
            </button>
          ))}
        </div>
      ) : null}
      {presetChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {presetChips.map((tag) => (
            <button
              key={tag}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => addTag(tag)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:border-[color:var(--brand-link)] hover:text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
            >
              <Hash className="h-3 w-3" aria-hidden="true" />
              {tag}
            </button>
          ))}
        </div>
      ) : null}
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--ink)]/15 px-3 py-1 text-xs font-medium text-[color:var(--ink)]"
            >
              <Hash className="h-3 w-3 text-[color:var(--brand-link)]" aria-hidden="true" />
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                className="text-[color:var(--ink)]/50 hover:text-[color:var(--ink)]"
                onClick={() => removeTag(tag)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
