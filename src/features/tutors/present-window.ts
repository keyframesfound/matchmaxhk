/**
 * #828 C (AC-C4): one "currently tutoring" window for the whole app. The
 * experience "– Present" line and the #204 active-student count both read
 * this, so they can never split into 30 vs 45 days again. Kept in its own
 * module because experience.ts already imports sor.ts.
 */
export const PRESENT_WINDOW_DAYS = 45;
