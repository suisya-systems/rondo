/**
 * `GET /events`, the one thing the host says to an open page (rondo#742).
 *
 * Out of `web-app.ts` for the reason `discard.ts` and
 * `github-sign-in-route.ts` are: that file is at its size cap, and a route
 * registered on the app it built is the unit that moves. What the stream *is*
 * belongs to `src/access/served.ts`, which compares and holds; what the bell
 * *is* belongs to `src/access/page-changes.ts`, which watches. This module is
 * the seam between them and the renderer: it reads the view and the language
 * off the reader's own address and hands `pageEvents` a way to draw that page.
 *
 * Read-only, as every other `GET` is: nothing here writes, and the token it
 * passes on is the one `GET /` already serves to the same reader.
 */
import type { Hono } from "hono";
import type { ServedPorts, WebPorts } from "./page/contract.js";
import { resolveLanguage } from "./page-logic/language.js";
import { viewOf } from "./page-logic/routes.js";
import { EVENTS_ROUTE, type PageChanges, pageEvents } from "./served.js";
import { operatorPage } from "./web.js";
import type { PageEnv } from "./web-app.js";

/**
 * The id every form carries in the draw this route compares against.
 *
 * **A fixed one, and it never reaches a browser.** The draw is never sent: it
 * exists so the host can tell whether what a page shows has changed, and a
 * minted id differs on every draw and would make every ring a change. The
 * shapes are the minters' own (`newMessageId`, `newScopeId`,
 * `newIterationId`), so the compared bytes are the real page's but for these.
 */
const WATCHED_UUID = "00000000-0000-0000-0000-000000000000";

/**
 * Register the route.
 *
 * It is handed the app's whole ports and the process's token, and asks them
 * the same questions `GET /` asks: a token only where something answers, a
 * naming form only where nobody is named, and a minter only where the port
 * that writes what it mints exists. The view is the one the page carries in
 * its own query, so the comparison is of the reader's own screen; the language
 * is resolved by the same five steps `GET /` uses (D-0056 rule 2), because a
 * page and the bytes it is compared against must be in one set.
 */
export function registerPageEvents(app: Hono<PageEnv>, ports: ServedPorts, process: string): void {
  const reading: WebPorts = ports;
  const changes: PageChanges | null = ports.changes ?? null;
  const token = ports.answer === null ? null : process;
  const namingToken = ports.naming === undefined || ports.naming === null ? null : process;
  const draws = {
    sends: ports.say !== null,
    scopes: ports.scope !== null,
    revises: ports.revise !== null,
  };
  app.get(EVENTS_ROUTE, (c) => {
    const query = new URL(c.req.url).searchParams;
    const wording = resolveLanguage({
      query: query.get("lang"),
      cookie: c.req.header("cookie"),
      host: reading.hostLanguage,
      header: c.req.header("accept-language"),
    });
    const view = viewOf(query);
    return pageEvents({
      token,
      changes,
      shown: async () =>
        await operatorPage(
          namingToken === null ? reading : { ...reading, namingToken },
          token,
          view,
          wording,
          draws.sends ? (kind) => `${kind}-${WATCHED_UUID}` : null,
          draws.scopes ? () => `scope-${WATCHED_UUID}` : null,
          draws.scopes || draws.revises ? () => `lap-${WATCHED_UUID}` : null,
        ),
      signal: c.req.raw.signal,
    });
  });
}
