# Concierge Free-Trial Policy (Internal — Never Publish)

> **Confidential operational playbook — do not copy any part of this file into public-facing
> copy.** The free trial is a deliberately unlisted concierge tool (issue #100). The public FAQ,
> marketing copy, TOS, and `public/llms.txt` must never mention free trials.

## What it is

A one-time **free first (trial) lesson** that Tim may offer to a hesitant parent while closing a
match. Two hard gates, both mandatory:

1. **Concierge-initiated only.** It is never self-serve, never listed on the site, and never
   hinted at in public copy. Parents who trial-hunt are not offered it.
2. **Tutor consent is per-case and voluntary.** The specific tutor must explicitly agree before
   anything is offered to the parent. Consent on one case never implies consent on another, and
   one tutor's consent never implies another tutor's.

## When to use it

- The parent is genuinely close to confirming and hesitates specifically about paying for an
  unproven first lesson.
- Use sparingly. It exists to close high-fit, high-intent matches — not to attract bargain
  hunters. That is exactly why it is unadvertised.
- Never: offer it proactively on public channels, use it as a default discount for every
  hesitation, or extend it past one free lesson per match (no "free trial packages").

## How to run it

1. **Tutor first, privately.** Explain the parent's hesitation and ask whether they volunteer the
   first lesson free. Consent must be explicit and unpressured — declining costs the tutor
   nothing and must not affect their standing, visibility, or case allocation.
2. **Log the consent** (who, when, where) in the dedicated concierge WhatsApp group thread, so it
   sits with the other timestamped communication the TOS dispute process relies on.
3. **Only then offer it to the parent**, through the concierge WhatsApp group. It should read as
   a personal arrangement between parent and tutor, not a platform promotion.
4. **Run the lesson exactly like a normal trial lesson**: same scheduling, same last-name-only
   anonymity rules, same first-2-lesson concierge window, same TOS dispute matrix.

## Money

- The free trial waives **only the tutor's fee for that single lesson**, volunteered by the
  tutor. MatchMax does not pay, reimburse, or subsidise it.
- The **Administrative Matching Fee is unchanged** and still due via FPS within 24 hours of a
  successful trial lesson — a free trial still counts as the "first trial lesson" for TOS
  purposes (1.5-lesson fee for standard cases; 20% of package for short-term cases of ≤5
  lessons).
- Cancellation protections still apply: a client cancellation inside 6 hours can still be
  invoiced to compensate the tutor's reserved calendar time, even though the lesson itself is
  free.

## Public-copy guardrail

- The public position is already live and intentional: trial lessons are **at each tutor's
  discretion and may be paid** (FAQ: "Can I arrange a trial lesson before committing to a regular
  schedule?", in both locales). Keep that tutor-discretionary wording; it must never promise,
  hint at, or enumerate free trials.
- The TOS deliberately contains **no** free-trial language; its dispute matrix applies to free
  trials unchanged. Do not add free-trial clauses to public legal copy.
- Before publishing any copy change, grep the public surfaces for `free trial`, `免費試堂`, and
  `試堂免費` — at minimum `src/features/i18n/locales/{en,zh-HK}.json`, `src/routes/`, and
  `public/llms.txt`.
- "Free" claims that are fine and unrelated: free matching/concierge sourcing, free tutor
  profiles, free posting of cases, and the First-Lesson Free Rematch Guarantee (a waived rematch
  fee, not a free lesson).
