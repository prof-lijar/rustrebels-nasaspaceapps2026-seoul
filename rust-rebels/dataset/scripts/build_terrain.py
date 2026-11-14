"""Turn the raw terrain downloads into browser-ready files.

Inputs  (dataset/raw/terrain): HiRISE DTM + ortho windows (.npy), CTX DTM + ortho (.tif)
Outputs (public/dataset/terrain):
    height_2048.u16 / height_1024.u16   little-endian uint16 heightmaps (2 m and 4 m per pixel)
    ortho_4096.jpg / ortho_2048.jpg      HiRISE greyscale image (1 m and 2 m per pixel)
    slope_1024.png                       slope in degrees, 0-90 mapped to 0-255
    skyview_1024.png                     fraction of sky visible, 0-1 mapped to 0-255
    context_ctx_2048.jpg                 20 km CTX image around the site, for the minimap
    context_height_512.u16               20 km CTX heightmap (40 m per pixel)
    terrain.json                         georeferencing, value ranges, sources

Row 0 of every raster is the NORTH edge; column 0 is the WEST edge.

Run from rust-rebels/:
    uv run --with rasterio --with numpy --with pillow python dataset/scripts/build_terrain.py
"""
from __future__ import annotations

import json

import numpy as np
import rasterio
from PIL import Image
from rasterio.windows import from_bounds

from site_config import MARS_R, PUBLIC, RAW, SITE, xy_to_lonlat

SRC = RAW / "terrain"
OUT = PUBLIC / "terrain"
OUT.mkdir(parents=True, exist_ok=True)
Image.MAX_IMAGE_PIXELS = None

CONTEXT_M = 20480.0  # side of the CTX context square


def block_mean(a: np.ndarray, k: int) -> np.ndarray:
    h, w = a.shape
    return a.reshape(h // k, k, w // k, k).mean(axis=(1, 3))


def fill_nodata(a: np.ndarray, bad: np.ndarray) -> np.ndarray:
    if not bad.any():
        return a
    from scipy import ndimage
    idx = ndimage.distance_transform_edt(bad, return_distances=False, return_indices=True)
    return a[tuple(idx)]


def to_u16(a: np.ndarray, lo: float, hi: float) -> np.ndarray:
    return np.round((a - lo) / (hi - lo) * 65535).clip(0, 65535).astype("<u2")


def sky_view(h: np.ndarray, res: float, n_dir: int = 16, reach_m: float = 600.0) -> np.ndarray:
    """Sky-view factor: 1 = open plain, lower = terrain blocks part of the sky."""
    n = h.shape[0]
    pad = int(reach_m / res)
    hp = np.pad(h, pad, mode="edge")
    dists = np.unique(np.round(np.geomspace(1, pad, 28)).astype(int))
    svf = np.zeros_like(h, dtype=np.float32)
    for k in range(n_dir):
        az = 2 * np.pi * k / n_dir
        max_tan = np.zeros_like(h, dtype=np.float32)
        for d in dists:
            dx, dy = int(round(np.sin(az) * d)), int(round(-np.cos(az) * d))
            shifted = hp[pad + dy:pad + dy + n, pad + dx:pad + dx + n]
            max_tan = np.maximum(max_tan, (shifted - h) / (np.hypot(dx, dy) * res))
        svf += np.cos(np.arctan(max_tan)) ** 2
    return svf / n_dir


def main() -> None:
    meta_dtm = json.loads((SRC / "hirise_dtm_window.json").read_text())
    dtm = np.load(SRC / "hirise_dtm_window.npy").astype(np.float32)
    bad = ~np.isfinite(dtm) | (dtm < -1e30)
    print(f"DTM nodata: {bad.mean():.4%}")
    dtm = fill_nodata(dtm, bad)

    h2 = block_mean(dtm, 2)   # 2048, 2 m
    h4 = block_mean(dtm, 4)   # 1024, 4 m
    lo, hi = float(np.floor(dtm.min())), float(np.ceil(dtm.max()))
    to_u16(h2, lo, hi).tofile(OUT / "height_2048.u16")
    to_u16(h4, lo, hi).tofile(OUT / "height_1024.u16")

    gy, gx = np.gradient(h4, 4.0)
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    Image.fromarray(np.round(slope / 90 * 255).clip(0, 255).astype(np.uint8)).save(OUT / "slope_1024.png", optimize=True)

    svf = sky_view(h4, 4.0)
    Image.fromarray(np.round(svf * 255).clip(0, 255).astype(np.uint8)).save(OUT / "skyview_1024.png", optimize=True)

    ortho = np.load(SRC / "hirise_ortho_window.npy", mmap_mode="r")
    o4 = np.empty((4096, 4096), dtype=np.float32)
    for i in range(0, 4096, 256):  # in bands, to keep memory low
        o4[i:i + 256] = block_mean(np.asarray(ortho[i * 4:(i + 256) * 4], dtype=np.float32), 4)
    ortho_nodata = float((np.asarray(ortho[::16, ::16]) == 0).mean())
    p1, p99 = np.percentile(o4[o4 > 0], [0.5, 99.5])
    o8 = ((o4 - p1) / (p99 - p1) * 255).clip(0, 255).astype(np.uint8)
    img = Image.fromarray(o8)
    img.save(OUT / "ortho_4096.jpg", quality=82, optimize=True, progressive=True)
    img.resize((2048, 2048), Image.LANCZOS).save(OUT / "ortho_2048.jpg", quality=84, optimize=True, progressive=True)

    # Context: 20 km square centred on the site, from the CTX mosaics.
    cx, cy = (SITE["x_min"] + SITE["x_max"]) / 2, (SITE["y_min"] + SITE["y_max"]) / 2
    half = CONTEXT_M / 2
    ctx_bounds = (cx - half, cy - half, cx + half, cy + half)
    with rasterio.open(SRC / "JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0.tif") as d:
        c = d.read(1, window=from_bounds(*ctx_bounds, d.transform), out_shape=(2048, 2048),
                   boundless=True, fill_value=0, resampling=rasterio.enums.Resampling.average)
    v = c[c > 0]
    c1, c99 = np.percentile(v, [0.5, 99.5])
    c8 = ((c.astype(np.float32) - c1) / (c99 - c1) * 255).clip(0, 255).astype(np.uint8)
    Image.fromarray(c8).save(OUT / "context_ctx_2048.jpg", quality=82, optimize=True, progressive=True)
    with rasterio.open(SRC / "JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif") as d:
        ch = d.read(1, window=from_bounds(*ctx_bounds, d.transform), out_shape=(512, 512),
                    boundless=True, fill_value=np.nan, resampling=rasterio.enums.Resampling.average).astype(np.float32)
        if d.nodata is not None:
            ch[ch == d.nodata] = np.nan
    cbad = ~np.isfinite(ch) | (ch < -1e30)
    ctx_nodata = float(cbad.mean())
    ch = fill_nodata(ch, cbad)
    clo, chi = float(np.floor(ch.min())), float(np.ceil(ch.max()))
    to_u16(ch, clo, chi).tofile(OUT / "context_height_512.u16")

    lon0, lat0 = xy_to_lonlat(SITE["x_min"], SITE["y_min"])
    lon1, lat1 = xy_to_lonlat(SITE["x_max"], SITE["y_max"])
    info = {
        "site": SITE["name"],
        "projection": {"type": "equirectangular", "lat_ts": 0, "lon_0": 0, "sphere_radius_m": MARS_R,
                       "note": "x = R*radians(lon_east), y = R*radians(lat_north)"},
        "bounds_xy_m": {k: SITE[k] for k in ("x_min", "y_min", "x_max", "y_max")},
        "bounds_lonlat": {"west": lon0, "south": lat0, "east": lon1, "north": lat1},
        "size_m": SITE["size_m"],
        "local_frame": "origin at site centre; +x east, +z south in three.js (row 0 = north edge), y up",
        "elevation": {"min_m": lo, "max_m": hi, "datum": "MOLA areoid",
                      "encoding": "uint16 little-endian; metres = min + value/65535*(max-min)"},
        "layers": {
            "height_2048.u16": {"px": 2048, "m_per_px": 2},
            "height_1024.u16": {"px": 1024, "m_per_px": 4},
            "ortho_4096.jpg": {"px": 4096, "m_per_px": 1, "note": "greyscale, contrast-stretched 0.5-99.5 percentile"},
            "ortho_2048.jpg": {"px": 2048, "m_per_px": 2},
            "slope_1024.png": {"px": 1024, "m_per_px": 4, "encoding": "degrees = value/255*90",
                               "stats": {"mean_deg": float(slope.mean()), "p95_deg": float(np.percentile(slope, 95)),
                                         "share_over_25deg": float((slope > 25).mean())}},
            "skyview_1024.png": {"px": 1024, "m_per_px": 4, "encoding": "sky fraction = value/255",
                                 "stats": {"min": float(svf.min()), "mean": float(svf.mean())},
                                 "note": "derived by us from the DTM: 16 azimuths, 600 m horizon search"},
        },
        "context": {
            "size_m": CONTEXT_M, "bounds_xy_m": dict(zip(("x_min", "y_min", "x_max", "y_max"), ctx_bounds)),
            "context_ctx_2048.jpg": {"px": 2048, "m_per_px": CONTEXT_M / 2048},
            "context_height_512.u16": {"px": 512, "m_per_px": CONTEXT_M / 512, "min_m": clo, "max_m": chi,
                                       "nodata_filled_share": ctx_nodata},
        },
        "quality": {"dtm_nodata_filled_share": float(bad.mean()), "ortho_nodata_share": ortho_nodata},
        "sources": {
            "hirise_dtm": meta_dtm["source"],
            "hirise_ortho": json.loads((SRC / "hirise_ortho_window.json").read_text())["source"],
            "ctx": "https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/",
            "credit": "NASA/JPL-Caltech/University of Arizona/MSSS/USGS Astrogeology Science Center "
                      "(Mars 2020 Terrain Relative Navigation mosaics, Fergason et al. 2020)",
        },
    }
    (OUT / "terrain.json").write_text(json.dumps(info, indent=2))
    print(json.dumps({"elev": [lo, hi], "slope": info["layers"]["slope_1024.png"]["stats"],
                      "svf": info["layers"]["skyview_1024.png"]["stats"], "quality": info["quality"],
                      "ctx_nodata": ctx_nodata}, indent=1))


if __name__ == "__main__":
    main()
