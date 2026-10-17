# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project
Offline, single-file educational app: a French "visual dictionary" of the house vocabulary for primary school, in 4 languages (fr source; ht/en/es are [auto] translations). Plain ES5-style JavaScript, no runtime dependencies, no framework.

## Commands
- `npm install` — dev dependencies only (jsdom, axe-core, playwright for tests).
- `npm run build` — runs blocking checks (`src/checks.js` + `CORE.lint`) then writes `dist/dictionnaire-visuel-maison.html`. Build fails on any missing translation, hidden arrow target, duplicate id, low contrast, network call, innerHTML, etc.
- `npm test` — build + `tests/core.test.js`, `tests/content.test.js`, `tests/ui.test.js` (jsdom + axe-core). Run a single suite with `node tests/<name>.test.js` (ui test needs a fresh build).
- `npm run test:browser` — Chromium via Playwright (desktop + 390px mobile), writes screenshots to `rapport/captures/`.

## Architecture
- `src/template.html` holds CSS and placeholders `{{CONFIG}} {{CORE}} {{CONTENT}} {{MAP}} {{APP}}`, inlined by `build.js`.
- `src/content.js` (`CONTENT`): objects → parts with shapes (rect/circle/ellipse/poly/line in a 460×340 viewBox, drawn in list order, later = on top), arrow target `a`, names/definitions via `L(fr, ht, en, es)`, UI strings.
- `src/core.js` (`CORE`): i18n helpers, geometry (`partAt` = topmost part), label layout, validators, attempt engine (hint1 → hint2 → solution after 3 fails), linter, IndexedDB store with memory fallback, store-only ZIP, CSV.
- `src/mindmap.js` (`MINDMAP`): draggable mind map, info panel inside the frame.
- `src/app.js`: full re-render UI built with `textContent` only (never innerHTML).

## Conventions
- Every learner-facing string must exist in fr/ht/en/es; misconceptions start with "Croire que"; French part names start with an article.
- Keep the two-hints-before-solution rule, dropdowns over free inputs, real checkboxes for multiple choice, ≥44px targets.
