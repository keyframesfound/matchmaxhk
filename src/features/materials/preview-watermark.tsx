import { useMemo } from "react";

import { useAuth } from "@/features/auth/useAuth";
import { maskEmail } from "@/features/materials/marketplace-policy";
import { LOGO_WATERMARK_DATA_URL } from "@/features/materials/logo-watermark";

/**
 * Owner request (2026-11-02): a visible, FLOATING watermark over every
 * on-screen content preview (note preview pages, the card preview dialog,
 * course lesson players). It sits above the content as a non-interactive
 * layer, so screenshots and screen recordings carry it, on top of the
 * watermark already stamped into the preview PDF itself.
 *
 * Two layers:
 *  1. a tiled diagonal pattern ("MatchMax Preview · matchmax.hk");
 *  2. a drifting label with the signed-in viewer's masked email (or
 *     "matchmax.hk" for visitors) that slowly moves across the content so it
 *     cannot be cropped out of one corner. Reduced-motion users get it static.
 * pointer-events: none keeps scrolling, selection-free reading and clicks
 * working underneath.
 */

function tileDataUrl(text: string): string {
  const safe = text.replace(/[<>&"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><text x="20" y="120" transform="rotate(-24 160 100)" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="700" fill="rgb(70,90,120)" fill-opacity="0.16">${safe}</text></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

export function PreviewWatermark({ label }: { label?: string }) {
  const { user } = useAuth();
  const viewer = maskEmail(user?.email) ?? "matchmax.hk";
  const tile = useMemo(() => tileDataUrl(label ?? "MatchMax Preview · matchmax.hk"), [label]);

  return (
    <div
      aria-hidden
      data-testid="preview-watermark"
      className="pointer-events-none absolute inset-0 z-10 select-none overflow-hidden"
      style={{ backgroundImage: tile, backgroundRepeat: "repeat" }}
    >
      <style>{`
        @keyframes mm-watermark-drift {
          0% { transform: translate(4%, 6%) rotate(-18deg); }
          25% { transform: translate(55%, 30%) rotate(-18deg); }
          50% { transform: translate(20%, 62%) rotate(-18deg); }
          75% { transform: translate(60%, 82%) rotate(-18deg); }
          100% { transform: translate(4%, 6%) rotate(-18deg); }
        }
        .mm-watermark-drift { animation: mm-watermark-drift 40s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .mm-watermark-drift { animation: none; transform: translate(30%, 40%) rotate(-18deg); }
        }
      `}</style>
      <img
        src={LOGO_WATERMARK_DATA_URL}
        alt=""
        className="absolute left-1/2 top-1/2 w-[55%] max-w-[420px] -translate-x-1/2 -translate-y-1/2 opacity-[0.14]"
      />
      <span className="mm-watermark-drift absolute left-0 top-0 whitespace-nowrap rounded-md px-2 py-1 text-sm font-bold text-[rgb(70,90,120)]/40">
        MatchMax · {viewer}
      </span>
    </div>
  );
}
