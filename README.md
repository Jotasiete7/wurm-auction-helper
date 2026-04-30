# Wurm Auction Helper

Web app that aggregates **Wurm Online** forum auctions (NFI and SFI), enriches each topic from the thread page, and supports **favorites** stored in the browser.

## Features

- **Northern Freedom Isles (NFI)** and **Southern Freedom Isles (SFI)** — loads the current listing page of the official forum auction boards (pinned help topics are skipped on list pages).
- **Favorites** — loads saved topic URLs from `localStorage` and fetches each thread server-side.
- Per auction: title, author, last activity time, starting bid, timer status (from `timer_*.svg` in the post), latest reply snippet when the thread has more than one comment, and a visual hint when less than 24 hours remain on an active timer.
- **i18n** — English and Portuguese (fixed corner language toggle, same idea as the Wurm Carpentry Tool).
- **Favorites first** — starred auctions are sorted to the top when browsing NFI/SFI lists.

## Tech stack

- React 18, TypeScript, Vite, Tailwind CSS, Lucide React
- Server-side HTML parsing with **Cheerio** inside a Vite dev/preview middleware (`/api/auctions`)

## API (local dev / `vite preview`)

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/api/auctions?forum=nfi` | Default. NFI forum listing + per-topic enrichment. |
| `GET` | `/api/auctions?forum=sfi` | SFI forum listing + enrichment. |
| `POST` | `/api/auctions` | Body: `{ "forum": "favorites", "hrefs": string[] }` — up to 80 HTTPS URLs on `forum.wurmonline.com`. |

> **Production:** `npm run build` outputs static assets only. The scraper runs in the Vite Node middleware, so **`npm run dev`** and **`npm run preview`** expose `/api/auctions`. For a static host (e.g. Cloudflare Pages), move this logic to a serverless function or small backend.

## Prerequisites

- Node.js 18+ (recommended 20+ if you upgrade Cheerio to the latest major)

## Scripts

```bash
npm install
npm run dev
```

App: `http://localhost:5173`

```bash
npm run build
npm run preview
```

## Disclaimer

Not affiliated with **Code Club AB**. Auction text and timers belong to their authors and the Wurm Online forum.
