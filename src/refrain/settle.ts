/**
 * The status-blind end of a row that will not decode, split out of
 * `interpreter.ts` for its line budget (rondo#661); `abandon` there is
 * its one caller.
 */
import type { ConductorReport } from "./interpreter.js";
import type { ConductorPorts } from "./ports.js";

/**
 * End a row that will not decode, by id alone.
 *
 * The only call of `store.settle` in this tree, and it may stay that way: the
 * store's own doc comment states the licence as narrow and single-purpose, and
 * what makes it narrow is that exactly one branch of one function reaches it.
 * Every other write in `interpreter.ts` asserts the status it is leaving, which is
 * the closed edge relation and the safety property -- but this row has no
 * readable status to assert, and refusing to write it is what leaves the
 * conductor with no path forward at all.
 *
 * Why the row did not decode is recorded beside the operator's reason: the
 * status-blind write is the unusual one, and a person reading the settled row
 * afterwards should be able to see why it was used.
 */
export async function settleUnreadable(
  ports: Pick<ConductorPorts, "store" | "now">,
  lines: string[],
  id: string,
  decodeReason: string,
  reason: string,
): Promise<ConductorReport> {
  lines.push(`Iteration ${id} exists but will not decode: ${decodeReason}`);
  const outcome = await ports.store.settle(
    id,
    `${reason}; the row did not decode: ${decodeReason}`,
    ports.now(),
  );
  switch (outcome.kind) {
    case "settled":
      lines.push(
        `Iteration ${id} was settled at 'abandoned' by id alone, without decoding it: ${reason}`,
        "That write asserted no previous status, because a row whose status cannot be read has " +
          "none to assert. It is the one place rondo writes that way, and abandon() is the one " +
          "call that reaches it.",
        "'abandoned' is terminal, so the single-flight lock is released and a new iteration can " +
          "be reserved.",
        "rondo cannot say whether a run or a gate is open under this iteration, because the row " +
          "did not decode. 'gate list' and continuo's own run listing are how a person finds out, " +
          "and closing either is theirs (D-0010, D-0013).",
      );
      return { iterationId: id, status: "abandoned", lines: Object.freeze(lines) };
    case "missing":
      lines.push(
        `Iteration ${id} no longer exists in the store, so there was nothing left to settle.`,
      );
      return { iterationId: id, status: null, lines: Object.freeze(lines) };
    case "defect":
      lines.push(
        `Stopped: the store could not settle iteration ${id}: ${outcome.reason}`,
        "The row is unchanged and still holds the single-flight lock, and this is the last call " +
          "that could have released it, so a person has to look at the database itself.",
      );
      return { iterationId: id, status: null, lines: Object.freeze(lines) };
  }
}
