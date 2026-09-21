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
import { lapEvents } from "../../../src/access/page-logic/thread-events.js";
import { chromeFor, EN } from "../../../src/access/wording.js";
import type { IterationRecord } from "../../../src/store/records.js";
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

test("a refusal's line is marked the person's to act on, so the fold leaves it out", () => {
  // The other half of rule 4.4, added by rondo#317: relaying what was said is
  // worth nothing if a later try's fold can draw over it. `failureKind` is the
  // only place this is still known -- the fold will not read the sentence back
  // -- so the line carries it out (D-0082 rule 7, `page-logic/event-fold.ts`).
  const lap = (failureKind: "refusal" | "defect" | null) =>
    lapEvents(
      EN,
      {
        id: "i-fail",
        status: "failed",
        reason: "that branch already has an open run",
        failureKind,
        createdAtMs: 1_000,
        updatedAtMs: 3_000,
      } as unknown as IterationRecord,
      [],
      (status) => status === "failed",
      () => "1h",
      1,
    );
  const ended = (failureKind: "refusal" | "defect" | null) =>
    lap(failureKind).find((event) => event.id === "i-fail:ended");

  expect(ended("refusal")?.yours).toBe(true);
  // And nothing else is: a defect asks nothing of the person (rule 4.5), and a
  // row with no kind is the line it has always been.
  expect(ended("defect")?.yours).toBeUndefined();
  expect(ended(null)?.yours).toBeUndefined();
});

test("continuo's nested-sandbox refusal reaches the person in their own language (continuo D-1112)", () => {
  // continuo gives this refusal no code, so rondo knows it by continuo's own
  // pinned sentence; what the person reads is rondo's, in each shipped set,
  // with none of continuo's verb or errno in it (D-0076, D-0079).
  const sentence =
    "this process may not create a Unix socket (EPERM), and the worker it would spawn " +
    "inherits that block, so the worker's own sandbox would fail to initialize and every " +
    "Bash call after the first would run unsandboxed. The usual cause is running continuo " +
    "inside another Claude Code sandbox, whose seccomp filter refuses AF_UNIX for itself " +
    "and every child; run lap perform outside it. This check is Linux-only and detects " +
    "only this cause.";
  for (const wording of [EN, chromeFor("ja")]) {
    const ended = lapEvents(
      wording,
      {
        id: "i-box",
        status: "failed",
        reason: sentence,
        failureKind: "refusal",
        createdAtMs: 1_000,
        updatedAtMs: 3_000,
      } as unknown as IterationRecord,
      [],
      (status) => status === "failed",
      () => "1h",
      null,
    ).find((event) => event.id === "i-box:ended");
    expect(ended?.said, wording.lang).toBe(wording.lapNestedSandbox);
    expect(ended?.yours).toBe(true);
    expect(wording.lapNestedSandbox).not.toMatch(/EPERM|lap perform|seccomp|AF_UNIX/);
  }
  expect(chromeFor("ja").lapNestedSandbox).not.toBe(EN.lapNestedSandbox);
});
