"use client";

import { useEffect, useState, type RefObject } from "react";

/** Decorative loops run only while visible and respect the system motion setting. */
export function useMotionActivity<T extends Element>(ref: RefObject<T | null>) {
  const [motion, setMotion] = useState({ active: false, reduced: false });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let intersecting = false;
    const update = () => setMotion({
      active: intersecting && !document.hidden && !preference.matches,
      reduced: preference.matches,
    });
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      update();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    preference.addEventListener("change", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      preference.removeEventListener("change", update);
    };
  }, [ref]);

  return motion;
}
