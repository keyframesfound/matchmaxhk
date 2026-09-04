import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import { useRouter } from "@tanstack/react-router";

const LAYER_COLORS = ["#041344", "#0A245F", "#1FA8B6"];

/**
 * Full-screen layered curtain that sweeps across the screen during route
 * changes, mirroring the staggered layer transition used by the mobile menu.
 * Only triggers when the pathname changes (not for search-param updates).
 */
export function PageTransitionCurtain() {
  const router = useRouter();
  const mountedRef = useRef(false);
  const layersRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<"idle" | "covering" | "covered">("idle");
  const fallbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const layers = layersRef.current?.querySelectorAll<HTMLElement>(".ptc-layer");
    if (!layers || layers.length === 0) return;

    gsap.set(layers, { xPercent: 0, x: "100%" });

    const clearFallback = () => {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };

    const playCover = () => {
      stateRef.current = "covering";
      gsap.killTweensOf(layers);
      gsap.set(layers, { xPercent: 0, x: "100%" });
      const timeline = gsap.timeline();
      layers.forEach((layer, index) => {
        timeline.to(layer, { x: "0%", duration: 0.42, ease: "power4.in" }, index * 0.06);
      });
      timeline.eventCallback("onComplete", () => {
        stateRef.current = "covered";
      });
      // Safety net: never leave the screen covered if onRendered never fires.
      fallbackTimerRef.current = window.setTimeout(playReveal, 1600);
    };

    const playReveal = () => {
      clearFallback();
      if (stateRef.current === "idle") return;
      stateRef.current = "idle";
      gsap.killTweensOf(layers);
      const timeline = gsap.timeline();
      layers.forEach((layer, index) => {
        timeline.to(layer, { x: "-110%", duration: 0.55, ease: "power4.out" }, index * 0.06);
      });
      timeline.eventCallback("onComplete", () => {
        gsap.set(layers, { x: "100%", xPercent: 0 });
      });
    };

    const unsubBefore = router.subscribe("onBeforeLoad", (event) => {
      if (!event.pathChanged) return;
      if (stateRef.current === "idle") playCover();
    });
    const unsubRendered = router.subscribe("onRendered", (event) => {
      if (!event.pathChanged) return;
      playReveal();
    });

    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      clearFallback();
      unsubBefore();
      unsubRendered();
      gsap.killTweensOf(layers);
    };
  }, [router]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[200]">
      <div ref={layersRef} className="absolute inset-0">
        {LAYER_COLORS.map((color) => (
          <div
            key={color}
            className="ptc-layer absolute inset-0 will-change-transform"
            style={{ backgroundColor: color, transform: "translateX(100%)" }}
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}
