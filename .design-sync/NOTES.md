# design-sync notes (rondo)

Target project: https://claude.ai/design/p/abec09ec-276c-47a9-a58d-5ae62ec5a4db

## How this repo is synced

- Package shape: no Storybook and no stories. rondo publishes no library, so
  `.design-sync/pkg/` is a small sync-only package: `index.ts` re-exports the
  React components under `src/access/page/` (nothing reimplemented), `tsconfig.json`
  extends the repo's config with `declaration: true`, and `package.json` names it
  `@suisya-systems/rondo-page`. The output (`.design-sync/pkg/dist/`) is gitignored.
- Build (`cfg.buildCmd`): `npm run build`, then `tsc -p .design-sync/pkg/tsconfig.json`,
  then copy `dist/page/app.css` and its two woff2 files into `.design-sync/pkg/dist/page/`.
  The copy is needed because the converter skips a `cssEntry` outside the package dir.
- Install follows rondo's AGENTS.md: `node vendor/pin.mjs check`, then `npm ci --ignore-scripts`.
  Node 22.17.0.
- Converter run: `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle`
  (the entry comes from `cfg.entry`).
- Render check: the machine has `~/.cache/ms-playwright/chromium_headless_shell-1248`, which
  `playwright@1.64.1` pins. Install that version into `.ds-sync/`.

## What is and is not synced

- Only the React half of the page is synced: the modules with `/** @jsxImportSource react */`.
  The rest of `src/access/` (screens, gate material, approve, composer, vocabulary helpers)
  is `hono/jsx` server JSX that renders to strings. It is not React and cannot be synced.
- **Excluded React modules:** `held.tsx` (`Held`) and `triage.tsx` (`TriageSection`, `GoalScreen`).
  They import `inbox.js`, `read-in.js` and `advisory/triage.js`, which reach `node:crypto`,
  `node:fs` and `node:net` through `src/store` and the vendored cadenza. esbuild cannot bundle
  them for a browser, and stubbing those modules would change what they draw.
- `chromeFor` (wording) is exported beside the components because every component takes a
  `wording` prop. It adds about 430 KB of strings to the bundle.
- `cfg.dtsPropsFor` holds hand-written props for 12 components. The extractor left domain
  types (`Governance`, `WorkStep`, `ThreadEvent`, `RequestList`, `LapResult`, ...) as bare
  names the design agent cannot see, and dropped `| null`. The bodies inline the structural
  types from `src/access/page-logic/*.ts`. `Chrome` stays a name, documented as `chromeFor(...)`.

## Preview gotchas

- **Each preview needs `/** @jsxImportSource react */` on its first line.** The repo's
  tsconfig sets `jsxImportSource: hono/jsx`, and without the pragma the preview JSX compiles
  to hono nodes ("Objects are not valid as a React child").
- Previews use `chromeFor("ja")` (one SideSteps cell uses `en`) and literal data shaped
  like the fixtures in `test/access/page/*.test.ts`.
- `cfg.overrides.<Name>.cardMode = "column"` on the wide faces so each cell gets full width.
- Fonts: Inter Variable and JetBrains Mono Variable ship. The CJK names in `--font-sans` and
  `--font-mono` are system fonts by D-0059's design (CJK stays on system fonts) and are listed
  in `cfg.runtimeFontPrefixes` to silence `[FONT_MISSING]`. Cards show the CJK text in the
  machine's system face.

## Known render warns / observations

- FoldedLine `Shut`: the fold is drawn open because the card's `<html>` lacks class `js`.
  `app.css` opens every `<details>` when there is no script, so this render is faithful.
- EmptySide `NoAllowance`: the figure grid shows an empty grey cell where the spend
  figures would be. The shipped component does this when `allowance` is null. It is real
  behaviour, possibly a rondo UI defect, and not a sync artifact.

## Re-sync risks

- `dtsPropsFor` copies type shapes from `src/access/page-logic/{governance,week,list,result,event-fold}.ts`
  and `src/access/page/{events,thread,thread-side,empty-side}.tsx`. When those types change,
  the hand-written bodies go stale silently. Diff them on every re-sync.
- The barrel in `.design-sync/pkg/index.ts` names modules by file. A new React module, or
  a renamed one, is not picked up until it is added there. `held.tsx` and `triage.tsx` are
  out until their node-only imports move off the render path.
- The compiled CSS holds only the classes rondo's own source uses (Tailwind `source(none)` +
  `@source "../src/access/**/*.tsx"`). The conventions header lists classes checked against
  this build. Re-check them when styles change.
- The playwright pin depends on this machine's browser cache (build 1248).
