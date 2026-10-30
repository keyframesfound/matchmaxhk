# Fee and Drop state machine (#536)

Single source of truth for the #537 Fee · Drop · Trust cluster. The code is
`src/features/cases/fee-drop.ts` (`resolveCaseFee`), fed by
`src/features/cases/ownership-window.ts` (#508). Tests:
`tests/cases/fee-drop.test.ts`, `tests/cases/ownership-window.test.ts`.

Change a rule on #536 and in `fee-drop.ts` first, then the child issues
(#520, #525, #508, #528, #529).

`R` = agreed hourly rate × standard lesson duration fixed at match
confirmation. Amounts scale by student count and round once to whole HKD.

## Diagram

```mermaid
flowchart TD
  start([Case outcome]) --> probono{Pro-bono?}
  probono -- yes --> zero0[$0 · PRO_BONO]
  probono -- no --> window{Ownership window}
  window -- day 181+ --> zero1[$0 · OWNERSHIP_EXPIRED<br/>not a MatchMax case]
  window -- not started / inside --> kind{Outcome}

  kind -- L1 not done --> pending0[nothing final · IN_PROGRESS]
  kind -- rejected before L1 --> zero2[$0 · PRE_L1_REJECT<br/>window never opens]
  kind -- free online intro only --> zero3[$0 · FREE_TRIAL_STOP]
  kind -- parent no-show / <24h cancel --> l1due[L1 portion · NO_SHOW_L1_DUE]
  kind -- continued past L2 --> full[tier base · CONTINUED_FULL<br/>advances retained tier]
  kind -- stopped after one paid L1 --> bypass{Bypass?}

  bypass -- confirmed --> ban[tier base + ban · BYPASS_CONFIRMED_FULL]
  bypass -- suspected --> void0[L1 portion · BYPASS_SUSPECTED_VOID]
  bypass -- none --> who{Who stopped?}

  who -- tutor --> tutorwhy{Verified reason}
  tutorwhy -- hostile parent --> hostile[0.5×R floor · HOSTILE_PARENT_PROTECTED<br/>blacklist parent, no tutor penalty]
  tutorwhy -- emergency with proof --> emerg[L1 portion · TUTOR_EMERGENCY_VOID<br/>strike, no shadowban]
  tutorwhy -- anything else --> flake[L1 portion · TUTOR_FLAKE_VOID<br/>strike + 30-day shadowban + priority rematch]

  who -- parent / centre / admin --> verify{Parent or centre verification}
  verify -- none / pending --> pending1[nothing final · VERIFICATION_PENDING]
  verify -- rejected: still continuing --> void1[L1 portion · UNVERIFIED_VOID]
  verify -- verified / rejected: tutor fault --> reason{Reason}
  reason -- serious misconduct --> misconduct[L1 portion + ban · SERIOUS_MISCONDUCT_VOID]
  reason -- clear tutor fault --> fault[L1 portion · TUTOR_FAULT_VOID]
  reason -- vague, 2+ prior quality drops --> repeat[L1 portion · REPEAT_PATTERN_VOID]
  reason -- hostile parent --> hostile
  reason -- vague / not a fit --> protected[0.5×R floor · DROP_PROTECTED]
```

## Table

| Event | MatchMax fee | Tutor | Parent / centre | Rule id |
| --- | --- | --- | --- | --- |
| Pre-L1 reject | $0, no Ownership window | none | none | `PRE_L1_REJECT` |
| Continues to L2+ (first Regular) | tier base, 1.5×R for tier 1 / primary | none | none | `CONTINUED_FULL` |
| Stop after one paid lesson, verified, vague reason | min(base, 0.5×R) | keeps the rest | none | `DROP_PROTECTED` |
| Clear tutor fault | L1 portion (1.0×R) | no form | none | `TUTOR_FAULT_VOID` |
| Hostile / abusive parent (verified) | min(base, 0.5×R) | no penalty | blacklisted | `HOSTILE_PARENT_PROTECTED` |
| Tutor L1 quit | L1 portion + priority rematch, no parent refund | strike + 30-day shadowban | none | `TUTOR_FLAKE_VOID` |
| Tutor emergency with proof | L1 portion | strike, no shadowban | priority rematch | `TUTOR_EMERGENCY_VOID` |
| Same-client ladder | 1.5 → 1.0 → 0.5 → $0; protection floor 0.5×R | none | none | tier input |
| Day 181+ Ownership | $0, not a case | tutor's relationship | none | `OWNERSHIP_EXPIRED` |
| Centre secondary in window | Retained-Only ladder | none | none | tier input |
| Parent no-show / <24h cancel before L1 | L1 portion, not Drop-Protection | none | none | `NO_SHOW_L1_DUE` |
| Suspected bypass | L1 portion, protection void | flagged | none | `BYPASS_SUSPECTED_VOID` |
| Confirmed bypass | tier base, ban (human action) | banned | none | `BYPASS_CONFIRMED_FULL` |

Notes:

- L1 portion = min(tier base, 1.0×R) under `100_50`, min(tier base, 0.75×R) under the opt-in `75_75` A/B.
- A tutor-funded first-lesson discount scales the L1 portion and the protection to the amount actually paid. Regular lessons stay on full R.
- Only parent or centre confirmation can reduce the fee. Admin-reviewed evidence is accepted only on the tutor-initiated hostile-parent and emergency paths (`dropRecordError`).
- Consequences (blacklist, strike, shadowban) apply once per rule change, so re-saving a decision never double-counts. Bans stay a human action.
- No parent refund in any row. Rematch is the parent remedy.
