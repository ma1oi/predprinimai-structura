"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Partner } from "@/lib/partner-types";
import { useMotionActivity } from "@/lib/use-motion-activity";
import styles from "./about-partners.module.css";

const benefits = [
  {
    number: "01",
    title: <>Практику вместо<br />мотивации</>,
    description: "Блоки про\u00a0нейросети в\u00a0малом бизнесе, право в\u00a0интернете, после\u00a0которой есть\u00a0что\u00a0внедрять уже\u00a0в\u00a0понедельник",
    name: "practice",
    starWidth: 484,
    starHeight: 282.323,
    personWidth: 440,
    personHeight: 304,
  },
  {
    number: "02",
    title: <>Знакомства,<br />которые работают</>,
    description: "Нетворкинг и\u00a0активности в\u00a0паузах, чтобы\u00a0встретиться с\u00a0теми, с\u00a0кем\u00a0можно сделать совместный проект или\u00a0сделку",
    name: "network",
    starWidth: 545.563,
    starHeight: 257.001,
    personWidth: 440,
    personHeight: 281,
  },
  {
    number: "03",
    title: <>Спикеров, которые<br />уже прошли путь</>,
    description: "Выступят топ-спикеры из\u00a0банковской сферы и\u00a0из\u00a0предпринимательства",
    name: "speakers",
    starWidth: 484,
    starHeight: 282.323,
    personWidth: 439,
    personHeight: 273,
  },
];

export function AboutSection() {
  return (
    <section id="about" className={styles.about} aria-labelledby="about-heading">
      <h2 id="about-heading" className={styles.heading}>О фестивале</h2>
      <p className={styles.introduction}>
        Один день, когда чаты заканчиваются и&nbsp;начинается встреча. Соберём вместе молодых предпринимателей из&nbsp;Ярославля и&nbsp;Москвы. Вы&nbsp;услышите сильных спикеров, познакомитесь друг с&nbsp;другом и&nbsp;вместе разберётесь, что&nbsp;сегодня меняет бизнес: от&nbsp;нейросетей до&nbsp;права в&nbsp;интернете.
      </p>
      <dl className={styles.stats}>
        <div className={styles.stat}><dt>01</dt><dd>день</dd></div>
        <div className={styles.stat}><dt>300</dt><dd>участников</dd></div>
      </dl>
      <h3 className={styles.benefitsHeading}>Что ты получишь</h3>
      <div className={styles.benefits}>
        {benefits.map((benefit) => (
          <article className={`${styles.card} ${styles[benefit.name]}`} key={benefit.number}>
            <span className={styles.number}>{benefit.number}</span>
            <h4 className={styles.cardTitle}>{benefit.title}</h4>
            <p className={styles.description}>{benefit.description}</p>
            <picture>
              <source media="(max-width: 767px)" srcSet={`/assets/mobile/about-star-${benefit.name}.webp`} />
              <Image
              className={styles.star}
              src={`/assets/page/about-star-${benefit.name}.webp`}
              width={benefit.starWidth}
              height={benefit.starHeight}
              sizes="(max-width: 1100px) 580px, 38vw"
              alt=""
              />
            </picture>
            <picture>
              <source media="(max-width: 767px)" srcSet={`/assets/mobile/about-person-${benefit.name}.webp`} width={350} height={benefit.name === "practice" ? 242 : benefit.name === "network" ? 224 : 217} />
              <Image
              className={styles.person}
              src={`/assets/page/about-person-${benefit.name}.webp`}
              width={benefit.personWidth}
              height={benefit.personHeight}
              sizes="(max-width: 1100px) 440px, 31vw"
              alt=""
              />
            </picture>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PartnersSection({ initialPartners }: { initialPartners: Partner[] }) {
  const [partners, setPartners] = useState(initialPartners);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/partners", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const result = await response.json();
        if (Array.isArray(result.partners)) setPartners(result.partners);
      } catch {
        // Keep the last published logos when the connection is interrupted.
      }
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
  return <div className="festival-partners"><PartnersMarquee partners={partners} /></div>;
}

function PartnersMarquee({ partners }: { partners: Partner[] }) {
  const regionRef = useRef<HTMLElement>(null);
  const { active } = useMotionActivity(regionRef);
  const group = Array.from({ length: Math.max(1, Math.ceil(18 / partners.length)) }, () => partners).flat();

  return (
    <section id="partners" ref={regionRef} className={styles.partners} aria-label="Партнёры фестиваля" tabIndex={0} data-running={active}>
      <div className={styles.partnerTrack} style={{ "--partner-duration": `${group.length * 6.7}s` } as CSSProperties}>
        {[0, 1].map((copy) => (
          <div className={styles.partnerGroup} key={copy} role={copy === 0 ? "list" : undefined} aria-hidden={copy === 1 ? true : undefined}>
            {group.map((partner, index) => (
              <div className={`${styles.partnerLogo} ${index >= partners.length ? styles.partnerFiller : ""}`} key={`${partner.id}-${index}`} role={copy === 0 && index < partners.length ? "listitem" : undefined} aria-hidden={index >= partners.length ? true : undefined} data-builtin={partner.logo.startsWith("/assets/") ? "true" : undefined}>
                <Image src={partner.logo} width={230} height={150} alt={copy === 0 && index < partners.length ? partner.name : ""} sizes="(max-width: 767px) 165px, 230px" unoptimized />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
