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
  /**
   * What this host has seen written, as one short word that changes with it.
   *
   * **The one thing a page can say about how current it is.** `GET /` stamps
   * the page it serves with the mark of that moment
   * (`data-drawn-at` on `#ledger`), the page hands it back when it opens the
   * stream, and two equal marks are a proof no caller has to take on trust:
   * the store has not been written since that page was drawn, so
   * what the reader is holding is what the host would draw now. Different
   * marks are the three cases a comparison against the host's *present* view
   * would miss -- a write between the page's own `GET` and this stream, a
   * write while the reader was disconnected, and a restart of the host --
   * and each of them is one `change` and one redraw.
   *
   * It says nothing about *which* view changed, which is why it decides only
   * the first word of a stream: from there on what a reader is told is decided
   * by comparing the bytes of that reader's own page.
   */
  readonly mark: () => string;
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
  /**
   * The mark of the draw the reader has actually **finished showing**
   * ({@link PageChanges.mark}), or null where it says none.
   *
   * **Where the first word of the stream comes from.** The page this reader is
   * standing on was drawn before this stream opened, and the host cannot
   * recover its bytes -- so whether it is current is read off this mark
   * instead. Null is a page that claims nothing (one drawn before this host's
   * stamp, or a reader of rondo's own making), and it is read as *possibly
   * behind*: one `change`, one redraw, and from then on the comparison is of
   * bytes.
   *
   * **Finished, and not merely told.** It is the mark the page's own
   * `#ledger` carries, which only moves when a redraw was fetched and swapped
   * in (`src/access/page/document.tsx`, `page/live.js`) -- never the id of a
   * frame this host sent, which says no more than that a word arrived. A
   * reader told to redraw that then failed to fetch, or dropped off the
   * network mid-fetch, still holds the older draw and says so, so the stream
   * it opens next is told again rather than agreed with.
   */
  readonly held: string | null;
  /** Aborted when the reader goes away, so the bell loses its listener with it. */
  readonly signal: AbortSignal | null;
}

/**
 * One SSE frame.
 *
 * **No `id`, deliberately.** An `id` is what a browser hands back as
 * `Last-Event-ID` when it reconnects a stream of its own accord, and that is
 * the wrong thing for this host to compare against: it says a word *arrived*,
 * not that the redraw it asked for was fetched and shown. The draw a reader
 * holds is the one its own `#ledger` carries, and the page sends it on the
 * address of every stream it opens ({@link PageEvents.held}).
 */
const frame = (event: string, data: string): string => `event: ${event}\ndata: ${data}\n\n`;

/**
 * How many times one draw is taken again because the store moved under it.
 *
 * A bound rather than a loop that waits for quiet: a host being written to
 * without pause must still answer this reader, and an unsettled draw is read
 * as *possibly behind*, which costs one redraw and never a stale screen. What
 * reaching it means is in {@link PageEvents.shown}'s caller: the bytes are
 * kept as this reader's standing draw and **one more look is taken straight
 * away**, so the store is given the chance to hold still and the version it
 * holds still at is the one the last word is about.
 */
const PASSES = 3;

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
 * **The bytes a reader is standing on are the page it actually holds, and the
 * first word is decided by its mark.** The host has no copy of what it served
 * this reader, so a comparison can only ever start from the open draw -- and
 * starting there silently would lose every change made between that page's own
 * `GET` and this stream, while the reader was away, or across a restart of the
 * host, because both sides of that first comparison are already past it. So
 * {@link PageEvents.held} is compared with the mark the open draw settled at
 * instead: equal is a page that holds what the host would draw, and anything
 * else is one `change` on that draw and the page back in step.
 *
 * **Both halves of that comparison are of the same moment.** The mark is read
 * again after the draw and the draw is taken again where it moved, so a write
 * that lands while the open draw is in flight is on one side of the comparison
 * or the other and never lost between them -- which is the one way a reader
 * whose page was current as the stream opened could have been left holding a
 * screen nothing would ever ring about again. And the mark it is compared with
 * is the draw the page *finished*, so a reader that was told to redraw and did
 * not manage it is told again. A store that will not hold still for
 * {@link PASSES} draws ends that look on bytes of no one moment: the reader
 * hears about them, and the host looks once more of its own accord rather than
 * leaving them as the version every later comparison is against.
 *
 * `retry` is still named, so a browser that reconnects a dropped stream of its
 * own accord waits rather than hammers; `page/live.js` closes a failed stream
 * and opens it again on a growing wait of its own, saying on the address which
 * draw it is holding by then. With no bell there is nothing to hold the stream
 * open for: the token is sent and the response ends, as it did before. A
 * `204` -- no token and no bell -- is the one answer that ends the asking, and
 * the page reads it off the status rather than off the state of a source that
 * reports every failure the same way.
 */
export function pageEvents({ token, changes, shown, held, signal }: PageEvents): Response {
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
      /**
       * One draw of this reader's view, and the mark it is a draw *of*.
       *
       * **Read before and after, and taken again where the two differ.** The
       * draw is asynchronous, so a write can land in the middle of one: the
       * bytes are then of neither moment, and a mark read before the draw
       * would say they are of the earlier one. Taking the draw again until the
       * two reads agree is what makes the pair honest -- and where the store
       * will not hold still for {@link PASSES} of them, the later mark is
       * returned, which is a mark no page can be holding and so is read as one
       * redraw, with `still` false to say the pair is of no one moment.
       */
      const settled = async (): Promise<{
        readonly at: string;
        readonly now: string;
        readonly still: boolean;
      }> => {
        let at = changes.mark();
        for (let pass = 1; ; pass += 1) {
          const now = await shown();
          const after = changes.mark();
          if (after === at) {
            return { at: after, now, still: true };
          }
          if (pass === PASSES) {
            return { at: after, now, still: false };
          }
          at = after;
        }
      };
      const look = async (): Promise<void> => {
        if (drawing) {
          again = true;
          return;
        }
        drawing = true;
        try {
          const { at, now, still } = await settled();
          if (!open) {
            return;
          }
          // **The open draw is judged by its mark and every later one by its
          // bytes**, which is one comparison and not two: the host has no copy
          // of the page this reader already holds, so the first pass can only
          // ask whether the draw it just settled on is the draw the page says
          // it is showing. From then on it has those bytes and compares them.
          if (standing === null ? held === null || held !== at : now !== standing) {
            controller.enqueue(bytes.encode(frame("change", "1")));
          }
          standing = now;
          // **A draw that never settled is not where this reader is left.**
          // Its bytes are of no one moment, so taking them as the standing
          // draw and waiting for the next ring would compare the version
          // after it against a version the host never held -- and the ring
          // that would correct it is the bell's to send, which this module
          // does not get to assume: the real bell counts a write the moment
          // it is seen and rings a settle later, so a mark can move here with
          // no listener called yet. One more look is taken instead, until a
          // draw does settle; while the store holds still that is one extra
          // draw, and while it does not there is a change to tell about
          // anyway.
          if (!still) {
            again = true;
          }
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
