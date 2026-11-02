# Notes marketplace guide (upload v2)

How the MatchMax notes system works, for sellers, buyers and staff. The
public, translated version of this guide lives at `/guide/notes`
(`src/routes/guide.notes.tsx`, copy in `guide.notes.*` of both locale files),
and the upload form links to it.

## What the system does

Verified tutors sell their own study materials (notes, mock papers, graded
exemplars, flashcards). Buyers preview watermarked pages, pay MatchMax, and
receive the file in their account after staff release it. MatchMax keeps
20%; tutors are paid in the monthly run. Nothing in v2 changes the payment,
review or payout flow.

## For sellers: uploading a note

Entry points: the **Upload notes** banner and floating button in the notes
shop (`/tutors?view=materials`), the **Sell your own notes** card on every
note page, the guide page, and Account → Add a note (`/account/notes/new`).

1. **Add files.** One drop zone takes everything:
   - **PDF**: the main document and the source of the preview (max 50 MB).
   - **Photos / scans** (JPG, PNG, WebP, GIF): merged in the browser into one
     PDF (A4 width, max 80 photos). HEIC must be converted to JPG first
     (browsers cannot decode it).
   - **Word, PowerPoint, Excel, ZIP, video, audio, Anki, text**: extra
     deliverables, up to 2 GB each, max 10 per note. They upload straight to
     private storage through signed upload URLs with a progress bar.
   - **Links**: *Import PDF* downloads a public Google Drive file, Google
     Docs / Slides / Sheets (exported as PDF) or a Dropbox file link and makes
     it the main PDF. *Add as link* attaches any Google Drive, Docs, Dropbox or
     OneDrive link as a buyer deliverable (max 10).
   - A PDF over 50 MB is accepted as an extra download; the seller then adds
     a smaller PDF or photos for the preview.
2. **AI detection.** As soon as a main file is added, the browser extracts
   the text (or renders 3 page images for scanned files) and the server asks
   Alibaba Qwen via OpenRouter for title, one-line summary, description,
   curriculum, subject, type, category, topic, year, language and keywords.
   Values are checked against the site's own lists; contact details are
   stripped. Empty fields are filled; **Detect again** overwrites all of them.
3. **Preview pages.** Thumbnails of the main PDF; the seller ticks the pages
   buyers may see. Default: the first ~30% (min 5, max 12), never the whole
   document (a 1-page file is the only exception; the watermark protects
   it). Every preview page gets the tiled "PREVIEW COPY - MATCHMAX.HK"
   watermark server-side.
4. **Details.** Title, summary, description, curriculum, category chips
   (IB: IA / EE / TOK / Paper 1-3 ...; DSE: Paper 1 / Paper 2 / SBA /
   Electives ...; IGCSE and A-Level papers, coursework ...), subject, type,
   topic, document language (English / 繁體 / 简体 / mixed), year, word
   count, search keywords.
5. **Price guide.** Compares published listings of the same type, narrowing
   to same subject + category → same subject → same curriculum → same type
   (at least 3 comparables). With fewer, a baseline is used (HKD
   notes 60-98-150, mock 40-78-120, exemplar 120-220-380, flashcards
   30-50-90). Shows the 25th-75th percentile range, a marker for the
   seller's price, a verdict (too low / low / competitive / high / too high)
   and links to the closest comparable listings.
6. **Submit.** Accept the Notes Terms and submit for staff review, or save a
   draft. Live notes: text and price changes go live; a new main PDF is
   staged for staff review; extra files and links on a live note change
   through staff.

## For buyers

- **Search** (shop directory): English, Traditional and Simplified Chinese
  are folded together, with synonym groups (IA = internal assessment =
  內部評估, past paper = 歷屆試題, Paper 1 = 卷一, ...), typo tolerance for
  longer words and Chinese bigram matching. Results are ranked; a listing
  matching most of the query still appears.
- **Filters**: kind chips, a **Saved** chip, category chips, school, subject,
  curriculum and document language.
- **Note page**: summary, watermarked preview, *What's included*, **Save**,
  **Share**, ratings and reviews, similar notes with a side-by-side
  **Compare** (up to 3), and the buy card.
- **After purchase**: extra files and links appear on the note page under
  *Your extra files* (signed links valid for 1 hour). The main file is
  delivered exactly as before.
- **Reviews**: only a buyer whose order grants download access (the same
  rule as the Download button in the Bought list) can rate 1-5 stars and
  comment; one review per buyer, editable. Comments go through the contact
  filter.

## Languages

All notes copy exists in English and Traditional Chinese (zh-HK). Simplified
Chinese is supported inside the notes system without changing the site-wide
language settings: search understands Simplified input, AI keeps a
Simplified document's text in Simplified, and listings can be labelled and
filtered as 简体中文. A full Simplified Chinese site locale (zh-CN) touches
the shared language switcher and URL routing, so it needs owner approval
first.

## For staff / operators

One-time setup before deploying:

1. Apply `supabase/migrations/20261101090000_notes_upload_v2.sql` (additive:
   new columns on `digital_materials`, tables `material_files`
   (service-role only), `material_reviews`, `saved_materials`, private bucket
   `materials-extras`).
2. Raise the project's global Storage upload limit (Supabase dashboard →
   Storage → Settings) to at least 2 GB for large extras (the bucket itself
   allows 2 GB; plan limits apply).
3. Set `OPENROUTER_API_KEY` in the Cloudflare Worker environment (already
   used by the tutor autofill; without it AI detection shows a friendly
   error and sellers fill in details by hand).

Safety notes:

- Originals and extras stay in private buckets; buyers only ever receive
  short-lived signed URLs after an access check.
- The main-PDF attach call only accepts paths under the caller's own
  `materials/u-<tutorId>/` prefix; extras only under `extras/<materialId>/`.
- Link import fetches only Google Drive / Docs / Dropbox hosts (redirects are
  re-checked hop by hop), caps the download at 50 MB and requires a real PDF.
- Public pages read the new columns with a fallback, so the shop and note
  pages keep working if the migration has not been applied yet.

## Testing checklist

See the PR description for the step-by-step test plan.
