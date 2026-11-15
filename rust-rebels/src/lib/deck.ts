import type { Slide } from "@/components/slide-deck";
import slide01 from "../../public/slides/slide-01.jpg";
import slide02 from "../../public/slides/slide-02.jpg";
import slide03 from "../../public/slides/slide-03.jpg";
import slide04 from "../../public/slides/slide-04.jpg";
import slide05 from "../../public/slides/slide-05.jpg";
import slide06 from "../../public/slides/slide-06.jpg";
import slide07 from "../../public/slides/slide-07.jpg";

// Static imports give each slide a content hash; version the PDF download too.
const deckVersion = "bf71e7c0790f";
const slideImages = [slide01, slide02, slide03, slide04, slide05, slide06, slide07];

export const deck = {
  title: "Rust Rebels: SuperJar Marswalk pitch deck",
  pdfHref: `/deck/RustRebels_SuperJar_Marswalk.pdf?v=${deckVersion}`,
  slides: slideImages.map((image, i): Slide => ({
    src: image.src,
    alt: `Slide ${i + 1} of 7 from the Rust Rebels SuperJar Marswalk pitch deck`,
  })),
};
