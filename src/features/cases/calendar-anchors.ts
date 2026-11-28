/**
 * #828: deep-link anchors shared between the Calendar hub and the Settings
 * tabs it links into. Both sides import the same constant so the hash in the
 * link and the `id` on the target wrapper cannot drift apart — a mismatch is
 * silent, the link just leaves the reader at the top of the page.
 */
export const LESSONS_ANCHOR_ID = "lessons";
