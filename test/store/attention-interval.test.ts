/**
 * #40's falsifier, as a planted case (D-0037 rule 6, and its implementation
 * list's item 4).
 *
 * **The requirement this file exists for is one sentence**: given rows written
 * inside and outside an interval, an operator can reconstruct *what was
 * withheld from them in that interval*, **by rule and by count**. #40 states
 * that as the thing rondo must be able to do in order to have discharged its
 * accountability at all, so it is asserted here directly rather than inferred
 * from the query's shape.
 *
 * **The rows are planted, and that is D-0032 rule 5's precedent rather than a
 * shortcut.** Nothing in the tree writes a `withheld` row yet -- the layer that
 * decides what an operator does *not* see is the one #40 says nobody owns --
 * so a test that waited for a withholding writer would be a requirement nobody
 * can check until an unrelated entry lands. What is planted is written through
 * `recordAttention`, so the writer's own refusal (a withholding whose rule
 * cannot be named) still stands between the plant and the table.
 *
 * **The boundaries are asserted in both directions, because an off-by-one here
 * is invisible.** A breakdown that silently dropped the row bearing exactly the
 * mark would still look like a working accounting section: the counts would be
 * plausible, they would simply be wrong, and the only reader who could notice
 * is the one reconstructing a specific morning. Both bounds are inclusive, on
 * `changedSince`'s and `openProposals`' terms -- the failure accepted is
 * showing something twice, and the failure avoided is losing it for ever.
 *
 * Every case carries an **observed-red control**: the same assertion run
 * against the unbounded breakdown, or against a neighbouring interval, so that
 * a `WHERE` clause which quietly matched everything (or nothing) would fail
 * here rather than pass as a narrower-looking number.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import type { AttentionCount } from "../../src/store/records.js";
import type { AdvisoryRecord } from "../../src/store/sqlite.js";
import { advisoryRecord } from "../../src/store/sqlite.js";

const record = (): AdvisoryRecord => advisoryRecord(new DatabaseSync(":memory:"));

/** One withholding, planted at a moment, under a named rule. */
async function withhold(
  store: AdvisoryRecord,
  atMs: number,
  subjectId: string,
  ruleName: string,
): Promise<void> {
  const outcome = await store.recordAttention({
    atMs,
    subjectKind: "proposal",
    subjectId,
    disposition: "withheld",
    ruleName,
  });
  expect(outcome.kind).toBe("recorded");
}

/** One presentation, planted at a moment. */
async function present(store: AdvisoryRecord, atMs: number, subjectId: string): Promise<void> {
  const outcome = await store.recordAttention({
    atMs,
    subjectKind: "proposal",
    subjectId,
    disposition: "presented",
    ruleName: null,
  });
  expect(outcome.kind).toBe("recorded");
}

/**
 * The breakdown as the sentence an operator reconstructs: rule name to count.
 *
 * The presented side is keyed under `null`, which is what the row holds there
 * -- there is no policy to name where nothing was withheld.
 */
function byRule(counts: readonly AttentionCount[]): Record<string, number> {
  const named: Record<string, number> = {};
  for (const row of counts) {
    if (row.disposition === "withheld") {
      named[row.ruleName ?? "(unnamed)"] = row.count;
    }
  }
  return named;
}

function presented(counts: readonly AttentionCount[]): number {
  return counts
    .filter((row) => row.disposition === "presented")
    .reduce((sum, row) => sum + row.count, 0);
}

// --- #40's falsifier ------------------------------------------------------

test("what was withheld in an interval is reconstructable by rule and by count", async () => {
  const store = record();
  // **Before the interval**: two withholdings an operator must not be shown as
  // having happened during it.
  await withhold(store, 1_000, "p-before-1", "duplicate-delivery");
  await withhold(store, 1_500, "p-before-2", "quiet-hours");
  // **Inside it**: three by one rule, one by another, and one presentation.
  await withhold(store, 2_000, "p-in-1", "duplicate-delivery");
  await withhold(store, 2_400, "p-in-2", "duplicate-delivery");
  await withhold(store, 2_900, "p-in-3", "duplicate-delivery");
  await withhold(store, 2_500, "p-in-4", "quiet-hours");
  await present(store, 2_600, "p-in-5");
  // **After it**: one more, under a rule that appears nowhere else, so an
  // interval that leaked forwards would show a rule name it should not know.
  await withhold(store, 4_000, "p-after-1", "batched-by-repository");

  const inside = await store.attentionBreakdown({ fromMs: 2_000, toMs: 3_000 });

  // The sentence #40 asks for: *in that window, three were withheld by the
  // duplicate-delivery rule and one by quiet-hours*.
  expect(byRule(inside)).toEqual({ "duplicate-delivery": 3, "quiet-hours": 1 });
  expect(presented(inside)).toBe(1);

  // **The observed-red control.** Without a bound the same rows answer with
  // every rule and every count, so a `WHERE` clause that matched everything
  // would pass the assertion above only if this one also held -- and it does
  // not.
  const everything = await store.attentionBreakdown();
  expect(byRule(everything)).toEqual({
    "duplicate-delivery": 4,
    "quiet-hours": 2,
    "batched-by-repository": 1,
  });
  expect(byRule(everything)).not.toEqual(byRule(inside));
});

test("a rule that withheld nothing in the interval is absent from it, not zeroed elsewhere", async () => {
  const store = record();
  await withhold(store, 1_000, "p-1", "quiet-hours");
  await withhold(store, 2_000, "p-2", "duplicate-delivery");

  const inside = await store.attentionBreakdown({ fromMs: 1_900, toMs: 2_100 });
  // One rule, and the other is not reported as a zero it did not earn: what an
  // operator reconstructs is the rules that actually withheld something from
  // them in that window.
  expect(byRule(inside)).toEqual({ "duplicate-delivery": 1 });
  // The control: the rule that is absent here really is in the table.
  expect(byRule(await store.attentionBreakdown())).toHaveProperty("quiet-hours", 1);
});

// --- the bounds, in both directions ---------------------------------------

test("both bounds are inclusive, and a row one millisecond outside is not counted", async () => {
  const store = record();
  await withhold(store, 999, "p-just-before", "r");
  await withhold(store, 1_000, "p-on-the-lower-bound", "r");
  await withhold(store, 2_000, "p-on-the-upper-bound", "r");
  await withhold(store, 2_001, "p-just-after", "r");

  // Both ends inclusive: the two rows bearing exactly the bounds are in.
  expect(byRule(await store.attentionBreakdown({ fromMs: 1_000, toMs: 2_000 }))).toEqual({ r: 2 });
  // One millisecond wider takes both neighbours, which is the control that
  // says the two excluded rows exist and were excluded by the bound rather
  // than by never having been written.
  expect(byRule(await store.attentionBreakdown({ fromMs: 999, toMs: 2_001 }))).toEqual({ r: 4 });
  // One millisecond narrower drops both bound-bearing rows, which is the
  // control in the other direction.
  expect(byRule(await store.attentionBreakdown({ fromMs: 1_001, toMs: 1_999 }))).toEqual({});
});

test("a half-open interval bounds only the side it names", async () => {
  const store = record();
  await withhold(store, 1_000, "p-1", "r");
  await withhold(store, 3_000, "p-2", "r");

  // A null bound is no bound, which is what lets the inbox ask "since the
  // mark" without inventing an upper limit, and "up to the render's own bound"
  // without inventing a lower one.
  expect(byRule(await store.attentionBreakdown({ fromMs: 2_000, toMs: null }))).toEqual({ r: 1 });
  expect(byRule(await store.attentionBreakdown({ fromMs: null, toMs: 2_000 }))).toEqual({ r: 1 });
  expect(byRule(await store.attentionBreakdown({ fromMs: null, toMs: null }))).toEqual({ r: 2 });
});

test("an empty interval is an empty answer and not the whole table", async () => {
  const store = record();
  await withhold(store, 1_000, "p-1", "r");
  await present(store, 1_000, "p-2");

  // The failure this rules out is a `WHERE` clause that falls back to matching
  // everything when its bounds exclude every row -- which would report a
  // quiet window as the busiest one in the ledger.
  const empty = await store.attentionBreakdown({ fromMs: 5_000, toMs: 6_000 });
  expect(empty).toEqual([]);
  expect(presented(empty)).toBe(0);
  expect(byRule(empty)).toEqual({});
  // The control: those rows are there, and an unbounded ask finds them.
  expect(presented(await store.attentionBreakdown())).toBe(1);
});

test("an interval whose bounds are inverted answers nothing rather than everything", async () => {
  const store = record();
  await withhold(store, 1_000, "p-1", "r");
  // Not a case any caller here produces, and asserted because the alternative
  // is a query that silently drops its own bounds: `at_ms >= 2000 AND
  // at_ms <= 1000` is unsatisfiable, and an accounting section that answered
  // "all of time" to it would be at its most wrong where it looked most
  // precise.
  expect(await store.attentionBreakdown({ fromMs: 2_000, toMs: 1_000 })).toEqual([]);
});

// --- what the interval cannot prove ---------------------------------------

test("a presentation counted once per subject stays one row however often it is asked for", async () => {
  const store = record();
  // D-0036 rule 1, re-asserted through the interval: *when* a subject was first
  // shown is preserved and *how often* is not, so an interval bounds the
  // moment of the first presentation and nothing else. A second write inside a
  // later window must not make the subject appear in that window.
  await present(store, 1_000, "p-1");
  await present(store, 5_000, "p-1");

  expect(presented(await store.attentionBreakdown({ fromMs: 900, toMs: 1_100 }))).toBe(1);
  expect(presented(await store.attentionBreakdown({ fromMs: 4_900, toMs: 5_100 }))).toBe(0);
  expect(presented(await store.attentionBreakdown())).toBe(1);
});

test("a withholding is counted per row, because a subject may be withheld more than once", async () => {
  const store = record();
  // The other half of rule 1's asymmetry, and it is deliberate: the unique
  // index covers `disposition = 'presented'` only. A subject withheld on
  // Monday and again on Tuesday was withheld twice, and an interval over
  // Tuesday has to be able to say so.
  await withhold(store, 1_000, "p-1", "quiet-hours");
  await withhold(store, 5_000, "p-1", "quiet-hours");

  expect(byRule(await store.attentionBreakdown({ fromMs: 4_900, toMs: 5_100 }))).toEqual({
    "quiet-hours": 1,
  });
  expect(byRule(await store.attentionBreakdown())).toEqual({ "quiet-hours": 2 });
});

test("a withholding that names no rule is refused, so an interval never counts one", async () => {
  const store = record();
  // D-0032 rule 10's writer refusal, re-asserted from this side: what bounds
  // the *accountable* silence is that every row in it names a rule. A blank
  // rule name would be a row the interval could count and an operator could
  // not attribute.
  const outcome = await store.recordAttention({
    atMs: 1_000,
    subjectKind: "proposal",
    subjectId: "p-1",
    disposition: "withheld",
    ruleName: "   ",
  });
  expect(outcome.kind).toBe("refused");
  expect(await store.attentionBreakdown({ fromMs: 0, toMs: 9_999 })).toEqual([]);
});
