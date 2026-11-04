import { LOGO_WATERMARK_DATA_URL } from "@/features/materials/logo-watermark";


/** The one watermark style: the greyscale logo on a diagonal grid. */
const LOGO_TILE = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="300" height="190"><g transform="rotate(-30 150 95)" opacity="0.16"><image href="${LOGO_WATERMARK_DATA_URL}" xlink:href="${LOGO_WATERMARK_DATA_URL}" x="60" y="77" width="170" height="36"/></g></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
})();

/**
 * Floating watermark for content that is NOT already stamped (course lesson
 * players). Note previews and pictures carry the same diagonal logo baked
 * in, so they do not get this extra layer (owner: one style only).
 */
export function PreviewWatermark() {
  return (
    <div
      aria-hidden
      data-testid="preview-watermark"
      className="pointer-events-none absolute inset-0 z-10 select-none overflow-hidden"
      style={{ backgroundImage: LOGO_TILE, backgroundRepeat: "repeat" }}
    />
  );
}
