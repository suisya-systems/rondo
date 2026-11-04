/**
 * One page is answered inside half a second over a store the size of the one a
 * host holds (rondo#755, the measurement in `f9ff989`).
 *
 * **Why this suite exists.** The page was drawn from several readings of the
 * same rows, and what that cost grew with the store: over the dogfood store a
 * draw made 485 port calls and took 3.8 to 5.6 s, because the readers that
 * answer *has this plan already been started* and *where does this scope stand*
 * each take the whole ended ledger and were asked once per request. Nothing in
 * the suite said so -- every page test drew over three or four rows, where 485
 * calls are as cheap as five -- so the slowness was found by a person waiting
 * for a page rather than by a red check. This file is that missing check: a
 * store of the size the host's is, one page served over http, and a budget.
 *
 * **What is judged, and how.** A duration is noisy -- a runner is shared, the
 * compiler and the garbage collector are not ours to schedule -- so a single
 * draw over budget is not a verdict. One draw is taken as a warm-up and thrown
 * away (the first draw pays for v8 compiling the renderer and for sqlite's
 * first read of each page of the file), then {@link DRAWS} draws are measured
 * and **the median is judged against {@link BUDGET_MS}**. The median is over
 * budget exactly when the majority of draws are, which is the claim worth
 * failing on: *a page takes this long*, not *a page once took this long*. The
 * slowest draw is reported in the message either way, so a run that was close
 * to the line says so.
 *
 * **The headroom, measured.** On this machine on 2026-11-05 the measured draws
 * are 63 to 177 ms, so the budget is some five times what a healthy page costs.
 * That is deliberate: this is a floor under runner variance, not a target to
 * grow into. The number to change when the page gets slower is the page.
 *
 * **What the fixture is, and what it is not.** Its row counts are the counts of
 * the store at hand, read off `rondo-iterations.sqlite3` on 2026-11-05: 78
 * iterations, 448 thread messages, 288 proposals and 139 lap readings. Its
 * plans are padded to the average payload that store carries (8.4 KB), because
 * the ended ledger's cost is a function of plan bytes rather than of row count.
 * It is not a copy of that store: its readings, spends and scopes are the
 * fixtures' own, and a host's store will keep growing past these numbers. So
 * what a red run here means is "the page gets slower as the store grows", which
 * is the regression this file is for -- and what a green run does *not* promise
 * is a particular duration on a particular operator's machine.
 */
import { expect, test } from "vitest";
import type { ProposalDraft } from "../../src/store/records.js";
import { ownLane } from "../lane-claims.js";
import {
  EVIDENCE,
  fresh,
  get,
  openGate,
  openRequest,
  PLAN,
  planFor,
  portsOver,
  recordAnswer,
  rows,
  serving,
  WINDOWS_HEAVY_TIMEOUT_MS,
} from "./page-world.js";

/** What a page may take, which is what the issue asks for: half a second. */
const BUDGET_MS = 500;

/**
 * Draws measured after the warm-up. Odd, so the median is a measurement rather
 * than the mean of two, and five rather than three because the judgement is
 * then "three draws over budget", which no single slow draw can produce.
 */
const DRAWS = 5;

/**
 * The size of the store at hand, measured on 2026-11-05 (see this file's
 * header). The counts are named here so a reader can compare them with a host's
 * store rather than reverse them out of the loops below.
 */
const AT_HAND = {
  iterations: 78,
  messages: 448,
  proposals: 288,
  readings: 139,
  /** Average `length(plan)` over that store's iteration rows. */
  planBytes: 8_387,
} as const;

/**
 * A prompt long enough that the stored plan is about as many bytes as the
 * average plan of the store at hand. The filler is a sentence rather than one
 * repeated character so that the payload compresses and digests like prose.
 *
 * Padded to the average plus a little, because what is measured here is the
 * record this test serialises and what the assertion below reads is the column
 * sqlite wrote: the two differ by a few bytes per row, and overshooting by a
 * line of prose is cheaper than making a test about duration depend on which
 * of the two spellings is longer.
 */
function paddedPrompt(): string {
  const sentence = "Add the retry budget the request asks for, and say what it costs. ";
  const base = JSON.stringify(planFor("i-sizing")).length;
  const pad = Math.max(0, AT_HAND.planBytes + sentence.length - base);
  return PLAN.prompt + sentence.repeat(Math.ceil(pad / sentence.length)).slice(0, pad);
}

/** One model reading, which is what a lap carries two of by the time it ends. */
const reading = (index: number) => ({
  drafter: "rondo/model/1/gpt-6-astra",
  verdict: "concerns" as const,
  findings: [`the backoff is not capped (${index})`, "the loop never stops"],
  evidence: EVIDENCE,
  unavailableReason: null,
});

/** One proposal about the lap `iterationId`, as the drafter writes them. */
const proposal = (index: number, iterationId: string): ProposalDraft => ({
  proposalId: `p-${index}`,
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

const lapId = (index: number): string => `i-${String(index).padStart(4, "0")}`;

/**
 * A store the size of the one at hand: every lap ended at its gate but the
 * last, which is left waiting so the page has the row with a button on it.
 *
 * The laps are reserved one at a time and closed as they go, because a store
 * holds four occupying laps and six live ones at once (`fresh`): a ledger of 78
 * is a ledger of laps that have *ended*, which is also what makes it expensive
 * to read.
 */
async function storeTheSizeOfTheHosts(): Promise<ReturnType<typeof fresh>> {
  const made = fresh();
  const prompt = paddedPrompt();
  // 61 laps carry two readings and 17 carry one, which is the 139 the store at
  // hand holds over its 78 laps.
  const twoReadings = AT_HAND.readings % AT_HAND.iterations;
  for (let index = 0; index < AT_HAND.iterations; index += 1) {
    const id = lapId(index);
    await openRequest(made, `req-${id}`, `request ${index}: add a retry budget`, 1_000 + index);
    const reserved = await made.store.reserve({
      numbers: null,
      id,
      request: `request ${index}: add a retry budget`,
      plan: planFor(id, null, PLAN.repository, prompt),
      spend: null,
      scopeSpend: null,
      claim: ownLane(id),
      nowMs: 1_000,
      supersedesIterationId: null,
      requestMessageId: `req-${id}`,
      runId: `rondo-${id}`,
      topicBranch: `rondo/${id}`,
      workspace: `/srv/work/${id}`,
    });
    expect(reserved.kind).toBe("reserved");
    await openGate(made, id);
    for (let taken = 0; taken < (index < twoReadings ? 2 : 1); taken += 1) {
      const appended = await made.store.appendReading(id, reading(taken), 2_500);
      expect(appended.kind).toBe("appended");
    }
    // The last lap stays at its gate: a page over a ledger with nothing waiting
    // on it draws no gate, and the gate is the most expensive thing on it.
    if (index === AT_HAND.iterations - 1) {
      continue;
    }
    await recordAnswer(made, id);
    const closed = await made.store.transition(id, "awaiting_human", "closed", {}, 3_000);
    expect(closed.kind).toBe("transitioned");
  }
  // The thread messages past the one each request opened, and the proposals,
  // spread over the laps the way a drafter writes them.
  for (let index = AT_HAND.iterations; index < AT_HAND.messages; index += 1) {
    await openRequest(made, `m-${index}`, `a reply about the retry budget (${index})`, 1_200);
  }
  for (let index = 0; index < AT_HAND.proposals; index += 1) {
    const recorded = await made.record.recordProposal(
      proposal(index, lapId(index % AT_HAND.iterations)),
    );
    expect(recorded.kind).toBe("recorded");
  }
  return made;
}

const median = (durations: readonly number[]): number =>
  [...durations].sort((a, b) => a - b)[Math.floor(durations.length / 2)] ?? Number.NaN;

test(
  "one page is answered inside half a second over a store the size of the host's",
  async () => {
    const made = await storeTheSizeOfTheHosts();
    // The budget is judged over the store this says it is judged over. Without
    // this, a fixture that stopped writing rows -- a refused reserve, a renamed
    // table -- would turn the measurement green by having nothing to draw.
    expect({
      iterations: rows(made.connection, "iteration"),
      messages: rows(made.connection, "conversation_message"),
      proposals: rows(made.connection, "proposal"),
      readings: rows(made.connection, "lap_reading"),
    }).toEqual({
      iterations: AT_HAND.iterations,
      messages: AT_HAND.messages,
      proposals: AT_HAND.proposals,
      readings: AT_HAND.readings,
    });
    const plan = made.connection
      .prepare("SELECT avg(length(plan)) AS bytes FROM iteration")
      .get() as { bytes: number };
    expect(Number(plan.bytes)).toBeGreaterThanOrEqual(AT_HAND.planBytes);

    const { base, stop, served } = await serving(portsOver(made, "ada", []));
    try {
      // The warm-up, thrown away: it pays for the renderer being compiled and
      // for the first read of each page of the store.
      const first = await get(base, "/?lang=en");
      expect(first.status).toBe(200);
      // And the page really is drawn over these rows, rather than being a
      // refusal or an empty shell served quickly.
      expect(first.body).toContain("add a retry budget");

      const durations: number[] = [];
      for (let draw = 0; draw < DRAWS; draw += 1) {
        const started = performance.now();
        const page = await get(base, "/?lang=en");
        durations.push(performance.now() - started);
        expect(page.status).toBe(200);
      }
      const taken = durations.map((one) => Math.round(one));
      // The median, so that one draw the runner stalled is not a verdict; the
      // slowest is in the message, so a run near the line can be read.
      expect(
        median(taken),
        `a page over ${AT_HAND.iterations} laps took ${taken.join(", ")} ms ` +
          `(median ${median(taken)} ms, slowest ${Math.max(...taken)} ms), ` +
          `and the budget is ${BUDGET_MS} ms`,
      ).toBeLessThanOrEqual(BUDGET_MS);
    } finally {
      stop.abort();
      await served;
    }
  },
  // The fixture writes some 950 rows and the test draws six pages over them,
  // which is heavy in the sense `WINDOWS_HEAVY_TIMEOUT_MS` is for: a floor
  // under runner variance, and not the thing being measured -- what this test
  // asserts about duration it asserts itself, in milliseconds.
  WINDOWS_HEAVY_TIMEOUT_MS,
);
