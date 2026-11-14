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
| `audio/sounds_of_mars.mp3`, `audio/ingenuity_flight.mp3` | Perseverance microphone recordings | NASA/JPL-Caltech |
| `video/jezero_delta_overview.mp4`, `video/ingenuity_third_flight.mp4` | 720p clips with poster frames | NASA/JPL-Caltech |
| `models/perseverance.glb`, `models/ingenuity.glb` | NASA 3D models, unchanged | NASA/JPL-Caltech |

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
| Videos | https://images.nasa.gov/ | NASA/JPL-Caltech |
| 3D models | https://mars.nasa.gov/system/resources/gltf_files/ | NASA/JPL-Caltech |

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
- **Audio is not cut.** Both MP3s are full sound tracks. Nobody has listened through and picked loop points.
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
