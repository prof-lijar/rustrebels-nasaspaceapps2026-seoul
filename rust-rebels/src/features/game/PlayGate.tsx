"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import "./play-gate.css";

/** Marswalk needs a keyboard, a mouse and a wide screen. Anything narrower, or touch only, gets the film instead. */
const SMALL_SCREEN = "(max-width: 899px), (hover: none) and (pointer: coarse)";
const VIDEO_ID = "uheFhKE7DDs";
const VIDEO_SRC = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&mute=1&playsinline=1&loop=1&playlist=${VIDEO_ID}&rel=0`;

// The game (three.js and the models) is only downloaded once we know the screen can run it.
const MarsGame = dynamic(() => import("./MarsGame").then((m) => m.MarsGame), {
  ssr: false,
  loading: () => <div className="pg-blank" />,
});

function subscribe(onChange: () => void) {
  const query = window.matchMedia(SMALL_SCREEN);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** `film`: open on the 30-second demo instead of the start screen (the /demo page). */
export function PlayGate({ film = false }: { film?: boolean }) {
  // null on the server and during hydration: the screen size is not known yet.
  const small = useSyncExternalStore<boolean | null>(subscribe, () => window.matchMedia(SMALL_SCREEN).matches, () => null);
  if (small === null) return <div className="pg-blank" />;
  return small ? <SmallScreen /> : <MarsGame film={film} />;
}

function SmallScreen() {
  const [copied, setCopied] = useState(false);

  const sendLink = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: "Marswalk", url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch { /* sharing was cancelled or blocked; the address bar still has the link */ }
  };

  return (
    <main className="pg">
      <header className="pg-top">
        <Link href="/" className="pg-mark">RUST<span>/</span>REBELS</Link>
        <span className="pg-tag">Marswalk</span>
      </header>

      <div className="pg-video">
        <iframe
          src={VIDEO_SRC}
          title="Rust Rebels at NASA Space Apps Challenge 2026 Seoul"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <p className="pg-video-note">Playing muted. Tap the video for sound.</p>

      <section className="pg-card" role="status">
        <p className="pg-eyebrow"><i aria-hidden="true" />Desktop mission only</p>
        <h1>Mars needs a <span>bigger screen</span>.</h1>
        <p className="pg-copy">
          Marswalk is a full 3D walk across Jezero crater, flown with a keyboard and a mouse.
          It is not available on phones yet. Open this page on a laptop or desktop to suit up, drive the rover and fly SuperJar.
        </p>
        <ul className="pg-needs">
          <li><b>01</b>Laptop or desktop</li>
          <li><b>02</b>Keyboard and mouse</li>
          <li><b>03</b>Window 900 px or wider</li>
        </ul>
        <div className="pg-actions">
          <button type="button" className="pg-primary" onClick={sendLink}>
            {copied ? "Link copied" : "Send the link to my computer"}<span aria-hidden="true">→</span>
          </button>
          <Link href="/#marswalk" className="pg-secondary">See the app screen by screen</Link>
        </div>
      </section>
    </main>
  );
}
