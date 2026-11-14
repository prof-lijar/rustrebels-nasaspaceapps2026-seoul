"""Shrink the textures embedded in a .glb so the model is light enough for the web.

Geometry (including Draco-compressed data) is copied byte for byte. Only the
embedded images are resized and re-encoded, each in its own format (PNG, JPEG or WebP).

Run from rust-rebels/:
    python3 dataset/scripts/shrink_glb.py IN.glb OUT.glb [max_texture_px]
"""
from __future__ import annotations

import io
import json
import struct
import sys

from PIL import Image


def shrink(src: str, dst: str, max_px: int = 1024) -> None:
    data = open(src, "rb").read()
    magic, version, _ = struct.unpack("<4sII", data[:12])
    assert magic == b"glTF" and version == 2, "not a glTF 2 binary"
    jlen, jtype = struct.unpack("<II", data[12:20])
    assert jtype == 0x4E4F534A
    doc = json.loads(data[20:20 + jlen])
    blen, btype = struct.unpack("<II", data[20 + jlen:28 + jlen])
    assert btype == 0x004E4942
    blob = data[28 + jlen:28 + jlen + blen]

    image_views = {im["bufferView"]: im for im in doc.get("images", []) if "bufferView" in im}
    out = bytearray()
    for i, view in enumerate(doc["bufferViews"]):
        assert view.get("buffer", 0) == 0, "only single-buffer files are supported"
        start = view.get("byteOffset", 0)
        chunk = blob[start:start + view["byteLength"]]
        if i in image_views:
            im = Image.open(io.BytesIO(chunk))
            before = (im.size, len(chunk))
            if max(im.size) > max_px:
                im.thumbnail((max_px, max_px), Image.LANCZOS)
            buf = io.BytesIO()
            if image_views[i].get("mimeType") == "image/jpeg":
                im.convert("RGB").save(buf, "JPEG", quality=85, optimize=True)
            elif image_views[i].get("mimeType") == "image/webp":
                im.save(buf, "WEBP", quality=85, method=6)
            else:
                im.save(buf, "PNG", optimize=True)
            if buf.tell() < len(chunk):
                chunk = buf.getvalue()
            print(f"image {image_views[i].get('name', i)}: {before[0]} {before[1] / 1e6:.2f} MB -> {im.size} {len(chunk) / 1e6:.2f} MB")
        while len(out) % 4:
            out.append(0)
        view["byteOffset"] = len(out)
        view["byteLength"] = len(chunk)
        out += chunk
    while len(out) % 4:
        out.append(0)
    doc["buffers"][0]["byteLength"] = len(out)

    j = json.dumps(doc, separators=(",", ":")).encode()
    j += b" " * (-len(j) % 4)
    total = 12 + 8 + len(j) + 8 + len(out)
    with open(dst, "wb") as fh:
        fh.write(struct.pack("<4sII", b"glTF", 2, total))
        fh.write(struct.pack("<II", len(j), 0x4E4F534A) + j)
        fh.write(struct.pack("<II", len(out), 0x004E4942) + bytes(out))
    print(f"{len(data) / 1e6:.1f} MB -> {total / 1e6:.1f} MB")


if __name__ == "__main__":
    shrink(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 1024)
