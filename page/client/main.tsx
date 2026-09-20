/**
 * What the browser runs (DECISIONS.md D-0059 rule 2, as the page's rebuild
 * leaves it).
 *
 * **Hydration and nothing else.** The document the browser receives is already
 * rendered by the server, as it was before the foundation changed: this file
 * attaches behaviour to what is there. It mounts no page of its own, fetches
 * nothing on load, and holds no router -- the whole of the surface's state is
 * still in the address (`src/access/page-logic/routes.ts`).
 *
 * **It never posts.** Approving, approving a scope, answering by option and
 * the scoped starts are presses, and a press is minted only from a person's
 * navigation carrying `Sec-Fetch-User: ?1` -- which a `fetch` does not send,
 * measured, even directly behind a click. So those stay real forms and submit
 * themselves; nothing here intercepts a submit. `test/access/web-app.test.ts`
 * fails if a press route ever answers a request without that header, which is
 * what keeps this paragraph true rather than merely intended.
 */
import { hydrateRoot } from "react-dom/client";
import { Faces } from "../../src/access/page/faces.js";

/**
 * Every island the server may have rendered, by the name it marks its root
 * with. A root whose name is not here is left as the server drew it, which is
 * the failure that costs least: static markup a person can still read.
 */
const ISLANDS: Readonly<Record<string, (props: never) => React.ReactNode>> = {
  faces: Faces as (props: never) => React.ReactNode,
};

for (const root of document.querySelectorAll<HTMLElement>("[data-island]")) {
  const name = root.dataset["island"] ?? "";
  const island = ISLANDS[name];
  const raw = root.dataset["props"];
  if (island === undefined || raw === undefined) {
    continue;
  }
  hydrateRoot(root, island(JSON.parse(raw) as never));
}
