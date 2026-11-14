# PRD: Martian Map app

Rust Rebels · NASA Space Apps Challenge 2026 · Seoul · written 2026-11-14

Challenge: [Interplanetary Survival Guide: Martian Map](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/)

Inputs: the [call with Dr. Amar](NASA-Space-Apps-2026-Seoul-Call-Transcript.md), the [pitch deck](rustrebels-martian-map-deck.md), the [challenge resources](NASA%20Data%20%26%20Resources/README.md) and the prepared [dataset](../rust-rebels/dataset/README.md). The build order is in the [implementation plan](implementation-plan.md).

## 1. What we are building

A browser app at `<root-url>/app` in which anyone can run one Marswalk at Jezero crater, on real NASA terrain, from three viewpoints:

1. **Mission map.** A 3D view of the site with the planned route, the scout, hazards and shelters.
2. **SuperJar scout view.** The scout flies the route first and reports what has changed since the base map was made.
3. **Astronaut helmet display.** The astronaut walks the scouted route in first person, with radiation, hazards, a minimap, vitals and consumables.

One scripted solar storm interrupts the walk. The display turns red, the route changes to the nearest shelter, and SuperJar says whether to continue or leave.

The existing homepage at `/` stays as the pitch. `/app` is the product.

## 2. Why it fits the challenge

The brief asks for a map that helps a crew move safely through a new place, and names space weather, mobility in a suit, a route around obstacles and point-of-view imagery. Our answer to each:

| The brief asks for | What the app shows |
| --- | --- |
| A map of a chosen location with science objectives | Jezero delta front at 1 m resolution, with science stops along the route |
| A route that avoids obstacles | A route solved on real slope data, re-solved when the scout finds something new |
| The radiation environment and space weather | Live dose rate and EVA dose driven by Curiosity RAD readings, storm triggered by a real DONKI event |
| Suit mobility | Walking speed and consumables that depend on slope |
| Point-of-view imagery | Perseverance Navcam frames pinned to the places they were taken |
| A format: habitat display, tablet or helmet HUD | All three, as the three views |

## 3. Who it is for

- **Judges** (primary). They have minutes. They must understand the idea within 30 seconds of opening the link and without instructions.
- **The 30-second demo video.** The app must be able to play the whole story on its own so the recording is one take.
- **The public.** The link is open. No login, no install, no API key.

The astronaut and the habitat crew are the users inside the story, not users of this prototype.

## 4. Goals and non-goals

Goals:

- Open `/app` and reach a moving, understandable scene in under 5 seconds on a laptop.
- Tell the full story (scout, walk, storm, shelter) in a 30-second autoplay.
- Every number on screen traces to a NASA dataset or is labelled as simulated.
- Works in current Chrome, Safari and Firefox on a laptop. Usable on a phone.

Non-goals:

- Real sensors. There is no lidar, Timepix or camera feed. The scout's detections are simulated.
- A trained object detector. No YOLO model ships in the prototype.
- A physical dose calculation. We scale measured dose rates; we do not transport particles.
- More than one site.
- VR headset support, accounts, saved missions.

## 5. The 30-second story

This is the default autoplay and the script for the video.

| Time | View | What happens |
| --- | --- | --- |
| 0–5 s | Mission map | Camera settles on the Jezero delta. The planned route draws from the lander to the delta front. Label: "Base map: HiRISE, months old." |
| 5–12 s | SuperJar view | The scout flies the route. Two new boulders and one soft-sand patch are flagged "not in base map". The route bends around them. |
| 12–20 s | Astronaut HUD | The astronaut walks the updated route. Dose rate, EVA dose, waypoint distance, minimap and vitals are live. |
| 20–26 s | Astronaut HUD | Storm alert. HUD turns red, dose rate climbs, the route switches to the nearest shelter with time-to-shelter shown. |
| 26–30 s | Mission map | SuperJar's verdict: "Abort EVA. Shelter in 4 min. Dose this EVA 41 µGy." End card with the link. |

After autoplay, or on any key press, the user takes control.

## 6. Features

P0 is required for submission. P1 is built if P0 is done. P2 is stretch.

### P0

| ID | Feature | Done when |
| --- | --- | --- |
| F1 | `/app` route with its own full-screen layout, linked from the homepage | The page loads from the homepage button and directly by URL |
| F2 | 3D terrain from `height_1024.u16` and `ortho_2048.jpg`, tinted to Mars colours | The delta scarp and Belva crater are recognisable; 60 fps on a 2020 laptop |
| F3 | Three views with a switcher (`1`, `2`, `3` keys and on-screen tabs) | Switching keeps mission time and position |
| F4 | Planned route from the landing site to a delta-front science stop | A visible path that stays under 25° slope |
| F5 | Scout pass with simulated new-object detection | At least three objects appear with "not in base map" labels and the route changes |
| F6 | Astronaut HUD: heading, waypoint, dose rate, EVA dose, hazard callout, minimap, vitals, consumables | All readouts update while walking |
| F7 | Radiation model driven by the RAD series | Quiet dose rate reads about 11 µGy/h; the storm reaches about 2.2 times that |
| F8 | Storm protocol: detect, warn, reroute, shelter | Triggering the storm changes HUD colour, route and SuperJar's advice within one second |
| F9 | Autoplay of the 30-second story, with replay | Runs untouched from page load to end card |
| F10 | Data credits and a "simulated" tag on every simulated value | Visible in an info panel; no unlabelled invented number |

### P1

| ID | Feature |
| --- | --- |
| F11 | Free control: WASD walking in the HUD, orbit and zoom in the map |
| F12 | Uncertainty score: too many new objects in an area makes SuperJar advise leaving it |
| F13 | SuperJar chat: plain-language questions answered from the twin's state |
| F14 | Navcam frames shown at the four mapped stops |
| F15 | Sound: Mars ambience, alert tone on storm |
| F16 | Weather strip from MEDA: pressure, temperature, wind |
| F17 | Higher terrain detail near the camera (`height_2048.u16`, `ortho_4096.jpg`) |

### P2

| ID | Feature |
| --- | --- |
| F18 | Dose heat map draped on the terrain |
| F19 | 360° proximity ring in the HUD |
| F20 | Storm timeline panel with the real DONKI records |
| F21 | Phone layout tuned for touch |

## 7. How the simulation works

Each rule below is the whole model. Nothing else is hidden behind the numbers.

**Dose rate.** `dose_rate(position, time) = RAD(time) × sky_fraction(position) × vest_factor`

- `RAD(time)` is the measured detector-E dose rate from `rad_sep_2017-09.json`, replayed on a compressed clock. Quiet value about 11 µGy/h.
- `sky_fraction` comes from `skyview_1024.png`. On open ground it is 1.
- `vest_factor` is 1 unless Dr. Amar supplies a figure for the water vest.
- EVA dose is the running sum of dose rate over mission time.

**Storm.** A scripted trigger at a fixed mission time replays the 10–11 Sep 2017 rise. The alert text cites the DONKI record. The HUD goes red when dose rate exceeds 1.5 times the quiet value.

**Route.** A* search on the 4 m grid. Cost is distance, multiplied up with slope. Cells steeper than 25° and cells inside a hazard are blocked. The storm route minimises time to the nearest entry in `shelters.json`. It runs in a Web Worker so the scene does not stall.

**Scout detections.** A fixed list of invented objects (boulders, a sand patch, a rockfall) is placed near the route. The scout "detects" each when it comes within sensor range, and the object joins the hazard layer. The list is seeded, so every run and every recording is identical. These are labelled simulated.

**Uncertainty.** New objects per 100 m of route. Above a threshold SuperJar advises leaving the area.

**Vitals and consumables.** Heart rate rises with slope and during the storm. Oxygen, water and battery drain with time and effort. All simulated.

**SuperJar's advice.** A rule table over storm state, EVA dose, uncertainty and oxygen margin produces one of: continue, reroute, shelter, abort. The chat (F13) explains the current rule output in plain language; it never invents readings.

## 8. Data

Everything is already in `rust-rebels/public/dataset/` and described in the [dataset README](../rust-rebels/dataset/README.md).

| App layer | File | Real or simulated |
| --- | --- | --- |
| Terrain mesh | `terrain/height_*.u16` | Real (HiRISE) |
| Terrain image | `terrain/ortho_*.jpg` | Real (HiRISE), colour tint is ours |
| Slope and route cost | `terrain/slope_1024.png` | Derived from real |
| Shielding and shelters | `terrain/skyview_1024.png`, `shelters/shelters.json` | Derived from real, our method |
| Minimap surroundings | `terrain/context_*` | Real (CTX) |
| Rover path, science stops | `traverse/rover.json` | Real |
| Scout flight pattern reference | `traverse/helicopter.json` | Real (Ingenuity) |
| Dose rate and storm shape | `radiation/rad_sep_2017-09.json` | Real, measured at Gale crater |
| Storm alert | `space-weather/donki_2017-09.json` | Real |
| Weather | `weather/meda_sol_0120.json` | Real, one sol |
| Point-of-view photos | `images/` | Real |
| Rover and drone models | `models/*.glb` | Real NASA models |
| New objects, vitals, consumables, lidar, detections | none | Simulated |

## 9. What the data changed in our plan

Preparing the data turned up four things that differ from the deck. These need Dr. Amar's review.

1. **The storm is 2.2 times baseline, not "several-fold".** RAD read about 11 µGy/h before the 10 Sep 2017 event and 24.6 µGy/h at its peak. The deck's slide 2 says dose rate "jumps several-fold". The app uses the measured figure.
2. **The HUD colour bands need re-setting.** The deck uses green under 10, amber 10–20, red over 20 µGy/h. The measured quiet value is about 11, so a normal day would show amber. The PRD uses bands relative to baseline instead: green under 1.2 times, amber to 1.5 times, red above.
3. **Terrain is a weak shelter at this site.** The best standable spots still see 88–93% of the sky. Walking to the crater wall cuts dose by roughly a tenth at most under our geometric proxy. The storm protocol should lead with the rover or habitat and the water vest, with terrain as a partial help.
4. **Three deck datasets are not in the build.** CRISM, RIMFAX and MOLA are listed on slide 8 but not prepared. CTX replaces MOLA. CRISM and RIMFAX are out unless there is time.

The deck's mock HUD value of 9.2 µGy/h is close to the post-storm reading (9.4), so it can stay as an example but not as the quiet baseline.

## 10. Architecture

- **Framework.** The existing Next.js 16 app. `/app` is a new route with its own layout, no shared header.
- **3D.** three.js through React Three Fiber. No CesiumJS: one 4 km tile does not need a globe engine, and it would add load time.
- **State.** One mission store holding time, position, storm state, hazards and route. All three views read from it.
- **Simulation.** A fixed-step clock, separate from rendering, so autoplay is deterministic.
- **Route solver.** Web Worker.
- **SuperJar chat (F13).** A server route calling the Claude API, with the key in a server environment variable. If no key is set, the chat falls back to the rule table's canned explanations so the public link never breaks.
- **Hosting.** Vercel. The 58 MB of data is static and cached.

Budgets: first scene under 5 MB of downloads (the 4 m heightmap and the 2 m image), everything else loads after the scene is visible.

## 11. Risks

| Risk | Response |
| --- | --- |
| The 3D scene is slow on a judge's laptop | Start at the 4 m mesh; F17 detail is opt-in by frame rate |
| Autoplay drifts and the video take is unusable | Fixed-step clock and seeded objects make every run identical |
| A judge reads simulated values as real | F10 labels and the credits panel |
| The chat fails or the key leaks | Server-side key, canned fallback, P1 not P0 |
| Time runs out | P0 is a complete story on its own; P1 items are independent of each other |

## 12. Decisions needed

| Decision | Who | Default if no answer |
| --- | --- | --- |
| Accept the baseline-relative colour bands in section 9 | Dr. Amar | Use them |
| A dose reduction figure for the water vest | Dr. Amar | Show the vest, apply no reduction |
| What counts as "shelter" in the storm scene | Dr. Amar | Rover first, terrain second |
| Update deck slides 2, 5 and 8 to match the data | Li Jar | Update before submission |
| SuperJar chat with a live model or canned only | Li Jar | Canned, live if time allows |
