"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowButton, Button, FestivalBanner, HeroImage, Navigation, Partners, PhotoGallery, Sticker } from "@/components/ui";
import { stickers, type NavigationId } from "@/lib/kit-content";

export function KitShowcase() {
  const [defaultActive, setDefaultActive] = useState<NavigationId>();
  const [active, setActive] = useState<NavigationId>("home");
  const [prediction, setPrediction] = useState(-1);
  const [message, setMessage] = useState("");

  const showPrediction = () => {
    const next = (prediction + 1) % (stickers.length - 1);
    setPrediction(next);
    setMessage(stickers[next].text);
  };

  const movePhotos = (direction: number) => {
    const track = document.querySelector<HTMLElement>(".kit-photo-track");
    if (!track) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: direction * track.clientWidth * 0.7, behavior: reduced ? "instant" : "smooth" });
  };

  return (
    <main className="kit-board">
      <h1 className="sr-only">UI-кит фестиваля «Предпринимай»</h1>
      <div className="kit-canvas">
        <section className="kit-placement kit-stickers" aria-label="Текстовые плашки">
          {stickers.map((sticker) => <Sticker key={sticker.id} width={sticker.width}>{sticker.text}</Sticker>)}
        </section>

        <section className="kit-placement kit-arrow-samples" aria-label="Кнопки фотоленты">
          <ArrowButton direction="left" aria-label="Предыдущие фотографии" onClick={() => movePhotos(-1)} />
          <ArrowButton direction="right" aria-label="Следующие фотографии" onClick={() => movePhotos(1)} />
        </section>

        <div className="kit-placement kit-icon-samples" aria-hidden="true">
          <Image src="/assets/figma/arrow.svg" width={43} height={43} alt="" className="kit-icon-arrow" />
          <Image src="/assets/figma/refresh.svg" width={20} height={20} alt="" className="kit-icon-refresh" />
        </div>

        <section className="kit-placement kit-menus" aria-label="Варианты меню">
          <Navigation activeId={defaultActive} onNavigate={setDefaultActive} label="Меню: обычное состояние" />
          <Navigation activeId={active} onNavigate={setActive} label="Меню: выбранный пункт" />
        </section>

        <section className="kit-placement kit-cta-samples" aria-label="Кнопка «Я иду»: обычное состояние и наведение">
          <Button variant="pink" icon="arrow" onClick={() => setMessage("Нажата кнопка «Я иду»")}>я иду</Button>
          <Button variant="pink" icon="arrow" previewState="hover" onClick={() => setMessage("Нажата кнопка «Я иду»")}>я иду</Button>
        </section>

        <section className="kit-placement kit-prediction-samples" aria-label="Кнопка предсказания: обычное состояние и наведение">
          <Button onClick={showPrediction}>получить предсказание</Button>
          <Button previewState="hover" onClick={showPrediction}>получить предсказание</Button>
        </section>

        <section className="kit-placement kit-again-samples" aria-label="Повторное предсказание: обычное состояние и наведение">
          <Button icon="refresh" onClick={showPrediction}>еще одно предсказание</Button>
          <Button icon="refresh" previewState="hover" onClick={showPrediction}>еще одно предсказание</Button>
        </section>

        <section className="kit-placement kit-desktop-photo" aria-label="Фон первого экрана для компьютера"><HeroImage variant="desktop" /></section>
        <section className="kit-placement kit-mobile-photo" aria-label="Фон первого экрана для телефона"><HeroImage variant="mobile" /></section>
        <section className="kit-placement kit-banner-sample" aria-label="Баннер фестиваля"><FestivalBanner /></section>
        <section className="kit-placement kit-gallery-sample" aria-label="Фотолента"><PhotoGallery /></section>
        <section className="kit-placement kit-partners-sample" aria-label="Блок партнёров"><Partners /></section>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {message && (
          <div className="kit-demo-message">
            <span>{message}</span>
            <button type="button" className="kit-dismiss" onClick={() => setMessage("")} aria-label="Закрыть сообщение">закрыть</button>
          </div>
        )}
      </div>
    </main>
  );
}
