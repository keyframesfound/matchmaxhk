# Desk WhatsApp script pack (#797 · AC-512-1 / AC-512-2)

Status: **approved by #797**. Unlisted ops doc, do not link publicly.
Seven FAQ paths in EN and 繁中, and these seven are the only scripts the desk
may send without a human rewrite. Everything outside them is a
human-reviewed draft.

Owner: the desk lead holds this file. Wording changes are proposed as a PR
against this file and need CEO sign-off, because the same lines appear in the
fee and verification help articles. Until that lands, the text below is the
approved version.

## 1. What this pack is, and what "auto-sendable" means here

- One script per FAQ path, each paired EN / 繁中, each 1 to 3 sentences. A desk
  reply, not a leaflet.
- "Auto-sendable" means a staff member may copy the line and send it without
  rewriting the policy. **Nothing in the product auto-sends.** The desk quick
  replies are insert-only and a human presses Send (`quick-replies.ts` header,
  CEO lock), and this pack does not change that.
- The 繁中 column is the desk default for Hong Kong parents. The EN column is
  for English-language threads. Do not mix the two in one message.
- Anything not on the seven paths goes to a person (section 3), even when the
  answer feels obvious.

## 2. The seven auto-sendable paths

### 2.1 Core hours

Trigger: the client asks when the desk is open, or why a reply was slow.

| EN | 繁中 |
| --- | --- |
| Our desk is open 10:00–20:00 HKT daily. Outside those hours we reply when we are free, and quickly if a lesson is being locked in. | 客服時間為每日香港時間 10:00–20:00。其餘時間我們會盡快回覆，如需鎖定課堂會優先處理。 |

### 2.2 The parent matching fee is HK$0

Trigger: a parent asks what MatchMax charges them, or whether there is a commission.

| EN | 繁中 |
| --- | --- |
| MatchMax charges the family HK$0 in matching fees. You pay the tutor's agreed rate directly, and nothing extra to us. | MatchMax 向家長收取的配對費為 HK$0。學費由家長按導師的議定價格直接支付，平台不另收費用。 |

### 2.3 The 1.5-lesson admin fee, framed as the tutor's slice

Trigger: a client asks what the admin fee is or who pays it.

| EN | 繁中 |
| --- | --- |
| The 1.5-lesson administrative fee is the tutor's side of the introduction, not a parent charge: Lesson 1 at 100% and Lesson 2 at 50% for ongoing cases of six lessons or more. | 1.5 堂行政費是導師就介紹繳付的費用，並非向家長收取：持續 6 堂或以上的個案，第 1 堂收 100%，第 2 堂收 50%。 |

### 2.4 Short cases: 20%

Trigger: the client describes a short package of a few lessons.

| EN | 繁中 |
| --- | --- |
| A short case of five lessons or fewer, declared before Lesson 1, carries a 20% package fee instead of the 1.5-lesson fee. | 5 堂或以下的短期個案，須於第 1 堂前申報，按套裝費用 20% 收費，而非 1.5 堂行政費。 |

### 2.5 Independent Tutors, not employees

Trigger: a client asks whether the tutor works for MatchMax, or mentions salary or a job.

| EN | 繁中 |
| --- | --- |
| Tutors on MatchMax are Independent Tutors running their own practice. They are not employees, and we do not place anyone into a job. | MatchMax 的導師是獨立導師，自行經營教學事業，並非僱員，我們亦不提供就業安排。 |

### 2.6 Blue Tick means staff-checked documents

Trigger: a parent asks what the badge means, or whether it proves quality.

| EN | 繁中 |
| --- | --- |
| The Blue Tick means our staff have checked the tutor's documents by hand, including official transcripts and HKID. It is a document check, not a promise about teaching or grades. | 藍剔代表我們的工作人員已人手核對導師文件，包括官方成績單及香港身份證。這是文件審核，並不代表教學質素或成績保證。 |

The badge is the **Blue Tick**. Never call it Gold, and never present it as a
quality mark.

### 2.7 No grade promises

Trigger: a parent asks whether the tutor can raise grades, promise a level, or guarantee a 5**.

| EN | 繁中 |
| --- | --- |
| We do not promise grades, scores or offers, and no tutor on MatchMax should. We handle the match and the fit; results depend on the student and the work. | 我們不會承諾成績、分數或取錄結果，MatchMax 的導師亦不應作出保證。我們負責配對與合適度，成果取決於學生及實際努力。 |

**Centre inbound only.** When a centre writes in about its own fee, staff may
restate the centre fee memory as 1.5 / 1 / 0.5 / $0. State the four numbers and
stop. Do not explain the centre product stack, and do not volunteer this ladder
to a private parent.

## 3. Escalate, never auto-send

A human reviews and sends every item below. A first draft may come from the
official Gems, but a staff member reads it, edits it and sends it.

| Situation | Why the desk does not send it alone |
| --- | --- |
| Matching suggestions, shortlists, or "which tutor is best for us" | The desk owns the shortlist and the case context |
| Tutor pings and first contact, including fee framing before YES | A wrong framing becomes a `BILLING-1.5` dispute later |
| Rematches, tutor quit, ghost risk | Timing and the 24–48h promise are desk decisions |
| L1 / L2 drops and Drop-Protection | Verified stop, fault and protection floor sit in `fee-drop-state-machine.md` |
| Fee caps, waivers, goodwill, any exception | CEO lock territory; no desk member invents a number |
| Complaints, conduct, safeguarding, hostile households | Evidence handling and consequences are human decisions |

## 4. Tags the desk may propose

Tags are proposed by the desk and confirmed by a human before they are applied.
Every tag carries the case code, and an `MM-T` code when a tutor is involved.

| Tag | Use when | Attach |
| --- | --- | --- |
| `BOT-FALLBACK` | An automated reply or bot path gave a wrong or missing answer | `MM-C-####`, screenshot |
| `MATCH-MISMATCH` | The tutor sent does not fit the brief | `MM-C-####`, `MM-T###` |
| `TUTOR-CONDUCT` | Conduct, reliability or safeguarding concern about a tutor | `MM-T###`, `MM-C-####` |
| `BILLING-1.5` | Fee was framed late or wrongly, or a short case was mislabelled | `MM-C-####` |
| `PLATFORM-UX` | A site flow confused the client: form, reveal, upload, status | `MM-C-####`, page path |

Never tag a policy argument as an engineering bug. A GitHub issue is opened
only for a real engineering bug, with steps to reproduce and the case code.
Everything else stays on the case.

## 5. Hard limits

- **No new in-app chat engine.** MatchMax does not run in-app chat; early
  lessons are arranged through MatchMax and the Case Manager.
- **No new vendor agent.** The desk is people plus these scripts.
- **No website AI search.** A script is not a search answer, and the desk does
  not promise one.
- These scripts may not be used to state anything outside the policy lines in
  section 2. In particular: no salary or employment placement, no grade or
  offer promise, no "guaranteed", no 包升, no 保證奪星, no Gold badge, and no fee
  number that is not listed above.
- When a question is not on a listed path, reply with the escalation from
  section 3 rather than improvising policy.

## 6. Returning parents

A returning parent is answered warmly and briefly from staff-only notes. Read
the notes, answer the question, and keep it to a few lines. Never paste, quote
or forward a raw notes dump, and never show the internal shorthand or tags.

## References

- Fee table and centre ladder: `src/features/help/content/admin-fee-structure.md`
- Parent-side $0 framing: `src/features/help/content/understand-zero-parent-commission-and-tutor-admin-fees.md`
- Blue Tick wording: `src/features/help/content/how-matchmax-verifies-tutors.md`
- Fee rules and the 20% short-case lock: `docs/fee-drop-state-machine.md`
- Insert-only desk replies: `src/features/cases/quick-replies.ts`
