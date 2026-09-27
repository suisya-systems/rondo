/**
 * The scope card waits for rondo's draft (rondo#495, lap 18).
 *
 * Right after the owner sent a request the thread showed the amber *set the
 * scope* card while the drafter had only read the linked issue; the draft came
 * 43 seconds later. A scope pressed then is one decided without rondo's plan.
 * These hold the three surfaces that say whose turn it is -- the card at the
 * top of the thread, the right face's steps and the list's row -- to one
 * reading of whether rondo still owes the draft.
 */
import { expect, test } from "vitest";

import type { WebPorts } from "../../src/access/page/contract.js";
import { PAGE_EN } from "../../src/access/page/words.js";
import { EN } from "../../src/access/wording.js";
import { fresh, openRequest, operatorPage, portsOver } from "./page-world.js";

const threadOf = (messageId: string) => ({ kind: "thread" as const, messageId, to: null });

const owing = (world: ReturnType<typeof fresh>, owed: () => Promise<ReadonlySet<string>>) =>
  ({ ...portsOver(world), draftsOwed: owed }) satisfies WebPorts;

/** The card at the top of the thread, from its section to its end. */
function nextCard(html: string): string {
  const at = html.indexOf('class="next-step');
  expect(at).toBeGreaterThan(-1);
  const start = html.lastIndexOf("<section", at);
  return html.slice(start, html.indexOf("</section>", start));
}

test("while rondo owes the draft, the thread says it is rondo's turn and offers no scope", async () => {
  const world = fresh();
  await openRequest(world, "req-1", "Do #200, please.");
  const html = await operatorPage(
    owing(world, async () => new Set(["req-1"])),
    "t",
    threadOf("req-1"),
  );
  const card = nextCard(html);
  expect(card).toContain(EN.nextStepRondoHeading);
  expect(card).toContain(EN.nextStepDrafting);
  // Not amber, and nothing to press: neither the filled card nor the outlined way.
  expect(card).not.toContain("border-wait");
  expect(html).not.toContain(EN.nextStepHeading);
  expect(html).not.toContain('id="scope-req-1"');
  // The right face agrees: the plan and its scope are under way, and not yours.
  expect(html).toMatch(
    new RegExp(`side-step-waiting[^>]*><span>${PAGE_EN.stepScope}</span><b>${PAGE_EN.stepNow}`),
  );
  // And the list's row says rondo is on it, outside *your turn*.
  expect(html).toContain(PAGE_EN.rowDrafting);
  expect(html).not.toContain("list-row-mine");
});

test("once nothing is owed, the scope card appears, marked for the redraw's wash (rondo#494)", async () => {
  const world = fresh();
  await openRequest(world, "req-1", "add a retry budget");
  const html = await operatorPage(
    owing(world, async () => new Set()),
    "t",
    threadOf("req-1"),
  );
  const card = nextCard(html);
  expect(card).toContain('data-can-act="next"');
  expect(card).toContain(EN.nextStepScope);
  expect(html).toContain('id="scope-req-1"');
  expect(html).toMatch(
    new RegExp(`side-step-yours[^>]*><span>${PAGE_EN.stepScope}</span><b>${PAGE_EN.stepYours}`),
  );
  expect(html).not.toContain(PAGE_EN.rowDrafting);
  expect(html).toContain(PAGE_EN.rowNotStarted);
});

test("a drafter that drafted nothing hands the scope to the person, saying so (rondo#495 item 2)", async () => {
  const world = fresh();
  await openRequest(world, "req-1", "Do #200, please.");
  const said = await world.record.recordThreadMessage({
    messageId: "drafter-1",
    body: "rondo's drafter wrote no draft for this: claude -p exited 1",
    authorKind: "drafter",
    authorId: "rondo/drafter/6/claude-opus-5",
    inReplyTo: "req-1",
    atMs: 600,
    bases: [{ form: "message", messageId: "req-1" }],
    asks: false,
  });
  expect(said.kind).toBe("recorded");
  const html = await operatorPage(
    owing(world, async () => new Set()),
    "t",
    threadOf("req-1"),
  );
  const card = nextCard(html);
  expect(card).toContain(EN.nextStepNoDraft);
  expect(card).not.toContain(EN.nextStepScope);
  expect(html).toContain('id="scope-req-1"');
});

test("a read of what is owed that fails withholds the scope rather than offering it (Codex)", async () => {
  const world = fresh();
  await openRequest(world, "req-1", "add a retry budget");
  const html = await operatorPage(
    owing(world, async () => {
      throw new Error("the threads could not be read");
    }),
    "t",
    threadOf("req-1"),
  );
  expect(nextCard(html)).toContain(EN.nextStepDrafting);
  expect(html).not.toContain('id="scope-req-1"');
});

test("with no drafter host, nothing is owed and the page is as it was", async () => {
  const world = fresh();
  await openRequest(world, "req-1", "add a retry budget");
  const html = await operatorPage(portsOver(world), "t", threadOf("req-1"));
  expect(nextCard(html)).toContain(EN.nextStepScope);
  expect(html).not.toContain(EN.nextStepDrafting);
});
