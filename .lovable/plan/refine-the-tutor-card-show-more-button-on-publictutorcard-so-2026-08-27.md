Refine the tutor card "Show more" button on `PublicTutorCard` so that it feels like a transparent frosted-glass overlay that lets the subject chips underneath peek through, rather than a solid white strip.

Scope
- Only the collapsed-state "Show more" button in `src/features/tutors/public-tutor-card.tsx` is in scope.
- The expanded "Show less" state can stay minimal and unchanged.

Implementation
1. Reduce the button background opacity (e.g. `bg-white/30` or `bg-white/40`) and keep `backdrop-blur-md` / `backdrop-blur-sm`.
2. Soften the top fade gradient to transparent so the chips are visible beneath the button (e.g. `from-white/30 to-transparent` or remove the opaque gradient).
3. Add a subtle border and rounded corners (`rounded-full` or `rounded-b-[10px]`) so the button remains visible as a tappable affordance.
4. Keep text styling and the up/down chevron behavior exactly as-is.
5. Verify the card still measures height correctly and the button only appears when there are more than two rows of chips.

Files changed
- `src/features/tutors/public-tutor-card.tsx`

No backend, schema, or other page changes.