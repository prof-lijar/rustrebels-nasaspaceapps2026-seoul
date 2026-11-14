"use client";

import Image from "next/image";
import { useCallback, useState } from "react";

export type TourSlide = { src: string; alt: string; title: string; brief: string };

/** Screens captured from the Marswalk app, shown one at a time with a short explanation under each. */
export function AppTour({ slides }: { slides: TourSlide[] }) {
  const [index, setIndex] = useState(0);
  const count = slides.length;
  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);
  const slide = slides[index];

  return (
    <div
      className="tour"
      role="group"
      aria-roledescription="slideshow"
      aria-label="Marswalk app tour"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      }}
    >
      <div className="tour-stage">
        {slides.map((s, i) => (
          <Image
            key={s.src}
            src={s.src}
            alt={i === index ? s.alt : ""}
            aria-hidden={i !== index}
            className={i === index ? "is-current" : ""}
            width={1280}
            height={720}
            sizes="(max-width: 900px) 90vw, 60vw"
            loading={i === 0 ? "eager" : "lazy"}
          />
        ))}
        <button type="button" className="tour-arrow tour-prev" onClick={() => go(-1)} aria-label="Previous screen">←</button>
        <button type="button" className="tour-arrow tour-next" onClick={() => go(1)} aria-label="Next screen">→</button>
      </div>
      <div className="tour-caption" aria-live="polite">
        <span className="tour-count">{String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}</span>
        <div>
          <strong>{slide.title}</strong>
          <p>{slide.brief}</p>
        </div>
      </div>
      <div className="tour-dots">
        {slides.map((s, i) => (
          <button key={s.src} type="button" className={i === index ? "is-current" : ""} onClick={() => setIndex(i)} aria-label={`Screen ${i + 1}: ${s.title}`} aria-current={i === index} />
        ))}
      </div>
    </div>
  );
}
