# Dataset

Public NASA data behind the Martian Map demo, and the scripts that turn it into files a browser can load.

| Where | What | In git |
| --- | --- | --- |
| `dataset/scripts/` | Download and build scripts | yes |
| `dataset/raw/` | Untouched downloads, 1.3 GB | no (ignored) |
| `public/dataset/` | Browser-ready files the app fetches at `/dataset/...`, 58 MB | yes |

Built 2026-11-14. Everything in `public/dataset/` can be rebuilt from the scripts.

## Demo site

A 4,096 m square on the western floor of Jezero crater: 77.3966–77.4657°E, 18.4133–18.4824°N. It holds the Perseverance landing site, Séítah, Belva crater and the delta front, and every rover waypoint from sol 13 to sol 717.

Scene coordinates are metres from the centre of the square: `x` east, `y` north, `h` elevation above the MOLA areoid. Every raster has north at row 0 and west at column 0. `public/dataset/terrain/terrain.json` carries the georeferencing.

## What is in `public/dataset/`

| File | Content | Source |
| --- | --- | --- |
| `terrain/height_2048.u16`, `height_1024.u16` | Elevation at 2 m and 4 m per pixel, uint16 little-endian, −2602 to −2447 m | HiRISE DTM mosaic, 1 m |
| `terrain/ortho_4096.jpg`, `ortho_2048.jpg` | Greyscale surface image at 1 m and 2 m per pixel | HiRISE orthomosaic, 25 cm |
| `terrain/slope_1024.png` | Slope in degrees. Mean 4.1°, 0.85% of the site is steeper than 25° | derived from the DTM |
| `terrain/skyview_1024.png` | Fraction of sky visible from each point | derived from the DTM |
| `terrain/context_ctx_2048.jpg`, `context_height_512.u16` | 20 km surroundings for the minimap and horizon | CTX mosaics, 6 m and 20 m |
| `traverse/rover.json` | 260 Perseverance waypoints and the drive path | Mars 2020 mission map |
| `traverse/helicopter.json` | 45 Ingenuity landing spots, flights 0–44 | Mars 2020 mission map |
| `shelters/shelters.json` | 12 most sky-shielded standable spots | derived from the DTM |
| `radiation/rad_sep_2017-09.json` | 787 dose-rate readings, 7–14 Sep 2017 | Curiosity RAD, PDS |
| `space-weather/donki_2017-09.json` | 10 SEP, 24 CME, 3 geomagnetic storm records and CME arrival predictions for Mars, 1–20 Sep 2017 | NASA DONKI |
| `weather/meda_sol_0120.json` | Pressure, air temperature, wind, humidity, ground emission in 5-minute bins for one sol | Perseverance MEDA, PDS |
| `images/index.json`, `images/navcam/*.jpg` | 13 Navcam frames at 4 mapped waypoints | Mars 2020 raw images |
| `audio/mars_wind_supercam_sol4.mp3` | Martian wind, SuperCam microphone, sol 4 (40 s). The game's ambient loop | NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero |
| `audio/supercam_laser_sol12.mp3` | SuperCam laser striking a rock, sol 12 (11 s). Played when SuperJar flags a hazard | NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero |
| `audio/ingenuity_flight_loop.mp3`, `audio/ingenuity_flight.mp3` | Ingenuity's fourth flight heard by SuperCam; the loop drops the silent start and end. The scout drone's sound | NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero |
| `audio/mars_first_audio_sol1.mp3` | First audio recorded on the surface, sol 1 (20 s). Not used in the game yet | NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero |
| `audio/rover_driving_sol16.mp3` | Perseverance driving, sol 16 highlights (85 s). Not used in the game yet | NASA/JPL-Caltech |
| `audio/sounds_of_mars.mp3` | Sound track of NASA's "Sounds of Mars" compilation video (149 s), uncut. Not used in the game | NASA/JPL-Caltech |
| `video/jezero_delta_overview.mp4`, `video/ingenuity_third_flight.mp4` | 720p clips with poster frames | NASA/JPL-Caltech |
| `models/perseverance.glb`, `models/ingenuity.glb` | NASA 3D models, unchanged | NASA/JPL-Caltech |
| `models/emu_suit.glb`, `models/aces_suit.glb` | NASA suit models the player can wear, both unchanged: the Extravehicular Mobility Unit (the Space Station spacewalk suit, modelled with its jet backpack and hand controllers; about 343,000 triangles) and the orange Advanced Crew Escape Suit. NASA publishes them without joints, so at load time the game fits the Quaternius astronaut's skeleton inside each suit and plays its animations on it (`src/features/game/suits.ts`). The ACES arms are animated; the EMU's stay as NASA posed them. | NASA |
| `models/astronaut.glb` | "Astronaut" by Quaternius, unchanged. Rigged, with the artist's own walk, run and idle animations. Worn as three of the game's suits, two of them recoloured in code. Not a NASA model. | Quaternius, public domain (CC0) |
| `models/astronaut_realistic.glb` | "Astronaut in spacesuit (rigged)": a detailed textured suit, rigged, with its own walk and run animations. Supplied by the team as a downloaded file, unchanged (14 MB, 300,000 triangles). Not a NASA model. | Free download under a licence that allows sharing, per the team; page link and author still to be added |
| `models/astronaut_classic.glb` | "Rigged Astronaut" by J-Toastie, unchanged. Rigged but not animated; the game drives its skeleton. Not a NASA model. | J-Toastie, CC BY 3.0 |

## Sources

| Data | URL | Credit |
| --- | --- | --- |
| HiRISE and CTX mosaics (Mars 2020 Terrain Relative Navigation) | https://planetarymaps.usgs.gov/mosaic/mars2020_trn/ | NASA/JPL-Caltech/University of Arizona/MSSS/USGS |
| Rover and helicopter positions | https://mars.nasa.gov/mmgis-maps/M20/Layers/json/ | NASA/JPL-Caltech |
| Curiosity RAD reduced data | https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/ | NASA/JPL-Caltech/SwRI |
| DONKI | https://api.nasa.gov/DONKI/ | NASA CCMC |
| MEDA | https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/ | NASA/JPL-Caltech/CAB (CSIC-INTA) |
| Raw images | https://mars.nasa.gov/mars2020/multimedia/raw-images/ | NASA/JPL-Caltech |
| Sounds of Mars | https://science.nasa.gov/mission/mars-2020-perseverance/sounds-of-mars/ | NASA/JPL-Caltech |
| Perseverance microphone clips | https://science.nasa.gov/resource/perseverance-rovers-supercam-records-wind-on-mars/ and the sibling resource pages named in `fetch_raw.py` | NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero |
| Videos | https://images.nasa.gov/ | NASA/JPL-Caltech |
| 3D models | https://mars.nasa.gov/system/resources/gltf_files/ | NASA/JPL-Caltech |
| NASA ACES suit model | https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Advanced%20Crew%20Escape%20Suit | NASA (the repository states its assets are free and without copyright) |
| NASA EMU suit model | https://science.nasa.gov/3d-resources/extravehicular-mobility-unit/ | NASA |
| Astronaut model | https://poly.pizza/m/3hC2i0CTuO | Quaternius, public domain (CC0) |
| Rigged Astronaut model | https://poly.pizza/m/0oBRDJ9Zl9 | J-Toastie, CC BY 3.0: credit required |

NASA media is generally free to use with credit and without implying NASA endorsement. Show the credits above in the app.

## Checks we ran

- **Terrain matches the rover.** DTM elevation at the 260 waypoints differs from the rover's own recorded elevation by 0.02 m in the median and 0.39 m at most.
- **No gaps.** The DTM, the orthoimage and the CTX context have no missing pixels inside the site.
- **The storm is real.** RAD read about 11 µGy/h before the 10 Sep 2017 event and peaked at 24.6 µGy/h (2.2 times baseline), then fell to 9.4 µGy/h as the passing CME shielded Mars from cosmic rays.
- **Images are terrain.** The first image pull was half sun-tracking shots; those are now filtered out and the remaining 13 were checked by eye.

## Limits to know before building on this

- **RAD measured Gale crater, not Jezero.** No radiation instrument has flown at Jezero. The series is the dose baseline and the storm shape, not a local reading.
- **DONKI particle events are near-Earth detections.** The Mars entries are model predictions of CME arrival, not measurements.
- **Terrain gives little shelter here.** The most shielded standable spots still see 88–93% of the sky, and nowhere in the site sees less than 64%. `skyview` and `shelters` are our own geometric derivation, not a dose calculation.
- **Weather is one sol, with no dust opacity.** Sol 120 was chosen because the wind sensor was still healthy.
- **Navcam coverage is thin.** Four stops, all on the crater floor (sols 15, 73, 123, 341), none on the delta front.
- **Audio is louder than the originals.** The recordings are very quiet, so the clips were levelled (the laser clip was raised 13 dB). Nobody has listened to the loops by ear; they were checked by duration and level only.
- **DONKI flares and shocks are missing.** The FLR endpoint returned 404 and the IPS request hit the demo-key rate limit.
- **Not prepared:** CRISM minerals, RIMFAX radar and MOLA, which the pitch deck lists. CTX covers the regional elevation role MOLA had.

## Rebuild

Run from `rust-rebels/`. Needs `uv`, `curl` and `ffmpeg`.

```sh
python3 dataset/scripts/fetch_raw.py                                                        # about 800 MB
uv run --with rasterio --with numpy python dataset/scripts/fetch_hirise_window.py           # 1.7 GB transfer, keeps 335 MB
uv run --with rasterio --with numpy --with pillow --with scipy python dataset/scripts/build_terrain.py
python3 dataset/scripts/build_radiation.py
uv run --with numpy --with pillow --with scipy python dataset/scripts/build_layers.py
sh dataset/scripts/build_media.sh
```

Set `NASA_API_KEY` (free at https://api.nasa.gov/) before `fetch_raw.py donki` to get the missing flare and shock records. The site square is defined once, in `dataset/scripts/site_config.py`.
