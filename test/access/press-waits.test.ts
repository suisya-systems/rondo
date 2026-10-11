/**
 * A press before any draft is the person's turn (rondo#643).
 *
 * A request naming a repository rondo does not hold (`D-0090`, `D-0191` rule 3)
 * or sent to a store holding no plan (`D-0191` rule 2) is drafted only after the
 * person's press. The thread's *next step* card was amber, while the list drew
 * the row under its day as *not started*: the one request nothing would move
 * until the person acted was the one the list said nothing about. These hold
 * the list, the count, the tab, the host's reach and the answer across every
 * request to the card.
 */
import { expect, test } from "vitest";

import { gatherExplainerMaterial } from "../../src/access/explainer/material.js";
import type { WebPorts } from "../../src/access/page/contract.js";
import { PAGE_EN } from "../../src/access/page/words.js";
import { REACH_SUBJECT, reachThePerson } from "../../src/access/reach.js";
import { EN } from "../../src/access/wording.js";
import { fresh, openGate, openRequest, operatorPage, portsOver, reserve } from "./page-world.js";

const threadOf = (messageId: string) => ({ kind: "thread" as const, messageId, to: null });

const UNHELD = { work: { kind: "unheld" as const, repo: "owner/other", named: "owner/other#12" } };
const PLANLESS = { work: { kind: "open" as const }, planless: true };

/** What the reckoning says of `req-1`, past its `unbuilt`; null for one that will not read. */
type Where = Omit<Awaited<ReturnType<NonNullable<WebPorts["repositoryFor"]>>>, "unbuilt">;

const over = (world: ReturnType<typeof fresh>, where: Where | null): WebPorts => ({
  ...portsOver(world),
  addable: true,
  draftsOwed: async () => new Set(),
  setupPlanFiles: () => ["/srv/state/plan-owner-a.json"],
  repositoryFor: async (id) => {
    if (where === null) {
      throw new Error("the thread will not read");
    }
    return await Promise.resolve(
      id === "req-1" ? { unbuilt: [], ...where } : { work: { kind: "open" as const }, unbuilt: [] },
    );
  },
});

test("a repository to add, or setup's plan to record, lifts the request under *your turn* (rondo#643)", async () => {
  for (const where of [UNHELD, PLANLESS]) {
    const world = fresh();
    await openRequest(world, "req-1", "Do owner/other#12.");
    const html = await operatorPage(over(world, where), "t", { kind: "summary" });
    expect(html).toContain(PAGE_EN.yourTurn);
    expect(html).toContain("list-row-mine");
    // It says a press waits, not an answer: there is no box to answer in.
    expect(html).toContain(PAGE_EN.rowPressWaits);
    expect(html).not.toContain(PAGE_EN.rowWaitingOnYou);
    expect(html).not.toContain(PAGE_EN.rowNotStarted);
    // Counted with the rest, and the tab rings for it.
    expect(html).toContain(EN.waitingCount(1));
    expect(html).toContain('data-waits="[&quot;press:req-1&quot;]"');
    // Opened by hand, it is the request selected: its card is on the screen.
    expect(html).toContain('id="add-repository-req-1"');
  }
});

test("a reckoning that will not read, or a request not waiting on a press, is no turn", async () => {
  const world = fresh();
  await openRequest(world, "req-1", "Do owner/other#12.");
  for (const ports of [over(world, null), over(world, { work: { kind: "open" as const } })]) {
    const html = await operatorPage(ports, "t", threadOf("req-1"));
    expect(html).not.toContain("list-row-mine");
    expect(html).toContain('data-waits="[]"');
  }
});

test("a gate beside the press keeps the row's own sentence: the press is not all that waits", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "Do owner/other#12.");
  await openGate(world, "i-0001");
  const lapRoot = (await world.store.readLive()).flatMap((o) =>
    o.kind === "read" ? [o.record.requestMessageId] : [],
  )[0];
  expect(lapRoot).toBeDefined();
  const html = await operatorPage(
    {
      ...over(world, UNHELD),
      repositoryFor: async () => await Promise.resolve({ unbuilt: [], ...UNHELD }),
    },
    "t",
    { kind: "summary" },
  );
  expect(html).toContain("list-row-mine");
  expect(html).toContain(PAGE_EN.rowWaitingOnYou);
  expect(html).not.toContain(PAGE_EN.rowPressWaits);
});

test("the host reaches the person once for the press, and again for the draft that follows it", async () => {
  const world = fresh();
  await openRequest(world, "req-1", "Do owner/other#12.");
  const sent: string[] = [];
  const tick = () =>
    reachThePerson({
      store: world.store,
      record: world.record,
      now: () => 50_000,
      words: EN,
      notify: async (sentence) => {
        sent.push(sentence);
        return { kind: "reached" };
      },
      say: () => undefined,
      unheld: async (id) => await Promise.resolve(id === "req-1"),
    });
  await tick();
  await tick();
  expect(sent).toEqual([EN.reachYourTurn]);
  expect(
    world.connection
      .prepare("SELECT subject_id FROM operator_attention WHERE subject_kind = ?")
      .all(REACH_SUBJECT)
      .map((row) => (row as { subject_id: string }).subject_id),
  ).toEqual(["press:req-1"]);
});

test("asked across every request, rondo names the press where the list does (D-0189)", async () => {
  const world = fresh();
  await openRequest(world, "req-1", "Do owner/other#12.");
  await openRequest(world, "question-across", "What is waiting on me?");
  const waits = async (unheld: (id: string) => Promise<boolean>) =>
    (await gatherExplainerMaterial({ ...portsOver(world), unheld }, "question-across", 3_000))
      .waits;
  expect(await waits(async (id) => await Promise.resolve(id === "req-1"))).toEqual([
    {
      kind: "press",
      messageId: "req-1",
      request: { messageId: "req-1", title: "Do owner/other#12." },
      // Waiting since the request was written (D-0068 rule 2.5).
      forMs: 2_500,
    },
  ]);
  // A question's own thread asks for no work, so it is never a press (D-0189).
  expect(await waits(async () => await Promise.resolve(true))).toEqual([
    {
      kind: "press",
      messageId: "req-1",
      request: { messageId: "req-1", title: "Do owner/other#12." },
      // Waiting since the request was written (D-0068 rule 2.5).
      forMs: 2_500,
    },
  ]);
});
