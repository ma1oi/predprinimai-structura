"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type Lenis from "lenis";

export function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lenis: Lenis | undefined;
    let disposed = false;
    let generation = 0;

    function syncMenu() {
      if (document.querySelector("dialog[open]")) lenis?.stop();
      else lenis?.start();
    }

    async function updateMotion() {
      const current = ++generation;
      lenis?.destroy();
      lenis = undefined;
      if (reducedMotion.matches) return;

      const { default: Lenis } = await import("lenis");
      if (disposed || current !== generation) return;
      lenis = new Lenis({ autoRaf: true, smoothWheel: true, syncTouch: false, lerp: 0.1 });
      syncMenu();
    }

    function onAnchorClick(event: MouseEvent) {
      if (!lenis || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== pathname || url.search !== window.location.search || !url.hash) return;
      let id: string;
      try { id = decodeURIComponent(url.hash.slice(1)); } catch { return; }
      const target = document.getElementById(id);
      if (!target || document.querySelector("dialog[open]")) return;

      event.preventDefault();
      if (window.location.hash !== url.hash) window.history.pushState(null, "", url.hash);
      // Lenis reads the target's responsive scroll-margin, matching native anchors.
      lenis.scrollTo(target, {
        onComplete: () => {
          const hadTabIndex = target.hasAttribute("tabindex");
          if (!hadTabIndex) target.setAttribute("tabindex", "-1");
          target.focus({ preventScroll: true });
          if (!hadTabIndex) target.removeAttribute("tabindex");
        },
      });
    }

    const observer = new MutationObserver(syncMenu);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
    document.addEventListener("click", onAnchorClick);
    window.addEventListener("festival-menu-change", syncMenu);
    reducedMotion.addEventListener("change", updateMotion);
    void updateMotion();

    return () => {
      disposed = true;
      generation++;
      observer.disconnect();
      document.removeEventListener("click", onAnchorClick);
      window.removeEventListener("festival-menu-change", syncMenu);
      reducedMotion.removeEventListener("change", updateMotion);
      lenis?.destroy();
    };
  }, [pathname]);

  return null;
}
