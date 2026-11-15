# How we built the 3D Mars world

Notes for the presentation. Each section is written so it can be lifted onto a slide.
Full file list, credits and rebuild steps are in `rust-rebels/dataset/README.md`.

## One-slide version

**The ground in Marswalk is real Mars.** We took NASA's public elevation map of Jezero crater for the shape and NASA's orbital photo of the same place for the surface, and rendered them in the browser.

- **Where:** a 4,096 m square on the western floor of Jezero crater (77.3966–77.4657°E, 18.4133–18.4824°N). It holds the Perseverance landing site and the delta front.
- **Shape:** HiRISE elevation model, 1 m detail, from the Mars Reconnaissance Orbiter.
- **Surface:** HiRISE orbital photo mosaic, 25 cm detail.
- **Check:** our terrain matches the height Perseverance itself recorded at 260 waypoints to within 0.39 m (0.02 m in the median).

## The NASA data we used for the world

| What you see in the game | NASA data behind it | Credit |
| --- | --- | --- |
| Shape of the ground (hills, slopes, the delta scarp) | HiRISE elevation model mosaic, 1 m per pixel, made for Mars 2020 landing navigation | NASA/JPL-Caltech/University of Arizona/USGS |
| Picture on the ground | HiRISE orbital photo mosaic, 25 cm per pixel | NASA/JPL-Caltech/University of Arizona/USGS |
| Minimap and distant surroundings (20 km) | CTX camera mosaics, 6 m photo and 20 m elevation | NASA/JPL-Caltech/MSSS/USGS |
| Rover route and waypoints | 260 Perseverance waypoints, sols 13 to 717 | NASA/JPL-Caltech |
| Rover and SuperJar models | NASA 3D models of Perseverance and Ingenuity | NASA/JPL-Caltech |

Download source for the terrain: USGS, Mars 2020 Terrain Relative Navigation mosaics, https://planetarymaps.usgs.gov/mosaic/mars2020_trn/

## How the data becomes a 3D world

1. **Download.** Scripts fetch the raw NASA files (1.3 GB).
2. **Cut and shrink.** We cut out our 4,096 m square and reduce it to files a browser can load: elevation at 4 m per sample (1,024 × 1,024 heights) and the photo at 2 m per pixel (2,048 × 2,048).
3. **Build the ground.** In the browser, the game lays out a grid of points 4 m apart, lifts each point to its real elevation, and joins them into about 2 million triangles.
4. **Drape the photo.** The orbital photo is laid over that mesh as its texture.
5. **Light and render.** three.js draws it with a sun, haze and a sky, in real time.

The same elevation data also drives the gameplay, not just the picture:

- **Slope map:** where it is too steep to walk (over 25°) or to climb in a suit (38°).
- **Sky-view map:** how much open sky each spot sees, used to pick the 12 best terrain shelters.
- **Route planner:** finds a walkable path across the real slopes.

## What is real and what is not

| Real NASA data | Made by us |
| --- | --- |
| Ground shape and elevation | Orange tint (the orbital photo is greyscale) |
| Surface photo | Fine ground grain up close (an orbital photo is blurry at walking distance) |
| Rover waypoints | Sky colours and haze |
| Perseverance and Ingenuity models | Scattered rocks |
| Slope and sky-view maps (calculated from the NASA elevation data) | Hazards SuperJar finds: soft sand, rockfall, new boulder (simulated) |

## Numbers for the slide

| | |
| --- | --- |
| Site size | 4,096 m × 4,096 m |
| Elevation range | −2,602 m to −2,447 m |
| Elevation samples in the game | 1,024 × 1,024, one every 4 m |
| Surface photo in the game | 2,048 × 2,048, 2 m per pixel |
| Mean slope | 4.1° (0.85% of the site is steeper than 25°) |
| Terrain vs rover's own elevation | 0.02 m median difference, 0.39 m at most, over 260 waypoints |
| Raw NASA downloads | 1.3 GB |
| Files the browser loads | 58 MB |

## Tools

- **Data preparation:** Python scripts with rasterio, NumPy, SciPy and Pillow (`rust-rebels/dataset/scripts/`).
- **Rendering:** three.js (WebGL) inside a Next.js app. No game engine and no plugin: it runs in a desktop browser.

## Honest limits

- The game uses the elevation at 4 m per sample, not the full 1 m of the source, to stay fast in a browser.
- The surface colour is our tint. The HiRISE photo we used is greyscale.
- Close-up ground detail is generated noise, not data.
- Terrain gives little radiation shelter here: even the most shielded spots still see 88–93% of the sky.

## Credit line for the slide

Terrain and imagery: NASA/JPL-Caltech/University of Arizona/MSSS/USGS (HiRISE and CTX mosaics, Mars 2020 Terrain Relative Navigation). Rover positions and 3D models: NASA/JPL-Caltech. NASA does not endorse this project.
