# Rust Rebels

A Next.js + TypeScript starter website for Rust Rebels, with App Router, Tailwind CSS 4, ESLint, and a responsive Mars-themed homepage.

## Run locally

Use Node.js 24 (see `.nvmrc`) and pnpm (see `packageManager` in `package.json`), then:

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000 for the pitch and http://localhost:3000/app for the game. No environment variables are required.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Development server with hot reload |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint checks |
| `pnpm typecheck` | Generate route types and check TypeScript |

## Project layout

- `src/app/page.tsx`: homepage content and sections
- `src/app/app/page.tsx`: the Marswalk game at `/app`
- `src/features/game/`: game engine (`engine.ts`, three.js), terrain lookups and route solver (`world.ts`), HUD (`MarsGame.tsx`, `game.css`)
- `public/draco/`: Draco decoder copied from three.js, needed to load NASA's compressed suit models
- `public/dataset/`: NASA terrain, radiation and model files the game loads; see `dataset/README.md`
- `src/app/layout.tsx`: root layout and site metadata
- `src/app/globals.css`: Tailwind import and visual styles
- `src/components/slide-deck.tsx`: pitch deck viewer (popup, arrow keys, Enter for full-screen presentation)
- `src/lib/deck.ts`: slide list and PDF link for the deck viewer
- `public/images/`: local website assets
- `public/slides/`, `public/deck/`: rendered deck slides and the source PDF
- `scripts/render-slides.sh`: re-renders `../docs/RustRebels_MartianMap.pdf` into `public/slides/` (needs `brew install poppler`)
- `next.config.ts`: Next.js configuration
- `.env.example`: environment variable guidance

The `@/*` import alias points to `src/*`. TypeScript strict mode is enabled. System fonts keep builds independent of external font services.

## Content and assets

Team identity and mission copy come from `../docs/rust-rebels-team-identity.md`. The homepage is the pitch. The playable map is at `/app`.

`public/images/rust-rebels-team.png` (hero) and `public/images/rust-rebels-poster.png` (crew section) come from `../docs/assets/`. Both are generated fictional expedition art; the suited figures do not depict actual team members.

## Framework documentation

- https://nextjs.org/docs/app
- https://www.typescriptlang.org/docs/
- https://tailwindcss.com/docs

## Marswalk game (`/app`)

A first-person and third-person walk across the Jezero delta front on HiRISE terrain. SuperJar (the scout drone) flies the route first and flags obstacles that are not in the base map, then a solar storm forces a reroute to shelter. The rover follows the astronaut, takes orders by chat or map click, recharges the suit, and drives to meet the astronaut as shelter when the storm hits.

| Key | Action |
| --- | --- |
| W A S D, mouse | Move and look (click the scene first) |
| Shift, Space | Run, jump |
| V, or 1 / 2 / 3 | First person, third person, mission map |
| P | Auto-walk the route |
| T | Trigger the solar storm now |
| N | Sound on / off |
| Enter or C | Talk to SuperJar or the rover, whichever tab is open in the left panel |
| G, or click the minimap | Expand the map; click a point to send SuperJar or the rover there |
| B | Call SuperJar back |
| Q | Remote control: SuperJar, then the rover, then back to you. The camera follows the one you drive |
| F | Rover follow / park |
| Suit button | Change the astronaut's suit: five game-art suits and two NASA suit models (EMU and ACES). Also on the start screen |
| E | Beside the rover: plug in for oxygen and battery |
| R | Restart the mission |

The left panel has two tabs: SuperJar (the drone) and Rover. Quick orders, the chat box and map clicks go to the open tab. A message that starts with "rover" or "superjar" goes to that one whichever tab is open.

The "Data" button in the game lists what is real NASA data, what we derived, and what is simulated.
