/**
 * The revise drafter (DECISIONS.md D-0077): a row per reading, and what it
 * does when a write fails or a newer reading lands while a draft is being
 * written.
 *
 * **Its own file since the page's rebuild.** These cases used to sit in
 * `test/access/web.test.ts` and none of them is about markup, so replacing the
 * view layer would have taken this module's coverage with it and nothing would
 * have gone red.
 */
import { expect, test } from "vitest";
import type { JsonRecord } from "../../src/store/records.js";
import {
  draftRevise,
  fresh,
  gateWithChecks,
  modelFindings,
  newerModelReading,
  REVISE_ANSWER,
  reviseRows,
} from "./revise-drafter-world.js";

test("the revise drafter writes one row per reading, under its own name, and is not run twice over one (D-0077 rules 1.2, 2.2, 5.1)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  await modelFindings(world);
  const documents = await draftRevise(world, REVISE_ANSWER);
  expect(documents).toHaveLength(1);
  // The document holds every finding, numbered, and what the drafter must not do.
  const doc = documents[0] as string;
  expect(doc).toContain(
    "--- finding 1 (blocker)\nthe loop never stops\n  where: src/notifier.ts:41",
  );
  expect(doc).toContain("--- finding 2 (major)\nthe backoff is not capped");
  expect(doc).toContain('"findings" holds exactly 2 entries');
  expect(doc).toContain("BEGIN THE ATTEMPT'S PROMPT\ndo the thing\n");
  const [row, ...more] = reviseRows(world);
  expect(more).toHaveLength(0);
  expect(row?.drafter).toMatch(/^rondo\/revise-drafter\/1\//);
  expect(row?.payload).toEqual({
    kind: "drafted",
    lead: "Keep the retry budget, but make it end.",
    changes: [
      "Stop after the budget's last try.\nSay so in the log.",
      "Cap the backoff at 30 seconds.",
    ],
  });
  expect((row?.snapshot["reading"] as JsonRecord | undefined)?.["findings"]).toEqual([
    "the loop never stops",
    "the backoff is not capped",
  ]);
  // A proposal nobody approves: the store refuses a decision naming it.
  const id = String(
    world.connection
      .prepare("SELECT proposal_id FROM proposal WHERE kind = 'revise_draft'")
      .get()?.["proposal_id"],
  );
  const decided = await world.record.recordDecision({
    decisionId: "d-1",
    proposalId: id,
    outcome: "approved",
    approved: null,
    predecessor: null,
    actorId: "ada",
    recordedBy: "rondo-web",
    gateId: null,
    gateTransitionSeq: null,
    decidedAtMs: 5_000,
  });
  expect(decided.kind).toBe("refused");

  // Drafted, so a second scan spends nothing.
  expect(await draftRevise(world, REVISE_ANSWER)).toHaveLength(0);
  expect(reviseRows(world)).toHaveLength(1);
});

test("a store fault at the write keeps the draft and writes it on the next scan, without running again (D-0077 rules 2.2, 4.2)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  await modelFindings(world);
  let faults = 1;
  const documents = await draftRevise(world, REVISE_ANSWER, {
    scans: 2,
    write: (real) => async (proposal, gateId) => {
      if (faults > 0) {
        faults -= 1;
        return { kind: "defect", reason: "database is locked" };
      }
      return await real(proposal, gateId);
    },
  });
  // One model call; the first scan's write met the lock, and the second wrote
  // the same draft -- not an unavailable row about the lock.
  expect(documents).toHaveLength(1);
  expect(reviseRows(world).map((r) => r.payload["kind"])).toEqual(["drafted"]);
});

test("a reading that lands while the draft is written makes that draft stale: nothing is written for it (D-0077 rule 2.3)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  await modelFindings(world);
  let landed = false;
  const documents = await draftRevise(
    world,
    { lead: null, findings: [{ finding: 1, change: "Fix it." }] },
    {
      during: async () => {
        if (!landed) {
          landed = true;
          await newerModelReading(world, "the log is too loud", 6_000);
        }
      },
    },
  );
  // The first run was over two findings and is discarded at the write; the
  // rescan drafts the newer reading, whose one finding the answer addresses.
  expect(documents).toHaveLength(2);
  const written = reviseRows(world);
  expect(written).toHaveLength(1);
  expect((written[0]?.snapshot["reading"] as JsonRecord | undefined)?.["findings"]).toEqual([
    "the log is too loud",
  ]);
});
