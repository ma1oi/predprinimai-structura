"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { InformationPartner } from "@/lib/information-partner-types";
import { useMotionActivity } from "@/lib/use-motion-activity";
import styles from "./information-partners.module.css";

export function InformationPartnersSection({ initialPartners }: { initialPartners: InformationPartner[] }) {
  const [partners, setPartners] = useState(initialPartners);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/information-partners", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const result = await response.json();
        if (Array.isArray(result.partners)) setPartners(result.partners);
      } catch { /* Keep published cards while offline. */ }
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  if (!partners.length) return null;
  return <InformationPartnersMarquee key={JSON.stringify(partners)} partners={partners} />;
}

function InformationPartnersMarquee({ partners }: { partners: InformationPartner[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const { active } = useMotionActivity(sectionRef);
  const single = partners.length === 1;
  const group = single ? partners : Array.from({ length: Math.ceil(18 / partners.length) }, () => partners).flat();
  return <section id="information-partners" ref={sectionRef} className={styles.section} aria-labelledby="information-partners-heading" data-running={active} data-static={single}>
    <h2 id="information-partners-heading" className={styles.heading}>Информационные партнеры</h2>
    <div className={styles.viewport}>
      <div className={styles.track} style={{ "--information-duration": `${group.length * 8}s` } as CSSProperties}>
        {(single ? [0] : [0, 1]).map((copy) => <div key={copy} className={`${styles.group} ${copy ? styles.duplicate : ""}`} role={copy === 0 ? "list" : undefined} aria-hidden={copy ? true : undefined}>
          {group.map((partner, index) => {
            const duplicate = copy > 0 || index >= partners.length;
            return <article key={`${partner.id}-${index}`} className={`${styles.card} ${index >= partners.length ? styles.filler : ""}`} role={!duplicate ? "listitem" : undefined} aria-hidden={duplicate ? true : undefined}>
              <div className={styles.portrait}><Image src={partner.photo} alt={duplicate ? "" : `Фото: ${partner.name}`} fill unoptimized sizes="(max-width: 767px) 200px, 270px" draggable={false} /></div>
              <h3 className={styles.name}>{partner.name}</h3>
              {partner.job && <p className={styles.job}>{partner.job}</p>}
              <a className={styles.social} href={partner.socialUrl} target="_blank" rel="noopener noreferrer" tabIndex={duplicate ? -1 : undefined} aria-label={`Соцсеть: ${partner.name}`}>
                <span>{new URL(partner.socialUrl).hostname.replace(/^www\./, "")}</span>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6 4h10v10M16 4 4 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </a>
            </article>;
          })}
        </div>)}
      </div>
    </div>
  </section>;
}
