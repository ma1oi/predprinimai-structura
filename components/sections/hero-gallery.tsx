"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent } from "react";
import { Sticker } from "@/components/ui/sticker";
import { navigationItems, stickers } from "@/lib/kit-content";
import { useMotionActivity } from "@/lib/use-motion-activity";
import styles from "./hero-gallery.module.css";

const festivalDate = Date.parse("2026-11-20T00:00:00+03:00");
const getDaysRemaining = () => Math.max(0, Math.ceil((festivalDate - Date.now()) / 86_400_000));
const getServerDays = () => null;
function subscribeToClock(update: () => void) {
  const timer = window.setInterval(update, 60_000);
  return () => window.clearInterval(timer);
}

function dayLabel(days: number | null) {
  if (days === null) return "дней";
  if (days % 100 >= 11 && days % 100 <= 14) return "дней";
  if (days % 10 === 1) return "день";
  if (days % 10 >= 2 && days % 10 <= 4) return "дня";
  return "дней";
}

export function FestivalHeader() {
  const menu = useRef<HTMLDialogElement>(null);
  const phase = useRef("closed");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const unlockScroll = useRef<(() => void) | undefined>(undefined);
  const pendingLink = useRef<HTMLAnchorElement | null>(null);
  const [menuPhase, setMenuPhase] = useState("closed");
  const menuOpen = menuPhase !== "closed";

  const finishClose = useCallback(() => {
    clearTimeout(closeTimer.current);
    phase.current = "closed";
    if (menu.current?.open) menu.current.close();
    unlockScroll.current?.();
    unlockScroll.current = undefined;
    setMenuPhase("closed");
    window.dispatchEvent(new Event("festival-menu-change"));
    const link = pendingLink.current;
    pendingLink.current = null;
    // Replay navigation after the native modal and scroll lock are released.
    link?.click();
  }, []);

  const closeMenu = useCallback(() => {
    if (!menu.current?.open || phase.current === "closing") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishClose();
      return;
    }
    phase.current = "closing";
    setMenuPhase("closing");
    closeTimer.current = setTimeout(finishClose, 320);
  }, [finishClose]);

  function openMenu() {
    if (!menu.current || menu.current.open) return;
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    unlockScroll.current = () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
    };
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const nextPhase = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "open" : "opening";
    phase.current = nextPhase;
    setMenuPhase(nextPhase);
    menu.current.showModal();
    window.dispatchEvent(new Event("festival-menu-change"));
  }

  function navigateFromMenu(event: MouseEvent<HTMLAnchorElement>) {
    if (!menu.current?.open) return;
    event.preventDefault();
    pendingLink.current = event.currentTarget;
    closeMenu();
  }

  useEffect(() => {
    const dialog = menu.current;
    const desktop = window.matchMedia("(min-width: 768px)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const closeOnDesktop = () => { if (desktop.matches) finishClose(); };
    const finishReducedClose = () => {
      if (reducedMotion.matches && phase.current === "closing") finishClose();
      else if (reducedMotion.matches && phase.current === "opening") {
        phase.current = "open";
        setMenuPhase("open");
      }
    };
    desktop.addEventListener("change", closeOnDesktop);
    reducedMotion.addEventListener("change", finishReducedClose);
    return () => {
      clearTimeout(closeTimer.current);
      pendingLink.current = null;
      dialog?.close();
      unlockScroll.current?.();
      window.dispatchEvent(new Event("festival-menu-change"));
      desktop.removeEventListener("change", closeOnDesktop);
      reducedMotion.removeEventListener("change", finishReducedClose);
    };
  }, [finishClose]);

  return (
    <>
    <div className={styles.headerDock}>
      <header className={styles.header}>
        <a href="#home" aria-label="Предпринимай — главная" className={styles.logo}>
          <Image src="/assets/page/top-header-left.svg" width={243} height={75} alt="" className={styles.headerPlate} />
          <Image src="/assets/page/top-logo.svg" width={196} height={40} alt="Фестиваль «Предпринимай»" className={styles.logoImage} />
          <Image src="/assets/mobile/header-logo.svg" width={138} height={29} alt="" className={styles.mobileLogo} />
        </a>
        <nav className={styles.navigation} aria-label="Основная навигация">
          {navigationItems.map((item) => <a key={item.id} href={`#${item.id}`}>{item.label}</a>)}
        </nav>
        <a href="#registration" className={styles.headerCta}>
          <Image src="/assets/page/top-header-right.svg" width={146} height={75} alt="" className={styles.headerPlate} />
          <span>я иду!</span>
        </a>
        <button
          type="button"
          className={styles.burger}
          aria-label="Открыть меню"
          aria-haspopup="dialog"
          aria-controls="mobile-menu"
          aria-expanded={menuOpen}
          onClick={openMenu}
        >
          <Image src="/assets/mobile/burger.svg" width={24} height={16} alt="" />
        </button>
      </header>
    </div>
    <dialog
      id="mobile-menu"
      ref={menu}
      className={styles.mobileMenu}
      aria-label="Меню фестиваля"
      data-phase={menuPhase}
      data-lenis-prevent
      onCancel={(event) => { event.preventDefault(); closeMenu(); }}
      onClose={() => { if (!menu.current?.open) finishClose(); }}
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget || event.nativeEvent.pseudoElement) return;
        if (phase.current === "closing") finishClose();
        else if (phase.current === "opening") {
          phase.current = "open";
          setMenuPhase("open");
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeMenu();
      }}
    >
      <a href="#home" className={styles.menuLogo} aria-label="Предпринимай — главная" onClick={navigateFromMenu}>
        <Image src="/assets/mobile/header-logo.svg" width={138} height={29} alt="Фестиваль «Предпринимай»" />
      </a>
      <button type="button" className={styles.closeMenu} aria-label="Закрыть меню" onClick={closeMenu} autoFocus>
        <Image src="/assets/mobile/close.svg" width={33} height={33} alt="" />
      </button>
      <nav className={styles.mobileNavigation} aria-label="Мобильная навигация">
        {navigationItems.map((item) => <a key={item.id} href={`#${item.id}`} onClick={navigateFromMenu}>{item.label}</a>)}
      </nav>
      <a href="#registration" onClick={navigateFromMenu} className={`kit-button kit-button-pink flex items-center justify-center ${styles.menuCta}`}>
        <span>я иду</span>
        <Image src="/assets/figma/arrow.svg" width={43} height={43} className="kit-button-icon kit-button-icon-arrow" alt="" />
      </a>
    </dialog>
    </>
  );
}

const firstStickers = [0, 1, 3, 4];

function HeroStickers() {
  const region = useRef<HTMLDivElement>(null);
  const { active, reduced } = useMotionActivity(region);
  const [phase, setPhase] = useState(-1);

  useEffect(() => {
    if (!active) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const delay = setTimeout(() => {
      setPhase((current) => current + 1);
      interval = setInterval(() => setPhase((current) => current + 1), 2800);
    }, 2500);
    return () => { clearTimeout(delay); clearInterval(interval); };
  }, [active]);

  return (
    <div ref={region} className={styles.stickers} aria-hidden="true" data-running={active}>
      {(reduced || phase >= 0) && firstStickers.map((start, slot) => {
        const sticker = stickers[(start + Math.max(0, phase)) % stickers.length];
        return (
          <div className={`${styles.stickerSlot} ${styles[`stickerSlot${slot}`]}`} key={slot}>
            <Sticker key={`${phase}-${slot}`} width={sticker.width} className={styles.heroSticker}>{sticker.text}</Sticker>
          </div>
        );
      })}
    </div>
  );
}

export function HeroSection() {
  return (
    <section id="home" className={styles.hero} aria-labelledby="festival-title">
      <picture className={styles.heroPicture}>
        <source media="(max-width: 767px)" srcSet="/assets/mobile/hero.webp" />
        <source media="(max-width: 900px)" srcSet="/assets/figma/hero-mobile.webp" />
        <Image src="/assets/page/hero-desktop.webp" fill priority unoptimized sizes="100vw" alt="Друзья на фестивале «Предпринимай»" className={styles.heroImage} />
      </picture>
      <div className={styles.heroShade} aria-hidden="true" />
      <div className={styles.heroTitle}>
        <p>фестиваль молодых предпринимателей</p>
        <h1 id="festival-title">предпринимай</h1>
      </div>
      <div className={styles.festivalInfo}>
        <time dateTime="2026-11-20">20 ноября</time>
        <span>участие бесплатное</span>
        <span>ярославль</span>
      </div>
      <p className={styles.heroDescription}>Один день, чтобы услышать тех, кто уже вырос и познакомиться<br className={styles.desktopBreak} /> с теми, кто растет рядом</p>
      <a href="#registration" className={`kit-button kit-button-pink flex items-center justify-center ${styles.heroCta}`}>
        <span>я иду</span>
        <Image src="/assets/figma/arrow.svg" width={43} height={43} className="kit-button-icon kit-button-icon-arrow" alt="" aria-hidden="true" />
      </a>
      <p className={styles.registrationNote}>Регистрация открыта до 20 ноября включительно</p>
      <HeroStickers />
    </section>
  );
}

export function CountdownSection() {
  const days = useSyncExternalStore(subscribeToClock, getDaysRemaining, getServerDays);
  return (
    <section className={styles.countdown} aria-label="Обратный отсчет до фестиваля">
      <p>до фестиваля осталось</p>
      <Image src="/assets/page/top-countdown-star.webp" width={235} height={190} alt="" aria-hidden="true" className={styles.countdownStar} />
      <Image src="/assets/mobile/countdown-star.webp" width={130} height={171} alt="" aria-hidden="true" className={styles.mobileCountdownStar} />
      <div className={styles.remaining} aria-live="polite" aria-atomic="true"><strong>{days ?? "—"}</strong><span>{dayLabel(days)}</span></div>
    </section>
  );
}

const photos = [
  { width: 240, height: 280, alt: "Участница фестиваля за столом" },
  { width: 240, height: 330, alt: "Участники слушают выступление в зале" },
  { width: 240, height: 280, alt: "Спикер с микрофоном на сцене" },
  { width: 240, height: 360, alt: "Знакомства и общение на фестивале" },
  { width: 240, height: 300, alt: "Участницы фестиваля в зрительном зале" },
  { width: 240, height: 280, alt: "Разговор участников фестиваля" },
];

export function HistorySection() {
  const track = useRef<HTMLDivElement>(null);
  const { active } = useMotionActivity(track);
  return (
    <section id="photos" className={styles.history} aria-labelledby="history-title">
      <h2 id="history-title">Как это было в прошлом году</h2>
      <div className={styles.gallery}>
        <div ref={track} className={styles.photoViewport} tabIndex={0} role="region" aria-label="Фотографии прошлого фестиваля" data-running={active}>
          <div className={styles.photoTrack}>
            {[0, 1].map((copy) => (
              <div key={copy} className={styles.photoGroup} aria-hidden={copy === 1 ? true : undefined}>
                {[0, 1].flatMap((repeat) => photos.map((photo, index) => (
                  <figure key={`${repeat}-${index}`} className={styles.photoItem} style={{ "--photo-width": photo.width, "--photo-mobile-order": [5, 0, 4, 1, 3, 2][index] + repeat * 6 } as CSSProperties} aria-hidden={repeat === 1 ? true : undefined}>
                    <Image src={`/assets/page/top-photo-${index + 1}.webp`} width={photo.width} height={photo.height} alt={copy === 0 && repeat === 0 ? photo.alt : ""} sizes="(max-width: 767px) 135px, 17vw" className={styles.photo} />
                    {index === 1 && <Image src="/assets/page/top-eyes.webp" width={177} height={149} alt="" aria-hidden="true" className={`${styles.eyes} ${styles.desktopDecoration}`} />}
                    {index === 4 && <Image src="/assets/page/top-peace.webp" width={225} height={226} alt="" aria-hidden="true" className={`${styles.peace} ${styles.desktopDecoration}`} />}
                    {index === 3 && <Image src="/assets/mobile/eyes.webp" width={50} height={44} alt="" className={`${styles.eyes} ${styles.mobileDecoration}`} />}
                    {index === 5 && <Image src="/assets/mobile/peace.webp" width={60} height={63} alt="" className={`${styles.peace} ${styles.mobileDecoration}`} />}
                  </figure>
                )))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
