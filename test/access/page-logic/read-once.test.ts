/**
 * One draw, one reading of the rows (`readOncePerDraw` in
 * `src/access/page-logic/model.ts`).
 *
 * The page asked the store for the same rows many times in one draw -- every
 * ended lap once for the list and again for each request's split, each
 * request's scopes three times over -- and what that cost grew with the store.
 * `operatorPage` now wraps the reading ports it is handed, so each read is
 * answered once for the page it is drawing.
 *
 * **What says the page is unchanged is every other page suite in this
 * directory and beside it**: they all draw through `operatorPage`, so they all
 * draw through the wrapper, and what they assert is the markup. What is left to
 * this suite is the wrapper's own contract: it hands back what the port hands
 * back, it holds a read under its own arguments, and it lives for one draw and
 * no longer -- so a row written between two draws is on the second page.
 *
 * **Nothing here is a measurement.** The counts below are counted to say which
 * reads reach the store, not how long they take.
 */
import { expect, test } from "vitest";
import type { WebPorts } from "../../../src/access/page/contract.js";
import { pageModel, readOncePerDraw } from "../../../src/access/page-logic/model.js";
import { EN } from "../../../src/access/wording.js";
import {
  fresh,
  openGate,
  openRequest,
  operatorPage,
  portsOver,
  recordAnswer,
  reserve,
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

test("a draw asks each question once, where its readers ask a request's scopes three times", async () => {
  const made = await world();
  const asked: string[] = [];
  const ports = counting(portsOver(made, "ada", []), asked);
  // The readers themselves, which is the reason the wrapper exists: three
  // readings of one request's scopes before a single view is composed.
  await pageModel(ports, "t", { kind: "summary" }, EN, null);
  expect(count(asked, "scopesFor(req-lap-waiting)")).toBe(3);
  // And the draw, which wraps them: once, and the ended ledger once.
  asked.length = 0;
  const html = await operatorPage(ports, "t", { kind: "summary" }, EN);
  expect(count(asked, "scopesFor(req-lap-waiting)")).toBe(1);
  expect(count(asked, "terminalIterations")).toBe(1);
  // Not a count over an empty page: the work is drawn on it.
  expect(html).toContain("The work that waits at its gate");
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

test("a wrapper lives for one draw, so the next draw reads the rows again", async () => {
  const made = await world();
  const asked: string[] = [];
  const ports = counting(portsOver(made, "ada", []), asked);
  const first = await operatorPage(ports, "t", { kind: "summary" }, EN);
  expect(first).not.toContain("A request written between two draws");
  await openRequest(made, "req-later", "A request written between two draws", 1_500);
  asked.length = 0;
  const second = await operatorPage(ports, "t", { kind: "summary" }, EN);
  // A read, not a held answer: the page says what the store says now.
  expect(count(asked, "terminalIterations")).toBe(1);
  expect(second).toContain("A request written between two draws");
});
