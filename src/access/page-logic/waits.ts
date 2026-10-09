/**
 * Which requests are waiting on the person, from the two places a wait comes
 * from (DECISIONS.md D-0036 rule 5 and D-0072 rule 3).
 *
 * **One function, because a second reading of *is it my turn* is a bug with a
 * screen behind it.** rondo now says this in two places -- the left face lifts
 * a waiting request out of the time order (`D-0083` rule 2), and the host
 * reaches for the person who is not looking at the screen (rondo#311) -- and
 * the two must agree or the person is told to come and look at a screen that
 * shows nothing waiting. That is #206's failure with a notification on the end
 * of it: there, a page that disagreed with the store about a waiting ask drew
 * a reply box the write port then refused.
 *
 * **The two sources, named.** A lap on `D-0036` rule 5's *waiting on you* side
 * ({@link WAIT_SIDE}), and a message with `asks` set that no answer of the
 * person's has carried on -- the reading `openAsksIn` takes, computed here off
 * the same rows through {@link Threads.waiting}. Neither is the other's
 * subset: a lap can wait at a gate with nothing asked in its thread, and a
 * question can stand over a request no lap has been started for.
 *
 * **One pass, and every reader takes what it needs from it.** What a person
 * acts on is a request -- two questions standing in one thread are one row in
 * the list and one thing to go and look at -- so the list groups
 * {@link Wait.root}. What has already been sent to somebody has to be counted
 * per *wait*, because a request outlives any one of its questions, so the host
 * and the open tab both key on {@link Wait.episode}. Deriving them here rather
 * than letting each caller decide what "waiting" is is the whole point: the
 * screen, the host's tick and the tab cannot disagree about what is waiting,
 * because there is one answer and they read it.
 */
import {
  type IterationRecord,
  isTerminal,
  type NonTerminalStatus,
  WAIT_SIDE,
} from "../../store/records.js";
import type { AdvisoryRecord } from "../../store/sqlite.js";
import { draftAwaiting, draftedStanding } from "../drafted-view.js";
import { FLOW_STOP } from "../flow-stop.js";
import type { Threads } from "./threads.js";

/**
 * One thing waiting on the person: the request to open, and the wait itself.
 *
 * **Two fields because two questions are being asked of one scan.** *Whose
 * turn is it* is answered by the request, which is what a person opens and
 * what the list draws a row for. *Is this a wait I have already been told
 * about* is answered by {@link episode}, and the difference is the whole of
 * rondo#311 round 2 (Codex): keyed by the request, a thread's second question
 * -- and the gate a lap reaches after the first one is answered -- would be
 * filtered out for ever as a repeat of a wait that had in fact been settled.
 */
export interface Wait {
  /** The message that opened the request, which is the way into its thread. */
  readonly root: string;
  /**
   * A key that is new exactly when the wait is.
   *
   * An ask is its own id: it is settled by an answer carrying it on and never
   * re-opened, so a later question in the same thread is a different row and a
   * different key. A lap is its id and the status it stopped at, which is
   * `D-0068` rule 3.1's episode and rests on its claim -- a lap walks its
   * statuses forward and never re-enters one (`nextStep`,
   * `src/refrain/loop.ts`: from `awaiting_human` the only edge is
   * `observe_gate`, and a revise is a successor lap and not this one again).
   */
  readonly episode: string;
}

/**
 * Everything whose next move is the person's, one entry per wait.
 *
 * `laps` is every lap the store holds that this reading should consider --
 * `readLive()`'s rows for a page that draws the live ones. A terminal row is
 * skipped here rather than assumed away, because `readLive` is not the only
 * caller and a closed lap is nobody's turn.
 *
 * A waiting message whose root this store does not hold is dropped: it is a
 * wait with nowhere to send the person, and naming it would be an entry in the
 * list that opens nothing.
 *
 * **A question the person answered *stop this line* is not their turn**
 * (D-0110 rule 2). The line stays held -- `threads.waiting` still has it, and
 * a start still waits on a `carry_on` (`D-0072`) -- but the person has already
 * acted on it, and a stop that stayed *your turn* would be a request nobody can
 * take off the list short of pressing the answer they chose not to give.
 */
export function waitsOnYou(threads: Threads, laps: readonly IterationRecord[]): readonly Wait[] {
  const waits: Wait[] = [];
  for (const message of threads.messages) {
    if (!threads.waiting.has(message.messageId) || threads.stopped.has(message.messageId)) {
      continue;
    }
    const root = threads.rootOf(message.messageId);
    if (root !== null) {
      waits.push({ root, episode: `ask:${message.messageId}` });
    }
  }
  for (const lap of laps) {
    if (!isTerminal(lap.status) && WAIT_SIDE[lap.status as NonTerminalStatus] === "waitingOnYou") {
      waits.push({ root: lap.requestMessageId, episode: `gate:${lap.id}:${lap.status}` });
    }
  }
  return waits;
}

/**
 * **The requests whose only wait is the goal flow's stop** (rondo#611, D-0188).
 *
 * The flow asks its stop in the thread of its latest request (`askStop`),
 * which can be one injected under an earlier approval and long since answered
 * and run: the stop that followed a resume was drawn as that request waiting
 * on the person, under its own words, and read as the old question asked
 * again. The stop is still the person's turn and its box is in that thread, so
 * the row stays under *your turn*; what changes is that it says it is the
 * flow's stop, and not the request, that waits. A gate or another question in
 * the same thread is the request's own, and the row says so as before.
 */
export function flowStopOnly(waits: readonly Wait[]): ReadonlySet<string> {
  const own = new Set(
    waits.filter((wait) => !wait.episode.startsWith(`ask:${FLOW_STOP}`)).map((wait) => wait.root),
  );
  return new Set(waits.map((wait) => wait.root).filter((root) => !own.has(root)));
}

/**
 * Which requests rondo still owes a draft, read once per pass (rondo#495).
 * **A read that fails withholds the scope, and does not offer it**: a draft
 * may be on its way, and a scope pressed over it is the act this guards
 * against (Codex). Absent where no drafter runs: nothing is owed.
 */
export async function draftsOwedNow(ports: {
  readonly draftsOwed?: (() => Promise<ReadonlySet<string>>) | undefined;
}): Promise<(requestMessageId: string) => boolean> {
  if (ports.draftsOwed === undefined) {
    return () => false;
  }
  try {
    const owed = await ports.draftsOwed();
    return (id) => owed.has(id);
  } catch {
    return () => true;
  }
}

/**
 * **A drafted scope waiting on the person's approval is their turn** (rondo#534,
 * D-0154): once rondo's draft is ready, approving it is the one thing that moves
 * the request. The thread's *approve the drafted scope* card, by its own
 * conditions: a request with no lap, no question in its thread, no draft still
 * owed (`D-0151`) and no repository to add first, whose standing is a draft
 * nobody has decided. Only a draft: a request with none is not waited on by
 * anything rondo holds. A redraft after an approval that stands waits too,
 * laps or not (rondo#621): a follow-up to a merged request read *merged* in
 * the list while its new scope waited ({@link draftAwaiting}).
 *
 * The episode is the draft's scope, so a redraft over a newer message is a new
 * wait and a person already told about the old one is told again.
 */
export async function scopesAwaitingYou(
  ports: {
    readonly record: Pick<
      AdvisoryRecord,
      "scopesFor" | "scopeDecisionOf" | "readProposal" | "scopeSupersededByApproved"
    >;
    /** Whether the request's work is in a repository rondo does not hold (`D-0090`). */
    readonly unheld: (requestMessageId: string) => Promise<boolean>;
  },
  threads: Threads,
  /** Every lap the store holds, ended ones too: a request with any is past its first draft. */
  laps: readonly IterationRecord[],
  owes: (requestMessageId: string) => boolean,
): Promise<readonly Wait[]> {
  const lapped = new Set(laps.map((lap) => lap.requestMessageId));
  const asked = new Set([...threads.waiting].map((id) => threads.rootOf(id)));
  const waits = await Promise.all(
    threads.messages
      .filter(
        (message) =>
          message.inReplyTo === null && !owes(message.messageId) && !asked.has(message.messageId),
      )
      .map(async ({ messageId: root }): Promise<Wait[]> => {
        if (await ports.unheld(root)) {
          return [];
        }
        const draft = draftAwaiting(await draftedStanding(ports, root), lapped.has(root));
        return draft === null ? [] : [{ root, episode: `scope:${draft.scope.scopeId}` }];
      }),
  );
  return waits.flat();
}

/**
 * The laps that have been in flight longer than the patience their own plan
 * declared (`D-0068` section 2, finding F1).
 *
 * **The plan's own ceiling and never a threshold of rondo's** (`D-0068`'s
 * measurement): `invocationCeilingMs` is what the plan's author set as how
 * long an answer may take, and a lap inside it is not late however long it has
 * been. A plan that carries no readable ceiling is not overdue -- there is no
 * statement to have passed -- which is the same direction `D-0036` rule 5
 * takes with a liveness reading it refuses to guess at.
 *
 * The key each lap is returned under is `D-0068` rule 3.1's episode: the lap
 * and the status it is overdue at. A lap walks its in-flight statuses forward
 * and never re-enters one, so a lap overdue at `admitting` and again at
 * `performing` is two episodes and not a repeat of one.
 */
export function lapsPastTheirCeiling(
  laps: readonly IterationRecord[],
  nowMs: number,
): readonly string[] {
  return laps.flatMap((lap) => {
    const ceiling = lap.plan["invocation_ceiling_ms"];
    return !isTerminal(lap.status) &&
      WAIT_SIDE[lap.status as NonTerminalStatus] === "inFlight" &&
      typeof ceiling === "number" &&
      Number.isFinite(ceiling) &&
      ceiling > 0 &&
      nowMs - lap.updatedAtMs > ceiling
      ? [`${lap.id}:${lap.status}`]
      : [];
  });
}
