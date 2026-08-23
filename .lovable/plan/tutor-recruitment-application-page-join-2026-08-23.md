# Tutor Recruitment Application Page (/join)

A new public page that reproduces the MatchMax Google Form, submitting by email to matchmaxedu@gmail.com. No Lovable-specific services: it uses your own Supabase project and Resend, so it runs unchanged on Cloudflare.

## Fix the failing build first

Typechecking is currently broken, mostly cascading from the generated Supabase client losing its types. Clear these before the new page ships:

- `src/integrations/supabase/client.ts` — both factory functions infer `any` circularly (TS7023). Everything below is downstream of this, so fix it first by giving the exported client an explicit `SupabaseClient<Database>` type.
- `src/routes/_authenticated.admin.settings.tsx:80` and `src/routes/_authenticated.admin.users.tsx:76` — annotate the `row` / `p` callback parameters.
- `src/features/auth/useAuth.tsx:25,39,62` — annotate the role, auth-event, session and destructured `data` parameters.
- `src/components/ui/command.tsx:41,58` — the cmdk input wrapper passes `onChange`; drop it from the forwarded props and type the handler.
- `src/features/tutors/r2.functions.ts:56-59` — guard the R2 env vars (throw when missing) instead of assigning `string | undefined`; line 300 — wrap the `Uint8Array` body in a `Blob` before passing it to `fetch`.
- `src/lib/email-templates/send-email.ts:87` — Resend's option is `replyTo`, not `reply_to`.


## The page

Route: `/join` (public, in the header/footer nav, and the "Apply" buttons on Become a Tutor link here).

Header text mirrors the form: title, purpose/consent intro, and a collapsible "Sample tutor profile" panel showing the example profile so applicants know the level of detail expected.

Fields, in the form's order (\* = required):

1. Name \*
2. Contact number / WhatsApp \*
3. Email address \*
4. Earliest start date (date picker)
5. Current status \* — University student / Graduate / Full-time tutor / Part-time tutor / Other (+ free text)
6. Current university / institution
7. Degree / programme
8. High school and graduation year \*
9. Curriculum completed \* — IBDP / A-Level / AP / Other (+ free text)
10. Overall achieved score in high school qualifications \*
11. Subjects and levels confident teaching \* (long text)
12. Relevant subject results / academic strengths \* (long text)
13. Awards, scholarships, notable achievements (long text)
14. Teaching / tutoring experience \* (long text)
15. Normal hourly rate in HKD \* (number)
16. Teaching materials or resources available \* — Yes / No / In progress
17. Preferred tutoring format \* — Face to face / Online / Both
18. Max number of students (number)
19. Preferred teaching location(s) if in-person
20. Preferred medium of instruction \*
21. Anything else / who referred you (long text)
22. Academic transcript / proof of results \* — up to 5 files, 10 MB each
23. Commission acknowledgement checkbox \* — "MatchMax will take the 1st and 11th lesson as commission…"
24. Privacy notice (PDPO Cap. 486) checkbox \*

Every text, number, and date input carries a light grey placeholder showing an example answer for that question — e.g. Name: "Jayden Lau"; WhatsApp: "+852 9123 4567"; High school and graduation year: "Diocesan Boys' School, 2023"; Overall score: "IB 43/45"; Subjects and levels: "History HL, Economics HL, Business Management HL, Chemistry SL"; Hourly rate: "450"; Medium of instruction: "English / Cantonese". Choice, checkbox, and file fields get a short grey helper line instead.

Styling follows the existing MatchMax design system (site header/footer, card sections, same inputs as the post-case form). Bilingual labels and placeholders via the existing i18n files (EN + zh-HK).

On success the page swaps to a confirmation panel with a "back to home" link; errors show inline with the values preserved.

## Submission

A server function validates every field with Zod (same rules as the client), then sends one email to matchmaxedu@gmail.com through your existing Resend setup:

- Subject: `New tutor application — <name>`
- Body: a readable HTML + plain-text table of every answer, built with the existing React Email components so it matches your other templates.
- Reply-To set to the applicant's email so you can answer directly.
- The uploaded files are attached to the email. Client-side guard: max 5 files, 10 MB each, 20 MB total, and only PDF / JPG / PNG / DOC(X) accepted.

Nothing is written to the database, so there is no migration and no new table.

## Technical notes

- New route file `src/routes/join.tsx` with its own `head()` metadata (title, description, og tags, canonical) and an entry added to `src/routes/sitemap[.]xml.ts`.
- New `src/lib/tutor-application.functions.ts` exporting a single `createServerFn` (POST) — a thin wrapper only; the schema and the email builder live in sibling modules (`tutor-application.schema.ts`, `src/lib/email-templates/tutor-application.tsx`).
- Files are transported as base64 in the request payload and converted into Resend attachments server-side; the request body cap is enforced before upload.
- `RESEND_API_KEY` is read inside the handler, as with the existing templates. The recipient address is a constant in the server module.
- No Lovable-managed AI, storage, or edge functions are involved.
