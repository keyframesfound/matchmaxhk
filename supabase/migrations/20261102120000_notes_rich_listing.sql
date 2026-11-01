-- #556 rich product builder: gallery images (1-5, public watermarked
-- previews), an optional YouTube / Vimeo trailer, structured "What's
-- included" chips and a syllabus outline. Additive and idempotent.

ALTER TABLE public.digital_materials
  ADD COLUMN IF NOT EXISTS preview_image_paths text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trailer_video_url text,
  ADD COLUMN IF NOT EXISTS whats_included text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS syllabus_outline text;

ALTER TABLE public.digital_materials
  DROP CONSTRAINT IF EXISTS digital_materials_rich_listing_check;
ALTER TABLE public.digital_materials
  ADD CONSTRAINT digital_materials_rich_listing_check CHECK (
    cardinality(preview_image_paths) <= 5
    AND cardinality(whats_included) <= 12
    AND (syllabus_outline IS NULL OR char_length(syllabus_outline) <= 3000)
    AND (trailer_video_url IS NULL OR char_length(trailer_video_url) <= 300)
  );
