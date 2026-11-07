# Squeek DJ design

## Overview

The existing game uses a dark playfield, four colored note lanes and a pink primary action. The wheel's status and the player's score flank the game on desktop and stack above it on phones. The narrow header adapts its spacing and brand size to keep both utilities visible. The canonical styles are in `src/styles.css`, with canvas art in `src/components/Playfield.tsx`.

## Colors

Components consume semantic CSS variables; their hex primitives are defined in `:root`.

| Semantic token | Value | Role |
| --- | --- | --- |
| `--color-bg` | `#0f1020` | Page background |
| `--color-surface` | `#181a30` | HUD, score, playfield, dialog |
| `--color-surface-raised` | `#23264a` | Secondary actions, pads, empty energy track |
| `--color-surface-hover` | `#343866` | Secondary and ghost hover |
| `--color-text` | `#f3f4ff` | Main text |
| `--color-text-secondary` | `#b4b8dc` | Labels, supporting text, disabled actions |
| `--color-accent-solid` / `--color-accent-hover` | `#ff7ab6` / `#ff9cc8` | Primary action |
| `--color-on-accent` | `#1d0b17` | Text on primary actions and pressed pads |
| `--color-focus` | `#cfe3ff` | Keyboard outline |
| `--color-status-live` | `#5be0a0` | Live label, healthy energy, Perfect |
| `--color-status-stale` | `#ffc857` | Stale label |
| `--color-status-offline` | `#ff6b6b` | Offline label, low energy, Miss |
| `--color-status-connecting` | `#8a8fb8` | Connecting label |
| `--color-scrim` | `rgb(15 16 32 / 0.94)` | Game overlays and dialog backdrop |

`LANE_COLORS` in `Playfield.tsx` supplies `#5cc8ff`, `#6ee7b7`, `#ffd166`, `#b49cff` in D/F/J/K order. Canvas notes and pad top borders share those colors. Status always includes a text label. The interface has one dark theme; there are no theme variants or gradients. Rendered contrast coverage and exclusions are recorded in `artifacts/validation.md`.

## Typography

The system font stack is `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. No fonts are downloaded. Actual glyphs depend on the platform's installed fonts. The observed weights are 400, 600 and 700.

| Token | Size | Use |
| --- | --- | --- |
| `--text-label` | 0.75rem / 12px | HUD labels, energy, footer |
| `--text-ui` | 0.875rem / 14px | Hints, status, mode label |
| `--text-body` | 1rem / 16px | Descriptions, buttons and brand at widths up to 22rem |
| `--text-value` | 1.25rem / 20px | Brand above 22rem, score values, pads, summary heading |
| `--text-display` | 1.75rem / 28px; 2.25rem / 36px at 60rem | Ready-state headline |

Body line height is 1.5; headings and buttons use 1.1, data values 1.3. Only the display headline uses negative tracking, at `-0.02em`, with balanced wrapping. Descriptions use pretty wrapping. Changing numbers use `tabular-nums`; data values can wrap with `overflow-wrap: anywhere`. Overlay text is limited to 26rem; help content to 65ch.

## Layout

Spacing tokens `--space-1/2/3/4/6` are 4/8/12/16/24px. The header is 56px high. Pads are 64px high with 8px gaps. Buttons are normally at least 44px high; the in-game Pause button is 36px high.

Below 60rem, `.layout` is a vertical flex stack with 12px horizontal padding and 8px gaps: HUD, score, then the game and pads. HUD and score data use three columns. The game expands to available height with a 360px minimum. Its ready, paused and summary overlays can scroll vertically. At widths up to 26rem, the Sound word is visually hidden while its accessible name stays present.

At widths up to 22rem (352px at the default root size), `src/styles.css:655` gives `.topbar` 8px inline padding (`--space-2`) and a 4px gap (`--space-1`), and `.brand` uses `--text-body`. The header stays 56px high; utility labels, controls and game layout keep their existing behavior.

At 60rem and wider, `.layout` becomes a three-column grid: `minmax(15rem, 18rem) minmax(22rem, 34rem) minmax(15rem, 18rem)`. The order on screen is HUD / stage / score. HUD data uses two columns, score data one. Desktop stage height is clamped between 480px and 820px. Panel padding becomes 16px and the layout's side padding 24px.

Rendered checks covered 320, 352, 353, 390, 768 and 1440 CSS pixels with default system fonts and with DejaVu Sans selected as the system font. The final export has no horizontal overflow at those widths. At 320×700 the help control ends at 312px; the game rectangle matches the original export. Header geometry above 22rem is unchanged. At 390×844 the main action remains wholly visible, ending near 592px with DejaVu Sans. The probe still flags the existing hint clipping at 320×700, documented in validation and outside this header revision.

## Elevation and depth

Surfaces are flat tonal fills with no shadows. Game overlays sit above the canvas using the dark scrim; the native help dialog uses the browser top layer with the same scrim backdrop. A 2px focus outline with a 2px offset identifies keyboard controls. Pads have a 4px colored top border; canvas lanes alternate low-opacity white fills over the dark playfield.

## Shapes

`--radius-control` is 12px for buttons and pads; `--radius-panel` is 16px for panels, stage and dialog. Mode labels use 8px corners, the energy track 4px and status dots 50%. Notes and targets are circles. Stage clipping is for canvas art; overlay content has its own vertical scrolling.

## Components and states

- `WheelHud.tsx`: labels core status, RPM, current BPM, distance, block height and settled round. Connecting/Live/Stale/Offline use text plus a colored dot. Missing values remain dashes. The age label now reflects cached response age and elapsed time across repeated observations.
- `ScorePanel.tsx`: shows score, streak, best streak and a named ARIA energy meter with its numeric value. Low energy changes color and its accessible value text.
- `Playfield.tsx`: draws four lanes and falling notes on canvas; the canvas is decorative to accessibility APIs. Its `engine`, `running`, `reducedMotion` and `onFrame` props keep rendering separate from gameplay. The hit line is at 86% of stage height.
- `App.tsx`: owns ready/playing/paused/summary states and the shared start actions. A fresh, turning wheel makes Start live set primary; otherwise Practice is primary. Stale/offline feeds disable live starts and explain how Practice remains available. D/F/J/K and pointer presses target four native pad buttons. Escape pauses/resumes. Ending while paused now excludes the outstanding pause from set length. Summary focus moves to its heading.
- `HelpDialog.tsx`: native modal dialog, opened by How to play, closed with Close or Escape, with focus returning to the trigger. Opening it during play pauses the set.
- Button classes in `styles.css`: `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-small`; hover, active, focus and disabled states reuse semantic tokens. Sound is a native toggle button with `aria-pressed` and a current-color SVG icon.

Button transitions last 150ms and pad color transitions 100ms. Energy width changes over 150ms. The shared easing is `cubic-bezier(0.2, 0, 0, 1)`. The 300ms judgement entrance runs only with no reduced-motion preference. Reduced motion also suppresses canvas beat pulses and expanding hit rings; essential falling notes, short color transitions and the existing button press scale remain. There are no endless decorative CSS animations.

## Reuse

Reuse the semantic tokens and existing type scale for new copy. Use the shared action styles and keep one action primary in each overlay. Keep directions beside controls and keep feed status separate from Practice tempo. Preserve the public field labels and tabular numeric styling when extending the HUD. If another static screen is added, reuse `.app`, `.topbar`, panel spacing and native button/dialog patterns, and keep navigation compatible with relative static URLs.

Design review used the supplied Better Interface guide by Jakub Krehel (MIT, commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`) and its adapted documentation method from Paul Bakaus's Impeccable (Apache-2.0, commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`). This document records the implemented source rather than introducing a new design system.
