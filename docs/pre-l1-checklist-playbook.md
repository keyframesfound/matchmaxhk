# Pre-L1 checklist playbook + WA macros (#528 · #517 ops desk)

Unlisted ops doc — do not link publicly. Copy locks below are CEO locks
(#520 / #508 / #529 / #536); the SoT state machine lives in
`docs/fee-drop-state-machine.md`. Desk surfaces: Drop-Protection panel,
Applications card, Match & fee panel, trust queue.

## Copy locks (never break these in any macro)

- Say **Platform Administrative Fee / administrative matching fee** and
  **Independent Tutor**. Never "employment", "salary", "deduction", or any
  framing where MatchMax charges the parent.
- Parents **pay the tutor directly** at the agreed rate for every lesson.
  The admin fee is the tutor's slice of intro tuition, settled by FPS.
- Free trial = **15–20 minute online fit call only** — never a free full
  lesson, never in-person free.
- On a stop: **ask why once**. No tutor double-confirm, no parent refund,
  no chasing extra out-of-pocket.
- Never advertise retention percentages or guarantee outcomes.

## Pre-L1 checklist (work top to bottom before telling a parent "your tutor is confirmed")

1. **Fee framing disclosed on the first tutor ping, before YES.** The macro
   below (M1) states the 1.5 in one line. A tutor who says yes without the
   framing is a later `BILLING-1.5` dispute (tag it per #514 and restate —
   one-case goodwill only if the CEO offers; never rewrite the ladder).
2. **Blacklist + hold gates clear** (#529). No open `PENDING_SAFETY_REVIEW`
   on the case; parent phone not on `trust_blacklist`; industrial/hotel
   keyword and late-night adult holds resolved. The site enforces the rules;
   the desk double-checks because WA-dispatched cases skip the form.
3. **New-tutor capacity** (#535). Under 3 verified hours → max 2 concurrent
   uncompleted first lessons. The Apply gate enforces it; a WA dispatch that
   bypasses Apply must be checked by hand.
4. **Contact reveal not leaked.** Parent phone/address stay masked until the
   tutor accepts and the fee terms are acknowledged (#529 progressive
   reveal). If a tutor asks for contact before accepting, send M2.
5. **Confirmed contact by T-16h / T-12h** (#529). Tutor confirms contact
   with the parent at T-16h (M3 nudge). Still silent at T-12h → alert the
   backup tutor and the desk (`ghost risk` queue row appears automatically).
6. **Parent match card sent** (#529 item 7): tutor display name, photo,
   university + "verify the person at the door matches this card; pay only
   the matched tutor, never anyone else who shows up."
7. **Lesson 1 window logged.** The 6-month ownership clock (#508) starts on
   the first **completed paid** L1 — never the match date. Record nothing
   extra; the fee engine reads `case_lessons`.

## WA macros

Placeholders in `[brackets]`. Keep messages short; these are chat macros,
not letters.

### M1 — Intro ping with fee framing (tutor, first contact)

> Hi [Name], [Parent display name] is looking for [subject, level] in
> [district], [sessions/week]. Rate [HK$X/hr]. Quick transparency note: as an
> Independent Tutor on MatchMax, if you proceed, you pay us a one-off
> administrative matching fee of 100% of Lesson 1 + 50% of Lesson 2. Parents
> pay you directly at your rate. Reply YES and I'll connect you.

### M2 — Contact-before-accept deflection

> Parent contact stays in the MatchMax chat until you accept and the fee
> terms are acknowledged — it protects both sides. Accept here and it
> unlocks per the standard flow.

### M3 — T-16h confirmed-contact nudge (tutor)

> Hi [Name], tomorrow's Lesson 1 with [Parent display name] is [time]. Please
> confirm you've been in contact with the parent tonight. If anything's
> unclear, tell me now and I'll fix it.

### M4 — T-12h backup alert (desk → backup tutor)

> [Name], possible open slot tomorrow [time] in [district], [subject]. Stand
> by — I'll confirm within a few hours if the current tutor goes silent.

### M5 — Ask-why-once (parent, verified stop flow)

> Thanks for letting us know. So we can support you better — was it
> scheduling, fit, or something about the lessons? One question, then we'll
> take it from here.

### M6 — Tutor-quit rematch (parent) — same script the panel renders

Use `tutorQuitRematchMessage` in the Drop-Protection panel (fits-tags.ts).
Own it, rematch in 24–48h, no cost, no refund of what was taught.

### M7 — Centre asks for an out-of-window tutor by name (#508, verbatim lock)

> You matched with [Name] in [Month]. Our 6-month introduction window for
> that placement has closed, so the relationship is now yours and theirs —
> feel free to contact them directly. In the meantime, here are 3 fresh
> tutors for this new student: [A], [B], [C] — a new introduction means a
> fresh arrangement, same as before.

Do not set the expired tutor up again. The desk hard-warns and audits any
override (Match & fee panel → "Out of window" → Assign anyway).

### M8 — Fit-call offer (picky parent routing)

> Totally understandable — let's do a fit call first. [Tutor first name] can
> do a free 15–20 minute video call before any lesson: goals, expectations,
> and whether they click. No teaching in the call, no obligation. Would
> [time A] or [time B] work?

### M9 — Hostile-parent evidence ask (tutor)

> I'm sorry that happened. Send me what you have (screenshots or a short
> note of what was said/done, with dates). If it checks out, you keep the
> standard protected treatment for the stop and that household won't be
> matched to you again.

Escalate verified cases to the trust queue (admin approve → parent
blacklist, `HOSTILE_PARENT`). Never promise the parent side any outcome.

### M10 — Bypass suspicion (tutor, no accusation)

> Quick one: I noticed contact moved off-platform before the fee settled.
> Just flagging that introductions made through MatchMax carry the
> administrative fee per the terms you accepted — continuing off-platform
> can put your account at risk. Happy to help close this case out properly.

Suspected → void protection, fee due, flag the case + Master Sheet note.
Confirmed → deactivate + blacklist via the account tools (human action, never
auto). No V1 fine button; no parent fines.

## Where the automation ends and the desk starts

- The site enforces: holds, caps, reveal gating, OTP/blacklist checks
  (#529 V1) — WA-dispatched cases bypass the forms, so the checklist above
  is the compensating control.
- The fee engine (#536) prices everything; the desk never invents numbers.
- The classifier (#511/#529 Module B) trails — until it ships, M3/M4 and
  the ghost-risk queue are the only confirmed-contact safety net.
