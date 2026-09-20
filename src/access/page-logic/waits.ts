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
 * **The unit is the request and not the wait.** Both callers ask *whose turn
 * is it*, and the answer a person acts on is a request to open: two questions
 * standing in one thread are one row in the list and one thing to be told
 * about, not two.
 */
import {
  type IterationRecord,
  isTerminal,
  type NonTerminalStatus,
  WAIT_SIDE,
} from "../../store/records.js";
import type { Threads } from "./threads.js";

/**
 * The requests whose next move is the person's, by the message that opened
 * each one.
 *
 * `laps` is every lap the store holds that this reading should consider --
 * `readLive()`'s rows for a page that draws the live ones. A terminal row is
 * skipped here rather than assumed away, because `readLive` is not the only
 * caller and a closed lap is nobody's turn.
 *
 * A waiting message whose root this store does not hold is dropped: it is a
 * wait with nowhere to send the person, and naming it would be an entry in the
 * list that opens nothing.
 */
export function requestsWaitingOnYou(
  threads: Threads,
  laps: readonly IterationRecord[],
): ReadonlySet<string> {
  const roots = new Set<string>();
  for (const message of threads.messages) {
    if (!threads.waiting.has(message.messageId)) {
      continue;
    }
    const root = threads.rootOf(message.messageId);
    if (root !== null) {
      roots.add(root);
    }
  }
  for (const lap of laps) {
    if (!isTerminal(lap.status) && WAIT_SIDE[lap.status as NonTerminalStatus] === "waitingOnYou") {
      roots.add(lap.requestMessageId);
    }
  }
  return roots;
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
