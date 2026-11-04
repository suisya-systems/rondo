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
 * **It adds a check and changes nothing the page draws**: no module under
 * `src/access/page` or `src/access/web.tsx` is touched by the diff it came in.
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
 * **The judgement is on the durations as measured; rounding is for the eye
 * only.** `performance.now()` answers in fractional milliseconds, and the issue
 * asks for a failure when a page takes *more than* half a second, so the
 * comparison is against the raw median: a median of 500.4 ms is over a 500 ms
 * budget and fails. `Math.round` appears once, in the failure message, where a
 * reader wants `117` and not `117.33299999999997`. Rounding before the
 * comparison would read 500.4 ms as exactly on the line and pass it, which is
 * what the second test in this file pins.
 *
 * **The headroom, measured.** On this machine on 2026-11-05 the measured draws
 * are 104 to 157 ms, so the budget is some four times what a healthy page
 * costs. That is deliberate: this is a floor under runner variance, not a
 * target to grow into. The number to change when the page gets slower is the
 * page.
 *
 * **What the fixture is.** Its row counts and its two heaviest columns are the
 * store at hand's, read off `rondo-iterations.sqlite3` on 2026-11-05: 78
 * iterations, 448 thread messages, 288 proposals, 139 lap readings, plans of
 * 8.4 KB and a worker's command log of 174 KB a lap -- 12 MB of that store's 24
 * MB, and the thing a draw decodes per lap it draws.
 *
 * **What it is not, measured on the same day.** It does not reproduce the 4 s
 * draw `f9ff989` removed: with that fix reverted, a draw over this fixture
 * takes 155 ms against 115 ms with it, not four seconds. The 4 s was 485 port
 * calls rather than a large store, and how many calls a draw makes is a
 * function of the *shape* of what is in the store -- how many requests carry
 * scopes, splits and successors, which readers then answer once per request --
 * where this fixture's requests carry none. The call count is
 * `test/access/page-logic/read-once.test.ts`' claim and stays there; what this
 * file holds is the duration, over a store of the right weight. So a red run
 * here says the page is slower than half a second over a store the size of a
 * host's, and a green one does not promise that no shape of store is slow.
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
  /**
   * Average `length(lap_commands)` over the 69 rows that carry one, and the
   * largest column in that store by two orders of magnitude: 12 MB of the 24 MB
   * file is what the workers ran (`D-0104`), about 160 entries of some 2 KB a
   * lap. The page decodes it per lap it draws, so a fixture without it is a
   * fixture missing half the store's weight.
   */
  commandBytes: 174_363,
  /** About 160 entries a lap, at about 2 KB each. */
  commandsPerLap: 160,
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

/**
 * What a worker ran, in the shape the runner records it (`D-0104`): as many
 * entries and as many bytes as a lap of the store at hand carries, so that a
 * draw pays for decoding them the way a draw over that store does.
 */
function lapCommands(): string {
  const output = "1\tthe file this command read, line by line, as the runner kept it\n";
  const each = Math.floor(AT_HAND.commandBytes / AT_HAND.commandsPerLap);
  return JSON.stringify(
    Array.from({ length: AT_HAND.commandsPerLap }, (_unused, index) => ({
      index,
      command: `Read {"file_path":"/srv/work/i-0001/src/access/web.tsx"}`,
      output: output.repeat(Math.ceil(each / output.length)).slice(0, each),
      output_omitted_chars: 0,
      is_error: false,
    })),
  );
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
  const commands = lapCommands();
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
    // What the worker ran, carried by a transition of the state onto itself,
    // which is how a reading arrives minutes after the walk that produced it
    // (`gateWithChecks`' own spelling).
    const ran = await made.store.transition(
      id,
      "awaiting_human",
      "awaiting_human",
      { lapCommands: commands },
      2_400,
    );
    expect(ran.kind).toBe("transitioned");
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
    const written = made.connection
      .prepare(
        "SELECT avg(length(plan)) AS plan, avg(length(lap_commands)) AS commands FROM iteration",
      )
      .get() as { plan: number; commands: number };
    expect(Number(written.plan)).toBeGreaterThanOrEqual(AT_HAND.planBytes);
    expect(Number(written.commands)).toBeGreaterThanOrEqual(AT_HAND.commandBytes);

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
      // The median, so that one draw the runner stalled is not a verdict; the
      // slowest is in the message, so a run near the line can be read. What is
      // compared is the median of the durations as measured -- the rounding
      // below is the message's, because a budget of half a second that a
      // 500.4 ms page passes is not the budget the issue asks for.
      const shown = durations.map((one) => Math.round(one));
      expect(
        median(durations),
        `a page over ${AT_HAND.iterations} laps took ${shown.join(", ")} ms ` +
          `(median ${Math.round(median(durations))} ms, slowest ${Math.max(...shown)} ms), ` +
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

/**
 * The half-second above is a budget a page may *not exceed*, and the test
 * before this one spends a minute building a store before it can say so, which
 * is the wrong place to discover that the comparison reads a slow page as a
 * fast one. So the one arithmetic step between the measurements and the verdict
 * -- take the median, compare it as measured -- is checked here over durations
 * written by hand, where the interesting value can be put on the line on
 * purpose.
 *
 * 500.4 ms is that value: a page that took longer than half a second, by less
 * than a millisecond. It fails, and it fails because the median is compared
 * before it is rounded -- the second expectation is the same five draws through
 * the rounding the failure message uses, and it passes, which is what judging
 * on rounded values would have done to a page over budget.
 */
test("a median over the budget by a fraction of a millisecond is over the budget", () => {
  const draws = [117, 118, 500.4, 502, 640] as const;
  expect(median(draws)).toBeGreaterThan(BUDGET_MS);
  expect(median(draws.map((one) => Math.round(one)))).toBeLessThanOrEqual(BUDGET_MS);
  // And the budget is a ceiling rather than a limit a page has to stay under:
  // half a second exactly is inside half a second, so it passes.
  expect(median([117, 118, BUDGET_MS, 502, 640])).toBeLessThanOrEqual(BUDGET_MS);
});
