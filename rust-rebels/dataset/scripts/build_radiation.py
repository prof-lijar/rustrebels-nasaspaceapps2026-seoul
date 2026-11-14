"""Extract the surface dose-rate time series from Curiosity RAD RDR files.

Input : dataset/raw/radiation/rad/RAD_RDR_2017_*.TXT  (one file per sol, ~65 MB each)
Output: public/dataset/radiation/rad_sep_2017-09.json

Each RAD observation (~16 min) reports a total dose rate in microGray/hour for
detector B (silicon) and detector E (tissue-equivalent plastic). We keep both.
The window covers 7-14 Sep 2017: quiet days, then the 10 Sep 2017 solar
particle event, the largest RAD has seen on the surface.

Run from rust-rebels/:  python3 dataset/scripts/build_radiation.py
"""
from __future__ import annotations

import json
import re
import statistics
from datetime import datetime, timedelta, timezone

from site_config import PUBLIC, RAW

SRC = RAW / "radiation" / "rad"
OUT = PUBLIC / "radiation"
OUT.mkdir(parents=True, exist_ok=True)

OBS = re.compile(r"^\[OBSERVATION: (\d+)\]")
UTC = re.compile(r'^START_OBS_UTC="(\d{4})-(\d{3}) (\d\d):(\d\d):(\d\d)"')
DUR = re.compile(r"^OBS_DURATION=(\d+)")
DOSE = re.compile(r"^\[DOSIMETRY_TOTAL_DOSE_([BE]): \d+\]")


def parse(path) -> list[dict]:
    rows, cur, want = [], None, None
    with open(path, encoding="ascii", errors="replace") as fh:
        for line in fh:
            if line.startswith("["):
                if OBS.match(line):
                    if cur and "b" in cur and "e" in cur:
                        rows.append(cur)
                    cur, want = {}, None
                    continue
                m = DOSE.match(line)
                want = m.group(1).lower() if m else None
                continue
            if cur is None:
                continue
            if want and line.strip():
                cur[want] = float(line)
                want = None
            elif (m := UTC.match(line)):
                y, doy, hh, mm, ss = map(int, m.groups())
                cur["t"] = datetime(y, 1, 1, hh, mm, ss, tzinfo=timezone.utc) + timedelta(days=doy - 1)
            elif (m := DUR.match(line)):
                cur["dur"] = int(m.group(1))
    if cur and "b" in cur and "e" in cur:
        rows.append(cur)
    return rows


def main() -> None:
    rows: list[dict] = []
    files = sorted(SRC.glob("RAD_RDR_*.TXT"))
    for f in files:
        got = parse(f)
        print(f.name, len(got))
        rows += got
    rows = sorted((r for r in rows if "t" in r and r["b"] > 0 and r["e"] > 0), key=lambda r: r["t"])

    onset = datetime(2017, 9, 10, 16, 0, tzinfo=timezone.utc)  # X8.2 flare peaked 16:06 UTC
    quiet = [r for r in rows if r["t"] < onset]
    base_b = statistics.median(r["b"] for r in quiet)
    base_e = statistics.median(r["e"] for r in quiet)
    peak = max(rows, key=lambda r: r["e"])
    after = [r for r in rows if r["t"] > peak["t"] + timedelta(hours=36)]
    out = {
        "title": "Curiosity RAD surface dose rate, 7-14 Sep 2017 (Gale crater)",
        "units": "microGray per hour",
        "detectors": {"b": "silicon detector B", "e": "tissue-equivalent plastic detector E"},
        "note": "Measured at Gale crater by Curiosity, not at Jezero. Used as the dose baseline "
                "and as the shape of the solar-storm scenario in the demo.",
        "source": "NASA PDS PPI, MSL-M-RAD-3-RDR-V1.0, https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/",
        "credit": "NASA/JPL-Caltech/SwRI",
        "files": [f.name for f in files],
        "summary": {
            "observations": len(rows),
            "baseline_before_event": {"b": round(base_b, 2), "e": round(base_e, 2)},
            "peak": {"t": peak["t"].isoformat(), "b": round(peak["b"], 2), "e": round(peak["e"], 2),
                     "ratio_to_baseline_e": round(peak["e"] / base_e, 2)},
            "after_event_median_e": round(statistics.median(r["e"] for r in after), 2) if after else None,
            "event_onset_reference_utc": onset.isoformat(),
        },
        "series": [{"t": r["t"].strftime("%Y-%m-%dT%H:%M:%SZ"), "dur_s": r.get("dur"),
                    "b": round(r["b"], 3), "e": round(r["e"], 3)} for r in rows],
    }
    (OUT / "rad_sep_2017-09.json").write_text(json.dumps(out, separators=(",", ":")))
    print(json.dumps(out["summary"], indent=1))


if __name__ == "__main__":
    main()
