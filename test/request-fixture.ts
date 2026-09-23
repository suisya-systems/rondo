/**
 * One request in the conversation, for a lap to name (D-0061 rule 4).
 *
 * **Every lap has a request since D-0083.** `reserve()` refuses an id that
 * opens no request, so a suite that reserves a row has to have written one
 * first -- whatever the suite is actually about. That is one message and one
 * id, so it lives here rather than being rewritten in each file.
 */
import type { DatabaseSync } from "node:sqlite";
import {
  advisoryRecord,
  type HostPolicy,
  type IterationStore,
  iterationStore,
} from "../src/store/sqlite.js";

/** The id the fixtures name, so a suite that needs no second request says nothing. */
export const REQUEST = "req-fixture";

export async function openRequest(
  connection: DatabaseSync,
  messageId: string = REQUEST,
  body = "do the thing",
  atMs = 1,
): Promise<string> {
  const outcome = await advisoryRecord(connection).recordThreadMessage({
    messageId,
    body,
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: null,
    atMs,
    bases: [],
    asks: false,
  });
  // **Opening the same request twice is a no-op here**, so a `reserve` helper
  // can call this on every row without the suite having to thread a setup
  // step through. Every other refusal is a fixture that is wrong about the
  // store and is raised. The store's own arm since rondo#200; this read the
  // refusal's prose for it before there was one.
  if (outcome.kind !== "recorded" && outcome.kind !== "duplicate") {
    throw new Error(`the fixture did not open a request: ${JSON.stringify(outcome)}`);
  }
  return messageId;
}

/**
 * A store over `connection`, with the fixture's request already written.
 *
 * **Synchronous, which needs a word.** `recordThreadMessage` is declared
 * `async` and its body is not: the row is inserted inside the call, and the
 * promise only carries the outcome. Reading that outcome needs an await, so
 * this leaves it to the microtask -- a refusal surfaces as an unhandled
 * rejection, which is loud -- rather than making every suite's store creation
 * async for a fixture none of them is about.
 */
export function storeWithRequest(
  connection: DatabaseSync,
  policy: HostPolicy,
  messageId: string = REQUEST,
): IterationStore {
  const store = iterationStore(connection, policy);
  void openRequest(connection, messageId);
  return store;
}
