import { Link } from "@tanstack/react-router";
import { gsap } from "gsap";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import "./StaggeredMobileMenu.css";

export type StaggeredMobileMenuItem = {
  label: string;
  ariaLabel: string;
  to: string;
};

export type StaggeredMobileMenuSocialItem = {
  label: string;
  link: string;
};

type StaggeredMobileMenuProps = {
  items: StaggeredMobileMenuItem[];
  socialItems: StaggeredMobileMenuSocialItem[];
  renderFooter?: (closeMenu: () => void) => ReactNode;
};

const LAYER_COLORS = ["#041344", "#0A245F", "#1FA8B6"];

export function StaggeredMobileMenu({ items, socialItems, renderFooter }: StaggeredMobileMenuProps) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  const layersRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const openTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const closeTweenRef = useRef<gsap.core.Tween | null>(null);
  const panelId = useId();

  useLayoutEffect(() => {
    const context = gsap.context(() => {
      const panel = panelRef.current;
      const layers = layersRef.current?.querySelectorAll<HTMLElement>(".smm-prelayer");
      if (!panel || !layers) return;

      gsap.set([panel, ...layers], { xPercent: 100, opacity: 1 });
      gsap.set(iconRef.current, { rotate: 0, transformOrigin: "50% 50%" });
    });

    return () => context.revert();
  }, []);

  const playOpen = useCallback(() => {
    const panel = panelRef.current;
    const layers = layersRef.current?.querySelectorAll<HTMLElement>(".smm-prelayer");
    if (!panel || !layers) return;

    openTimelineRef.current?.kill();
    closeTweenRef.current?.kill();

    const labels = panel.querySelectorAll<HTMLElement>(".smm-item-label");
    const numbers = panel.querySelectorAll<HTMLElement>(".smm-menu-item");
    const socialTitle = panel.querySelector<HTMLElement>(".smm-socials-title");
    const socialLinks = panel.querySelectorAll<HTMLElement>(".smm-social-link");

    gsap.set(labels, { yPercent: 140, rotate: 8 });
    gsap.set(numbers, { "--smm-number-opacity": 0 });
    gsap.set(socialTitle, { opacity: 0 });
    gsap.set(socialLinks, { y: 20, opacity: 0 });

    const timeline = gsap.timeline();
    layers.forEach((layer, index) => {
      timeline.to(layer, { xPercent: 0, duration: 0.5, ease: "power4.out" }, index * 0.07);
    });

    const panelStart = Math.max(0, layers.length - 1) * 0.07 + 0.08;
    timeline.to(panel, { xPercent: 0, duration: 0.65, ease: "power4.out" }, panelStart);
    timeline.to(
      labels,
      { yPercent: 0, rotate: 0, duration: 0.8, ease: "power4.out", stagger: 0.08 },
      panelStart + 0.12,
    );
    timeline.to(
      numbers,
      { "--smm-number-opacity": 1, duration: 0.45, ease: "power2.out", stagger: 0.07 },
      panelStart + 0.2,
    );
    timeline.to(socialTitle, { opacity: 1, duration: 0.35, ease: "power2.out" }, panelStart + 0.36);
    timeline.to(
      socialLinks,
      { y: 0, opacity: 1, duration: 0.45, ease: "power3.out", stagger: 0.07 },
      panelStart + 0.4,
    );

    openTimelineRef.current = timeline;
  }, []);

  const playClose = useCallback(() => {
    const panel = panelRef.current;
    const layers = layersRef.current?.querySelectorAll<HTMLElement>(".smm-prelayer");
    if (!panel || !layers) return;

    openTimelineRef.current?.kill();
    closeTweenRef.current?.kill();
    closeTweenRef.current = gsap.to([panel, ...layers], {
      xPercent: 100,
      duration: 0.32,
      ease: "power3.in",
      overwrite: "auto",
    });
  }, []);

  const closeMenu = useCallback(
    (restoreFocus = false) => {
      if (!openRef.current) return;
      openRef.current = false;
      setOpen(false);
      playClose();
      gsap.to(iconRef.current, { rotate: 0, duration: 0.3, ease: "power3.inOut", overwrite: "auto" });
      if (restoreFocus) toggleRef.current?.focus();
    },
    [playClose],
  );

  const toggleMenu = useCallback(() => {
    const nextOpen = !openRef.current;
    openRef.current = nextOpen;
    setOpen(nextOpen);

    if (nextOpen) {
      playOpen();
      gsap.to(iconRef.current, { rotate: 225, duration: 0.75, ease: "power4.out", overwrite: "auto" });
      return;
    }

    playClose();
    gsap.to(iconRef.current, { rotate: 0, duration: 0.3, ease: "power3.inOut", overwrite: "auto" });
  }, [playClose, playOpen]);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu(true);
    };
    const handleClickAway = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node) && !toggleRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickAway);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickAway);
    };
  }, [closeMenu, open]);

  return (
    <div className="staggered-mobile-menu lg:hidden" data-open={open || undefined}>
      <div ref={layersRef} className="smm-prelayers" aria-hidden="true">
        {LAYER_COLORS.map((color) => (
          <div key={color} className="smm-prelayer" style={{ backgroundColor: color }} />
        ))}
      </div>

      <button
        ref={toggleRef}
        className="smm-toggle"
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggleMenu}
      >
        <span className="smm-toggle-label">{open ? "Close" : "Menu"}</span>
        <span ref={iconRef} className="smm-icon" aria-hidden="true">
          <span className="smm-icon-line" />
          <span className="smm-icon-line smm-icon-line-vertical" />
        </span>
      </button>

      <aside id={panelId} ref={panelRef} className="smm-panel" aria-hidden={!open}>
        <div className="smm-panel-header">
          <Link to="/" className="smm-brand" aria-label="MatchMax home" onClick={() => closeMenu()}>
            <img src="/matchmax-logo.png" alt="" width={32} height={32} />
            <span>MatchMax</span>
          </Link>
        </div>

        <div className="smm-panel-content">
          <nav aria-label="Mobile navigation">
            <ol className="smm-menu-list">
              {items.map((item) => (
                <li key={item.to} className="smm-menu-item">
                  <Link to={item.to} aria-label={item.ariaLabel} onClick={() => closeMenu()}>
                    <span className="smm-item-label">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </nav>

          <div className="smm-footer-controls">{renderFooter?.(() => closeMenu())}</div>

          <div className="smm-socials" aria-label="MatchMax social links">
            <h2 className="smm-socials-title">Connect</h2>
            <ul>
              {socialItems.map((item) => {
                const isExternal = item.link.startsWith("http");
                return (
                  <li key={item.link}>
                    <a
                      className="smm-social-link"
                      href={item.link}
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noopener noreferrer" : undefined}
                    >
                      {item.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}