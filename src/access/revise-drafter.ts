/**
 * The revise drafter in the resident host (D-0077 sections 1, 2 and 5): which
 * laps are due, one run over one lap's latest model reading, and the one row a
 * finished run writes.
 *
 * **Work is found by rows, not by a queue** (rule 2.2, D-0071 rule 3.2's
 * shape). A lap is due when it waits at its gate under an approval, its latest
 * model reading has findings, and no `revise_draft` row holds that reading in
 * its snapshot. Every finished run writes one -- a draft, or the reason there
 * is none -- so nothing stays due after a run over it and a restart loses
 * nothing. Readings are taken by whichever process ran the lap, so a timer
 * rescan is how this process hears of them.
 *
 * **One run per lap at a time, and a stale run writes nothing** (rule 2.3):
 * runs are taken one after another under a lease per lap, and the store
 * refuses a write whose lap left its gate or gained a newer model reading
 * after the document was assembled; the next scan runs the newer reading.
 *
 * **Nobody waits on it** (rule 2.4): {@link ReviseDrafterHost.kick} returns at
 * once, and the draft lands as a row the gate view reads when it is next drawn.
 */

import { drafterRow } from "../continuo/roles.js";
import { readPlan } from "../refrain/plan.js";
import {
  type IterationRecord,
  isModelReadingDrafter,
  type JsonRecord,
  type LapReading,
  latestReading,
  type ProposalDraft,
  readingContent,
} from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import type { runDrafter } from "./forge.js";
import { hostFailure } from "./host-failure.js";
import { threadOf } from "./model-drafter.js";
import { reviewRoundsAlong } from "./model-review.js";
import {
  prepareRevise,
  type ReviseLineageLap,
  type ReviseMaterial,
  type ReviseOutcome,
  reviseDrafterName,
  reviseDraftOf,
} from "./revise-draft.js";
import { approvalTip, budgetRefusal } from "./scope.js";

/** As the scope drafter's lease: past the drafter's own timeout, and freed within a quarter hour. */
const LEASE_MS = 15 * 60 * 1000;

/** Links a lineage walk follows before it stops, as the store's own bound. */
const LINEAGE_BOUND = 1000;

/** What the host reaches, as values a test can replace. */
export interface ReviseDrafterPorts {
  readonly store: Pick<IterationStore, "read" | "readLive" | "readingsFor">;
  readonly record: Pick<
    AdvisoryRecord,
    | "threadMessages"
    | "scopeDecisionAdmitting"
    | "scopeTip"
    | "readScopeDecision"
    | "readScope"
    | "scopeSpent"
    | "lineageOf"
    | "recordReviseDraft"
    | "reviseDraftFor"
    | "claimDraft"
    | "releaseDraft"
  >;
  readonly runDrafter: typeof runDrafter;
  readonly now: () => number;
  readonly mintId: (kind: "draft" | "drafter-host") => string;
  /** The language the host's operator reads, or null (`RONDO_OPERATOR_LANGUAGE`). */
  readonly language: string | null;
  readonly log: (line: string) => void;
}

export interface ReviseDrafterHost {
  /** Look for due laps now. Returns at once; a scan already in flight is joined. */
  kick(): void;
  /** Resolves once no scan or run is in flight: for tests and for a clean shutdown. */
  idle(): Promise<void>;
}

/** One lap due for a draft, and the reading it is due over. */
interface Due {
  readonly record: IterationRecord;
  readonly gateId: string;
  readonly reading: LapReading;
}

/** The lease key of one lap, in the drafter lease's table (rule 2.3). */
const leaseKey = (iterationId: string): string => `revise:${iterationId}`;

/** A reading's identity for the host's own memory: the lap and what the reading says. */
const memoryKey = (iterationId: string, reading: LapReading): string =>
  `${iterationId}\n${JSON.stringify(readingContent(reading))}`;

export function reviseDrafterHost(ports: ReviseDrafterPorts): ReviseDrafterHost {
  // A reading whose row could not be written at all: not run again (D-0071
  // rule 1.5's "not retried"), so a store that refuses does not cost a draft
  // on every scan. The next reading on the lap is a new key.
  const givenUp = new Set<string>();
  // A finished run whose write met a store fault (a locked database): kept so
  // the next scan writes it without paying for the run again.
  const unwritten = new Map<string, Finished>();
  const holder = ports.mintId("drafter-host");
  let running: Promise<void> | null = null;
  let again = false;

  const loop = async (): Promise<void> => {
    while (again) {
      again = false;
      let due: readonly Due[];
      try {
        due = await dueLaps(ports, givenUp);
      } catch (error) {
        ports.log(`revise drafter  the laps could not be scanned: ${describe(error)}`);
        return;
      }
      for (const one of due) {
        const id = one.record.id;
        try {
          const nowMs = ports.now();
          if (!(await ports.record.claimDraft(leaseKey(id), holder, nowMs, nowMs + LEASE_MS))) {
            continue;
          }
          try {
            // Still due now that it is ours: another host may have drafted it.
            const still = (await dueLaps(ports, givenUp)).find((d) => d.record.id === id);
            if (still !== undefined) {
              const written = await draftAndWrite(ports, still, unwritten);
              if (written === "stale") {
                again = true;
              } else if (written === "failed") {
                givenUp.add(memoryKey(id, still.reading));
              }
            }
          } finally {
            await ports.record.releaseDraft(leaseKey(id), holder);
          }
        } catch (error) {
          // A fault of the moment -- a locked database, a lease -- and not the
          // store answering this draft: the lap stays due for the next scan.
          ports.log(`revise drafter  ${id}: ${describe(error)}; tried again on the next scan`);
        }
      }
    }
  };

  const kick = (): void => {
    again = true;
    if (running === null) {
      running = loop().finally(() => {
        running = null;
        if (again) {
          kick();
        }
      });
    }
  };
  return {
    kick,
    async idle() {
      while (running !== null) {
        await running;
      }
    },
  };
}

/**
 * Every lap due for a draft, oldest first (D-0077 rule 2.1): waiting at its
 * gate, admitted under an approval whose line has one tip (the gate view draws
 * a revise form for no other lap), with a latest model reading of `concerns`
 * holding a finding that no revise draft holds.
 */
async function dueLaps(
  ports: ReviseDrafterPorts,
  givenUp: ReadonlySet<string>,
): Promise<readonly Due[]> {
  const due: Due[] = [];
  const live = (await ports.store.readLive()).flatMap((o) => (o.kind === "read" ? [o.record] : []));
  for (const record of live.sort((a, b) => a.createdAtMs - b.createdAtMs)) {
    if (record.status !== "awaiting_human" || record.gateId === null) {
      continue;
    }
    const reading = latestReading(await ports.store.readingsFor(record.id), isModelReadingDrafter);
    if (reading === null || reading.verdict !== "concerns" || reading.findings.length === 0) {
      continue;
    }
    if (givenUp.has(memoryKey(record.id, reading))) {
      continue;
    }
    const tip = await approvalTip(ports.record, record.id);
    if (tip.kind !== "tip") {
      continue;
    }
    // **Nor where a budget closes the change path**: the gate view draws the
    // way to raise it in place of the form (D-0074 rule 4.1), so a draft now
    // is paid for and read by nobody. A scan after the raise drafts it.
    if (
      record.requestMessageId !== null &&
      (await budgetClosed(ports, tip.scopeDecisionId, ports.now()))
    ) {
      continue;
    }
    if ((await ports.record.reviseDraftFor(record.id, reading)) !== null) {
      continue;
    }
    due.push({ record, gateId: record.gateId, reading });
  }
  return due;
}

/** Whether an approval's budgets would refuse one more attempt now: the gate view's own test. */
async function budgetClosed(
  ports: Pick<ReviseDrafterPorts, "record">,
  scopeDecisionId: string,
  nowMs: number,
): Promise<boolean> {
  const decided = await ports.record.readScopeDecision(scopeDecisionId);
  if (decided.kind !== "read") {
    return false;
  }
  const stored = await ports.record.readScope(decided.decision.scopeId);
  if (stored.kind !== "read") {
    return false;
  }
  const spent = await ports.record.scopeSpent(scopeDecisionId);
  return budgetRefusal(stored.scope.payload.budgets, spent, nowMs) !== null;
}

/** A plan's prompt, or null when the stored plan does not read. */
function promptOf(record: IterationRecord): string | null {
  const planned = readPlan(record.plan);
  return planned.kind === "planned" ? planned.plan.prompt : null;
}

/**
 * Everything D-0077 rule 3.1 hands the drafter, each part read from its own
 * source. Throws only when a source will not read at all.
 */
export async function gatherReviseMaterial(
  ports: Pick<ReviseDrafterPorts, "store" | "record">,
  due: Due,
  language: string | null,
): Promise<ReviseMaterial> {
  const { record } = due;
  // The line above this lap, oldest first: each earlier attempt's prompt
  // carries the revise text pressed at its predecessor's gate (D-0027 rule 7).
  const earlier: ReviseLineageLap[] = [];
  let up = record.supersedesIterationId;
  for (let hops = 0; up !== null && hops < LINEAGE_BOUND; hops += 1) {
    const read = await ports.store.read(up);
    if (read.kind !== "read") {
      break;
    }
    earlier.unshift({
      prompt: promptOf(read.record),
      readings: (await ports.store.readingsFor(up))
        .filter((r) => isModelReadingDrafter(r.drafter))
        .map((r) => ({ verdict: r.verdict, findings: r.findings })),
    });
    up = read.record.supersedesIterationId;
  }

  // The approval's threshold and the rounds it has left (D-0065 rules 4.2 and 5.1).
  let severityThreshold: string | null = null;
  let roundsLeft: number | null = null;
  const tip = await approvalTip(ports.record, record.id);
  if (tip.kind === "tip") {
    const decided = await ports.record.readScopeDecision(tip.scopeDecisionId);
    const scope =
      decided.kind === "read" ? await ports.record.readScope(decided.decision.scopeId) : null;
    if (scope?.kind === "read") {
      severityThreshold = scope.scope.payload.severity_threshold;
      const lineage = await ports.record.lineageOf(record.id);
      if (lineage !== null) {
        const links = [];
        for (const id of lineage) {
          links.push({ readings: await ports.store.readingsFor(id) });
        }
        roundsLeft = Math.max(
          0,
          scope.scope.payload.budgets.review_rounds - reviewRoundsAlong(links),
        );
      }
    }
  }

  let thread: ReviseMaterial["thread"] = [];
  if (record.requestMessageId !== null) {
    const read = await ports.record.threadMessages();
    if (read.kind !== "read") {
      throw new Error(`the thread will not read: ${read.reason}`);
    }
    const inThread = threadOf(read.messages, record.requestMessageId);
    thread = read.messages
      .filter((m) => inThread.has(m.messageId))
      .map((m) => ({ authorKind: m.authorKind, body: m.body }));
  }

  return {
    iterationId: record.id,
    gateId: due.gateId,
    reading: due.reading,
    prompt: promptOf(record),
    earlier,
    severityThreshold,
    roundsLeft,
    thread,
    language,
  };
}

/** One finished run, as it is written: what came of it and what it was handed. */
interface Finished {
  readonly outcome: ReviseOutcome;
  readonly document: string | null;
  readonly costUsd: number | null;
}

/** Run once over one due lap, never throwing, and say what came of it. */
async function runOnce(ports: ReviseDrafterPorts, due: Due): Promise<Finished | null> {
  let material: ReviseMaterial;
  try {
    material = await gatherReviseMaterial(ports, due, ports.language);
  } catch (error) {
    // **Nothing was read, so nothing was spent or written**: a store that
    // would not read is a fault of the moment, and the lap stays due.
    ports.log(`revise drafter  ${due.record.id}: nothing was written: ${describe(error)}`);
    return null;
  }
  const prepared = prepareRevise(material);
  if (prepared.kind === "refused") {
    return {
      outcome: { kind: "unavailable", reason: prepared.reason },
      document: null,
      costUsd: null,
    };
  }
  try {
    const run = await ports.runDrafter(drafterRow(), prepared.document);
    return {
      outcome: reviseDraftOf(due.reading, run),
      document: prepared.document,
      costUsd: run.kind === "answered" ? run.costUsd : null,
    };
  } catch (error) {
    return {
      outcome: { kind: "unavailable", reason: `the drafter could not be run: ${describe(error)}` },
      document: prepared.document,
      costUsd: null,
    };
  }
}

/**
 * Run once over one due lap and write its row (D-0077 rules 4.2 and 5.1).
 *
 * **A store fault is not the store's answer.** A `defect` -- a locked
 * database, which nothing here waits out -- keeps the finished run in
 * `unwritten` and leaves the lap due, so the next scan writes the same draft
 * without paying for it again; only a `refused` write becomes an unavailable
 * row naming why.
 */
async function draftAndWrite(
  ports: ReviseDrafterPorts,
  due: Due,
  unwritten: Map<string, Finished>,
): Promise<"written" | "stale" | "failed" | "held"> {
  const drafter = reviseDrafterName(drafterRow());
  const id = due.record.id;
  const key = memoryKey(id, due.reading);
  const finished = unwritten.get(key) ?? (await runOnce(ports, due));
  if (finished === null) {
    return "held";
  }
  const { outcome, document, costUsd } = finished;
  const write = async (payload: JsonRecord) =>
    await ports.record.recordReviseDraft(
      proposalOf(ports, drafter, due, payload, document, costUsd),
      due.gateId,
    );
  let written = await write(payloadOf(outcome));
  if (written.kind === "refused") {
    // A draft the store would not take is an unavailable run naming why, so
    // the reading does not stay due for ever over a row that never lands.
    written = await write({
      kind: "unavailable",
      reason: `the draft could not be recorded: ${written.reason}`,
    });
  }
  if (written.kind === "defect") {
    unwritten.set(key, finished);
    ports.log(
      `revise drafter  ${id}: the row could not be written now (${written.reason}); ` +
        "written on the next scan",
    );
    return "held";
  }
  unwritten.delete(key);
  const cost = costUsd === null ? "cost not reported" : `$${costUsd.toFixed(4)}`;
  switch (written.kind) {
    case "recorded":
      ports.log(
        `revise drafter  ${id}: ${
          outcome.kind === "drafted" ? "drafted" : `no draft: ${outcome.reason}`
        } (${cost})`,
      );
      return "written";
    case "covered":
      ports.log(`revise drafter  ${id}: already drafted elsewhere; this run wrote nothing`);
      return "written";
    case "stale":
      ports.log(`revise drafter  ${id}: the lap moved on while drafting; this run wrote nothing`);
      return "stale";
    default:
      ports.log(`revise drafter  ${id}: nothing was written: ${written.reason}`);
      return "failed";
  }
}

/** The stored structure (D-0077 rule 5.1): the drafter's words, or why there are none. */
function payloadOf(outcome: ReviseOutcome): JsonRecord {
  return outcome.kind === "drafted"
    ? { kind: "drafted", lead: outcome.lead, changes: [...outcome.changes] }
    : { kind: "unavailable", reason: outcome.reason };
}

function proposalOf(
  ports: Pick<ReviseDrafterPorts, "mintId" | "now">,
  drafter: string,
  due: Due,
  payload: JsonRecord,
  document: string | null,
  costUsd: number | null,
): ProposalDraft {
  return {
    proposalId: ports.mintId("draft"),
    kind: "revise_draft",
    drafter,
    payload,
    // The reading whole, which is how a reading is found drafted (rule 2.2),
    // beside the document as handed over, stored verbatim (D-0022 rule 4).
    snapshot: {
      reading: readingContent(due.reading),
      gate_id: due.gateId,
      document,
      cost_usd: costUsd,
    },
    derivation: null,
    iterationId: due.record.id,
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
    createdAtMs: ports.now(),
  };
}

function describe(error: unknown): string {
  return hostFailure(error).text;
}
