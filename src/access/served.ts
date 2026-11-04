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

/** Where a page hears this process's press token (rondo#674) and what has changed under it. */
export const EVENTS_ROUTE = "/events";
const RETRY_MS = 5000;

/**
 * What tells this process that something a page may be showing has changed.
 *
 * **A thing the host rings, never a clock this module reads.** The host owns
 * what counts as a change (`src/access/page-changes.ts` watches the store's
 * files), and this module owns what a reader is told about it. While nothing
 * rings, no callback runs and nothing here draws anything.
 */
export interface PageChanges {
  /** Calls `fn` on every change, until the function it returns is called. */
  readonly listen: (fn: () => void) => () => void;
}

/** What a reader of {@link pageEvents} is answered with. */
export interface PageEvents {
  /** This process's press token, or null where this host draws no form. */
  readonly token: string | null;
  /** The bell, or null where this host has none: then the stream is the token alone. */
  readonly changes: PageChanges | null;
  /**
   * The page this reader is on, as it would be drawn now.
   *
   * **Compared, never sent.** It is drawn on a ring of the bell and on nothing
   * else, and the reader hears `change` only where the bytes differ from the
   * ones it is standing on -- so a write that does not reach this view tells
   * this page nothing, and a quiet host draws nothing at all.
   */
  readonly shown: () => Promise<string>;
  /** Aborted when the reader goes away, so the bell loses its listener with it. */
  readonly signal: AbortSignal | null;
}

/** One SSE frame. */
const frame = (event: string, data: string): string => `event: ${event}\ndata: ${data}\n\n`;

/**
 * **What a page hears from the host** (D-0054 as rondo#742 leaves it): this
 * process's token, and then a word every time what this page shows has
 * changed.
 *
 * **The token** (rondo#674). A restarted host mints a new one (D-0041 rule
 * 3b), and a screen drawn before the restart would refuse the person's next
 * press, so the token is the stream's first frame and the page writes it into
 * its forms (`page/live.js`). It is what `GET /` already serves to the same
 * reader, under the same `Host` check; another origin cannot read it.
 *
 * **The change.** The stream is then held open and says nothing until the
 * bell rings. On a ring this draws the reader's own view again and compares it
 * with what the reader is standing on: equal bytes are silence, and different
 * bytes are one `change` frame, which the page answers with one `GET` of its
 * own address and a morph of `#ledger` (`src/access/page/document.tsx`). No
 * timer runs on either side, which is the whole of what replaced `every 5s`.
 *
 * `retry` is still named, so a host that goes down is a reconnect that waits
 * rather than a page that gives up. With no bell there is nothing to hold the
 * stream open for: the token is sent and the response ends, as it did before.
 * A `204` -- no token and no bell -- tells the browser to stop asking.
 */
export function pageEvents({ token, changes, shown, signal }: PageEvents): Response {
  const headers = { "content-type": "text/event-stream", "cache-control": "no-store" };
  // `retry` rides on the first frame, as it did when the token was the whole
  // of the answer; with no token it is a frame of its own and needs its own
  // blank line to close it.
  const head = `retry: ${String(RETRY_MS)}\n` + (token === null ? "\n" : frame("token", token));
  if (changes === null) {
    return token === null ? new Response(null, { status: 204 }) : new Response(head, { headers });
  }
  const bytes = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      let stop: (() => void) | null = null;
      // **One pass at a time, and one more where a ring arrived during it**
      // (rondo#742): the draw is `await`ed, and two passes over one view would
      // race to say which bytes the reader is standing on.
      let drawing = false;
      let again = false;
      let standing: string | null = null;
      const close = (): void => {
        if (!open) {
          return;
        }
        open = false;
        stop?.();
        try {
          controller.close();
        } catch {
          // A reader that has already gone needs no close.
        }
      };
      const look = async (): Promise<void> => {
        if (drawing) {
          again = true;
          return;
        }
        drawing = true;
        try {
          const now = await shown();
          if (!open) {
            return;
          }
          if (standing !== null && now !== standing) {
            controller.enqueue(bytes.encode(frame("change", "1")));
          }
          standing = now;
        } catch {
          // **A draw that failed is not a change.** The page the reader has is
          // still the page the host last drew, and the next ring tries again.
        } finally {
          drawing = false;
          if (again && open) {
            again = false;
            void look();
          }
        }
      };
      controller.enqueue(bytes.encode(head));
      stop = changes.listen(() => {
        void look();
      });
      // The bytes the reader is standing on, drawn once as the page opens and
      // never on a clock.
      void look();
      signal?.addEventListener("abort", close);
    },
  });
  return new Response(stream, { headers });
}
