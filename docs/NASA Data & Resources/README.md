# NASA Data & Resources

Public data links for our challenge, **Interplanetary Survival Guide: Martian Map**.

- Challenge resources tab: <https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/?tab=resources>
- Last synced with the official tab: 2026-11-14 (page last published 2026-11-13). The brief says more resources may be added, so re-check before relying on this list.

## Official challenge resources

These five are everything listed under "NASA Data & Resources" on the challenge page. Descriptions are the challenge page's own wording.

| Resource | Link | What the challenge page says |
| --- | --- | --- |
| JPL Mars Trek | <https://trek.nasa.gov/mars/> | NASA web-based portal for exploration of Mars, showcases data collected by NASA at various landing sites. |
| USGS-NASA Planetary Geologic Mapping Program | <https://astrogeology-usgs.hub.arcgis.com/pages/interactive-maps-mars> | High-quality standardized geologic map of Mars. |
| Curiosity's proposed path up Mount Sharp (route map example) | <https://science.nasa.gov/resource/curiositys-proposed-path-up-mount-sharp/> | Animation of a proposed route for the Curiosity rover climbing lower Mount Sharp. The annotated version labels regions scientists would like to explore; a flyover video explains them. |
| NASA Worldview | <https://worldview.earthdata.nasa.gov/> | Visually explore the past and present of Earth from a satellite's perspective (part of NASA Earthdata). |
| Mars Perseverance Raw Images Gallery | <https://mars.nasa.gov/mars2020/multimedia/raw-images/> | Over 1 million images captured by the rover on its journey across the Mars surface. |

Notes:

- All five links returned HTTP 200 on 2026-11-14.
- The USGS page is hosted on a non-NASA site (ArcGIS Hub). The challenge page asks participants to comply with the data-use terms of any non-U.S. Government website.
- Worldview covers Earth, not Mars. It is listed as a reference for how NASA presents map data, in line with the brief's suggestion to look at maps of other destinations for inspiration.

## Additional public data links

Links we find ourselves go here. One row per source.

The rows below are downloaded and processed in [`rust-rebels/dataset/`](../../rust-rebels/dataset/README.md). All were reached without a login on 2026-11-14.

| Resource | Link | What it gives us | Format / access | Added by | Date |
| --- | --- | --- | --- | --- | --- |
| Mars 2020 TRN HiRISE and CTX mosaics (USGS) | <https://planetarymaps.usgs.gov/mosaic/mars2020_trn/> | Jezero elevation at 1 m and 20 m, imagery at 25 cm and 6 m | GeoTIFF, direct download, byte ranges supported | dataset build | 2026-11-14 |
| Mars 2020 mission map layers | <https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json> | Perseverance waypoints and drive path, Ingenuity landing spots | GeoJSON (`M20_waypoints`, `M20_traverse`, `m20_heli_waypoints`) | dataset build | 2026-11-14 |
| Curiosity RAD reduced data (PDS PPI) | <https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/> | Surface dose rate in µGy/h, including the Sep 2017 solar storm | ASCII, one 65 MB file per sol | dataset build | 2026-11-14 |
| NASA DONKI | <https://api.nasa.gov/DONKI/> | Solar particle events, CMEs, model-predicted CME arrival at Mars | JSON API; `DEMO_KEY` allows about 10 requests an hour, a free key removes the limit | dataset build | 2026-11-14 |
| Perseverance MEDA (PDS Atmospheres) | <https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/> | Pressure, temperature, wind, humidity at Jezero | CSV per sol | dataset build | 2026-11-14 |
| Mars 2020 raw image API | <https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json> | Rover camera frames with site and drive counters that match the waypoints | JSON API, JPEG and PNG | dataset build | 2026-11-14 |
| Sounds of Mars | <https://science.nasa.gov/mission/mars-2020-perseverance/sounds-of-mars/> | Perseverance microphone recordings | MP4 | dataset build | 2026-11-14 |
| NASA Image and Video Library | <https://images.nasa.gov/> | Jezero and Ingenuity video | JSON API at `images-api.nasa.gov`, MP4 | dataset build | 2026-11-14 |
| NASA Mars 3D models | <https://mars.nasa.gov/system/resources/gltf_files/25042_Perseverance.glb> | Perseverance and Ingenuity models | glTF binary | dataset build | 2026-11-14 |

Links that did not work: the DONKI mirror at `kauai.ccmc.gsfc.nasa.gov` timed out, the DONKI flare endpoint returned 404, and the waypoint panoramas under `mars.nasa.gov/mmgis-maps/M20/Layers/mosaics/` returned 403.

Before adding a link, check that it is publicly accessible without a login and note any license or credit requirement.
