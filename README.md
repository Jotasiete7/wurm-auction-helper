# Wurm Auction Helper

Web app that aggregates **Wurm Online** forum auctions (NFI and SFI), enriches each topic from the thread page, supports **favorites** stored in the browser, and includes a searchable **history** view built from offline forum snapshots.

## Features

### Live auctions

- **Northern Freedom Isles (NFI)** and **Southern Freedom Isles (SFI)** — loads the current listing page of the official forum auction boards (pinned help topics are skipped on list pages).
- **Favorites** — loads saved topic URLs from `localStorage` and fetches each thread server-side.
- Per auction: title, author, last activity time, starting bid, timer status (from countdown images in the post: `timer_*.svg` on nesgamepro or `{timestamp}.svg` on wurm-countdown), latest reply snippet when the thread has more than one comment, and a visual hint when less than 24 hours remain on an active timer.
- **Search** — filter live listings by title or player name.
- **Favorites first** — starred auctions are sorted to the top when browsing NFI/SFI lists.

### History

- **History tab** — browse past auctions without scraping the forum on every visit.
- **NFI / SFI selector** — same boards as live view, backed by pre-fetched data.
- **Search** — filter by title or author.
- **Date range** — filter auctions by creation date.
- **Pagination** — 25 entries per page, sorted newest first.
- Each card shows the **latest** and **second-to-last** comment (author, timestamp, message snippet).

### Other

- **i18n** — English and Portuguese (fixed corner language toggle).

## Tech stack

- React 18, TypeScript, Vite, Tailwind CSS, Lucide React
- Server-side HTML parsing with **Cheerio** inside a Vite dev/preview middleware (`/api/auctions`)
- Offline history pipeline: CLI scraper → full JSON in `data/` → lightweight index in `public/data/` for the UI

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

## History data pipeline

History is maintained **offline** via CLI and served to the UI as static index files. The full JSON dumps are not loaded by the browser.

### 1. Fetch forum history (CLI)

Scrapes listing pages and each auction thread. Output goes to `data/` (not committed by default if you add them to `.gitignore`; index files in `public/data/` are what the app serves).

```bash
# Test with a few pages
npm run fetch-history -- --forum nfi --pages 1-2
npm run fetch-history -- --forum sfi --pages 1-2

# Full fetch (slow — hundreds of pages, thousands of threads)
npm run fetch-history -- --forum nfi --pages 1-125 --output data/auction-history.json
npm run fetch-history -- --forum sfi --pages 1-471 --output data/auction-history-sfi.json
```

| Flag | Default | Description |
|------|---------|-------------|
| `--forum` | `nfi` | `nfi` or `sfi` |
| `--pages` | `1-2` | Page range, e.g. `1-125` |
| `--from` / `--to` | — | Alternative to `--pages` |
| `--output` | `data/auction-history.json` | Output file path |
| `--concurrency` | `3` | Parallel thread fetches |
| `--delay` | `400` | Milliseconds between requests |

### 2. Build UI index

Generates compact index files used by the History tab (title, author, date, last two comments only):

```bash
npm run build-history-index
```

Writes:

- `public/data/auction-history-nfi-index.json`
- `public/data/auction-history-sfi-index.json`

After updating history with `fetch-history`, always run `build-history-index` before deploying or testing the History tab.

### Data layout

| Path | Purpose | Approx. size |
|------|---------|----------------|
| `data/auction-history.json` | Full NFI snapshot (CLI) | ~5.5 MB |
| `data/auction-history-sfi.json` | Full SFI snapshot (CLI) | ~23 MB |
| `public/data/auction-history-nfi-index.json` | NFI index for UI | ~1.5 MB |
| `public/data/auction-history-sfi-index.json` | SFI index for UI | ~5.5 MB |

Full snapshot shape (per auction): `id`, `title`, `author`, `date`, `href`, `comments[]` with `author`, `timestamp`, `message`.

## Project structure (relevant paths)

```
scripts/
  fetch-history.ts          # CLI: scrape forum → data/*.json
  build-history-index.ts    # CLI: data/*.json → public/data/*-index.json
src/
  App.tsx                   # Live + History tabs
  components/HistoryView.tsx
  lib/auction-history/      # Types, scraper, history helpers
data/                       # Full snapshots (CLI output)
public/data/                # Index files served to the UI
functions/api/auctions.ts   # Cloudflare Pages handler (optional deploy)
```

## Disclaimer

Not affiliated with **Code Club AB**. Auction text and timers belong to their authors and the Wurm Online forum.
