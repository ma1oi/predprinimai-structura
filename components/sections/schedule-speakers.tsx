"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { ArrowButton } from "../ui";
import type { Speaker } from "@/lib/speaker-types";
import { programAgenda as agenda } from "@/lib/program-agenda";
import type { ProgramSpeaker } from "@/lib/program-speaker-types";
import styles from "./schedule-speakers.module.css";



function speakerText(value: string) {
  const text = value.trim();
  return /^(?:имя(?:\s+фамилия|\s+спикера скоро объявим)?|должность)$/iu.test(text) ? "" : text;
}

function AgendaSpeaker({ speaker, mobile = false }: { speaker: ProgramSpeaker; mobile?: boolean }) {
  const name = speakerText(speaker.name);
  const job = speakerText(speaker.job);
  if (!name && !job && !speaker.photo) return null;
  return (
    <div className={mobile ? styles.mobileAgendaSpeaker : styles.agendaSpeaker}>
      {speaker.photo && <Image src={speaker.photo} width={mobile ? 80 : 100} height={mobile ? 80 : 100} alt={name ? `Фото: ${name}` : "Фото спикера"} sizes={mobile ? "80px" : "100px"} className={mobile ? styles.mobileAgendaPhoto : styles.agendaPhoto} unoptimized />}
      {(name || job) && <div className={mobile ? styles.mobileSpeakerCopy : styles.agendaSpeakerCopy}>
        <span>Спикер</span>
        {name && <p className={mobile ? styles.mobileAgendaName : styles.agendaSpeakerName}>{name}</p>}
        {job && <p>{job}</p>}
      </div>}
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
        // Preserve the rendered speakers while the connection is interrupted.
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
      <div className={styles.dateTime}><span>20 ноября</span><span>с 11:00 до {agenda[agenda.length - 1].time.split("-")[1]}</span></div>
      <ol className={styles.agenda}>
        {agenda.map((event) => {
          const speaker = programSpeakers.find((item) => item.id === event.id);
          return (
          <li key={event.id} className={`${styles.agendaRow} ${speaker && (speakerText(speaker.name) || speakerText(speaker.job) || speaker.photo) ? styles.speakerRow : ""}`}>
            <div className={styles.timeColumn}>
              <span className={styles.time}>{event.time}</span>
            </div>
            <div className={styles.eventContent}>
              <h3 className={styles.eventTitle}>{event.title}</h3>
              {event.description && <p className={styles.eventDescription}>{event.description}</p>}
              {speaker && <AgendaSpeaker speaker={speaker} />}
            </div>
          </li>
        ); })}
      </ol>
      <ol className={styles.mobileAgenda}>
        {agenda.map((event, index) => {
          const speaker = programSpeakers.find((item) => item.id === event.id);
          return (
          <li key={event.id} className={styles.mobileAgendaRow} data-row={index + 1} style={{ "--mobile-row-height": `${event.height}px` } as CSSProperties}>
            <span className={styles.mobileTime}>{event.time}</span>
            <h3 className={styles.mobileEventTitle}>{event.title}</h3>
            {event.description && <p className={styles.mobileEventDescription}>{event.description}</p>}
            {speaker && <AgendaSpeaker speaker={speaker} mobile />}
          </li>
        ); })}
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
          {carouselSpeakers.map((speaker) => {
            const name = speakerText(speaker.name);
            const job = speakerText(speaker.job);
            return (
            <article key={`${speaker.copy}-${speaker.id}`} className={styles.speakerCard} aria-hidden={speaker.copy !== "original" ? true : undefined}>
              <div className={`${styles.speakerPortrait} ${styles[speaker.color]}`}>
                {speaker.photo ? (
                  <Image src={speaker.photo} alt={name ? `Фото: ${name}` : "Фото спикера"} fill unoptimized className={styles.speakerPhoto} sizes="(max-width: 767px) 270px, 30vw" draggable={false} />
                ) : (
                  <Image src={`/assets/page/program-speaker-${speaker.art}.svg`} alt="" width={301} height={305} className={styles.speakerArt} draggable={false} />
                )}
              </div>
              <div className={styles.speakerInfo}>
                {name && <h3 className={styles.speakerName}>{name}</h3>}
                {job && <p className={styles.speakerJob}>{job}</p>}
                {(speaker.topic || speaker.time) && <div className={styles.speakerTalk}>
                  {speaker.topic && <p>{speaker.topic}</p>}
                  {speaker.time && <span>{speaker.time}</span>}
                </div>}
              </div>
            </article>
          ); })}
        </div>
      </div>
      {count > 1 && <>
        <ArrowButton direction="left" aria-label="Предыдущий спикер" className={`${styles.galleryArrow} ${styles.previous}`} onClick={() => move(-1)} />
        <ArrowButton aria-label="Следующий спикер" className={`${styles.galleryArrow} ${styles.next}`} onClick={() => move(1)} />
      </>}
    </section>
  );
}
