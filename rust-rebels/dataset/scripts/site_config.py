"""Shared constants for the dataset build scripts.

Demo site: a 4096 m square over the western floor of Jezero crater, covering
the Perseverance landing site (Octavia E. Butler Landing), Séítah and the
delta front. It contains every rover waypoint up to about sol 710.

Coordinates are in the projection the USGS Mars 2020 TRN mosaics use:
equirectangular, lat_ts = 0, lon_0 = 0, sphere R = 3396190 m. So
    x = R * radians(lon_east), y = R * radians(lat_north).
"""
from __future__ import annotations

import math
from pathlib import Path

MARS_R = 3396190.0

SITE = {
    "name": "Jezero crater: landing site to delta front",
    "x_min": 4587660.0,
    "y_min": 1091440.0,
    "x_max": 4591756.0,
    "y_max": 1095536.0,
    "size_m": 4096.0,
}

ROOT = Path(__file__).resolve().parents[2]  # rust-rebels/
RAW = ROOT / "dataset" / "raw"
PUBLIC = ROOT / "public" / "dataset"


def lonlat_to_xy(lon: float, lat: float) -> tuple[float, float]:
    return MARS_R * math.radians(lon), MARS_R * math.radians(lat)


def xy_to_lonlat(x: float, y: float) -> tuple[float, float]:
    return math.degrees(x / MARS_R), math.degrees(y / MARS_R)


def xy_to_local(x: float, y: float) -> tuple[float, float]:
    """Projected metres -> scene metres. Origin at the site centre, +east, +north."""
    cx = (SITE["x_min"] + SITE["x_max"]) / 2
    cy = (SITE["y_min"] + SITE["y_max"]) / 2
    return x - cx, y - cy


def in_site(x: float, y: float) -> bool:
    return SITE["x_min"] <= x <= SITE["x_max"] and SITE["y_min"] <= y <= SITE["y_max"]
