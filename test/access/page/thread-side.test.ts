/**
 * The right face of a request (DECISIONS.md D-0083 rules 5 and 6, gate point
 * 7's second slice).
 *
 * Three kinds of claim. **What the face holds** is rule 6's list read back off
 * the markup, with the entry's own ban on it: a spend is never drawn without
 * the figure it was approved against, and the reach and the tries fall with
 * the pair because all three are one approval's. **Which tier is on top** is
 * rule 5's other sentence -- the material above while something is being
 * asked, the agreement above when nothing is -- and it is a fact about the
 * state rather than a layout, so it is asserted directly. **That the count of
 * what rondo decided without asking is this request's** is asserted through
 * the store, with a withholding about another request planted beside it as the
 * observed-red control: a query that had quietly matched everything would pass
 * a test that only ever planted one request's rows.
 *
 * The rows are planted with `recordAttention`, which is `attention-interval`'s
 * precedent and its reason: nothing in the tree writes a `withheld` row yet --
 * the layer that decides what an operator does *not* see is the one #40 says
 * nobody owns -- so a test that waited for a withholding writer would be a
 * requirement nobody can check until an unrelated entry lands.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ThreadSide } from "../../../src/access/page/thread-side.js";
import type { Governance } from "../../../src/access/page-logic/governance.js";
import type { WorkStep } from "../../../src/access/page-logic/week.js";
import { EN } from "../../../src/access/wording.js";
import type { ProposalDraft } from "../../../src/store/records.js";
import { fresh, gateWithChecks, operatorPage, portsOver } from "../page-world.js";

const STEPS: readonly WorkStep[] = [
  { name: "work", state: "done" },
  { name: "checks", state: "done" },
  { name: "reading", state: "done" },
  { name: "approval", state: "waiting" },
  { name: "landing", state: "yours" },
];

const governance = (over: Partial<Governance> = {}): Governance => ({
  repository: "o/r",
  askedAtMs: 1_000,
  allowance: { spentUsd: 5, approvedUsd: 50 },
  tries: { at: 1, of: 4 },
  chain: [
    { step: "answer", state: "waiting" },
    { step: "proposal", state: "yours" },
    { step: "merge", state: "yours" },
  ],
  touches: { places: [{ repository: "o/r", root: "/w" }], acts: ["push_branch"] },
  decided: { count: 0, byRule: [] },
  ...over,
});

const side = (over: Partial<Governance> = {}, asking = true) =>
  renderToStaticMarkup(
    ThreadSide({
      wording: EN,
      governance: governance(over),
      steps: STEPS,
      material: "the material",
      asking,
    }),
  );

test("what was agreed is on the face in full: the allowance, what is left, the tries, the reach, the steps", () => {
  const html = side();
  expect(html).toContain(EN.sideAgreed);
  // The pair, and what is left of it -- which is the figure the line has no
  // room for and is the reason this face carries the same facts in full.
  expect(html).toContain("$5.00 of $50.00");
  expect(html).toContain("$45.00");
  expect(html).toContain("try 1 of 4");
  // Where it may touch, as a place and an act, and never as the act's name in
  // the record (D-0076).
  expect(html).toContain(EN.govTouchLabel);
  expect(html).toContain("/w");
  expect(html).toContain("rondo may push a branch");
  expect(html).not.toContain("push_branch");
  // What remains before this ends: the five steps, the one it is on marked.
  expect(html).toContain(EN.govStepsLabel);
  for (const said of [EN.stepWork, EN.stepChecks, EN.stepReading, EN.stepApproval, EN.stepLanding])
    expect(html).toContain(said);
  expect(html).toContain("side-step side-step-waiting");
});

test("with no approval read, neither the spend nor the reach is drawn", () => {
  // Rule 6's ban, on the face: the pair, the tries and the places all come off
  // one approval, so a lap admitted under none has no agreed reach to show and
  // no spend anybody agreed to.
  const html = side({ allowance: null, tries: null, touches: null });
  expect(html).toContain(EN.weekNoAllowance);
  expect(html).not.toContain("$");
  expect(html).not.toContain(EN.govTouchLabel);
  // And what does not depend on an approval is still said.
  expect(html).toContain(EN.govStepsLabel);
});

test("an approval that permits nothing outward says so rather than showing an empty list", () => {
  const html = side({ touches: { places: [], acts: [] } });
  expect(html).toContain(EN.govActsNone);
});

test("which tier is on top is whether anything is being asked", () => {
  // Rule 5: the material above the agreement while a question stands, and --
  // with nothing being asked -- the agreement on top with what is known so far
  // under it. The heading over the material changes with it.
  const asked = side({}, true);
  expect(asked.indexOf(EN.sideMaterial)).toBeLessThan(asked.indexOf(EN.sideAgreed));
  expect(asked).not.toContain(EN.sideKnownSoFar);

  const quiet = side({}, false);
  expect(quiet.indexOf(EN.sideAgreed)).toBeLessThan(quiet.indexOf(EN.sideKnownSoFar));
  expect(quiet).not.toContain(EN.sideMaterial);
});

test("what rondo decided without asking is counted, named by its rule, and is this request's", async () => {
  const world = fresh();
  await gateWithChecks(world);
  const proposal = (proposalId: string, iterationId: string | null): ProposalDraft => ({
    proposalId,
    kind: "widening_successor",
    drafter: "rondo/deterministic/1",
    payload: {},
    snapshot: {},
    derivation: null,
    iterationId,
    supersedesIterationId: null,
    supersedesProposalId: null,
    predecessorPlanDigest: null,
    predecessorContractDigest: null,
    agentTypeDigest: null,
    configDigest: null,
    contractDigest: null,
    continuoRevision: null,
    cadenzaRevision: null,
    elevatedFromMessageId: null,
    elevatedByActorId: null,
    createdAtMs: 1_000,
  });
  // Two withholdings about the lap this request is being answered on...
  expect(await world.record.recordProposal(proposal("p-mine", "i-0001"))).toEqual({
    kind: "recorded",
  });
  // ...and one about a lap of no request at all, which is the control: a query
  // bounded by nothing would count it and read three where two are true.
  expect(await world.record.recordProposal(proposal("p-elsewhere", null))).toEqual({
    kind: "recorded",
  });
  for (const [subjectId, ruleName] of [
    ["p-mine", "duplicate-delivery"],
    ["p-mine", "duplicate-delivery"],
    ["p-elsewhere", "below-threshold"],
  ] as const) {
    expect(
      await world.record.recordAttention({
        atMs: 2_000,
        subjectKind: "proposal",
        subjectId,
        disposition: "withheld",
        ruleName,
      }),
    ).toEqual({ kind: "recorded" });
  }

  const html = await operatorPage(portsOver(world, "ada", []), "t", { kind: "summary" });
  // On the line under the title, which is where rule 6 puts the count...
  expect(html).toContain(`class="gov-decided">${EN.govDecided(2)}`);
  // ...and on the face, with the rule behind it, which is the same thing as
  // why it did not need the person (D-0064 O8).
  const agreed = html.slice(html.indexOf(EN.sideAgreed));
  expect(agreed).toContain("duplicate-delivery");
  expect(agreed).not.toContain("below-threshold");
  expect(agreed).not.toContain(EN.govDecidedNone);
});
