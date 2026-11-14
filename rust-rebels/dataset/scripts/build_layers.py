"""Build the small JSON layers the app loads next to the terrain.

Outputs (public/dataset/):
    traverse/rover.json        Perseverance waypoints + drive path inside the site
    traverse/helicopter.json   Ingenuity landing spots + flight legs inside the site
    shelters/shelters.json     most sky-shielded spots, derived from the HiRISE DTM
    weather/meda_sol_0120.json one sol of MEDA weather in 5-minute bins
    space-weather/donki_2017-09.json  DONKI events around the 10 Sep 2017 storm
    images/index.json (+ jpgs) Navcam frames with map positions

Positions use the local scene frame: metres from the site centre,
x = east, y = north, plus elevation h in metres (MOLA areoid).

Run from rust-rebels/ (after build_terrain.py):
    uv run --with numpy --with pillow --with scipy python dataset/scripts/build_layers.py
"""
from __future__ import annotations

import csv
import json
import shutil
import statistics
from collections import defaultdict

import numpy as np
from PIL import Image

from site_config import PUBLIC, RAW, SITE, in_site, lonlat_to_xy, xy_to_local, xy_to_lonlat

TERRAIN = json.loads((PUBLIC / "terrain" / "terrain.json").read_text())
H = np.fromfile(PUBLIC / "terrain" / "height_2048.u16", dtype="<u2").reshape(2048, 2048)
E_MIN, E_MAX = TERRAIN["elevation"]["min_m"], TERRAIN["elevation"]["max_m"]


def height_at(x: float, y: float) -> float:
    col = min(2047, max(0, int((x - SITE["x_min"]) / 2)))
    row = min(2047, max(0, int((SITE["y_max"] - y) / 2)))
    return round(E_MIN + H[row, col] / 65535 * (E_MAX - E_MIN), 2)


def local(lon: float, lat: float) -> dict | None:
    x, y = lonlat_to_xy(lon, lat)
    if not in_site(x, y):
        return None
    lx, ly = xy_to_local(x, y)
    return {"x": round(lx, 2), "y": round(ly, 2), "h": height_at(x, y)}


def write(rel: str, obj) -> None:
    p = PUBLIC / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, separators=(",", ":")))
    print(f"{rel}: {p.stat().st_size / 1024:.0f} kB")


def clip_lines(features) -> list[dict]:
    """Keep the parts of each LineString that fall inside the site."""
    out = []
    for f in features:
        g = f["geometry"]
        lines = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        for line in lines:
            run: list[list[float]] = []
            for c in line:
                p = local(c[0], c[1])
                if p:
                    run.append([p["x"], p["y"], p["h"]])
                elif len(run) > 1:
                    out.append({"props": f["properties"], "points": run})
                    run = []
                else:
                    run = []
            if len(run) > 1:
                out.append({"props": f["properties"], "points": run})
    return out


def rover() -> None:
    wps = json.loads((RAW / "traverse" / "M20_waypoints.json").read_text())["features"]
    pts = []
    for f in wps:
        p = f["properties"]
        loc = local(p["lon"], p["lat"])
        if loc:
            pts.append({**loc, "sol": p["sol"], "site": p["site"], "drive": p["drive"],
                        "lon": p["lon"], "lat": p["lat"], "elev_rover_m": p["elev_geoid"],
                        "yaw_deg": p["yaw"], "tilt_deg": p["tilt"], "odometer_m": p["dist_total_m"]})
    diffs = [abs(p["h"] - p["elev_rover_m"]) for p in pts]
    legs = clip_lines(json.loads((RAW / "traverse" / "M20_traverse.json").read_text())["features"])
    write("traverse/rover.json", {
        "title": "Perseverance waypoints and drive path inside the demo site",
        "source": "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/ (M20_waypoints.json, M20_traverse.json)",
        "credit": "NASA/JPL-Caltech",
        "check": {"waypoints": len(pts), "sols": [pts[0]["sol"], pts[-1]["sol"]],
                  "median_abs_diff_dtm_vs_rover_elev_m": round(statistics.median(diffs), 2),
                  "max_abs_diff_m": round(max(diffs), 2)},
        "waypoints": pts,
        "path": [{"sol": l["props"].get("sol"), "points": l["points"]} for l in legs],
    })


def helicopter() -> None:
    wps = json.loads((RAW / "traverse" / "m20_heli_waypoints.json").read_text())["features"]
    pts = []
    for f in wps:
        p = f["properties"]
        loc = local(p["Lon"], p["Lat"])
        if loc:
            pts.append({**loc, "flight": p["Flight"], "sol": p["Sol"], "lon": p["Lon"], "lat": p["Lat"],
                        "leg_m": p.get("Dist_m"), "max_alt_m": p.get("Max_Alt_m"),
                        "max_speed_mps": p.get("Max_Spd_m"), "duration_s": p.get("Duration_s")})
    write("traverse/helicopter.json", {
        "title": "Ingenuity landing spots inside the demo site (real scout-drone flights)",
        "source": "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/m20_heli_waypoints.json",
        "credit": "NASA/JPL-Caltech",
        "raw_property_keys": sorted(wps[0]["properties"]),
        "landings": pts,
    })


def shelters(count: int = 12, min_gap_m: float = 250.0) -> None:
    """Most shielded spots: lowest sky-view factor, kept apart from each other."""
    svf = np.asarray(Image.open(PUBLIC / "terrain" / "skyview_1024.png"), dtype=np.float32) / 255
    slope = np.asarray(Image.open(PUBLIC / "terrain" / "slope_1024.png"), dtype=np.float32) / 255 * 90
    from scipy import ndimage
    score = ndimage.uniform_filter(svf, 3)          # 12 m footprint
    score[slope > 20] = 1.0                         # must be standable
    score[:8], score[-8:], score[:, :8], score[:, -8:] = 1, 1, 1, 1
    order = np.argsort(score, axis=None)
    picked: list[tuple[int, int]] = []
    for flat in order[:200000]:
        r, c = divmod(int(flat), 1024)
        if all(np.hypot(r - pr, c - pc) * 4 >= min_gap_m for pr, pc in picked):
            picked.append((r, c))
            if len(picked) == count:
                break
    out = []
    for i, (r, c) in enumerate(picked, 1):
        x = SITE["x_min"] + (c + 0.5) * 4
        y = SITE["y_max"] - (r + 0.5) * 4
        lx, ly = xy_to_local(x, y)
        lon, lat = xy_to_lonlat(x, y)
        out.append({"id": f"S{i:02d}", "x": round(lx, 1), "y": round(ly, 1), "h": height_at(x, y),
                    "lon": round(lon, 6), "lat": round(lat, 6),
                    "sky_fraction": round(float(score[r, c]), 3), "slope_deg": round(float(slope[r, c]), 1)})
    write("shelters/shelters.json", {
        "title": "Candidate storm shelters: terrain that blocks the most sky",
        "method": "Sky-view factor from the 4 m HiRISE DTM (16 azimuths, 600 m horizon search), "
                  "3x3 mean, slope <= 20 deg, at least 250 m apart. sky_fraction 1.0 = open plain.",
        "caveat": "Our own derivation, not a NASA product. Sky fraction is a geometric proxy for "
                  "shielding from particles arriving from above; it is not a dose calculation.",
        "shelters": out,
    })


def read_meda(kind: str):
    files = sorted((RAW / "weather" / "meda").glob(f"WE__0120*{kind}*.CSV"))
    if not files:
        return None
    return csv.DictReader(files[0].open())


def lmst_hours(s: str) -> float:
    hh, mm, ss = s.split("M")[1].split(":")
    return int(hh) + int(mm) / 60 + float(ss) / 3600


def weather(bin_min: int = 5) -> None:
    spec = {  # output key: (product, column(s), unit)
        "pressure_pa": ("DER_PS", ["PRESSURE"], "Pa"),
        "air_temp_k": ("CAL_ATS", ["ATS_LOCAL_TEMP1", "ATS_LOCAL_TEMP2", "ATS_LOCAL_TEMP3"], "K (ATS 1-3, ~1.45 m)"),
        "wind_speed_mps": ("DER_WS", ["HORIZONTAL_WIND_SPEED"], "m/s"),
        "wind_dir_deg": ("DER_WS", ["WIND_DIRECTION"], "deg, direction wind comes from"),
        "rel_humidity_pct": ("DER_RHS", ["LOCAL_RELATIVE_HUMIDITY"], "%"),
        "upward_lw_wm2": ("DER_TIRS", ["UPWARD_LW_IRRADIANCE"], "W/m2 (ground thermal emission)"),
    }
    nb = 24 * 60 // bin_min
    series, missing = {}, []
    for key, (kind, cols, _unit) in spec.items():
        rd = read_meda(kind)
        if rd is None:
            missing.append(kind)
            continue
        bins = defaultdict(list)
        for row in rd:
            vals = [float(row[c]) for c in cols if row.get(c) not in (None, "")]
            vals = [v for v in vals if abs(v) < 9e8]  # 999999999 marks a missing value
            if not vals:
                continue
            b = int(lmst_hours(row["LMST"]) * 60 // bin_min)
            if 0 <= b < nb:
                bins[b].append(sum(vals) / len(vals))
        if key == "wind_dir_deg":  # circular mean
            def cmean(v):
                a = np.radians(v)
                return float(np.degrees(np.arctan2(np.sin(a).mean(), np.cos(a).mean())) % 360)
            series[key] = [round(cmean(bins[b]), 1) if bins[b] else None for b in range(nb)]
        else:
            series[key] = [round(sum(bins[b]) / len(bins[b]), 2) if bins[b] else None for b in range(nb)]
    stats = {k: {"min": min(x for x in v if x is not None), "max": max(x for x in v if x is not None),
                 "bins_with_data": sum(x is not None for x in v)} for k, v in series.items()}
    write("weather/meda_sol_0120.json", {
        "title": "Perseverance MEDA weather, sol 120 (Jezero crater floor)",
        "bin_minutes": bin_min, "time_axis": "local mean solar time; bin i starts at i*bin_minutes",
        "units": {k: v[2] for k, v in spec.items()},
        "missing_products": sorted(set(missing)),
        "note": "No dust-opacity series: MEDA optical depth is not in the derived products we pulled.",
        "source": "NASA PDS Atmospheres Node, Mars 2020 MEDA bundle, "
                  "https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/",
        "credit": "NASA/JPL-Caltech/CAB (CSIC-INTA)",
        "stats": stats, "series": series,
    })


def space_weather() -> None:
    src = RAW / "space-weather"

    def load(kind):
        p = src / f"donki_{kind}_2017-09-01_2017-09-20.json"
        return json.loads(p.read_text()) if p.exists() else None

    events = []
    for s in load("SEP") or []:
        events.append({"type": "SEP", "t": s["eventTime"], "id": s["sepID"],
                       "detail": ", ".join(i["displayName"] for i in s.get("instruments") or []), "link": s["link"]})
    for c in load("CME") or []:
        a = next((x for x in c.get("cmeAnalyses") or [] if x.get("isMostAccurate")), None)
        events.append({"type": "CME", "t": c["startTime"], "id": c["activityID"],
                       "detail": f"{a['speed']:.0f} km/s, type {a['type']}, half-angle {a['halfAngle']} deg" if a and a.get("speed") else (c.get("note") or "")[:120],
                       "speed_kms": a.get("speed") if a else None, "link": c["link"]})
    for g in load("GST") or []:
        kp = max((k["kpIndex"] for k in g.get("allKpIndex") or []), default=None)
        events.append({"type": "GST", "t": g["startTime"], "id": g["gstID"], "detail": f"Earth geomagnetic storm, max Kp {kp}", "link": g["link"]})
    for f in load("FLR") or []:
        events.append({"type": "FLR", "t": f["peakTime"], "id": f["flrID"], "detail": f"class {f['classType']}", "link": f["link"]})
    for i in load("IPS") or []:
        events.append({"type": "IPS", "t": i["eventTime"], "id": i["activityID"], "detail": f"shock at {i['location']}", "link": i["link"]})
    mars = []
    for s in load("WSAEnlilSimulations") or []:
        for imp in s.get("impactList") or []:
            if imp["location"] == "Mars":
                mars.append({"model_run": s["simulationID"], "model_completed": s["modelCompletionTime"],
                             "predicted_arrival_at_mars": imp["arrivalTime"], "glancing_blow": imp.get("isGlancingBlow"),
                             "cme_ids": [c["CMEID"] for c in s.get("cmeInputs") or [] if c.get("CMEID")],
                             "link": s.get("link")})
    events.sort(key=lambda e: e["t"])
    have = [k for k in ("SEP", "CME", "GST", "FLR", "IPS", "WSAEnlilSimulations", "notifications") if load(k) is not None]
    write("space-weather/donki_2017-09.json", {
        "title": "NASA DONKI space-weather events, 1-20 Sep 2017",
        "source": "https://api.nasa.gov/DONKI/ (NASA CCMC Space Weather Database Of Notifications, Knowledge, Information)",
        "credit": "NASA CCMC / M2M Space Weather Analysis Office",
        "window": ["2017-09-01", "2017-09-20"],
        "endpoints_included": have,
        "endpoints_missing": [k for k in ("SEP", "CME", "GST", "FLR", "IPS", "WSAEnlilSimulations") if k not in have],
        "note": "SEP detections are from near-Earth spacecraft. Mars entries are WSA-ENLIL model "
                "predictions of CME arrival at Mars, not measurements.",
        "counts": {t: sum(e["type"] == t for e in events) for t in sorted({e["type"] for e in events})},
        "mars_cme_arrival_predictions": mars,
        "events": events,
    })


def images() -> None:
    src = RAW / "images"
    idx_path = src / "index.json"
    if not idx_path.exists():
        print("images: raw index missing, skipped")
        return
    out_dir = PUBLIC / "images" / "navcam"
    out_dir.mkdir(parents=True, exist_ok=True)
    out = []
    for im in json.loads(idx_path.read_text()):
        loc = local(im["lon"], im["lat"])
        if not loc or not (src / im["file"]).exists():
            continue
        shutil.copyfile(src / im["file"], out_dir / im["file"])
        out.append({**im, **loc, "file": f"navcam/{im['file']}"})
    write("images/index.json", {
        "title": "Perseverance Navcam frames at mapped waypoints",
        "source": "https://mars.nasa.gov/mars2020/multimedia/raw-images/ (raw image API)",
        "credit": "NASA/JPL-Caltech",
        "note": "mast_az / mast_el are the camera mast angles in the rover frame, in degrees.",
        "stops": len({(i["site"], i["drive"]) for i in out}), "images": out,
    })


if __name__ == "__main__":
    rover()
    helicopter()
    shelters()
    weather()
    space_weather()
    images()
