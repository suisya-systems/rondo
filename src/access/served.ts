/**
 * What the page is served beside its views: the files of the manifest, and
 * the press token as an event stream (rondo#674). Moved out of `web-app.ts`
 * unchanged but for the token.
 */
import { readFileSync } from "node:fs";

/**
 * The files this process serves, as a fixed map from path to file (D-0059 R1).
 *
 * **The manifest's files, and nothing else static** (D-0059 R2 retired D-0054's
 * two hand-served scripts). The built files are named by `page.manifest.json`,
 * the digest list CI checks `dist/page` against, so the set this server will
 * serve and the set CI vouches for are one list -- the stylesheet, htmx, the
 * key script and the two faces; a name that is not a plain file name is dropped
 * rather than joined into a path. No request contributes to a path: an address
 * not in this map is a 404 even when a file of that name exists.
 *
 * Resolved against this module rather than the working directory: from
 * `src/access/` and from `dist/access/`, `../../` is the repository root. A
 * missing file is a 404 and not a 500 (D-0054 rule 7), which is also what a
 * test run before `npm run build` sees for the built half.
 */
export const SERVED: ReadonlyMap<string, { readonly file: URL; readonly type: string }> = new Map(
  Object.keys(
    JSON.parse(
      readFileSync(new URL("../../page.manifest.json", import.meta.url), "utf8"),
    ) as Record<string, string>,
  )
    /*
     * **A plain file name, or one under `assets/`, and nothing else.** The
     * bundler emits its output into a directory, so the manifest now holds a
     * name with a separator in it -- and the property this filter exists for
     * is unchanged: no request contributes to a path. The key comes from the
     * manifest, the value is built from the key, and the pattern still admits
     * no `..`, no leading `/` and no second level, so a manifest entry cannot
     * name a file outside `dist/page/`.
     */
    .filter((name) => /^(?:assets\/)?[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name))
    .map(
      (name) =>
        [
          `/${name}`,
          {
            file: new URL(`../../dist/page/${name}`, import.meta.url),
            type: typeOf(name),
          },
        ] as const,
    ),
);

/** A served file's content type, by its extension. */
function typeOf(name: string): string {
  if (name.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (name.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }
  if (name.endsWith(".svg")) {
    return "image/svg+xml";
  }
  return name.endsWith(".woff2") ? "font/woff2" : "application/octet-stream";
}

/** Where a page hears this process's press token (rondo#674), and how often it asks again. */
export const TOKEN_ROUTE = "/events";
const TOKEN_RETRY_MS = 5000;

/**
 * **This process's token, to a page drawn by an earlier one** (rondo#674). A
 * restarted host mints a new token (D-0041 rule 3b), and a screen drawn before
 * the restart would refuse the person's next press. The page listens here
 * (`page/token.js`) and writes the token into its forms. One event, then the
 * response ends and the browser reconnects after `retry`: a stream held open
 * would hold the server's close, and a host that is down is simply a reconnect
 * that waits. The token is what `GET /` already serves to the same reader,
 * under the same `Host` check; another origin cannot read it. `null` is a host
 * that draws no form, and a `204` tells the browser to stop asking.
 */
export function tokenEvents(token: string | null): Response {
  return token === null
    ? new Response(null, { status: 204 })
    : new Response(`retry: ${String(TOKEN_RETRY_MS)}\nevent: token\ndata: ${token}\n\n`, {
        headers: { "content-type": "text/event-stream", "cache-control": "no-store" },
      });
}
