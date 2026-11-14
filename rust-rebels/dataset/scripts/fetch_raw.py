"""Download the raw public source files into dataset/raw/ (git-ignored).

Skips files that already exist. Sources and credits are documented in
dataset/README.md. The HiRISE window has its own script
(fetch_hirise_window.py) because it uses byte-range requests.

Run from rust-rebels/:
    python3 dataset/scripts/fetch_raw.py            # everything
    python3 dataset/scripts/fetch_raw.py donki meda  # selected groups

DONKI uses NASA_API_KEY if set, otherwise the rate-limited DEMO_KEY.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.parse
from pathlib import Path

from site_config import RAW, in_site, lonlat_to_xy

UA = "Mozilla/5.0"
CURL = ["curl", "-sS", "-L", "--fail", "--cacert", "/etc/ssl/cert.pem", "-A", UA]
RETRY = ["--retry", "3"]


def get(url: str, dest: Path, opts: list[str] = RETRY) -> Path:
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    print(f"GET {url}")
    subprocess.run(CURL + opts + ["-o", str(tmp), url], check=True)
    tmp.rename(dest)
    return dest


def text(url: str) -> str:
    return subprocess.run(CURL + RETRY + [url], check=True, capture_output=True, text=True).stdout


# --- groups -----------------------------------------------------------------

def traverse() -> None:
    base = "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/"
    for name in ("M20_waypoints.json", "M20_traverse.json", "m20_heli_waypoints.json"):
        get(base + name, RAW / "traverse" / name)


def terrain_ctx() -> None:
    base = "https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/"
    for name in (
        "JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif",
        "JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0.tif",
    ):
        get(base + name, RAW / "terrain" / name)


def models() -> None:
    base = "https://mars.nasa.gov/system/resources/gltf_files/"
    for name in ("25042_Perseverance.glb", "25043_Ingenuity_v3.glb"):
        get(base + name, RAW / "models" / name)


MEDIA = {
    # Real Mars audio recorded by Perseverance's microphones, no narration.
    "sounds_of_mars_no_voiceover.mp4":
        "https://assets.science.nasa.gov/content/dam/science/psd/mars/downloadable_items/4/8/48249_SoundsofMars_NoVoiceover_1280x720.mp4",
    # SuperCam microphone recording of Ingenuity's fourth flight.
    "ingenuity_flight_audio.mp4":
        "https://images-assets.nasa.gov/video/" + urllib.parse.quote(
            "JPL-20210506-Listen to NASA’s Ingenuity Helicopter as it Flies on Mars-1080/"
            "JPL-20210506-Listen to NASA’s Ingenuity Helicopter as it Flies on Mars-1080~medium.mp4"),
    # Mastcam-Z video of Ingenuity's third flight.
    "ingenuity_third_flight_mastcamz.mp4":
        "https://images-assets.nasa.gov/video/" + urllib.parse.quote(
            "JPL-20210425-TECHf-0001-Ingenuity Third Flight MastcamZ Video/"
            "JPL-20210425-TECHf-0001-Ingenuity Third Flight MastcamZ Video~medium.mp4"),
    # Narrated overview of the delta campaign (for an intro clip).
    "perseverance_explores_jezero_delta.mp4":
        "https://images-assets.nasa.gov/video/JPL-20220906-Perseverance_Explores_Jezero_Crater_Delta_UHD/"
        "JPL-20220906-Perseverance_Explores_Jezero_Crater_Delta_UHD~medium.mp4",
}


_AUDIO = "https://assets.science.nasa.gov/content/dam/science/psd/mars/downloadable_items/4/5/"
AUDIO = {  # Perseverance microphone recordings, each from its own science.nasa.gov/resource/ page
    # SuperCam microphone, sol 4: Martian wind. /resource/perseverance-rovers-supercam-records-wind-on-mars/
    "mars_wind_supercam_sol4.mp3": _AUDIO + "45828_SCAM_MIC_SOL004_RUN001.mp3",
    # SuperCam microphone, sol 1: first audio from the surface. /resource/first-audio-recording-of-sounds-on-mars/
    "mars_first_audio_sol1.mp3": _AUDIO + "45825_SCAM_MIC_SOL001_RUN001.mp3",
    # SuperCam laser hitting a rock, sol 12. /resource/first-acoustic-recording-of-laser-shots-on-mars/
    "supercam_laser_sol12.mp3": _AUDIO + "45831_SCAM_MIC_SOL012_RUN001.mp3",
    # EDL microphone, rover driving on sol 16, 90 s of highlights.
    # /resource/sounds-of-perseverance-mars-rover-driving-sol-16-90-second-highlights/
    "rover_driving_sol16.mp3": _AUDIO + "45857_FILTERED_HIGHLIGHTS_-_Sol16RoverDriveHighlights.mp3",
}


def media() -> None:
    for name, url in MEDIA.items():
        get(url, RAW / "media" / name)
    for name, url in AUDIO.items():
        get(url, RAW / "audio" / name)


RAD_DIR = "https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/"
RAD_SOLS = [  # 7-14 Sep 2017: quiet baseline, the 10 Sep SEP event (GLE 72), Forbush decrease
    "RAD_RDR_2017_250_02_13_1809", "RAD_RDR_2017_251_02_40_1810", "RAD_RDR_2017_252_03_24_1811",
    "RAD_RDR_2017_253_04_24_1812", "RAD_RDR_2017_254_04_42_1813", "RAD_RDR_2017_255_05_28_1814",
    "RAD_RDR_2017_256_06_11_1815", "RAD_RDR_2017_257_06_41_1816",
]


def rad() -> None:
    out = RAW / "radiation" / "rad"
    get(RAD_DIR + "DOCUMENT/RAD_RDR_SIS.PDF", out / "RAD_RDR_SIS.PDF")
    for name in RAD_SOLS:
        get(f"{RAD_DIR}DATA/SOL_01773_01869/{name}_V00.TXT", out / f"{name}_V00.TXT")


MEDA = "https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/"
MEDA_PRODUCTS = {  # sol 120: rover near the landing site, wind sensor still healthy
    "data_derived_env/sol_0090_0179/sol_0120/": ("DER_PS", "DER_RHS", "DER_TIRS", "DER_WS", "DER_ANCILLARY"),
    "data_calibrated_env/sol_0090_0179/sol_0120/": ("CAL_ATS",),
}


def meda() -> None:
    for folder, kinds in MEDA_PRODUCTS.items():
        listing = text(MEDA + folder)
        for name in sorted(set(re.findall(r'href="(WE__[^"]+\.(?:CSV|xml))"', listing))):
            if any(k in name for k in kinds):
                get(MEDA + folder + name, RAW / "weather" / "meda" / name)


def donki() -> None:
    key = os.environ.get("NASA_API_KEY", "DEMO_KEY")
    span = "startDate=2017-09-01&endDate=2017-09-20"
    # Most useful first: DEMO_KEY allows only about 10 requests per hour.
    for kind in ("SEP", "CME", "WSAEnlilSimulations", "GST", "notifications", "IPS", "FLR"):
        extra = "&type=all" if kind == "notifications" else ""
        try:
            get(f"https://api.nasa.gov/DONKI/{kind}?{span}{extra}&api_key={key}",
                RAW / "space-weather" / f"donki_{kind}_2017-09-01_2017-09-20.json",
                opts=["--max-time", "60"])  # no retry: a 429 would wait out the hour
        except subprocess.CalledProcessError:
            print(f"WARN DONKI {kind} failed (rate limit or endpoint error); re-run later")


RAW_API = "https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json"
IMAGE_STOPS = 12       # waypoints to illustrate
IMAGES_PER_STOP = 5    # Navcam frames per waypoint


def _num(v, default: float) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def images() -> None:
    """Navcam frames taken at rover waypoints inside the demo site.

    Waypoints and images share the rover's (site, drive) counters, so every
    downloaded frame has a known map position.
    """
    out = RAW / "images"
    wps = json.loads((RAW / "traverse" / "M20_waypoints.json").read_text())["features"]
    inside = [w["properties"] for w in wps
              if in_site(*lonlat_to_xy(w["properties"]["lon"], w["properties"]["lat"]))]
    step = 2  # many waypoints have no usable frames, so sample densely
    index, stops, last_odo = [], 0, 0.0
    for wp in inside[::step]:
        if stops >= IMAGE_STOPS:
            break
        if index and abs(wp["dist_total_m"] - last_odo) < 250:  # spread stops along the drive
            continue
        cache = out / "_api" / f"sol_{wp['sol']:04d}.json"
        if not cache.exists():
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_text(text(f"{RAW_API}&num=100&page=0&sol={wp['sol']}&search=NAVCAM_LEFT"))
        frames = [i for i in json.loads(cache.read_text()).get("images", [])
                  if int(i["site"]) == wp["site"] and int(i["drive"]) == wp["drive"]
                  and i["sample_type"] == "Full" and i["extended"].get("dimension") == "(1280,960)"
                  # SAPP frames and high mast elevations are sun-tracking shots, not terrain
                  and "SAPP" not in i["imageid"] and _num(i["extended"].get("mastEl"), 99) < 5]
        frames.sort(key=lambda i: _num(i["extended"].get("mastAz"), 0))
        if len(frames) < 2:
            continue
        stops += 1
        last_odo = wp["dist_total_m"]
        pick = frames[:: max(1, len(frames) // IMAGES_PER_STOP)][:IMAGES_PER_STOP]
        for im in pick:
            name = im["imageid"] + ".jpg"
            get(im["image_files"]["large"], out / name)
            index.append({
                "file": name, "imageid": im["imageid"], "sol": im["sol"],
                "site": wp["site"], "drive": wp["drive"], "lon": wp["lon"], "lat": wp["lat"],
                "mast_az": im["extended"].get("mastAz"), "mast_el": im["extended"].get("mastEl"),
                "date_taken_utc": im["date_taken_utc"], "credit": im["credit"],
                "source": im["json_link"],
            })
    (out / "index.json").write_text(json.dumps(index, indent=2))
    print(f"images: {len(index)} frames at {stops} waypoints")


GROUPS = {"traverse": traverse, "ctx": terrain_ctx, "models": models, "media": media,
          "rad": rad, "meda": meda, "donki": donki, "images": images}

if __name__ == "__main__":
    for g in sys.argv[1:] or list(GROUPS):
        GROUPS[g]()
