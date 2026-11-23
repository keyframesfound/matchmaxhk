# Error triage

Every unexpected failure a user hits is written to `public.error_logs` and can
be triaged — and fixed — from this file's queries. No devtools, no screenshots.

## What is captured

| column | meaning |
| --- | --- |
| `source` | `client` (browser) or `server` (worker / server fn) |
| `fingerprint` | stable hash of source + message + path; the dedupe key |
| `message` | the error text. Database errors carry the full PostgREST detail (`[PGRST201] … relationship A … relationship B …`) |
| `stack` | the stack, so the file and line of the throw are in the row |
| `url` | the page (or the request URL, for server rows) |
| `user_agent` | browser, for client rows |
| `occurrences` | how many times this exact failure has been seen |
| `first_seen_at` / `last_seen_at` | the window |
| `status` | `new` → `investigating` → `fixed` / `ignored` |
| `fix_note` | what was changed, or why it was ignored |

Three entry points write rows:

1. **Route error boundary** — the "Oops" screen posts before it renders.
2. **Window listeners** — `error` and `unhandledrejection`, for failures the
   router boundary never sees (background query, timer, event handler, chunk).
3. **Server** — the server-fn middleware (system-shaped failures only, so
   business-rule throws like "Order not found." stay out) and the worker's
   last-resort catch (everything).

Skipped on purpose: `Unauthorized …` (session expiry) and a bare
`Failed to fetch` (offline). Both are normal states, not defects.

## Triage query

```sql
select id, source, occurrences, status,
       left(message, 160) as message,
       left(url, 60)      as url,
       last_seen_at
from public.error_logs
where status = 'new'
order by occurrences desc, last_seen_at desc
limit 25;
```

Then open one row in full — the stack carries the file and line:

```sql
select message, stack, url, user_agent, first_seen_at, last_seen_at
from public.error_logs
where id = '<id>';
```

## The loop

1. Read the triage query.
2. Fix the cause (the message usually names it, e.g. a PGRST code with both
   competing relationships).
3. Mark it, so it stops showing up as new:

```sql
update public.error_logs
set status = 'fixed',
    fix_note = 'PR #842 — organisations embed hinted to organisation_id'
where id = '<id>';
```

Noise (a probe, a third-party outage, a test artifact):

```sql
update public.error_logs set status = 'ignored', fix_note = 'reason' where id = '<id>';
```

## Asking for a pass

Say **"triage errors"** and the agent reads the query above, fixes what it can,
marks each row `fixed` with the PR reference, and reports what it left open.
