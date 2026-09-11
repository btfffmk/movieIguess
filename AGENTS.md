# Repository Guidelines

A static, no-build vanilla-JS frontend for discovering movies/series via TMDB. Deployed to **Cloudflare Pages** (project `nebula`, custom domain `nebula.btfm.uk`) with GitHub Pages as a mirror (`src/new-ui/canonical-redirect.js` redirects `btfffmk.github.io/movieIguess` → `https://nebula.btfm.uk/<path>`). The repo currently hosts TWO UI generations: a canonical ES-module SPA in `src/new-ui/` and a legacy multi-page Tailwind app kept as a backup. **Work on the new UI unless the user explicitly asks for the legacy pages.**

## Project Overview

- **Purpose**: Netflix-style discovery UI for movies, series, anime, K-dramas, etc., driven by the TMDB v3 API. Up to 5 local profiles (incl. kids), My List, Continue Watching, in-page embedded playback, and an optional download provider.
- **Persistence**: Browser `localStorage` only. No backend runtime, no account system.
- **Stack**: Plain HTML + ES modules (new UI) / classic scripts (legacy) + CSS. No framework, no bundler, no TypeScript, no Prettier, no ESLint, no test framework, no CI.

## Architecture & Data Flow

### Two coexisting generations
1. **NEW UI (canonical)** — `index.html` is a 20-line shell that loads, in order:
   - `src/new-ui/canonical-redirect.js` (in `<head>`, IIFE)
   - `src/new-ui/download-provider.js` (classic script — sets `window.MovieIGuessDownloadProvider`)
   - `src/new-ui/netflix-ui.js` (`<script type="module">` — only ES-module entry)
   - stylesheet `src/new-ui/netflix-ui.css`

   `netflix-ui.js` imports from `./profile-store.js` (localStorage profile CRUD) and `./prewatch-page.js` (pre-watch screen, download modal, episode picker). All views render into `<div id="app">` via `innerHTML` template literals. There is no URL routing; view switching is internal (`switchContentView`). Cross-context channels: `localStorage`, `window.*` globals (incl. `MovieIGuessDownloadProvider`, `kofiWidgetOverlay`), and `contentWindow.postMessage` to the YouTube hero/hover iframe.

2. **LEGACY UI (backup, do not extend unless asked)** — `legacy-index.html` → `viewMovie.html` → `WatchMovie.html`; classic scripts in dependency order: `src/loading.js` → `src/home.js` / `src/view.js` / `src/watch.js`, plus `src/search.js` and `src/toast.js` on every page. Pages communicate via URL params:
   - `viewMovie.html?movieId=<tmdbId>&type=movie|tv`
   - `WatchMovie.html?movieId|seriesId&type=movie|tv`

   Tailwind, typed.js, axios, and Font Awesome are all CDN-loaded. `src/new-ui/README.md` documents that `legacy-index.html` is the original `index.html` kept as a backup.

### External dependencies
- **TMDB v3** — base `https://api.themoviedb.org/3`; key is hardcoded as the literal `'97df57ffd9278a37bc12191e00332053'` in 6 files (`src/search.js` ×2, `src/watch.js`, `src/home.js`, `src/view.js`, `src/new-ui/netflix-ui.js`) and once inline in `legacy-index.html`. Treat as known debt; do not proliferate new copies.
- **Image CDN** — `https://image.tmdb.org/t/p/{original|w500|w780}` exposed as `IMG_ORIGINAL`, `IMG_W500`, `IMG_W780` in `netflix-ui.js`.
- **Embed players** — `WATCH_SERVERS` array in `netflix-ui.js` (vidfast, videasy, vidsrc.wtf, 111movies, smashy, vidlink, autoembed, multiembed, primewire, vidrock, vidnest, vidzee). Legacy `src/watch.js` has its own 14-entry server list.
- **Download provider** — `src/new-ui/download-provider.js` SSE-scrapes `https://hahaevilcraft.site` through providers `4khdhubnew` / `4khdhub`. To swap providers, replace the constants at the top of the file; `src/new-ui/download-provider.example.js` documents the `window.MovieIGuessDownloadProvider.getSources(media, { onProgress })` contract.
- **Hosting** — Cloudflare Pages (project `nebula`, custom domain `nebula.btfm.uk`). Configured via `wrangler.toml` (publish dir `.`); security/cache headers in `_headers`; legacy deep-link redirects in `_redirects`. `firebase.json` and `.firebaserc` are leftover from the previous Firebase deploy — safe to delete once the CF project is live.

### Data flow
TMDB → `api(path)` helper in `netflix-ui.js` (fetch + `api_key=` query, throws on `!ok`) → module state → `innerHTML` template literals → `data-*` event hooks. `profile-store.js` reads/writes namespaced `localStorage`; `prewatch-page.js` is invoked with a dependency-injection object of ~20 fns/constants from `netflix-ui.js`.

### `localStorage` schema (exact keys, all JSON)
- `movieiguess.profiles.v1` — `[{ id, name, color, kids, preferences[], favoriteTitles[] }]`. `id` from `crypto.randomUUID()` with `profile-${Date.now()}` fallback; default color `#e50914`. Legacy entry with `id: "default"` is filtered out on read.
- `movieiguess.activeProfile.v1` — `{ profileId, selectedAt }`; 5h TTL (`ACTIVE_PROFILE_MAX_AGE = 5*60*60*1000`); auto-cleared on stale or malformed input; tolerates legacy bare-string form.
- `movieiguess.myList.v1` — `{ [profileId]: { 'movie|tv-<id>': <entry> } }`.
- `movieiguess.watchProgress.v1` — `{ [profileId]: { 'movie|tv-<id>': { media_type, id, watchSeason, watchEpisode, startedAt, mode?, serverId? } } }`.
- `movieiguess.watchServer.v1` — plain string server id, validated against `WATCH_SERVERS`.

## Key Directories

- `src/new-ui/` — canonical SPA. ES modules: `netflix-ui.js` (entry, 6872 lines), `profile-store.js`, `prewatch-page.js`. Classic scripts: `download-provider.js`, `canonical-redirect.js`. Stylesheet `netflix-ui.css` (7288 lines). Plus `download-provider.example.js` template and `README.md` (documents module roles).
- `src/` — legacy scripts (`home.js`, `view.js`, `watch.js`, `search.js`, `toast.js`, `loading.js`).
- `src/assets/` — actively used: `logo.png` (favicon + inline logo), `details.png` (fallback poster/backdrop in prewatch-page.js). Orphans: `icon.svg` and `qrcode.png` live at `src/` root, NOT in `src/assets/`.
- Root HTML — see **Important Files** below.

## Development Commands

There is no `scripts` field in `package.json`; nothing to `npm run`. Both declared deps (`axios` 1.8.4 runtime; `vite` 6.2.3 devDep) are unused: axios comes from CDN; vite has no config and no `node_modules` is installed.

| Task | Command | Notes |
| --- | --- | --- |
| Local dev | Open `index.html` with VS Code **Live Server** (port 5502 is pinned in `.vscode/settings.json`) | Or any static server pointed at the repo root. |
| Deploy | Local: `npx wrangler login` once, then `npx wrangler pages deploy . --project-name=nebula`. Or push to `btfffmk/movieIguess` main with the CF Pages Git integration wired up (see **CF Pages setup** below). Publish dir is `.` per `wrangler.toml`; deploys every root HTML/CSS/src file. `_redirects` rewrites legacy deep links (`/viewMovie`, `/WatchMovie`) to `/legacy-index.html`; `_headers` adds security + long-cache for `/assets/*`. |
| Smoke check | n/a — no test runner | Manual: load each entry page in a browser, exercise profile gate → home rail → details modal → pre-watch → iframe playback → My List / Continue Watching. |

## Runtime / Tooling Preferences

- **Runtime**: browser only. No Node.js app server. Any Node requirement is incidental to the unused vite devDep (Node 18/20/22+).
- **Package manager**: none installed. `package-lock.json` exists for the unused vite/axios lock. Do not run `npm install` thinking it will set up a dev server — it won't.
- **Editor**: VS Code recommended; `.vscode/settings.json` pins Live Server port 5502.
- **No formatter / linter / type-checker** is configured. Match existing style when editing.

## CF Pages setup (one-time, on your machine)

1. **Revoke the leaked GitHub PAT** `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` at <https://github.com/settings/tokens> — pasting a `ghp_…` token in chat compromises it regardless of intent. After revoking, generate a fresh token only if you have an active local need (e.g. `git push` over HTTPS without a credential helper); never paste it in chat. **Note: a GitHub PAT is not required for any of the steps below** — CF Pages uses its own OAuth / GitHub App for repo connection, and `git push` from your shell can prompt for credentials without embedding them.
2. **Install wrangler** locally (no `npm install` in the repo — use `npx wrangler …` per-command or install globally: `npm i -g wrangler`).
3. **Authenticate with Cloudflare**: `npx wrangler login` — opens a browser to OAuth with your CF account. Pick the account that owns the `btfm.uk` zone.
4. **Create the project** (idempotent — skips if it already exists): `npx wrangler pages project create nebula --production-branch main`.
5. **First deploy** (uploads everything in `.`): `npx wrangler pages deploy . --project-name=nebula`.
6. **Bind the custom domain** `nebula.btfm.uk` to project `nebula`: in the CF dashboard → Pages → nebula → Custom domains → Set up a custom domain. CF will create the CNAME automatically (since `btfm.uk` is on CF).
7. **(Recommended) Wire up Git integration for auto-deploy**:
  - Dashboard → Pages → nebula → Settings → Builds → Connect to Git → pick `btfffmk/movieIguess`, branch `main`.
  - Build command: *(leave empty — static site)*. Build output directory: `.`.
  - Environment variables: none needed for now.
  - After this, every push to `main` deploys automatically. Local `wrangler pages deploy` is still valid for ad-hoc previews.
8. **Smoke-check** the deployed URL: load `https://nebula.btfm.uk/`, confirm profile gate, home rails, and pre-watch iframe render. Load `https://btfffmk.github.io/movieIguess/` and confirm the client-side redirect to `https://nebula.btfm.uk/<path>` fires.
9. **After CF is live and serving traffic**, delete the legacy Firebase artifacts: `firebase.json` and `.firebaserc`. Update this guide's Important Files row to drop them.


## Code Conventions & Common Patterns

- **Module system**: ES modules ONLY in `src/new-ui/`. Every other JS file is a classic script loaded via `<script src>` in dependency order; cross-file coupling is via `window.*` globals and inline `onclick="fnName()"` handlers (e.g., `changeServer`, `loadSeason`, `watchEpisode`, `closeModal`, `showDevToast`).
- **Naming**: `camelCase` for functions; `PascalCase` for legacy page entry points (`Home`, `WatchMovie`, `WatchTV`); `UPPER_SNAKE_CASE` for module constants (`API_KEY`, `WATCH_SERVERS`, `IMG_W500`, `DOWNLOAD_API`). DOM hooks use the `data-*` attribute convention (`[data-card]`, `[data-nav]`, `[data-toast]`, `[data-server-id]`, `[data-preplay-*]`, `[data-watch-*]`).
- **Rendering**: huge template-literal `innerHTML` assignments — re-render full sections rather than diff. Always pass user-controlled values through `escapeHTML(value)` (defined in `netflix-ui.js`).
- **Async**: native `fetch` + `async/await` only. The `api(path)` helper in `netflix-ui.js` is the canonical wrapper — it throws `'TMDB error {status}'` on `!response.ok` and returns parsed JSON.
- **Error handling**: `try { … } catch (e) { console.error(...); /* user fallback */ }`. Legacy pages use `showError()` from `src/loading.js`. New UI uses `console.warn` + degraded render. `src/toast.js` exposes `window.showToast/showSuccess/showError/showWarning/showInfo` for legacy pages; the new UI uses its own `showToast` driven by `[data-toast]` attributes.
- **State**: module-scope mutable state object in `netflix-ui.js`; legacy uses `window.*` (`window.currentPlayingEpisode`, `window.currentMovieTrailer`, `window.currentMovieBackdrop`, `window.createLoadingSkeleton`, `window.showError`).
- **Comments**: banner-style `/* ===== SECTION ===== */` separators in `netflix-ui.js`; JSDoc-lite at module tops in `profile-store.js` and `prewatch-page.js`.
- **Encoding gotchas (do NOT "fix" without confirming with the user)**:
  - `src/view.js` starts with non-UTF-8 bytes — `read` as text may fail; `grep` still works.
  - `src/new-ui/prewatch-page.js` starts with a BOM and contains mojibake (broken bullet/checkmark characters).
- **File-level watch-out in `netflix-ui.js`**: a top-level `const profileMenuButton = app.querySelector(...)` runs at module import before any render — the queried element is `null` at that point. Don't add similar top-level DOM queries.

## Important Files

| Path | Why it matters |
| --- | --- |
| `index.html` | Canonical entry. 20-line shell. Loads `canonical-redirect.js`, `download-provider.js`, then `netflix-ui.js` as a module. Stylesheet: `src/new-ui/netflix-ui.css`. |
| `src/new-ui/netflix-ui.js` | SPA entry. `startApp()` at EOF. Boot path: `getActiveProfileSession()` → `renderHome()` (active profile) or `showProfileGate()` (no/expired profile). |
| `src/new-ui/profile-store.js` | localStorage profile CRUD: `getProfiles`, `saveProfiles`, `addProfile`, `updateProfile`, `deleteProfile` (also clears active if matched), `setActiveProfile`, `getActiveProfileId`, `getActiveProfileSession`, `clearActiveProfile`. |
| `src/new-ui/prewatch-page.js` | Pre-watch screen, download modal, episode picker. Exports `openPreWatchPage(item, deps)`, `openDownloadModal(details, options)`, `openEpisodePicker(details, options)`, `downloadIcon()`. Dep-injected. |
| `src/new-ui/download-provider.js` | Classic script. Defines `window.MovieIGuessDownloadProvider.getSources(media, { onProgress })`. Constants at top: `DOWNLOAD_API`, `DOWNLOAD_PROVIDERS`. Replace constants to swap providers; `download-provider.example.js` documents the contract. |
| `src/new-ui/canonical-redirect.js` | Loaded by every page. Redirects `btfffmk.github.io/movieIguess` → `https://nebula.btfm.uk/<path>` (Cloudflare Pages), preserving search+hash. Gotcha: on any non-GitHub http host, non-home paths normalize to `/` — deep links land on the home page. |
| `src/new-ui/README.md` | Documents the new-UI module split and confirms `legacy-index.html` is the original `index.html` kept as a backup. |
| `wrangler.toml` | Cloudflare Pages config: `name = "nebula"`, `pages_build_output_dir = "."`, `compatibility_date = "2026-09-11"`, observability on. |
| `_headers` | Cloudflare Pages response headers: security defaults for `/*`, `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`, 24h cache for `src/new-ui/netflix-ui.{css,js}`. |
| `_redirects` | Cloudflare Pages redirects: legacy deep-link paths (`/viewMovie`, `/WatchMovie`) → `/legacy-index.html`; legacy HTML files themselves redirect to `/`. |
| `firebase.json` + `.firebaserc` | **Legacy**, leftover from the previous Firebase deploy. Safe to delete once the `nebula` Cloudflare Pages project is live and serving traffic. |
| `.env` | Gitignored. Holds secrets (TMDB key, etc.); never commit, never paste contents into chat. |
| `legacy-index.html`, `viewMovie.html`, `WatchMovie.html`, `src/home.js`, `src/view.js`, `src/watch.js`, `src/search.js`, `src/toast.js`, `src/loading.js` | Legacy multi-page UI. Kept as backup; not linked from `index.html`. Edit only if the user asks. |
| `toast-demo.html`, `nettech.html`, `dummy.html`, `404.html` | Utility/demo pages. `nettech.html` (Memorizer) and `dummy.html` (personal portfolio) are unrelated side projects. `dummy.html` references nonexistent `src/scripts/*.js` and `src/styles/style.css` (broken; do not "fix" without asking). |
| `style.css`, `view.css` (root), `src/icon.svg`, `src/qrcode.png` | Dead/orphan files — zero references in HTML/CSS/JS. Leave alone unless explicitly asked to clean up. |

## Testing & QA

- **Verification is manual.** Standard loop:
  1. Start Live Server (or any static server) on the repo root.
  2. Open `http://127.0.0.1:5502/` and exercise: profile create/edit/delete → kids toggle → ≥5 title preferences → home rails render → hero plays muted trailer → search → details modal → episodes → pre-watch → server picker → iframe playback → My List toggle → Continue Watching resume → download modal.
  3. On the legacy pages (`legacy-index.html`, `viewMovie.html?movieId=…&type=movie|tv`, `WatchMovie.html?movieId=…`), confirm hero/details/playback still work and the search modal opens.
  4. Confirm `404.html` renders when navigating to a missing path on Cloudflare Pages.
  5. Before `wrangler pages deploy`, sanity-check `wrangler.toml` (`pages_build_output_dir = "."`), `_redirects`, and `_headers`; deploys the whole repo root (no build), so any hidden change to root HTML/CSS will ship.
- **Don't add a test framework speculatively.** The user hasn't asked for one, and the static/hand-rendered nature of the app makes E2E tests expensive to set up. Smoke-test by clicking through instead.
