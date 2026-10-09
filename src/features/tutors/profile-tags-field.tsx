import * as React from "react";
import { useTranslation } from "react-i18next";
import { Hash } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeProfileTag, parseProfileTags } from "@/features/tutors/profile-tags";

/**
 * Issue #217 — shared editor for the up-to-five profile tags, used by the
 * tutor self-serve settings form and the admin TutorEditor. Typing Enter or
 * comma commits a tag; tags render as removable chips. The cap and the
 * contact-detail rule come from parseProfileTags; local (non-i18n) error
 * messages on purpose — the admin editor is English-only, so the shared
 * component stays language-neutral.
 */

type ProfileTagsFieldProps = {
  tags: string[];
  onChange: (tags: string[]) => void;
  id?: string;
};

export function ProfileTagsField({ tags, onChange, id }: ProfileTagsFieldProps) {
  const inputId = React.useId();
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState("");

  const commitDraft = () => {
    const tag = normalizeProfileTag(draft);
    setDraft("");
    if (!tag) return;
    if (tags.includes(tag)) return;
    const result = parseProfileTags([...tags, tag]);
    if (!result.ok) {
      setError(
        result.error === "too_many"
          ? `Add no more than 5 tags`
          : `Tag "${result.tag}" looks like contact details — not allowed`,
      );
      return;
    }
    setError("");
    onChange(result.tags);
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
        placeholder="e.g. ia review, tok essay — press Enter after each (max 5)"
        className="bg-[color:var(--surface)]"
      />
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
