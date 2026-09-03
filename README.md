# MatchMax

MatchMax is a Hong Kong based Education-Tutor Startup aiming at IBDP , IGCSE, DSE, AP and other students looking for tutors to quickly be matched with top scoring tutors across the world. Our platform actively invites tutors and help them focus on teaching while we handle the task of finding students. WIthin MatchMax I leading a Full Stack Development Team in developing and deploying a tutor hiring platform for MatchMax.

## Built with Students in Mind

## Development

### Transcript AI auto-fill

Transcript image extraction uses OpenRouter. Add `OPENROUTER_API_KEY` to the local environment
and the Vercel project environment variables before deploying. The feature accepts JPG and PNG
images only.

### Cloudflare R2 (tutor profile images)

Admin tutor photo uploads/picking now use Cloudflare R2. Set these server env vars:

- `R2_ACCOUNT_ID`
- `R2_BUCKET_NAME`
- `R2_API_TOKEN` (Cloudflare API token with R2 bucket read/write scope)
- `R2_PUBLIC_BASE_URL` (public base URL or custom domain root for served objects)
- `R2_TUTOR_IMAGE_PREFIX` (optional, defaults to `tutor-profile-images/`)

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
