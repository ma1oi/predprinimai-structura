"use client";

import Image from "next/image";
import { useRef } from "react";
import { festivalPhotos } from "@/lib/kit-content";
import { ArrowButton } from "./button";

export function PhotoGallery({ showControls = false }: { showControls?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (direction: number) => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.current?.scrollBy({ left: direction * track.current.clientWidth * 0.7, behavior: reducedMotion ? "instant" : "smooth" });
  };

  return (
    <div>
      <div className="kit-photo-track flex items-center" ref={track} tabIndex={0} role="region" aria-label="Фотографии фестиваля">
        {festivalPhotos.map((photo) => (
          <Image key={photo.src} src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} style={{ width: `calc(${photo.width} * var(--kit-unit))` }} className="kit-gallery-photo shrink-0" sizes="(max-width: 767px) 240px, 12vw" />
        ))}
      </div>
      {showControls && (
        <div className="kit-gallery-controls flex justify-center gap-3">
          <ArrowButton direction="left" aria-label="Предыдущие фотографии" onClick={() => scroll(-1)} />
          <ArrowButton direction="right" aria-label="Следующие фотографии" onClick={() => scroll(1)} />
        </div>
      )}
    </div>
  );
}
