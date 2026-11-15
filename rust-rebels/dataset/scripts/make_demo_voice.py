#!/usr/bin/env python3
"""Record the voices (and, optionally, theme music) for the 30-second demo with ElevenLabs.

The lines come from src/features/game/demo-lines.json, so the recordings always match the captions.
Output goes to public/dataset/audio/demo/, with a manifest the app reads to know what exists.
The app only plays these recordings; without them the film shows captions and stays silent.

Pick two voices in the ElevenLabs voice library (https://elevenlabs.io/app/voice-library), add them
to your voices, and copy each voice ID. Then, from rust-rebels/:

    export ELEVENLABS_API_KEY=...          # your key; never commit it
    python3 dataset/scripts/make_demo_voice.py --superjar VOICE_ID --astronaut VOICE_ID
    python3 dataset/scripts/make_demo_voice.py --superjar VOICE_ID --astronaut VOICE_ID --theme

--theme also composes 32 seconds of instrumental music (uses music credits; needs a plan that has it).
--only 02 05 re-records just those lines.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LINES = ROOT / "src/features/game/demo-lines.json"
OUT = ROOT / "public/dataset/audio/demo"
API = "https://api.elevenlabs.io/v1"
THEME_PROMPT = (
    "Cinematic science-fiction underscore for a 30 second film about an astronaut and an AI companion "
    "on Mars. Slow analog synth pads and a soft pulse at the start, rising tension with low brass and "
    "ticking percussion from 19 seconds, then a warm, hopeful resolve for the last five seconds. "
    "Instrumental, no vocals, leaves room for dialogue."
)


def post(path: str, body: dict, key: str) -> bytes:
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(body).encode(),
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as res:
            return res.read()
    except urllib.error.HTTPError as err:
        sys.exit(f"ElevenLabs refused {path}: HTTP {err.code}\n{err.read().decode(errors='replace')[:600]}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--superjar", required=True, help="ElevenLabs voice ID for SuperJar")
    ap.add_argument("--astronaut", required=True, help="ElevenLabs voice ID for the astronaut")
    ap.add_argument("--model", default="eleven_multilingual_v2")
    ap.add_argument("--only", nargs="*", help="line ids to (re)record, e.g. 02 05")
    ap.add_argument("--theme", action="store_true", help="also compose the theme music")
    args = ap.parse_args()

    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("Set ELEVENLABS_API_KEY first (export ELEVENLABS_API_KEY=...).")

    OUT.mkdir(parents=True, exist_ok=True)
    lines = json.loads(LINES.read_text())
    for line in lines:
        if args.only and line["id"] not in args.only:
            continue
        voice = args.superjar if line["who"] == "SUPERJAR" else args.astronaut
        text = line.get("say", line["text"])
        # A touch faster than default so each line fits its slot in the film.
        audio = post(
            f"/text-to-speech/{voice}?output_format=mp3_44100_128",
            {"text": text, "model_id": args.model, "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "speed": 1.08}},
            key,
        )
        (OUT / f"line-{line['id']}.mp3").write_bytes(audio)
        slot = line["to"] - line["from"]
        print(f"line-{line['id']}.mp3  {len(audio) // 1024} KB  ({line['who']}, {slot:.1f} s slot)  {text}")

    if args.theme:
        audio = post("/music?output_format=mp3_44100_128", {"prompt": THEME_PROMPT, "music_length_ms": 32000, "force_instrumental": True}, key)
        (OUT / "theme.mp3").write_bytes(audio)
        print(f"theme.mp3  {len(audio) // 1024} KB")

    have = sorted(p.stem.removeprefix("line-") for p in OUT.glob("line-*.mp3"))
    manifest = {"lines": have, "theme": (OUT / "theme.mp3").exists()}
    (OUT / "manifest.json").write_text(json.dumps(manifest) + "\n")
    print("manifest:", manifest)
    print("Listen to each file: a line longer than its slot is cut off when the next one starts.")


if __name__ == "__main__":
    main()
