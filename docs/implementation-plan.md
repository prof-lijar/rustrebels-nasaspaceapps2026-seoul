# Implementation plan: Martian Map app

Rust Rebels · written 2026-11-14 · builds the [PRD](PRD-martian-map-app.md) on the prepared [dataset](../rust-rebels/dataset/README.md)

The hackathon ends on 15 November. The plan is ordered so that stopping after any milestone still leaves something to submit. Feature IDs (F1–F21) refer to the PRD.

## Before writing code

- Read the routing and layout guides in `rust-rebels/node_modules/next/dist/docs/`. This Next.js version differs from older ones (see `rust-rebels/AGENTS.md`).
- Use pnpm.
- Add the 3D packages: `pnpm add three @react-three/fiber @react-three/drei` and `pnpm add -D @types/three`. React is 19.2, so React Three Fiber must be version 9 or later.

## File layout

```
rust-rebels/src/
  app/app/
    layout.tsx          full-screen layout, no site header
    page.tsx            loads the client app
  features/mission/
    store.ts            mission state: clock, position, storm, hazards, route
    clock.ts            fixed-step simulation clock
    script.ts           the 30-second autoplay timeline
    data.ts             typed loaders for /dataset files
    terrain.ts          heightmap decode, height and slope lookup
    radiation.ts        dose-rate model
    route.worker.ts     A* route solver
    hazards.ts          seeded simulated objects
    advice.ts           SuperJar rule table
  features/scene/
    Terrain.tsx  Route.tsx  Scout.tsx  Astronaut.tsx  Hazards.tsx  Shelters.tsx
  features/views/
    MissionMap.tsx  ScoutView.tsx  HelmetHud.tsx  ViewSwitcher.tsx
  features/hud/
    DoseGauge.tsx  Minimap.tsx  Vitals.tsx  Consumables.tsx  HeadingTape.tsx  Credits.tsx
```

## Milestones

### M1. Terrain on screen (F1, F2)

1. Create the `/app` route and layout. Add an "Open the app" button on the homepage.
2. `data.ts`: fetch `terrain.json`, `height_1024.u16`, `ortho_2048.jpg`.
3. `Terrain.tsx`: a 1,024-segment plane displaced by the heightmap, textured with the image, tinted Mars orange. Row 0 is north.
4. Orbit camera, sky colour, distance fog.

Check: the delta scarp sits in the north-west and Belva crater right of centre, matching the dataset preview. Frame rate holds at 60.

### M2. Mission state and route (F3, F4)

1. `store.ts` and `clock.ts`.
2. `terrain.ts`: height and slope lookup at any scene position.
3. `route.worker.ts`: A* on the 4 m grid from the landing waypoint to a delta-front stop taken from `rover.json`.
4. `Route.tsx` draws the path on the terrain. `ViewSwitcher.tsx` adds the three tabs and number keys.

Check: the route never crosses a cell steeper than 25°. Switching views keeps time and position.

### M3. Scout and helmet views (F5, F6)

1. `hazards.ts`: seeded objects near the route.
2. `Scout.tsx`: the Ingenuity model flies the route; objects reveal within sensor range; the route re-solves.
3. `ScoutView.tsx`: chase camera, "not in base map" labels, detection list.
4. `Astronaut.tsx` and `HelmetHud.tsx`: first-person camera on the route with heading tape, waypoint, hazard callout, minimap, vitals and consumables.

Check: at least three detections, and the route visibly changes after the scout pass.

### M4. Radiation and storm (F7, F8)

1. `radiation.ts`: the PRD formula, reading `rad_sep_2017-09.json` and `skyview_1024.png`.
2. `DoseGauge.tsx`: dose rate, EVA dose, colour band relative to baseline.
3. Storm trigger in `script.ts`: replay the measured rise, show the DONKI record, switch the route to the nearest shelter.
4. `advice.ts`: continue, reroute, shelter or abort.

Check: the quiet reading is about 11 µGy/h, the peak about 24.6. The HUD, route and advice all change within a second of the trigger.

### M5. Autoplay and credits (F9, F10)

1. `script.ts`: the 30-second timeline from the PRD, with camera moves and view switches.
2. Replay button. Any key press hands over control.
3. `Credits.tsx`: sources from the dataset README, and a "simulated" tag component used on every simulated value.

Check: three untouched runs from page load are identical. This is the P0 finish line. Deploy and record the video here.

### M6. P1 features, in this order

Each is independent, so take them one at a time and stop when time runs out.

1. F11 free control.
2. F15 sound. Someone must first listen to `sounds_of_mars.mp3` and pick a wind loop.
3. F12 uncertainty score.
4. F14 Navcam frames at the four stops.
5. F16 weather strip.
6. F13 SuperJar chat, canned first, live model second.
7. F17 terrain detail.

## Submission checklist

- [ ] `/app` works on the public URL in Chrome, Safari and Firefox.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm build` pass.
- [ ] 30-second video recorded from autoplay.
- [ ] Deck slides 2, 5 and 8 updated to match the data (PRD section 9).
- [ ] Seven-slide deck states which values are simulated.
- [ ] Project page lists data sources with credits, and declares AI tool use if the Space Apps rules ask for it (check the participant guide).
- [ ] Repository is public and the README explains how to run and how to rebuild the data.

## Who does what

| Person | Work |
| --- | --- |
| Li Jar | M1–M6, deployment, video |
| Dr. Amar | Review PRD section 9, answer the open decisions in section 12, check radiation wording on the HUD and slides |

## Known gaps carried into the build

- Navcam frames exist only for the crater floor. The delta-front stops will have no photo unless more are pulled.
- DONKI flare and shock records are missing. A free NASA API key and one re-run fixes it.
- No dust-opacity data, so the dust hazard from the deck has no data behind it.
