# Revision validation

## Scope and outcome

All three supplied findings reproduced against the original committed export and were fixed. Runtime edits are limited to `src/lib/feed.ts`, `src/lib/useWheelFeed.ts` and `src/App.tsx`; the existing visual styling and rhythm engine are unchanged. The README, design documentation, regression tests, review responses and rebuilt `dist/` complete the revision handoff. These are worker-run results, not independent certification.

The site was served from the real `dist/` at a `/preview/` subpath for interaction checks. Browser response fixtures were used only in disposable test scripts, never in application source or the export. The scripts advanced a virtual clock for long polling and pause cases; they did not wait two minutes in real time. Scratch scripts and dependencies are not shipped.

## Finding reproductions and fixes

| Finding | Evidence before change | Fix and final recheck |
| --- | --- | --- |
| `b1a86a27…` — missing README, high | `git ls-files -- '*README*' '*readme*'` returned no files; no README existed on disk. | `README.md:3` now opens with the exact required community sentence and startup commands. It includes install, preview, rebuild, validation results, and a reserved canonical IMD job URL line. |
| `13de8e5e…` — stale data shown Live, high | Chromium at 390×844: a response generated ten minutes earlier with a 601-second-old observation displayed Live / Measured 1 s ago and enabled live start. An initially fresh frozen response remained Live after 44 three-second clock advances and repeated successful polls. | `src/lib/feed.ts:40` now includes response age at receipt and retains monotonic age for the same observation and epoch. `src/lib/useWheelFeed.ts:24` keeps the preceding successful reading. Final export shows Stale / Measured 10 min ago for the old response, and Stale / Measured 2 min ago for the repeated response, with live starts disabled. A newer observation restores Live and live starts. |
| `469b531e…` — paused time included, medium | Immediately pausing Practice, advancing 5.2 seconds and ending showed 0:05. Resuming and immediately pausing before ending showed 0:00. | `src/App.tsx:105` uses the pause timestamp when ending a paused set. Both browser paths now show 0:00. Three component tests also verify both paths and two pauses separated by three seconds of actual playing time, reported as 0:03. |

Full IDs and verdicts are in `../.imd-responses.json`.

## Commands and executed results

Dependencies were installed from the unchanged lockfile into a disposable copy of the project at `test/scratch/build/`. This kept the repository's dependency paths untouched. Source equivalence was checked with `diff -qr src test/scratch/build/src` before the final production build. The resulting export was copied back to root `dist/`.

| Executed command/check | Actual result |
| --- | --- |
| `npm ci --prefix test/scratch/build --cache test/scratch/npm --no-audit --no-fund` | Exit 0; 132 packages installed in scratch. |
| Baseline `npm test --prefix test/scratch/build` | Exit 0; the original 15 tests passed despite the reported bugs. |
| `npm run typecheck --prefix test/scratch/build` | Exit 0 after all regression tests were added. |
| `npm test --prefix test/scratch/build` | Exit 0; 24 tests passed in three files: 13 feed/tempo/distance, eight engine, three App pause-duration interactions. |
| `npm run build --prefix test/scratch/build` | Exit 0 after the final source change; TypeScript and Vite completed, 38 modules transformed. HTML 1.58 kB, CSS 10.42 kB, JS 166.91 kB as reported by Vite, plus local favicon and share image. |
| `node test/scratch/reproduce.mjs` | Executed before and after the fix against each export; reproduced both feed bugs and the paused-duration discrepancy, then confirmed corrected HUD/button and summary values. |
| `node test/scratch/validate.mjs` | Final run exit 0. Verified old-feed rejection, new-observation recovery, live start, offline fallback, Practice, keyboard and touch note hits (600 points total), pause/resume/end, sound persistence, best-score persistence, help keyboard open/close and focus return, summary focus, and reduced-motion Practice. Zero page exceptions or missing local resources. |
| Pinned `taste.mjs --out test/scratch/taste` | Completed: 15/16 checks passed. The script exits 0 when measurements complete, even with a failed check. Layout failed at 320px; see the baseline comparison below. |
| Pinned `taste.mjs test/scratch/baseline/dist --offline --out test/scratch/taste-before` | Completed against the original export read from Git, also 15/16; identical 320px layout findings. |
| Direct request to the real status API | HTTP 200; actual response contained online freshness, IDLE, RPM 0, distance 803370 mm, block 2110 and settled round 593. This single response checks the real schema, not future availability. |

The supplied browser tool failed before navigation with `Socket path too long`. Local Playwright used the available Chromium headless shell instead. The pinned taste probe ran unmodified through a scratch adapter that only selected that executable; checks and thresholds were unchanged. A first probe attempt using Playwright's default browser path could not find its expected executable. An initial online baseline probe terminated with exit 143; the subsequent offline comparison completed.

The first timed touch assertion in the interaction script missed a note after locator auto-waiting. The test was changed to pre-read pad coordinates, send a native touchscreen tap directly and await the score update. The final browser run scored both keyboard and touch hits without application changes. The shipped unit regressions do not depend on real-time browser scheduling.

## Better Interface review

The pinned workflow and core principles of all six domains were read and applied to the changed states and handoff. The established design was retained. Relevant findings were consolidated by cause rather than repeated per component.

| Domain | Coverage and evidence | Limitations |
| --- | --- | --- |
| Accessibility | Checked native buttons, meaningful names, status text in addition to color, the energy meter, keyboard lane hits, Escape pause, help focus return, summary focus, and reduced-motion paths. The probe passed target sizing at 390px. | No real screen-reader or native phone test; no full automated accessibility audit or complete keyboard/forced-colors review. The 36px Pause control is below the 44px comfort target but above the 24px minimum. |
| Layout | Checked source tokens and rendered ready, stale, playing, paused and summary states; inspected mobile and desktop screenshots. Measured 320, 390, 768 and 1440px widths. At 390×844, the main action ends near y=592px; no horizontal overflow at 390, 768 or 1440. | Existing 320px issue remains; detailed below. 200% browser zoom was not tested. RTL/localization are outside this English-only brief. |
| Writing | Checked labels against actions, explicit Practice mode and stale/offline recovery guidance. Corrected the underlying age and duration values so the existing copy is truthful. Added required community, run and canonical-URL documentation. | No new UI copy or visual rewrite. A public URL is assigned by IMD after submission. |
| Typography | Probe confirmed five sizes per viewport including one-off display text, one system font family, three weights and natural tracking. Source uses tabular numbers and wrapping data values. Screenshots reviewed at 390 and 1440. | OS font substitutions vary; no exhaustive font/platform matrix or text-resize testing. |
| Colors | Reviewed semantic tokens and status labels; probe passed measured solid-background text against its 4.5:1 normal / 3:1 large thresholds. | The probe excluded 14 text boxes over canvas/media/composited backgrounds. Their contrast is not claimed as measured. No second theme exists. |
| UI | Exercised ready/play/pause/summary, stale-to-live recovery, offline fallback, sound toggle, help and primary action states. Probe found no border-plus-shadow surfaces, nested cards, gradients, transition-all or endless reduced-motion animations. | No animation-panel slow-motion review or audible quality/latency test. Falling notes are essential motion; the existing short button press scaling remains under reduced motion. |

## Baseline limitations retained within revision scope

- **320px layout:** `src/styles.css:117` (header) and `src/styles.css:136` (utilities) produce a 341px document width at a 320px viewport, clipping the right edge of How to play. The probe also reports 26px of clipped hint text at 320×700 through the stage/overlay combination at `src/styles.css:378` and `src/styles.css:472`; overlay scrolling needs a separate layout review. The original export produced the same measurements. Styling is deliberately unchanged under the request to fix the three reported findings and leave the accepted implementation alone. This is a known remaining issue, not a passing responsive check.
- **WebKit:** downloaded and attempted to launch, but it reported missing host libraries including GTK 4 and GStreamer. WebKit interaction and rendering checks were not performed. No system libraries were installed.
- **Live browser network:** Chromium's direct navigation to the real API returned `net::ERR_EMPTY_RESPONSE`, while the separate Node request returned HTTP 200. The unmapped production page correctly showed Offline. Successful/live/stale transitions were verified using explicitly controlled response fixtures. Real browser connectivity from the eventual hosting origin remains unverified.
- **Clock:** detecting an already-old response initially depends on the device wall clock. Once an observation has arrived, monotonic aging prevents repeated responses or backward wall-clock changes from rejuvenating it. Unit tests cover this behavior.
- **Deployment:** export delivery is complete; IPFS pinning, public hosting and the canonical IMD job URL are provided by IMD after submission. No deployment command was run or hosted address invented.

## Evidence and completion

`evidence/ready-390.png` and `evidence/ready-1440.png` show the checked ready state with an unreachable feed. `evidence/stale-390.png` shows the controlled old-response fixture. `evidence/playing-390.png` shows the controlled fresh-response fixture while playing explicitly labelled Practice. Those fixture values are test evidence only. The compact `evidence/revision-results.json` preserves before/after values, browser results and the measured probe checks without scratch runtime paths.

Complete for the three reported revision findings. The remaining baseline layout issue and unavailable checks above are disclosed; no claim is made that every broader design check passed.

Packaging check: `dist/` has five files totaling 205,349 bytes and matches the final build byte for byte. HTML metadata and relative local asset paths were checked. Inherited ignore rules excluded the response JSON and artifacts, so `.gitignore` now names just those seven delivery files with explicit per-path budgets totaling 598,016 bytes. Dependency/cache exclusions remain at every nesting level; scratch tooling, downloads and baseline copies are excluded. The complete candidate submission, including the unchanged source and assets, is below the 8 MiB budget.
