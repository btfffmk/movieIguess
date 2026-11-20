# Nebula migration

The canonical application remains `index.html` → `src/new-ui/netflix-ui.js`. The entry now delegates to `app.js`; the previous monolith and pre-watch duplication have been replaced by screen and service modules. Legacy root pages and their scripts remain as repository backups but are not included in the build.

## Local development

Use Node 22.12+ (Node 24 recommended), then `npm ci`, `npm run dev`. Vite serves the app at http://127.0.0.1:5502. `npm test` runs focused Node tests. `npm run build` creates `dist`, and `npm run preview` serves the production build at http://127.0.0.1:4173.

The browser calls TMDB directly. `VITE_TMDB_API_KEY` in `.env.local` can override the existing public browser key. This is configuration, not secret storage: Vite includes it in the browser bundle. No backend, account service, or database is needed.

## Android app

The `android/` project packages the same Vite application with Capacitor. Its application ID is `uk.btfm.nebula`, its display name is Nebula, and its launcher/splash artwork is generated from `assets/logo.svg`. The packaged app uses an HTTPS local origin, so profile and library data remain in the Android WebView's local storage and are separate from data saved in a desktop or mobile browser.

Install Android Studio with Android SDK 36 and JDK 21 or newer, then run:

```sh
npm ci
npm run android:sync
npm run android:open
```

`android:sync` always builds the production web bundle before copying it into the native project. In Android Studio, select an emulator or connected device and run the `app` configuration. For a command-line debug APK, configure `ANDROID_HOME`/`local.properties` and run `android/gradlew assembleDebug` (`android\gradlew.bat assembleDebug` on Windows).

The `Android debug APK` GitHub Actions workflow provides the reproducible build path when a local Android toolchain is unavailable. It runs on Android-related pushes to `main` or can be started manually from the Actions tab. A successful run uploads `nebula-debug-apk` for 14 days; download and unzip that artifact to obtain `app-debug.apk`. Debug APKs are for testing only and are not suitable for Play Store submission.

Before a store release, increment `versionCode` and `versionName` in `android/app/build.gradle`, configure a private release signing key outside the repository, build an Android App Bundle, and complete the current Google Play privacy/content declarations. Do not commit `local.properties`, signing keys, APKs, or AABs. Embedded playback and downloads still depend on third-party HTTPS providers and must be tested on a physical device as well as an emulator.

## Modules and contracts

- `app.js` owns the persistent shell and route lifecycle; `router.js` parses hash routes and owns per-screen cancellation/disposal.
- `api.js` shares and caches metadata requests. Requests time out after 20 seconds, and the underlying fetch is cancelled when its last reader leaves.
- `storage.js` retains every original key and supports both array and keyed-object saved libraries. `profile-store.js` owns profile CRUD and the original five-hour session lifetime. Failed writes fall back to memory with a visible message.
- `catalogue.js` applies one policy to discovery, search, related titles and direct access. Kids profiles require US G/PG or TV-Y/TV-Y7/TV-G/TV-PG certification. Unknown ratings are excluded for kids and displayed as “Not rated” elsewhere. This is catalogue filtering, not a password-protected parental-control system.
- `discovery.js`, `profiles.js`, `title-page.js`, and `player.js` own screens. Shared presentation, native modal dialogs, and episode selection live in `ui.js` and `episodes.js`.
- `providers.js` retains all 16 existing server IDs and URLs. Continue Watching records the title, episode, and selected server; the app does not claim playback timestamps.
- `downloads.js` imports the provider only on demand. `getSources(media, { onProgress, signal })` preserves the previous media shape (`tmdbId`, `type`, `title`, optional `season`/`episode`). The provider retains the `window.MovieIGuessDownloadProvider` compatibility name when loaded, cancels closed requests, and times out after 60 seconds.
- `nebula.css` contains the new design tokens, components and responsive styling; `netflix-ui.css` is the compatibility entry. No old stylesheet is loaded.

## Cloudflare Workers

Both `nebula.btfm.uk` and `movies.btfm.uk` serve the production Worker. The Nebula hostname uses a Worker route over its existing proxied DNS record; retain that record. The movies hostname uses a Worker custom domain.

`worker/index.js` serves the ASSETS binding and emits a minimal `page_visit` log for HTML requests with country and HTTP status. Persistent logs sample 10% of requests; invocation logs and traces are disabled. View these under Workers & Pages → movieguess → Observability, filtering for `page_visit`. These are sampled page loads, not unique visitors or identified people. No IP, cookie, profile, URL, or query data is added to the custom log. Cloudflare's live debugging tail can still expose request metadata; use the saved custom logs for routine viewing.

The Worker also writes client-side route views to the `nebula_page_views` Analytics Engine dataset. Its fields are event type, normalized hash route, country, and hostname, with a count of one. Both browser and Worker use a closed route vocabulary: for example, `#/title/movie/123` becomes `#/title/movie/:id`, and unknown paths become `#/unknown`. All query parameters (including search text and episode selection) and extra fragments are discarded. There are currently no approved campaign or operational query fields. The analytics fetch omits credentials and referrers; it creates no cookie or visitor/session identifier. Request headers, raw IPs, auth tokens, profile data, and viewing history are never copied into analytics. Malformed or unsupported events are rejected without a data point. These counts cannot measure unique visitors or reconstruct visitor journeys. Browser-only profile and Continue Watching storage still support the app and are not exported. This changes future writes only; previously collected raw routes are not retroactively sanitized and should be handled separately under the dataset retention policy. Cloudflare creates the dataset on its first event; use the Analytics Engine dashboard or SQL API to group views by route, country, or hostname.

The connected Cloudflare service is the `movieguess` Worker at `movies.btfm.uk`. Its Git integration should run `npm run build` and then the existing `npx wrangler deploy` command. Non-production branches use `npx wrangler versions upload` to produce preview versions without promoting them. For a direct deployment, run `npm run build` and then `npx wrangler deploy`.

Only the Vite output in `dist` is uploaded as Worker static assets. `public/_headers`, `public/_redirects`, the favicon and 404 page are copied to it. The old root deployment files are retained for legacy reference; they are not deployment inputs. HTML revalidates; hashed assets have immutable caching. The repository's unrelated pages, source, tests, environment files, and dependencies are excluded.

Verify the preview before promoting production. Record the current production deployment ID in the Cloudflare dashboard before release; roll back to it there if necessary. No production deployment is performed by the local build. Existing localStorage remains available only on the same origin; a preview, a new domain, or a different browser has a separate library.

The GitHub mirror must publish the Vite build rather than the unbuilt repository. Build with the existing relative base and deploy `dist` using the repository's GitHub Pages workflow, or use a static redirect-only mirror. The canonical redirect preserves path, query and hash. The Firebase config files remain historical references and are not part of this deployment.

## Verification checklist

Run tests/build, then verify name-only profile creation; optional title preferences; editing, switching and deletion; saved favourites after reload; search typing and empty states; kids search and direct-link restrictions; movie and TV playback, episodes and server changes; Continue Watching; download empty/failure/cancellation; browser Back/Forward/refresh; keyboard dialog focus and Escape; phone/tablet/desktop layouts and reduced motion. On Android, additionally verify the system Back gesture, rotation, external links, full-screen playback, process restart persistence, and downloads on a physical device. External player availability depends on the provider; a rendered iframe is not evidence that playback succeeds.
