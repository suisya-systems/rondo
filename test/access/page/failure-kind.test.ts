/**
 * The two failures the thread now tells apart (rondo#348, D-0076 rules 4.4
 * and 4.5).
 *
 * **What these are against.** Before the row carried the kind, an upstream
 * refusal and a defect of rondo's own were the same line -- *Stopped.* -- with
 * the reason nowhere on the page at all. The person the page is written for
 * acts on the first and can do nothing about the second, so one line over both
 * is the page unable to say either thing.
 *
 * The third case is the one the migration exists for: a row that does not say
 * which reads exactly as every row read before the column.
 */
import { expect, test } from "vitest";
import { fresh, openRequest, operatorPage, portsOver, reserve } from "../page-world.js";

/** One lap of a request, walked to terminal `failed` with the kind the caller names. */
async function failedLap(
  failureKind: "refusal" | "defect" | null,
  reason: string,
): Promise<string> {
  const world = fresh();
  await openRequest(world, "req-fail", "fix the parser", 1_000);
  await reserve(world, "i-fail", "fix the parser", null, "req-fail");
  for (const [from, to] of [
    ["planned", "admitting"],
    ["admitting", "admitted"],
    ["admitted", "performing"],
  ] as const) {
    expect((await world.store.transition("i-fail", from, to, {}, 2_000)).kind).toBe("transitioned");
  }
  const ended = await world.store.transition(
    "i-fail",
    "performing",
    "failed",
    { reason, failureKind },
    3_000,
  );
  expect(ended.kind).toBe("transitioned");
  return operatorPage(portsOver(world, "ada", []), "t", {
    kind: "thread",
    messageId: "req-fail",
    to: null,
  });
}

test("an upstream refusal is relayed into the line itself, and nothing is folded", async () => {
  // Rule 4.4: the failure is in a world the person can act in, so what was
  // said is theirs to read -- relayed as it arrived (D-0015 rule 7), not
  // reworded and not shut behind a control.
  const html = await failedLap("refusal", "that branch already has an open run");

  expect(html).toContain("that branch already has an open run");
  expect(html).toContain("turned down");
  expect(html).not.toContain("ev-aside");
  // And it is no longer the sentence a row with no kind gets.
  expect(html).not.toContain(">Stopped.<");
});

test("a defect of rondo's own says so, and its reason is in one shut fold", async () => {
  // Rule 4.5: the person is told what cannot happen now and is not asked to
  // read rondo's reason. `<details>` with no `open` is the fold shut.
  const html = await failedLap("defect", "the plan digest did not match the plan");

  expect(html).toContain("a fault in rondo itself");
  expect(html).toContain("for whoever looks after it");
  // No `open` attribute on the element: the fold is in the page and shut, and
  // the person is never asked to open it.
  expect(html).toContain('<details class="ev-aside"><summary>');
  expect(html).toContain("the plan digest did not match the plan");
  // Nothing of the reason is inline: it is inside the fold's own paragraph and
  // not in the sentence the line says.
  expect(html).not.toMatch(/rondo itself[^<]*plan digest/);
});

test("a row that does not say which kind reads exactly as it read before", async () => {
  // The migration's whole claim on the screen: an existing row carries NULL,
  // and NULL is the line that was there before the column, with rondo's reason
  // nowhere on the page.
  const html = await failedLap(null, "continuo answered a document that would not decode");

  expect(html).toContain("Stopped.");
  expect(html).not.toContain("ev-aside");
  expect(html).not.toContain("continuo answered a document that would not decode");
});
