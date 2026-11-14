"""Download only the demo-site window from the Mars 2020 TRN HiRISE mosaics.

The USGS files are uncompressed, one-row-per-strip GeoTIFFs (DTM 1.8 GB,
orthomosaic 7.4 GB). The rows we need are one contiguous byte range, so we
fetch that range with parallel HTTP range requests and keep the columns we
need as a .npy array in dataset/raw/terrain/.

Run from rust-rebels/:
    uv run --with rasterio --with numpy python dataset/scripts/fetch_hirise_window.py
"""
from __future__ import annotations

import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import rasterio

from site_config import SITE, RAW

BASE = "https://planetarymaps.usgs.gov/mosaic/mars2020_trn/HiRISE/"
FILES = {
    "dtm": "JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif",
    "ortho": "JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first.tif",
}
CHUNK = 64 * 1024 * 1024
OUT = RAW / "terrain"


def fetch_range(url: str, start: int, end: int, dest: Path) -> None:
    want = end - start + 1
    if dest.exists() and dest.stat().st_size == want:
        return
    subprocess.run(
        ["curl", "-sS", "-L", "--fail", "--retry", "5", "--cacert", "/etc/ssl/cert.pem",
         "-A", "Mozilla/5.0", "-r", f"{start}-{end}", "-o", str(dest), url],
        check=True,
    )
    if dest.stat().st_size != want:
        raise RuntimeError(f"{dest.name}: got {dest.stat().st_size} bytes, wanted {want}")


def fetch(kind: str) -> None:
    out = OUT / f"hirise_{kind}_window.npy"
    if out.exists():
        print(f"{out.name} exists, skipping")
        return
    url = BASE + FILES[kind]
    with rasterio.open("/vsicurl/" + url) as d:
        res = d.transform.a
        col0 = round((SITE["x_min"] - d.bounds.left) / res)
        row0 = round((d.bounds.top - SITE["y_max"]) / res)
        n = round(SITE["size_m"] / res)
        dtype = np.dtype(d.dtypes[0])
        width = d.width
        first = int(d.get_tag_item(f"BLOCK_OFFSET_0_{row0}", "TIFF", bidx=1))
        nxt = int(d.get_tag_item(f"BLOCK_OFFSET_0_{row0 + 1}", "TIFF", bidx=1))
        last = int(d.get_tag_item(f"BLOCK_OFFSET_0_{row0 + n - 1}", "TIFF", bidx=1))
        nodata = d.nodata
    row_bytes = width * dtype.itemsize
    if nxt - first != row_bytes or last - first != row_bytes * (n - 1):
        raise RuntimeError("strips are not contiguous; cannot use a single byte range")
    total = row_bytes * n
    print(f"{kind}: rows {row0}..{row0 + n - 1}, cols {col0}..{col0 + n - 1}, {total / 1e6:.0f} MB")

    parts_dir = OUT / f"_parts_{kind}"
    parts_dir.mkdir(parents=True, exist_ok=True)
    jobs = []
    for i, off in enumerate(range(0, total, CHUNK)):
        end = min(off + CHUNK, total) - 1
        jobs.append((url, first + off, first + end, parts_dir / f"{i:04d}.bin"))
    with ThreadPoolExecutor(8) as pool:
        list(pool.map(lambda j: fetch_range(*j), jobs))

    window = np.empty((n, n), dtype=dtype)
    buf = b"".join(p.read_bytes() for _, _, _, p in jobs) if total < 600e6 else None
    if buf is not None:
        window[:] = np.frombuffer(buf, dtype=dtype).reshape(n, width)[:, col0:col0 + n]
    else:
        row = 0
        carry = b""
        for _, _, _, p in jobs:
            data = carry + p.read_bytes()
            k = len(data) // row_bytes
            arr = np.frombuffer(data[: k * row_bytes], dtype=dtype).reshape(k, width)
            window[row:row + k] = arr[:, col0:col0 + n]
            row += k
            carry = data[k * row_bytes:]
        assert row == n, (row, n)
    np.save(out, window)
    (OUT / f"hirise_{kind}_window.json").write_text(json.dumps({
        "source": url, "row0": row0, "col0": col0, "size_px": n, "res_m": res,
        "dtype": str(dtype), "nodata": nodata, "site": SITE,
    }, indent=2))
    for _, _, _, p in jobs:
        p.unlink()
    parts_dir.rmdir()
    print(f"wrote {out} {window.shape} {window.dtype}")


if __name__ == "__main__":
    for kind in sys.argv[1:] or ["dtm", "ortho"]:
        fetch(kind)
