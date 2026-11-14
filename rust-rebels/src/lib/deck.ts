import type { Slide } from "@/components/slide-deck";

export const deck = {
  title: "Rust Rebels: Martian Map pitch deck",
  pdfHref: "/deck/RustRebels_MartianMap.pdf",
  slides: Array.from({ length: 8 }, (_, i): Slide => ({
    src: `/slides/slide-${String(i + 1).padStart(2, "0")}.jpg`,
    alt: `Slide ${i + 1} of 8 from the Rust Rebels Martian Map pitch deck`,
  })),
};
