# Squeek DJ

Squeek DJ is a community project for the Squeekchain Buildooooor badge. It is a four-lane browser rhythm game whose tempo follows Squeektoshi's real wheel. Run it locally with `npm ci` and `npm run dev`; production and preview commands are below. Participation does not guarantee a badge or whitelist.

Canonical IMD job URL: ____________________

## Install, run and rebuild

Use Node.js 24 and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. To check, build and preview the production site:

```sh
npm run typecheck
npm test
npm run build
npm run preview -- --host 127.0.0.1
```

`npm run build` runs TypeScript and writes the complete static site to `dist/`. `npm run preview` serves that export; it does not rebuild it. Rebuild after changing source. The repository includes the source, `package-lock.json`, and the production export. Dependencies and caches are excluded from submission.

## Play

Choose **Start live set** when the feed is fresh, or **Practice at 100 BPM** at any time. Press D / F / J / K or tap the corresponding pads as notes cross the hit line. Perfect is within 60 ms, Good within 130 ms, and a later note is missed. Hits build score and streak; misses and stray taps drain energy. Escape or Pause pauses the set. Resume continues it, and End set shows the summary. Set length counts playing time and excludes pauses.

Sound is off initially. The Sound control enables Web Audio blips and saves that preference in this browser. The best score for each mode is also saved in localStorage; unavailable storage does not block play. Reduced motion removes the beat pulse, expanding hit rings and judgement entrance. Falling notes remain essential to timing the game.

## Live feed and distance

The only runtime network request is `GET https://api.squeekchain.com/v1/status`, polled about every three seconds while the tab is visible. Live RPM is `measurement.rpmMilli / 1000`, converted to a rounded tempo clamped to 48–176 BPM. Tempo changes glide toward that value one beat at a time. Practice always uses 100 BPM and is explicitly labelled.

The HUD shows the supplied core status, RPM, BPM, `measurement.distanceMm` as Distance tonight, block height and settled round. Missing data stays unavailable; there are no simulated live readings. Observation age includes the server's observation age, the response's age when received, and monotonic time since receipt. Repeated observations in the same counter epoch keep aging instead of becoming fresh on every poll. A non-online or expired observation is Stale; after ten seconds without a successful response, the feed is Offline. A newer fresh observation restores live starts. Initial age depends on the device wall clock; subsequent aging of an unchanged observation also uses a monotonic clock.

A live set ends after twelve seconds of sustained IDLE or zero RPM, twenty seconds of a bad feed while playing, or depleted energy. Hiding the tab pauses play. Wheel distance in the summary sums actual counter changes observed between readings during the set, including pauses; epoch changes or counter resets establish a new baseline. It is sampled distance, not an interpolated estimate. Practice can show measured wheel distance too, or No feed when none was available. It never manufactures distance from the practice tempo.

There is no wallet connection, account, key, token, contract, payment, backend or analytics. The live endpoint must allow requests from the hosting origin; Practice works when it is unavailable.

## Static hosting

Publish the contents of `dist/`. Vite uses `base: "./"`, and scripts, styles, favicon and share image use relative paths, so the same export works at an IPFS gateway subpath. There are no server routes or rewrites. IMD handles pinning and the public site address after submission; no hosted URL is invented here. The canonical job URL line above is reserved for IMD.

## Validation and design

The revision reproductions, executed checks, six-domain Better Interface review and remaining limitations are recorded in [artifacts/validation.md](artifacts/validation.md). [DESIGN.md](DESIGN.md) documents the existing implemented design. [.imd-responses.json](.imd-responses.json) answers each review finding.

Latest revision results: `npm run typecheck`, `npm test` (24 tests) and `npm run build` passed in an isolated scratch copy using the unchanged lockfile. Chromium reproduced the 341px-wide header at a 320px viewport with DejaVu Sans selected as its system font. The narrow-header fix keeps the page at 320px and How to play within 312px. Checks at 320, 352, 353, 390, 768 and 1440px passed with both font profiles, including help by touch/keyboard, focus return, sound persistence and Practice start/pause/resume/end. The game position and size match the original export. The pinned probe passed 15/16 checks: horizontal overflow is resolved; existing hint clipping at 320×700 remains outside this header revision. Current checks used a blocked API to exercise Offline; live service availability, WebKit and physical devices were not checked in this round. Prior feed/gameplay evidence and limitations remain in the validation history. Hosting is handled by IMD after submission.
