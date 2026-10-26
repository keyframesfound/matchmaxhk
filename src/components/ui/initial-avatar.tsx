import { cn } from "@/lib/utils";

/**
 * Issue #437, branded initial-avatar fallback. Grey silhouette placeholders
 * are forbidden: every missing photo renders a solid circle from the fixed
 * two-colour brand palette with the first initial in white.
 *
 * The colour is deterministic, hash(stableId) % 2, so the same identity
 * always lands on the same colour across feed, cards, detail and staff desk
 * (no random re-roll per render). Pass a stable id (auth user id, tutor
 * code); callers without a stable id fall back to hashing the display name.
 */

const AVATAR_PALETTE = ["#1D9BF0", "#8ECDF8"] as const; // MatchMax Azure | Sky

/** FNV-1a 32-bit, tiny, stable across renders and sessions. */
function hashStableId(stableId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < stableId.length; i += 1) {
    hash ^= stableId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function avatarColorFor(stableId: string): string {
  return AVATAR_PALETTE[hashStableId(stableId) % AVATAR_PALETTE.length];
}

/** First Unicode letter of the display name (EN/中文 safe); "M" when empty. */
export function firstUnicodeInitial(name: string | null | undefined): string {
  const match = (name ?? "").match(/\p{L}/u);
  return match ? match[0].toUpperCase() : "M";
}

type InitialAvatarProps = {
  /** Stable identity (user_id / tutor code) driving the deterministic colour. */
  stableId: string;
  /** Display name the initial is taken from; falls back to the stable id. */
  name?: string | null;
  className?: string;
};

export function InitialAvatar({ stableId, name, className }: InitialAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full border border-border font-bold text-white",
        className,
      )}
      style={{ backgroundColor: avatarColorFor(stableId) }}
    >
      {firstUnicodeInitial(name)}
    </span>
  );
}
