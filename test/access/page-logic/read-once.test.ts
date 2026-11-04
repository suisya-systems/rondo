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
import { requestRepository } from "../../../src/access/model-draft/host.js";
import type { WebPorts } from "../../../src/access/page/contract.js";
import { pageModel, readOncePerDraw } from "../../../src/access/page-logic/model.js";
import { EN } from "../../../src/access/wording.js";
import {
  fresh,
  openGate,
  openRequest,
  operatorPage,
  planFor,
  portsOver,
  recordAnswer,
  reserve,
} from "../page-world.js";

/**
 * An agent type a build of cadenza knows, as `press-path.test.ts` writes it:
 * the world's own plans carry `{}`, which builds no record, so a setup plan of
 * one stands for no plan `rondo setup-plan` would accept.
 */
const AGENT_TYPE_INPUT = {
  agentTypeId: "worker-basic",
  vocabularyVersion: 1,
  granted: ["command.run"],
  askable: ["branch.push"],
  loopPolicy: { maxReviewRounds: 2, noProgressWindow: 3, noProgressRepeat: 2 },
  executorPolicy: { roleName: "worker", modelTier: "standard", reportingDuties: [] },
};

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

/**
 * **The one read that is not a port method** (rondo#757).
 *
 * `repositoryFor` answers *where does this request's work run*, and it answers
 * it off the whole live and ended ledger, the thread and the setup plans
 * (`requestRepository`). `scopesAwaitingYou` asks it for **every request**, on
 * every view, so a port that reads the store out of its own closure read the
 * ledger once per request -- 19 times over the store at hand, on a page the
 * wrapper above had already brought to one reading, and 1.3 to 1.5 s a draw.
 *
 * Both halves are held here: that the draw's reading is what answers it, and
 * what a port reading a store of its own costs instead. The second is the
 * `boundary-is-not-vacuous` habit pointed at a count -- a draw that stopped
 * asking for the reckoning at all would also read the ledger once, and would
 * pass the first assertion saying nothing -- so the test plants the shape that
 * has to cost more and shows it costing more.
 */
test("a request's repository is reckoned off the draw's reading, not off the store again", async () => {
  const made = await world();
  const asked: string[] = [];
  const ports = counting(portsOver(made, "ada", []), asked);
  const reckon = ports.repositoryFor;
  if (reckon === undefined) {
    throw new Error("the world's ports no longer reckon a request's repository");
  }
  const reckoned: string[] = [];
  const drawn = await operatorPage(
    {
      ...ports,
      repositoryFor: async (id, reads) => {
        reckoned.push(id);
        return await reckon(id, reads);
      },
    },
    "t",
    { kind: "summary" },
    EN,
  );
  // Asked for every request the store holds, and the ledger read once for all
  // of them: the rows are the draw's, which is what the wrapper binds. The
  // calls are counted rather than gathered into a set, so a reckoning asked
  // twice for one request would be read here and not folded away.
  expect([...reckoned].sort()).toEqual(["req-asked", "req-lap-ended", "req-lap-waiting"]);
  expect(count(asked, "terminalIterations")).toBe(1);
  expect(drawn).toContain("The work that waits at its gate");

  // And the port as the host used to hold it -- the same reckoning over a
  // store of its own, ignoring the reads it is handed -- reads the ledger
  // again for each request it is asked about.
  asked.length = 0;
  const again: string[] = [];
  await operatorPage(
    {
      ...ports,
      repositoryFor: async (id) => {
        again.push(id);
        return await requestRepository(
          { store: ports.store, record: ports.record, now: ports.now },
          id,
        );
      },
    },
    "t",
    { kind: "summary" },
    EN,
  );
  expect(count(asked, "terminalIterations")).toBe(1 + again.length);
});

/**
 * **And the reckoning itself is run once for a request** (rondo#757), which is
 * the half of {@link reckonedOnce} the draw above does not pin down: the
 * summary happens to ask for each request once, so a count over that page
 * holds whether or not an answer is held. What a draw does do, on the views
 * where the thread's card and the scope wait both ask, is ask about the same
 * request more than once -- and the reckoning is not free even when every row
 * it reads is already in hand, since it digests each held plan and reads each
 * body. So the asking is done here directly, and what is counted is the runs
 * of the reckoning rather than the reads underneath it: this case fails if
 * `reckonedOnce` stops holding an answer, whatever the store is asked.
 */
test("one request asked for many times in a draw is reckoned once, and two are reckoned twice", async () => {
  const made = await world();
  const over = portsOver(made, "ada", []);
  const reckon = over.repositoryFor;
  if (reckon === undefined) {
    throw new Error("the world's ports no longer reckon a request's repository");
  }
  const reckoned: string[] = [];
  const ports = readOncePerDraw({
    ...over,
    repositoryFor: async (id, reads) => {
      reckoned.push(id);
      return await reckon(id, reads);
    },
  });
  const ask = ports.repositoryFor;
  if (ask === undefined) {
    throw new Error("the wrapper no longer hands on the reckoning it was given");
  }
  const first = await ask("req-lap-waiting");
  const second = await ask("req-lap-waiting");
  await ask("req-lap-waiting");
  await ask("req-asked");
  // Once for the request asked for three times, once for the other: held
  // under the request it was asked about, as a read is held under its
  // arguments.
  expect(count(reckoned, "req-lap-waiting")).toBe(1);
  expect(count(reckoned, "req-asked")).toBe(1);
  expect(reckoned).toHaveLength(2);
  // And the same answer, not merely an equal one.
  expect(second).toBe(first);
});

/**
 * **And what the reckoning reads that is not about the request** is read once
 * for the draw that asks (rondo#757, `heldByOneDraw` in
 * `src/access/model-draft/host.ts`).
 *
 * All but one part of `requestRepository` is the same answer whichever request
 * it is asked about: the twenty rows' plans, the setup plans and the agent type
 * each builds, and `buildsOn`'s reading of each held plan back into the plan
 * setup would have written. Only the templates the asking thread carries differ.
 * Read per request over the store at hand that was about a third of a draw --
 * 78 readings of the same rows, inside one reading of them -- so the reckoning
 * takes the object the draw hands it as the draw's identity and holds that half
 * against it.
 *
 * **Counted here as runs of that half and not as reads of the store**, because
 * `setupPlans` is one of the reads {@link readOncePerDraw} already answers
 * once: a count taken through the wrapper would be 1 whether or not this half
 * is held, which is the shape of a test that says nothing. So the reckoning is
 * asked directly, over a port that counts, and the half's own reading of the
 * setup plans is what is counted. `buildsOn` is the other half of the claim:
 * the same plan is read into the same answer once, and a second draw reads it
 * again.
 */
test("a draw reads what a reckoning does not take from the thread once, not once per request", async () => {
  const made = await world();
  const over = portsOver(made, "ada", []);
  // A setup plan whose agent type builds a record, so `buildsOn` is a plan
  // rather than null: the world's own rows carry an agent type no vocabulary
  // version this build knows, and a null answer would pin nothing.
  const setup = { ...planFor("i-setup"), agent_type_input: AGENT_TYPE_INPUT };
  const asked: string[] = [];
  const record = Object.assign(Object.create(over.record), {
    setupPlans: async () => {
      asked.push("setupPlans");
      return await Promise.resolve([{ setupId: "s-1", plan: setup, recordedAtMs: 1_000 }]);
    },
  }) as WebPorts["record"];
  const ports = { store: over.store, record, now: over.now };

  // One draw, two requests: the half is read once, and the plan it stands for
  // is the one answer rather than two readings of the same bytes.
  const draw = {};
  const waiting = await requestRepository(ports, "req-lap-waiting", draw);
  const other = await requestRepository(ports, "req-asked", draw);
  expect(count(asked, "setupPlans")).toBe(1);
  expect(waiting.buildsOn).not.toBeNull();
  expect(other.buildsOn).toBe(waiting.buildsOn);

  // And a caller outside a draw reads it for the one request it asks about,
  // which is what the host's own reckoning of whose turn it is does. What it
  // answers is what the draw's reading answered, to the field.
  asked.length = 0;
  const alone = await requestRepository(ports, "req-lap-waiting");
  const aloneToo = await requestRepository(ports, "req-asked");
  expect(count(asked, "setupPlans")).toBe(2);
  expect(alone).toEqual(waiting);
  expect(aloneToo.buildsOn).toEqual(alone.buildsOn);
  expect(aloneToo.buildsOn).not.toBe(alone.buildsOn);

  // A second draw is a second object, so a row written between two draws is
  // read: what is held lives as long as the reads it was taken from.
  asked.length = 0;
  await requestRepository(ports, "req-lap-waiting", {});
  expect(count(asked, "setupPlans")).toBe(1);
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
