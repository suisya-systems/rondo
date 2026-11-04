/**
 * One draw, one reading of the rows (`readOncePerDraw` in
 * `src/access/page-logic/model.ts`).
 *
 * The page asked the store for the same rows many times in one draw -- every
 * ended lap once for the list and again for each request's split, each
 * request's scopes three times over -- and what that cost grew with the store.
 * What this suite holds down is that answering each read once per draw is **the
 * same page**: the html drawn through the wrapper and the html drawn without it
 * are compared character for character, on a world with the shapes that do the
 * re-reading, and the response the route serves is compared against the
 * renderer's own page.
 *
 * **Nothing here is a measurement.** The counts are counted to say what the
 * wrapper holds and for how long -- one draw, and no longer -- and to keep the
 * comparisons from being vacuous: a wrapper that held nothing would pass every
 * equality case and say nothing at all.
 */
import { expect, test } from "vitest";

import { readOncePerDraw } from "../../../src/access/page-logic/model.js";
import type { PageView } from "../../../src/access/page-logic/routes.js";
import type { WebPorts } from "../../../src/access/page/contract.js";
import { EN } from "../../../src/access/wording.js";
import {
  fresh,
  get,
  openGate,
  openRequest,
  operatorPage,
  portsOver,
  recordAnswer,
  reserve,
  serving,
  tokenIn,
} from "../page-world.js";

/** A world with the three shapes a draw re-reads the rows for. */
async function world() {
  const made = fresh();
  await reserve(made, "lap-waiting", "The work that waits at its gate");
  await openGate(made, "lap-waiting");
  await reserve(made, "lap-ended", "The work that has ended");
  await openGate(made, "lap-ended");
  await recordAnswer(made, "lap-ended");
  const closed = await made.store.transition("lap-ended", "awaiting_human", "closed", {}, 3_000);
  if (closed.kind !== "transitioned") {
    throw new Error(`the fixture did not close the ended lap: ${JSON.stringify(closed)}`);
  }
  await openRequest(made, "req-asked", "A request nothing has run for yet", 1_200);
  return made;
}

/** The ports, with two of the page's reads written down as they are asked. */
function counting<Ports extends WebPorts>(ports: Ports, asked: string[]): Ports {
  // Over the ports rather than a copy of them, as the wrapper itself is: a
  // record may keep its methods on a prototype.
  const store: WebPorts["store"] = Object.assign(Object.create(ports.store), {
    terminalIterations: async () => {
      asked.push("terminalIterations");
      return await ports.store.terminalIterations();
    },
  });
  const record: WebPorts["record"] = Object.assign(Object.create(ports.record), {
    scopesFor: async (messageId: string) => {
      asked.push(`scopesFor(${messageId})`);
      return await ports.record.scopesFor(messageId);
    },
  });
  return { ...ports, store, record };
}

const count = (asked: readonly string[], what: string): number =>
  asked.filter((one) => one === what).length;

const VIEWS: readonly PageView[] = [
  { kind: "summary" },
  { kind: "requests" },
  { kind: "thread", messageId: "req-lap-waiting", to: null },
  { kind: "thread", messageId: "req-asked", to: null },
];

for (const view of VIEWS) {
  test(`the ${view.kind} view is the same page read once per draw as read many times`, async () => {
    const made = await world();
    const ports = portsOver(made, "ada", []);
    const many = await operatorPage(ports, "t", view, EN);
    const once = await operatorPage(readOncePerDraw(ports), "t", view, EN);
    expect(once).toBe(many);
    // Not two empty pages compared: the work the view is about is on both.
    expect(once).toContain("The work that waits at its gate");
  });
}

test("a draw asks each question once, where it asked a request's scopes three times", async () => {
  const made = await world();
  const asked: string[] = [];
  const ports = counting(portsOver(made, "ada", []), asked);
  await operatorPage(ports, "t", { kind: "summary" }, EN);
  // The reason the wrapper exists, measured on this world: three readings of
  // one request's scopes in one draw, and one of the ended ledger per split.
  expect(count(asked, "scopesFor(req-lap-waiting)")).toBe(3);
  asked.length = 0;
  await operatorPage(readOncePerDraw(ports), "t", { kind: "summary" }, EN);
  expect(count(asked, "scopesFor(req-lap-waiting)")).toBe(1);
  expect(count(asked, "terminalIterations")).toBe(1);
});

test("the same read asked twice in one draw reaches the store once", async () => {
  const made = await world();
  const asked: string[] = [];
  const ports = readOncePerDraw(counting(portsOver(made, "ada", []), asked));
  const first = await ports.store.terminalIterations();
  const second = await ports.store.terminalIterations();
  expect(count(asked, "terminalIterations")).toBe(1);
  // The same answer, and not merely as many rows: what the second caller is
  // handed is what the first was.
  expect(second).toBe(first);
});

test("a read is held under its own arguments, so two requests are two reads", async () => {
  const made = await world();
  const asked: string[] = [];
  const ports = readOncePerDraw(counting(portsOver(made, "ada", []), asked));
  await ports.record.scopesFor("req-lap-waiting");
  await ports.record.scopesFor("req-lap-waiting");
  await ports.record.scopesFor("req-asked");
  expect(asked).toEqual(["scopesFor(req-lap-waiting)", "scopesFor(req-asked)"]);
});

test("the page the route serves is drawn off one reading, and says what the renderer says", async () => {
  const made = await world();
  const asked: string[] = [];
  const ports = counting(portsOver(made, "ada", []), asked);
  const { base, stop, served } = await serving(ports);
  const answered = await get(base, "/?lang=en");
  stop.abort();
  await served;
  expect(answered.status).toBe(200);
  // **The wiring, in the one place a page is served from**: `GET /` draws
  // through the wrapper, so the three readings above are one.
  expect(count(asked, "scopesFor(req-lap-waiting)")).toBe(1);
  // **And the response is the page.** Drawn again here with the token the
  // server minted into the form it has just served, off the same ports and the
  // same frozen clock, and compared character for character.
  const drawn = await operatorPage(ports, tokenIn(answered.body), { kind: "summary" }, EN);
  expect(answered.body.replaceAll("&#39;", "'").replaceAll("&#x27;", "'")).toBe(drawn);
});

test("a wrapper lives for one draw, so the next draw reads the rows again", async () => {
  const made = await world();
  const asked: string[] = [];
  const ports = counting(portsOver(made, "ada", []), asked);
  const first = await operatorPage(readOncePerDraw(ports), "t", { kind: "summary" }, EN);
  expect(first).not.toContain("A request written between two draws");
  await openRequest(made, "req-later", "A request written between two draws", 1_500);
  asked.length = 0;
  const second = await operatorPage(readOncePerDraw(ports), "t", { kind: "summary" }, EN);
  // A read, not a held answer: the page says what the store says now.
  expect(count(asked, "terminalIterations")).toBe(1);
  expect(second).toContain("A request written between two draws");
});
