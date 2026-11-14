# Rust Rebels

A Next.js + TypeScript starter website for Rust Rebels, with App Router, Tailwind CSS 4, ESLint, and a responsive Mars-themed homepage.

## Run locally

Use Node.js 24 (see `.nvmrc`) and pnpm (see `packageManager` in `package.json`), then:

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. No environment variables are required.

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

Team identity and mission copy come from `../docs/rust-rebels-team-identity.md`. The homepage describes the team's aim; it does not implement a Mars map or route planner.

`public/images/rust-rebels-team.png` (hero) and `public/images/rust-rebels-poster.png` (crew section) come from `../docs/assets/`. Both are generated fictional expedition art; the suited figures do not depict actual team members.

## Framework documentation

- https://nextjs.org/docs/app
- https://www.typescriptlang.org/docs/
- https://tailwindcss.com/docs
