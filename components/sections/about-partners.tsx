"use client";

import Image from "next/image";
import { useRef } from "react";
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
        <div className={styles.stat}><dt>02</dt><dd>города: Ярославль и Москва</dd></div>
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

export function PartnersSection() {
  const regionRef = useRef<HTMLElement>(null);
  const { active } = useMotionActivity(regionRef);

  return (
    <section ref={regionRef} className={styles.partners} aria-label="Партнёры фестиваля" tabIndex={0} data-running={active}>
      <div className={styles.partnerTrack}>
        {[0, 1].map((copy) => (
          <div
            className={styles.partnerGroup}
            key={copy}
            role={copy === 0 ? "list" : undefined}
            aria-hidden={copy === 1 ? true : undefined}
          >
            {Array.from({ length: 18 }, (_, index) => (
              <div
                className={`${styles.partnerLogo} ${index >= 6 ? styles.partnerFiller : ""}`}
                key={index}
                role={copy === 0 && index < 6 ? "listitem" : undefined}
                aria-hidden={index >= 6 ? true : undefined}
              >
                <picture>
                  <source media="(max-width: 767px)" srcSet={`/assets/mobile/about-partner-${index % 2 + 1}.webp`} width={index % 2 === 0 ? 165 : 163} height={105} />
                  <Image
                  src={`/assets/figma/partner-${index % 2 + 1}.webp`}
                  width={230}
                  height={150}
                  alt={copy === 1 || index >= 6 ? "" : index % 2 === 0 ? "Демидовский университет" : "Стартап-студия «Структура»"}
                  sizes="(max-width: 767px) 165px, 230px"
                  />
                </picture>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
