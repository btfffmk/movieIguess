# Nebula migration

The canonical application remains `index.html` → `src/new-ui/netflix-ui.js`. The entry now delegates to `app.js`; the previous monolith and pre-watch duplication have been replaced by screen and service modules. Legacy root pages and their scripts remain as repository backups but are not included in the build.

## Local development

Use Node 22.12+ (Node 24 recommended), then `npm ci`, `npm run dev`. Vite serves the app at http://127.0.0.1:5502. `npm test` runs focused Node tests. `npm run build` creates `dist`, and `npm run preview` serves the production build at http://127.0.0.1:4173.

The browser calls TMDB directly. `VITE_TMDB_API_KEY` in `.env.local` can override the existing public browser key. This is configuration, not secret storage: Vite includes it in the browser bundle. No backend, account service, or database is needed.

## Modules and contracts

- `app.js` owns the persistent shell and route lifecycle; `router.js` parses hash routes and owns per-screen cancellation/disposal.
- `api.js` shares and caches metadata requests. Requests time out after 20 seconds, and the underlying fetch is cancelled when its last reader leaves.
- `storage.js` retains every original key and supports both array and keyed-object saved libraries. `profile-store.js` owns profile CRUD and the original five-hour session lifetime. Failed writes fall back to memory with a visible message.
- `catalogue.js` applies one policy to discovery, search, related titles and direct access. Kids profiles require US G/PG or TV-Y/TV-Y7/TV-G/TV-PG certification. Unknown ratings are excluded for kids and displayed as “Not rated” elsewhere. This is catalogue filtering, not a password-protected parental-control system.
- `discovery.js`, `profiles.js`, `title-page.js`, and `player.js` own screens. Shared presentation, native modal dialogs, and episode selection live in `ui.js` and `episodes.js`.
- `providers.js` retains all 16 existing server IDs and URLs. Continue Watching records the title, episode, and selected server; the app does not claim playback timestamps.
- `downloads.js` imports the provider only on demand. `getSources(media, { onProgress, signal })` preserves the previous media shape (`tmdbId`, `type`, `title`, optional `season`/`episode`). The provider retains the `window.MovieIGuessDownloadProvider` compatibility name when loaded, cancels closed requests, and times out after 60 seconds.
- `nebula.css` contains the new design tokens, components and responsive styling; `netflix-ui.css` is the compatibility entry. No old stylesheet is loaded.

## Cloudflare Pages

Keep project `nebula` and domain `nebula.btfm.uk`. Set the Git integration build command to `npm run build`, build output to `dist`, and Node version to 24. For a direct preview deployment, run `npm run build` then `npx wrangler pages deploy dist --project-name=nebula --branch=<preview-branch>`.

Only `dist` may be deployed. `public/_headers`, `public/_redirects`, the favicon and 404 page are copied to it. The old root deployment files are retained for legacy reference; they are not deployment inputs. HTML revalidates; hashed assets have immutable caching. The repository's unrelated pages, source, tests, environment files, and dependencies are excluded.

Verify the preview before promoting production. Record the current production deployment ID in the Cloudflare dashboard before release; roll back to it there if necessary. No production deployment is performed by the local build. Existing localStorage remains available only on the same origin; a preview, a new domain, or a different browser has a separate library.

The GitHub mirror must publish the Vite build rather than the unbuilt repository. Build with the existing relative base and deploy `dist` using the repository's GitHub Pages workflow, or use a static redirect-only mirror. The canonical redirect preserves path, query and hash. The Firebase config files remain historical references and are not part of this deployment.

## Verification checklist

Run tests/build, then verify name-only profile creation; optional title preferences; editing, switching and deletion; saved favourites after reload; search typing and empty states; kids search and direct-link restrictions; movie and TV playback, episodes and server changes; Continue Watching; download empty/failure/cancellation; browser Back/Forward/refresh; keyboard dialog focus and Escape; phone/tablet/desktop layouts and reduced motion. External player availability depends on the provider; a rendered iframe is not evidence that playback succeeds.
