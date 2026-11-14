"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export type Slide = { src: string; alt: string };

type Props = {
  slides: Slide[];
  title: string;
  pdfHref: string;
};

export function SlideDeck({ slides, title, pdfHref }: Props) {
  const [open, setOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [index, setIndex] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const count = slides.length;

  const go = useCallback(
    (delta: number) => setIndex((i) => Math.min(count - 1, Math.max(0, i + delta))),
    [count],
  );

  const exitPresentation = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    setPresenting(false);
  }, []);

  const close = useCallback(() => {
    exitPresentation();
    setOpen(false);
    openerRef.current?.focus();
  }, [exitPresentation]);

  const present = useCallback(() => {
    setPresenting(true);
    const el = panelRef.current;
    if (el?.requestFullscreen) void el.requestFullscreen().catch(() => undefined);
  }, []);

  // Keyboard: arrows move, Enter presents, Esc exits presentation then closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          e.preventDefault();
          go(1);
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          go(-1);
          break;
        case "Home":
          setIndex(0);
          break;
        case "End":
          setIndex(count - 1);
          break;
        case "Enter":
          if (!presenting) {
            e.preventDefault();
            present();
          }
          break;
        case "Escape":
          e.preventDefault();
          if (presenting) exitPresentation();
          else close();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, presenting, go, present, exitPresentation, close, count]);

  // Leaving browser fullscreen (Esc, system gesture) drops back to the popup.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Lock page scroll and move focus into the dialog while it is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Warm the cache for the neighbouring slides.
  useEffect(() => {
    if (!open) return;
    [index + 1, index - 1].forEach((i) => {
      const s = slides[i];
      if (s) new window.Image().src = s.src;
    });
  }, [open, index, slides]);

  const current = slides[index];

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        className="deck-cover"
        onClick={() => {
          setIndex(0);
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-label={`Open ${title}, ${count} slides`}
      >
        <Image src={slides[0].src} alt="" width={1920} height={1080} sizes="(max-width: 640px) 88vw, 60vw" />
        <span className="deck-cover-label">
          <span>Open the deck</span>
          <span>{count} slides</span>
        </span>
      </button>
      <p className="deck-links">
        <a className="text-link" href={pdfHref} download>
          Download PDF <span aria-hidden="true">↓</span>
        </a>
      </p>

      {open && (
        <div
          className={`deck-overlay${presenting ? " is-presenting" : ""}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={panelRef}
            className="deck-panel"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
          >
            <div
              className="deck-stage"
              onClick={() => {
                if (presenting) go(1);
              }}
            >
              <Image
                key={current.src}
                src={current.src}
                alt={current.alt}
                width={1920}
                height={1080}
                priority
                sizes={presenting ? "100vw" : "(max-width: 640px) 94vw, 1100px"}
              />
            </div>
            <div className="deck-controls">
              <div className="deck-nav">
                <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous slide">←</button>
                <span className="deck-counter" aria-live="polite">
                  {index + 1} / {count}
                </span>
                <button type="button" onClick={() => go(1)} disabled={index === count - 1} aria-label="Next slide">→</button>
              </div>
              <div className="deck-actions">
                {presenting ? (
                  <button type="button" onClick={exitPresentation}>Exit <kbd>Esc</kbd></button>
                ) : (
                  <>
                    <button type="button" onClick={present}>Present <kbd>↵</kbd></button>
                    <button type="button" onClick={close} aria-label="Close deck">✕</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
