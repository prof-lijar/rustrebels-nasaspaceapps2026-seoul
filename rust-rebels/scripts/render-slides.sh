#!/usr/bin/env sh
# Renders the pitch deck PDF into JPEG slides for the website viewer.
# Requires poppler (brew install poppler). Run from the rust-rebels folder.
set -eu
PDF="${1:-../docs/RustRebels_SuperJar_Marswalk.pdf}"
OUT="public/slides"
rm -f "$OUT"/slide-*.jpg
pdftoppm -jpeg -jpegopt quality=88 -r 150 -scale-to-x 1920 -scale-to-y -1 "$PDF" "$OUT/slide"
# pdftoppm zero-pads page numbers based on page count; normalise to two digits.
for f in "$OUT"/slide-*.jpg; do
  n=$(basename "$f" .jpg | sed 's/slide-0*//')
  mv "$f" "$OUT/$(printf 'slide-%02d.jpg' "$n")"
done
cp "$PDF" public/deck/RustRebels_SuperJar_Marswalk.pdf
ls -la "$OUT"
