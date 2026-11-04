/**
 * What the host tells an open page, and when it says nothing (rondo#742).
 *
 * The page used to `GET` its own address every five seconds and morph the
 * answer in. What replaced it is one held-open `GET /events`: the host rings a
 * bell when the store is written, draws the reader's own view again, and says
 * `change` only where the bytes differ from the ones that reader is standing
 * on. So the claims worth a test are **that a quiet host says nothing**, **that
 * a change says exactly one word**, **that a write which does not reach this
 * view is not a word to it** -- that one being the property the poll could not
 * have, since a poll redraws either way -- and **which file a write has to be
 * to, since the store shares a directory with files no page draws**.
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
import { CHANGE_FRAME, handBell, listening } from "./page-world.js";

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
  // rings -- the store was written -- and this page shows the
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
  // **And it carries no id**: what draw a page holds is what that page says it
  // is showing, never a frame this host remembers sending to it.
  expect(await said()).toBe(CHANGE_FRAME);

  // **Nothing more until the next change**: the same bytes rung twice are two
  // draws and no word.
  bell.ring();
  bell.ring();
  await Promise.resolve();
  drawn = "the page, with the answer on it";
  bell.ring();
  expect(await said()).toBe(CHANGE_FRAME);
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
  expect(await behind()).toBe(CHANGE_FRAME);
  // And then it is a reader like any other: standing on the bytes it was just
  // told to fetch, told nothing until they differ.
  expect(await behind()).toBe(true);

  // **A page that was drawn by a host that has since restarted claims a mark
  // this process never handed out**, which is the same answer: one `change`.
  const across = open("a-restart-ago.3");
  expect(await across()).toBe(TOKEN_FRAME);
  expect(await across()).toBe(CHANGE_FRAME);

  // **And a page that claims nothing is read as possibly behind**, not as
  // current: one redraw costs a reader one `GET`, and being wrong the other
  // way costs it a screen that is quietly out of date.
  const claiming = open(null);
  expect(await claiming()).toBe(TOKEN_FRAME);
  expect(await claiming()).toBe(CHANGE_FRAME);
});

test("a write during the open draw is one change, not a page left behind (rondo#742)", async () => {
  // **The boundary between the page's own `GET` and its stream, taken at its
  // narrowest**: the reader's page was current when the stream opened, and the
  // write lands while the host is part-way through drawing the view it is
  // about to compare against. Both sides of that comparison are then past the
  // write -- the draw has the new bytes in it and there is nothing yet to
  // compare them with -- so a host that read the mark once, before the draw,
  // would store the new page as what this reader is standing on and say
  // nothing, and the ring that follows would find the same bytes and say
  // nothing either. The reader would sit on the old screen until the next
  // unrelated write.
  const bell = handBell();
  let drawn = "the page";
  let wrote = false;
  const stream = pageEvents({
    token: null,
    changes: bell,
    shown: async () => {
      if (!wrote) {
        wrote = true;
        // The write lands inside the draw: the store moves, and the bytes this
        // draw answers with are already the new ones.
        drawn = "the page, with the question on it";
        bell.ring();
      }
      return await Promise.resolve(drawn);
    },
    // Current as the stream opened, which is what makes this the hard case.
    held: bell.mark(),
    signal: null,
  });
  const said = listening((stream.body as ReadableStream<Uint8Array>).getReader());
  expect(await said()).toBe("retry: 5000\n\n");
  // **The draw is taken again because the mark moved under it**, and the mark
  // it settles at is not the one this page says it is holding: one `change`.
  expect(await said()).toBe(CHANGE_FRAME);
  // And exactly one: the ring that arrived during the draw is answered by
  // comparing bytes, and they are the bytes the reader was just sent for.
  expect(await said()).toBe(true);
});

test("a draw the store would not hold still for is looked at again, not kept (rondo#742)", async () => {
  // **The bound on one look, and what reaching it must not cost.** A draw is
  // taken again where the mark moved under it, up to three times, so a host
  // being written to without pause still answers this reader -- and the draw
  // that bound ends on is of no one moment: the bytes are the ones this draw
  // read, the store is already past them. Keeping those bytes as the version
  // every later comparison is against, and then waiting, is how a reader ends
  // up holding a screen the host would not draw: the version after them is
  // compared against something the host never held, and the ring that would
  // have corrected it is not this module's to assume. The real bell counts a
  // write the moment the operating system reports it and rings a settle
  // afterwards, so the mark here moves with no listener called at all.
  const bell = handBell();
  // How many of this reader's draws the store moves under: the host's own
  // bound, so the look it is spent on is the one that does not settle.
  const UNSETTLED = 3;
  let drawn = "the page";
  let writes = 0;
  let draws = 0;
  const stream = pageEvents({
    token: null,
    changes: bell,
    shown: async () => {
      draws += 1;
      // The bytes this draw is of, read before the write that lands in it.
      const bytes = drawn;
      if (writes < UNSETTLED) {
        writes += 1;
        drawn = `the page, written to ${String(writes)} times`;
        bell.wrote();
      }
      return await Promise.resolve(bytes);
    },
    // Current as the stream opened: the writes all land inside the draws.
    held: bell.mark(),
    signal: null,
  });
  const said = listening((stream.body as ReadableStream<Uint8Array>).getReader());
  expect(await said()).toBe("retry: 5000\n\n");

  // **The unsettled look is a word**, because the mark it ended at is not the
  // one this page says it is holding: this reader is behind, and the host
  // cannot say by how much.
  expect(await said()).toBe(CHANGE_FRAME);
  // **And the version the store settles at is the word after it.** The host
  // looked again without being rung, found a draw whose mark held still, and
  // its bytes are not the ones the bound left behind -- so the last thing this
  // reader is told about is the page the host would actually draw now.
  expect(await said()).toBe(CHANGE_FRAME);
  expect(draws).toBe(UNSETTLED + 1);
  expect(writes).toBe(UNSETTLED);

  // **Then it stops.** A settled draw is kept, so the extra look is one and
  // not a loop a quiet host runs for the life of the stream.
  expect(await said()).toBe(true);
  expect(draws).toBe(UNSETTLED + 1);

  // And nothing is stuck behind it: the next real change is one word, judged
  // against the settled version rather than the one the bound ended on.
  drawn = "the page, with the answer on it";
  bell.ring();
  expect(await said()).toBe(CHANGE_FRAME);
  expect(await said()).toBe(true);
});

test("a reader told to redraw that could not is told again when it opens again (rondo#742)", async () => {
  // **What a page holds is what it finished showing.** A `change` says a word
  // arrived, and a redraw is a `GET` of this page's own address that can fail
  // or be cut off part-way; the mark on `#ledger` moves only where it did not.
  // So the stream a reader opens next is judged by that mark and never by the
  // frames this host remembers sending -- which is why no frame carries an id
  // for a browser to hand back as `Last-Event-ID`.
  const bell = handBell();
  const open = (held: string | null): ((ms?: number) => Promise<true | string>) => {
    const stream = pageEvents({
      token: null,
      changes: bell,
      shown: async () => await Promise.resolve(`the page, ${bell.mark()}`),
      held,
      signal: null,
    });
    return listening((stream.body as ReadableStream<Uint8Array>).getReader());
  };
  const holding = bell.mark();

  const told = open(holding);
  expect(await told()).toBe("retry: 5000\n\n");
  bell.ring();
  expect(await told()).toBe(CHANGE_FRAME);

  // The redraw that word asked for never landed -- the fetch failed, or the
  // network dropped during it -- so this page is still showing the draw it was
  // showing, and the stream it opens says so. It is told again.
  const reopened = open(holding);
  expect(await reopened()).toBe("retry: 5000\n\n");
  expect(await reopened()).toBe(CHANGE_FRAME);

  // Where the redraw did land, the mark it brought with it is this page's, and
  // the same reopen is silence: nothing is redrawn twice for one change.
  const current = open(bell.mark());
  expect(await current()).toBe("retry: 5000\n\n");
  expect(await current()).toBe(true);
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

/**
 * Waiting for the bell: answers as soon as `rings` moves.
 *
 * **Watched, not polled** is what this asserts about the host, so nothing here
 * waits on a clock of rondo's -- the write is what the operating system tells
 * the process about, and a case that hangs here is a bell that never rang.
 */
async function rung(rings: () => number): Promise<void> {
  await new Promise<void>((resolve) => {
    const at = setInterval(() => {
      if (rings() > 0) {
        clearInterval(at);
        resolve();
      }
    }, 10);
  });
}

/**
 * Long enough that a ring which was going to come has come.
 *
 * `SETTLE_MS` inside `page-changes.ts` is 50ms, and the quiet window the rest
 * of these tests give a host is 250ms (`listening`); this is that window, so a
 * silence asserted after it is five settles of silence and not a race.
 */
async function settled(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 250));
}

test("the bell rings on a write to the store, and stops when the host does (rondo#742)", async () => {
  const directory = mkdtempSync(join(tmpdir(), "rondo-changes-"));
  const bell = watchedChanges(join(directory, "rondo.db"), () => {});
  try {
    let rings = 0;
    const stop = bell.listen(() => {
      rings += 1;
    });
    // **The mark holds still while the store does**, which is what makes two
    // equal marks a proof that a page is current.
    const quiet = bell.mark();
    expect(bell.mark()).toBe(quiet);

    // The ring is coalesced, so a burst of writes to the store is one ring
    // rather than one per write.
    writeFileSync(join(directory, "rondo.db"), "a row");
    writeFileSync(join(directory, "rondo.db"), "a row, and another");
    await rung(() => rings);
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

test("the store's own file rings; the files beside it do not (rondo#742)", async () => {
  const directory = mkdtempSync(join(tmpdir(), "rondo-changes-"));
  const bell = watchedChanges(join(directory, "rondo.db"), () => {});
  try {
    let rings = 0;
    bell.listen(() => {
      rings += 1;
    });
    const quiet = bell.mark();

    // **What shares the directory and is not the store.** continuo keeps its
    // own control plane there, which a lap writes to while it runs and which no
    // page draws a byte of; SQLite moves the store's journal twice around every
    // commit, for the same one write to the database it sits beside. A bell for
    // either redraws a view that cannot have changed.
    writeFileSync(join(directory, "control-plane.sqlite3"), "a lap step");
    writeFileSync(join(directory, "rondo.db-journal"), "a commit in flight");
    rmSync(join(directory, "rondo.db-journal"));
    await settled();
    expect(rings).toBe(0);
    // **And no write was counted**, so a page served now is told it is current
    // rather than being handed a mark the host has already moved past.
    expect(bell.mark()).toBe(quiet);

    // **The store itself still rings**, which is what makes the silence above a
    // name the bell reads and not a watch that broke.
    writeFileSync(join(directory, "rondo.db"), "a row");
    await rung(() => rings);
    expect(rings).toBe(1);
    expect(bell.mark()).not.toBe(quiet);
  } finally {
    bell.stop();
    rmSync(directory, { recursive: true, force: true });
  }
});
