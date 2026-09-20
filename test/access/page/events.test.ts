/**
 * The event line (DECISIONS.md D-0083 rule 7).
 *
 * The dot's colour is the whole of what it says, so these cases are about the
 * kind reaching the markup -- the colour itself is `page/thread.css`, and a
 * stylesheet is not something a string of markup can answer for.
 *
 * **The claim worth guarding is the absence of amber.** Rule 7's list has no
 * amber in it, because amber means *a person must act* (D-0082 rule 2) and an
 * event line is something that already happened. A kind that drew amber would
 * put the one colour that calls a person onto the record of what is done.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { EventLine, EventLines, type ThreadEvent } from "../../../src/access/page/events.js";

const event = (over: Partial<ThreadEvent> & { id: string }): ThreadEvent => ({
  kind: "other",
  said: "something happened",
  at: "9:12",
  ...over,
});

test("each kind reaches the markup as its own class, and none of them is amber", () => {
  for (const kind of ["person", "passed", "failed", "decided", "other"] as const) {
    const html = renderToStaticMarkup(EventLine({ event: event({ id: "e", kind }) }));
    expect(html).toContain(`ev-${kind}`);
    // Rule 7 names ink, green, red, hollow and neutral. No member is amber,
    // and `wait` is what amber is called in the tokens.
    expect(html).not.toContain("wait");
  }
});

test("a line is a dot, a sentence and a time", () => {
  const html = renderToStaticMarkup(
    EventLine({ event: event({ id: "e", said: "You approved the estimate.", at: "9:10" }) }),
  );
  expect(html).toContain("You approved the estimate.");
  expect(html).toContain("9:10");
  expect(html).toContain("ev-dot");
});

test("evidence is a link only where there is somewhere to go", () => {
  const bare = renderToStaticMarkup(EventLine({ event: event({ id: "e" }) }));
  expect(bare).not.toContain("<a");
  const linked = renderToStaticMarkup(
    EventLine({
      event: event({ id: "e", href: "/?log=i-1&lang=en", linkSaid: "what was measured" }),
    }),
  );
  expect(linked).toContain("what was measured");
  expect(linked).toContain("/?log=i-1&amp;lang=en");
});

test("the last-looked line is drawn once, above the event it belongs above", () => {
  const html = renderToStaticMarkup(
    EventLines({
      events: [event({ id: "new" }), event({ id: "seen" }), event({ id: "older" })],
      lastLookedAbove: "seen",
      lastLookedSaid: "Below here is what you saw last time",
    }),
  );
  // Once, not per row (rule 7: no row carries a `new` of its own).
  expect(html.split("thread-since").length - 1).toBe(1);
  expect(html.indexOf("thread-since")).toBeGreaterThan(html.indexOf("ev-other"));
});

test("no line is drawn where there is none to draw", () => {
  const html = renderToStaticMarkup(
    EventLines({
      events: [event({ id: "a" })],
      lastLookedAbove: null,
      lastLookedSaid: "unused",
    }),
  );
  expect(html).not.toContain("thread-since");
  expect(html).not.toContain("unused");
});
