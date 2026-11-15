"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function SiteHeader({ children }: { children: ReactNode }) {
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    let previousY = Math.max(0, window.scrollY);
    let direction = 0;
    let distance = 0;

    const update = () => {
      // Clamp overscroll so bouncing at the bottom cannot reveal the header.
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const y = Math.min(maxY, Math.max(0, window.scrollY));
      const delta = y - previousY;
      const nextDirection = Math.sign(delta);
      header.dataset.scrolled = String(y > 24);

      if (y <= header.offsetHeight) {
        header.dataset.hidden = "false";
        distance = 0;
      } else if (nextDirection !== 0) {
        distance = nextDirection === direction ? distance + Math.abs(delta) : Math.abs(delta);
        direction = nextDirection;
        if (distance >= 8) header.dataset.hidden = String(direction > 0);
      }
      previousY = y;
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
    };
  }, []);

  return <header ref={headerRef} className="site-header">{children}</header>;
}
