/**
 * What the host tells an open page, and when it says nothing (rondo#742).
 *
 * The page used to `GET` its own address every five seconds and morph the
 * answer in. What replaced it is one held-open `GET /events`: the host rings a
 * bell when something beside the store is written, draws the reader's own view
 * again, and says `change` only where the bytes differ from the ones that
 * reader is standing on. So the three claims worth a test are **that a quiet
 * host says nothing**, **that a change says exactly one word**, and **that a
 * write which does not reach this view is not a word to it** -- the last being
 * the property the poll could not have, since a poll redraws either way.
 *
 * `pageEvents` is tested against a `shown` this file controls, because what is
 * under test is the comparison and not the renderer; `src/access/web-app.ts`
 * is what hands it the real page, and `test/access/web-page.test.ts` is what
 * asserts the trigger the page waits on.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { watchedChanges } from "../../src/access/page-changes.js";
import { pageEvents } from "../../src/access/served.js";
import { handBell, listening } from "./page-world.js";

test("a quiet host says nothing, and one change says one word (rondo#742)", async () => {
  const bell = handBell();
  let drawn = "the page";
  let draws = 0;
  const stream = pageEvents({
    token: "t",
    changes: bell,
    shown: async () => {
      draws += 1;
      return await Promise.resolve(drawn);
    },
    // The page this reader holds was drawn at the mark the host still holds,
    // so nothing was written between that draw and this stream.
    held: bell.mark(),
    signal: null,
  });
  expect(stream.headers.get("content-type")).toBe("text/event-stream");
  expect(stream.headers.get("cache-control")).toBe("no-store");
  const said = listening((stream.body as ReadableStream<Uint8Array>).getReader());
  // The token rides on the first frame, as it did when it was the whole answer.
  expect(await said()).toBe("retry: 5000\nevent: token\ndata: t\n\n");
  // **The bytes the reader is standing on are drawn once**, as the page opens.
  await Promise.resolve();
  expect(draws).toBe(1);

  // **A write that does not reach this view is not a word to it.** The bell
  // rings -- something beside the store was written -- and this page shows the
  // same thing it showed, so the reader hears nothing and makes no `GET`.
  bell.ring();
  await Promise.resolve();
  await Promise.resolve();
  expect(draws).toBe(2);

  // **And a change is one word.** The next read only returns once something is
  // enqueued, so a `change` that was never sent would hang this case rather
  // than pass it.
  drawn = "the page, with the question on it";
  bell.ring();
  // **And it carries the mark of the draw it is telling the page about**, which
  // the browser hands back as `Last-Event-ID` when it reconnects a dropped
  // stream: a change this reader has already drawn is not told to it twice.
  expect(await said()).toBe(`id: ${bell.mark()}\nevent: change\ndata: 1\n\n`);

  // **Nothing more until the next change**: the same bytes rung twice are two
  // draws and no word.
  bell.ring();
  bell.ring();
  await Promise.resolve();
  drawn = "the page, with the answer on it";
  bell.ring();
  expect(await said()).toBe(`id: ${bell.mark()}\nevent: change\ndata: 1\n\n`);
});

test("a page behind the host hears so as it opens, and a current one hears nothing (rondo#742)", async () => {
  // **The three changes a comparison against the host's present view cannot
  // see**, all of them the same shape: the page a reader holds was drawn
  // before this stream opened, and something was written in between -- between
  // that page's own `GET` and this stream, while the reader was disconnected,
  // or by the process that went down and came back as this one. The host has
  // no copy of what it served, so what it compares is the mark that page was
  // drawn at.
  const bell = handBell();
  const open = (held: string | null): ((ms?: number) => Promise<true | string>) => {
    const stream = pageEvents({
      token: "t",
      changes: bell,
      shown: async () => await Promise.resolve("the page"),
      held,
      signal: null,
    });
    return listening((stream.body as ReadableStream<Uint8Array>).getReader());
  };
  const TOKEN_FRAME = "retry: 5000\nevent: token\ndata: t\n\n";

  // **A page drawn at the mark the host still holds is current**, whatever is
  // on it: nothing has been written since, so there is nothing to tell it.
  const current = open(bell.mark());
  expect(await current()).toBe(TOKEN_FRAME);
  expect(await current()).toBe(true);

  // **A write lands, and a page drawn before it is behind.** The reader hears
  // one `change` as the stream opens, with no ring of its own: the bell rang
  // while it had no stream to hear it on.
  bell.ring();
  const behind = open("seen-0");
  expect(await behind()).toBe(TOKEN_FRAME);
  expect(await behind()).toBe(`id: ${bell.mark()}\nevent: change\ndata: 1\n\n`);
  // And then it is a reader like any other: standing on the bytes it was just
  // told to fetch, told nothing until they differ.
  expect(await behind()).toBe(true);

  // **A page that was drawn by a host that has since restarted claims a mark
  // this process never handed out**, which is the same answer: one `change`.
  const across = open("a-restart-ago.3");
  expect(await across()).toBe(TOKEN_FRAME);
  expect(await across()).toBe(`id: ${bell.mark()}\nevent: change\ndata: 1\n\n`);

  // **And a page that claims nothing is read as possibly behind**, not as
  // current: one redraw costs a reader one `GET`, and being wrong the other
  // way costs it a screen that is quietly out of date.
  const claiming = open(null);
  expect(await claiming()).toBe(TOKEN_FRAME);
  expect(await claiming()).toBe(`id: ${bell.mark()}\nevent: change\ndata: 1\n\n`);
});

test("a draw that failed is not a change, and a reader that goes away is dropped (rondo#742)", async () => {
  const bell = handBell();
  let fail = false;
  const stop = new AbortController();
  const stream = pageEvents({
    token: null,
    changes: bell,
    shown: async () => {
      if (fail) {
        throw new Error("the store would not open");
      }
      return await Promise.resolve("the page");
    },
    held: bell.mark(),
    signal: stop.signal,
  });
  const reader = (stream.body as ReadableStream<Uint8Array>).getReader();
  // No token to give: `retry` is a frame of its own, so the stream still says
  // how long the browser waits before it asks again.
  expect(await listening(reader)()).toBe("retry: 5000\n\n");
  expect(bell.holding()).toBe(1);

  // A draw that threw leaves the reader holding the page the host last drew.
  fail = true;
  bell.ring();
  await Promise.resolve();
  fail = false;
  bell.ring();
  await Promise.resolve();

  // **The listener goes with the reader** (rondo#742): a tab that was closed
  // must not leave the host drawing its view on every write for the life of
  // the process.
  stop.abort();
  expect(bell.holding()).toBe(0);
  expect((await reader.read()).done).toBe(true);
});

test("with no bell the stream is the press token alone, as it was (rondo#674)", async () => {
  const withToken = pageEvents({
    token: "t",
    changes: null,
    shown: async () => await Promise.resolve(""),
    held: null,
    signal: null,
  });
  expect(withToken.status).toBe(200);
  expect(await withToken.text()).toBe("retry: 5000\nevent: token\ndata: t\n\n");
  // A host that draws no form has no token and nothing to watch for: a `204`
  // tells the browser to stop asking.
  const neither = pageEvents({
    token: null,
    changes: null,
    shown: async () => await Promise.resolve(""),
    held: null,
    signal: null,
  });
  expect(neither.status).toBe(204);
});

test("the bell rings on a write beside the store, and stops when the host does (rondo#742)", async () => {
  const directory = mkdtempSync(join(tmpdir(), "rondo-changes-"));
  const bell = watchedChanges(join(directory, "rondo.db"), () => {});
  try {
    let rings = 0;
    const stop = bell.listen(() => {
      rings += 1;
    });
    // **Watched, not polled**: nothing here waits on a clock of rondo's. The
    // write is what the operating system tells this process about, and the
    // ring is coalesced, so a burst is one ring rather than one per file.
    const rung = new Promise<void>((resolve) => {
      const at = setInterval(() => {
        if (rings > 0) {
          clearInterval(at);
          resolve();
        }
      }, 10);
    });
    // **The mark holds still while the store does**, which is what makes two
    // equal marks a proof that a page is current.
    const quiet = bell.mark();
    expect(bell.mark()).toBe(quiet);

    writeFileSync(join(directory, "rondo.db"), "a row");
    writeFileSync(join(directory, "rondo.db-journal"), "a commit");
    await rung;
    expect(rings).toBe(1);

    // **And it moved with the write, not with the ring.** A page served during
    // the settle carries this new mark, so the write already in flight is one
    // the next stream it opens is told about.
    expect(bell.mark()).not.toBe(quiet);

    // A listener that was dropped hears no more, and a bell that was stopped
    // holds none.
    stop();
    bell.stop();
  } finally {
    bell.stop();
    rmSync(directory, { recursive: true, force: true });
  }
});
