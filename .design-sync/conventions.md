## How to build with rondo's page

rondo is a host app, not a component library. These components are the React half of
its operator page (`window.RondoPage`): the three faces (list, thread, side) and the
lines inside them. They take plain data props and draw no state of their own.

### Setup

- **Every component that takes `wording` needs a wording set.** Pass
  `chromeFor("ja")` or `chromeFor("en")` (both exported here). It holds every
  visible string; never hand-write labels the wording set already says.
- No provider or wrapper is needed. Styling comes from `styles.css` (one compiled
  Tailwind stylesheet plus rondo's own `.page-faces`, `.thread`, `.side-*` and
  `.ev-*` rules).
- Put `class="js"` on `<html>` to get the scripted look: without it every
  `<details>` fold is drawn open and `.js-only` elements are hidden (a deliberate
  no-script rule in `app.css`).
- Theme follows the OS. `data-theme="light"` or `"dark"` on `<html>` pins it.

### Styling idiom: Tailwind utilities over rondo's tokens

Only class names that already appear in rondo's source are compiled. Use these, and
check `_ds_bundle.css` before using any other utility.

| Family | Classes |
|---|---|
| Surfaces | `bg-background`, `bg-card`, `bg-muted`, `border-border`, `rounded-md`, `rounded-lg` |
| Ink | `text-foreground`, `text-muted-foreground`, `text-faint`, `text-link` |
| State | `text-wait-ink` `bg-wait-wash` (a person must act), `text-run-ink` `bg-run-wash` (running, neutral grey), `text-ok`, `text-fail` |
| Type scale | `text-meta` (13px), `text-body` (14px), `text-title` (16px), plus `font-semibold`, `font-mono` |
| Spacing | `px-3`, `py-2`, `px-4`, `py-3`, `p-3`, `space-y-2`, `gap-2` |

Colour rules from the code: **amber (`wait`) is reserved for "a person must act"**;
running is the neutral `run` family, never blue; **blue (`link`, `ring`) means "you can
touch this"**. The one filled button is ink, not amber:
`inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 font-semibold text-background`.
A card is `min-w-0 rounded-lg border border-border bg-card px-4 py-3`.

Tokens are CSS variables with both palettes in one `light-dark()`: `--background`,
`--foreground`, `--card`, `--muted`, `--border`, `--faint`, `--link`, `--ring`, `--wait`,
`--wait-ink`, `--wait-wash`, `--run`, `--run-ink`, `--run-wash`, `--ok`, `--fail`. Body text
is Inter Variable, then system CJK faces (the default; `font-sans`); code, ids and
amounts use JetBrains Mono Variable (`font-mono`, `var(--font-mono)`).

### Where the truth lives

Read `styles.css` and its import `_ds_bundle.css` before styling. Each component's
`.d.ts` spells out its full data shape; its `.prompt.md` shows a working composition.

### Composition

`Faces` (or `Shell`) lays out the page; `RequestsFace` fills the list face;
`ThreadFace` fills the thread face, taking `GovernanceLine` and `ResultLine` as nodes;
`ThreadSide`, `EmptySide`, `ScopeSide` or `PartsSide` fill the side face.

```tsx
const ja = chromeFor("ja");
<Faces
  list={<RequestsFace wording={ja} list={list} hrefOf={(id) => `/?thread=${id}`}
    agoOf={() => "12分前"} allowance={null} newRequestHref="/?new=1"
    lastLookedSaid="" openId={null} />}
  thread={<ThreadFace title="請求書に税額の内訳を出したい"
    governance={<GovernanceLine wording={ja} governance={governance} askedSaid="25分前" />}
    result={null} walk={null} items={items} foldOpen="開く" lastLookedAbove={null}
    lastLookedSaid="" answering={null} adding={null} acts={null} next={null} />}
  side={<ThreadSide wording={ja} governance={governance} steps={steps} material={null} asking={false} />}
/>
```

The answer box, the approve form, the goal and triage blocks and the gate screens are
drawn server-side and are not in this library. When a design needs them, build them
from the classes above.
