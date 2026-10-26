"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { ArrowButton } from "../ui";
import type { Speaker } from "@/lib/speaker-types";
import type { ProgramSpeaker } from "@/lib/program-speaker-types";
import styles from "./schedule-speakers.module.css";

const agenda = [
  { time: "11:00-12:00", title: "Регистрация и знакомство" },
  { time: "12:00-12:05", title: "Открытие фестиваля" },
  { time: "12:05-12:50", title: "Спикер-сессия «Бизнес за зумерами: хайп или новая экономика?»", wide: true },
  { time: "12:50-13:20", title: "«Личная эффективность: почему сильные руководители работают меньше»", twoLines: true },
  { time: "13:20-13:50", title: "«Предприниматель: сколько стоит твой успех?»" },
  { time: "13:50-14:20", title: "Перерыв на кофе-брейк и интерактивы на площадке" },
  { time: "14:20-14:40", title: "Бизнес-батл «AI или здравый смысл?»" },
  { time: "14:40-15:15", title: "Мастер-класс «Нанять AI: как рекрутировать себе цифрового сотрудника»", parallel: true },
  { time: "15:15-15:35", title: "«Бизнес под\u00a0наблюдением: что\u00a0сегодня нельзя делать в\u00a0интернете»", twoLines: true },
  { time: "15:35-16:15", title: "«Google уже мало: как нейросети выбирают бренды»", speaker: true },
  { time: "16:15-16:30", title: "Закрытие фестиваля" },
];

const mobileAgenda = [
  {
    "time": "11:00-12:00",
    "title": "регистрация и знакомство",
    "height": 67
  },
  {
    "time": "12:00-12:05",
    "title": "Открытие фестиваля",
    "height": 67
  },
  {
    "time": "12:05–12:50",
    "title": "Спикер-сессия «Бизнес за зумерами: хайп или новая экономика?»",
    "height": 103
  },
  {
    "time": "12:50-13:20",
    "title": "«Личная эффективность: почему сильные руководители работают меньше»",
    "height": 103
  },
  {
    "time": "13:20-13:50",
    "title": "«Предприниматель: сколько стоит твой успех?»",
    "height": 85
  },
  {
    "time": "13:50-14:20",
    "title": "Перерыв на кофе-брейк и интерактивы на площадке",
    "height": 85
  },
  {
    "time": "14:20-14:40",
    "title": "Бизнес-батл «AI или здравый смысл?»",
    "height": 80
  },
  {
    "time": "14:40-15:15",
    "title": "мастер-класс «нанять ai: как рекрутировать себе цифрового сотрудника»",
    "height": 126,
    "description": "Создание агентов для задач"
  },
  {
    "time": "15:15-15:45",
    "title": "«не просто говорить, а внедрять: ai внутри бизнес-процессов»",
    "height": 185,
    "speaker": "panfilov"
  },
  {
    "time": "15:45-16:05",
    "title": "«бизнес под наблюдением: что сегодня нельзя делать в интернете»",
    "height": 103
  },
  {
    "time": "16:05-16:45",
    "title": "«Google уже мало: как нейросети выбирают бренды»",
    "height": 193,
    "speaker": "goncharenko"
  },
  {
    "time": "16:45-16:50",
    "title": "Закрытие фестиваля",
    "height": 67
  }
];

function AgendaSpeaker({ panfilov = false, photo = "" }: { panfilov?: boolean; photo?: string }) {
  return (
    <div className={`${styles.agendaSpeaker} ${panfilov ? styles.panfilov : ""}`}>
      <Image src={photo || `/assets/page/program-${panfilov ? "panfilov" : "goncharenko"}.png`} width={100} height={100} alt={photo ? panfilov ? "Максим Панфилов" : "Максим Гончаренко" : ""} sizes="100px" className={styles.agendaPhoto} />
      <div className={styles.agendaSpeakerCopy}>
        <span>Спикер</span>
        <p className={styles.agendaSpeakerName}>{panfilov ? "Максим Панфилов" : "Максим Гончаренко"}</p>
        <p>{panfilov ? "Практик в области ИИ и разработки AI-решений" : <>Предприниматель и бизнес-спикер,<br />эксперт по GEO-оптимизации</>}</p>
      </div>
    </div>
  );
}

export function ScheduleSection({ initialProgramSpeakers }: { initialProgramSpeakers: ProgramSpeaker[] }) {
  const [programSpeakers, setProgramSpeakers] = useState(initialProgramSpeakers);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/program-speakers", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const result = await response.json();
        if (Array.isArray(result.speakers)) setProgramSpeakers(result.speakers);
      } catch {
        // Preserve the rendered photos while the connection is interrupted.
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
  return (
    <section id="schedule" className={styles.schedule} aria-labelledby="schedule-heading">
      <h2 id="schedule-heading" className={styles.heading}>Как пройдет день</h2>
      <div className={styles.dateTime}><span>20 ноября</span><span>с 11:00 до 16:30</span></div>
      <ol className={styles.agenda}>
        {agenda.map((event) => (
          <li key={event.time} className={`${styles.agendaRow} ${event.twoLines ? styles.twoLines : ""} ${event.parallel ? styles.parallelRow : ""} ${event.speaker ? styles.speakerRow : ""}`}>
            <div className={styles.timeColumn}>
              <span className={styles.time}>{event.time}</span>
              {event.parallel && <span className={styles.parallelPill}>Параллельно</span>}
            </div>
            <div className={styles.eventContent}>
              <h3 className={`${styles.eventTitle} ${event.wide ? styles.wideTitle : ""}`}>{event.title}</h3>
              {event.parallel && <>
                <p className={styles.eventDescription}>Создание агентов для задач</p>
                <h3 className={`${styles.eventTitle} ${styles.parallelTitle}`}>«Не просто говорить, а внедрять: AI внутри бизнес-процессов»</h3>
                <AgendaSpeaker panfilov photo={programSpeakers.find((speaker) => speaker.id === "panfilov")?.photo} />
              </>}
              {event.speaker && <AgendaSpeaker photo={programSpeakers.find((speaker) => speaker.id === "goncharenko")?.photo} />}
            </div>
          </li>
        ))}
      </ol>
      <ol className={styles.mobileAgenda}>
        {mobileAgenda.map((event, index) => (
          <li key={event.time} className={styles.mobileAgendaRow} data-row={index + 1} style={{ "--mobile-row-height": `${event.height}px` } as CSSProperties}>
            <span className={styles.mobileTime}>{event.time}</span>
            <h3 className={styles.mobileEventTitle}>{event.title}</h3>
            {event.description && <p className={styles.mobileEventDescription}>{event.description}</p>}
            {event.speaker && <div className={`${styles.mobileAgendaSpeaker} ${event.speaker === "panfilov" ? styles.mobilePanfilov : ""}`}>
              <Image src={programSpeakers.find((speaker) => speaker.id === event.speaker)?.photo || `/assets/page/program-${event.speaker}.png`} width={80} height={80} alt="" sizes="80px" className={styles.mobileAgendaPhoto} />
              <div className={styles.mobileSpeakerCopy}>
                <span>Спикер</span>
                <p className={styles.mobileAgendaName}>{event.speaker === "panfilov" ? "Максим Панфилов" : "Максим Гончаренко"}</p>
                <p>{event.speaker === "panfilov" ? "Предприниматель, основатель panfilov.digital и panfilov.consulting" : "Предприниматель, маркетолог, аналитик. За 17 лет с нуля запустил 40+ проектов"}</p>
              </div>
            </div>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function subscribeToMotionPreference(update: () => void) {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  preference.addEventListener("change", update);
  return () => preference.removeEventListener("change", update);
}
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const serverMotionPreference = () => true;

function subscribeToMobileLayout(update: () => void) {
  const query = window.matchMedia("(max-width: 767px)");
  query.addEventListener("change", update);
  return () => query.removeEventListener("change", update);
}
const isMobileLayout = () => window.matchMedia("(max-width: 767px)").matches;
const serverMobileLayout = () => false;

export function SpeakersSection({ initialSpeakers }: { initialSpeakers: Speaker[] }) {
  const [speakers, setSpeakers] = useState(initialSpeakers);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/speakers", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const result = await response.json();
        if (Array.isArray(result.speakers)) setSpeakers(result.speakers);
      } catch {
        // Keep the last rendered program when the connection is interrupted.
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

  if (!speakers.length) return null;
  return <div className="festival-speakers"><SpeakersCarousel key={JSON.stringify(speakers)} speakers={speakers} /></div>;
}

function SpeakersCarousel({ speakers }: { speakers: Speaker[] }) {
  const count = speakers.length;
  const carouselSpeakers = ["before", "original", "after"].flatMap((copy) => speakers.map((speaker) => ({ ...speaker, copy })));
  const [position, setPosition] = useState(0);
  const [moving, setMoving] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [visible, setVisible] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const section = useRef<HTMLElement>(null);
  const gallery = useRef<HTMLDivElement>(null);
  const interactingRef = useRef(false);
  const movingRef = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const reducedMotion = useSyncExternalStore(subscribeToMotionPreference, prefersReducedMotion, serverMotionPreference);
  const mobile = useSyncExternalStore(subscribeToMobileLayout, isMobileLayout, serverMobileLayout);

  const move = useCallback((direction: number) => {
    if (count < 2) return;
    if (mobile && gallery.current) {
      const viewport = gallery.current;
      const track = viewport.firstElementChild as HTMLElement;
      const step = (track.firstElementChild as HTMLElement).offsetWidth + parseFloat(getComputedStyle(track).columnGap);
      viewport.scrollTo({ left: (Math.round(viewport.scrollLeft / step) + direction) * step, behavior: reducedMotion ? "instant" : "smooth" });
      return;
    }
    if (movingRef.current) return;
    if (reducedMotion) {
      setPosition((current) => ((current + direction) % count + count) % count);
      return;
    }
    movingRef.current = true;
    setMoving(true);
    setPosition((current) => ((current % count + count) % count) + direction);
  }, [reducedMotion, count, mobile]);

  const finishMove = useCallback(() => {
    setMoving(false);
    setPosition((current) => (current % count + count) % count);
    movingRef.current = false;
  }, [count]);

  useEffect(() => {
    const viewport = gallery.current;
    if (!viewport) return;
    if (!mobile) {
      viewport.scrollLeft = 0;
      return;
    }
    const track = viewport.firstElementChild as HTMLElement;
    const step = (track.firstElementChild as HTMLElement).offsetWidth + parseFloat(getComputedStyle(track).columnGap);
    const span = count * step;
    viewport.scrollLeft = span;
    let settleTimer: ReturnType<typeof setTimeout>;
    const normalize = () => {
      if (interactingRef.current) return;
      const left = viewport.scrollLeft;
      // Return to the identical middle copy only after native momentum and snapping settle.
      if (left < span || left >= span * 2) {
        viewport.scrollTo({ left: ((left - span) % span + span) % span + span, behavior: "instant" });
      }
    };
    const onScroll = () => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(normalize, 220);
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    viewport.addEventListener("scrollend", normalize);
    viewport.addEventListener("pointerup", onScroll);
    viewport.addEventListener("pointercancel", onScroll);
    viewport.addEventListener("touchend", onScroll, { passive: true });
    viewport.addEventListener("touchcancel", onScroll, { passive: true });
    return () => {
      clearTimeout(settleTimer);
      viewport.removeEventListener("scroll", onScroll);
      viewport.removeEventListener("scrollend", normalize);
      viewport.removeEventListener("pointerup", onScroll);
      viewport.removeEventListener("pointercancel", onScroll);
      viewport.removeEventListener("touchend", onScroll);
      viewport.removeEventListener("touchcancel", onScroll);
    };
  }, [mobile, count]);

  useEffect(() => {
    const updateVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    const element = section.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.1), { threshold: 0.1 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (count < 2 || reducedMotion || hovered || focused || interacting || hidden || !visible || document.hidden) return;
    const timer = window.setInterval(() => move(1), 5000);
    return () => window.clearInterval(timer);
  }, [count, reducedMotion, hovered, focused, interacting, hidden, visible, move]);

  // Also release the transition lock if a resize or preference change interrupts it.
  useEffect(() => {
    if (!moving) return;
    const timer = window.setTimeout(finishMove, reducedMotion ? 0 : 700);
    return () => window.clearTimeout(timer);
  }, [moving, reducedMotion, finishMove]);

  return (
    <section
      id="speakers"
      ref={section}
      className={styles.speakers}
      aria-labelledby="speakers-heading"
      aria-roledescription="карусель"
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={(event) => { if (event.pointerType === "mouse") setHovered(false); }}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <h2 id="speakers-heading" className={`${styles.heading} ${styles.speakersHeading}`}>Кто будет на сцене</h2>
      <div
        ref={gallery}
        className={`${styles.speakerGallery} ${count === 1 ? styles.singleSpeaker : ""}`}
        tabIndex={mobile && count > 1 ? 0 : undefined}
        onTouchStart={() => {
          if (!mobile) return;
          interactingRef.current = true;
          setInteracting(true);
        }}
        onTouchEnd={() => {
          interactingRef.current = false;
          setInteracting(false);
        }}
        onTouchCancel={() => {
          interactingRef.current = false;
          setInteracting(false);
        }}
        onPointerDown={(event) => {
          if (mobile) {
            interactingRef.current = true;
            setInteracting(true);
            return;
          }
          if (event.pointerType !== "mouse") {
            touchStart.current = { x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }
        }}
        onPointerUp={(event) => {
          if (mobile) {
            interactingRef.current = false;
            setInteracting(false);
            return;
          }
          const start = touchStart.current;
          touchStart.current = null;
          if (!start) return;
          const distance = event.clientX - start.x;
          if (Math.abs(distance) > 35 && Math.abs(distance) > Math.abs(event.clientY - start.y)) move(distance < 0 ? 1 : -1);
        }}
        onPointerCancel={() => {
          touchStart.current = null;
          if (!mobile) {
            interactingRef.current = false;
            setInteracting(false);
          }
        }}
      >
        <div
          className={`${styles.speakerTrack} ${moving ? styles.moving : ""}`}
          style={{ "--speaker-position": count + (moving ? position : (position % count + count) % count) } as CSSProperties}
          onTransitionEnd={(event) => {
            if (event.target === event.currentTarget && event.propertyName === "transform") finishMove();
          }}
        >
          {carouselSpeakers.map((speaker) => (
            <article key={`${speaker.copy}-${speaker.id}`} className={styles.speakerCard} aria-hidden={speaker.copy !== "original" ? true : undefined}>
              <div className={`${styles.speakerPortrait} ${styles[speaker.color]}`}>
                {speaker.photo ? (
                  <Image src={speaker.photo} alt={speaker.name} fill unoptimized className={styles.speakerPhoto} sizes="(max-width: 767px) 270px, 30vw" draggable={false} />
                ) : (
                  <Image src={`/assets/page/program-speaker-${speaker.art}.svg`} alt="" width={301} height={305} className={styles.speakerArt} draggable={false} />
                )}
              </div>
              <div className={styles.speakerInfo}>
                <h3 className={styles.speakerName}>{speaker.name}</h3>
                {speaker.job && <p className={styles.speakerJob}>{speaker.job}</p>}
                {(speaker.topic || speaker.time) && <div className={styles.speakerTalk}>
                  {speaker.topic && <p>{speaker.topic}</p>}
                  {speaker.time && <span>{speaker.time}</span>}
                </div>}
              </div>
            </article>
          ))}
        </div>
      </div>
      {count > 1 && <>
        <ArrowButton direction="left" aria-label="Предыдущий спикер" className={`${styles.galleryArrow} ${styles.previous}`} onClick={() => move(-1)} />
        <ArrowButton aria-label="Следующий спикер" className={`${styles.galleryArrow} ${styles.next}`} onClick={() => move(1)} />
      </>}
    </section>
  );
}
