import { describe, expect, it } from "vitest";
import { answerOnceReserved } from "../../src/access/cli.js";
import type { Started } from "../../src/access/web-app.js";

// D-0109 (rondo#409): the start press answers once its lap's row is there.
const input = { iterationId: "lap-1", requestMessageId: "msg-1" };

function world() {
  let reserved = false;
  let status = "running";
  const written: { messageId: string; asks: boolean; body: string }[] = [];
  const store = {
    read: async (id: string) =>
      (reserved && id === input.iterationId
        ? { kind: "read", record: { status } }
        : { kind: "absent" }) as never,
  };
  const record = {
    recordThreadMessage: async (message: { messageId: string; asks: boolean; body: string }) => {
      written.push(message);
      return { kind: "recorded" } as never;
    },
  };
  return {
    store,
    record,
    written,
    reserve: () => (reserved = true),
    gate: () => (status = "awaiting_human"),
  };
}

function deferred() {
  let resolve!: (started: Started) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Started>((ok, no) => {
    resolve = ok;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("answerOnceReserved", () => {
  it("answers when the row appears, and a later failure is an ask in the thread", async () => {
    const w = world();
    const lap = deferred();
    const answer = answerOnceReserved(w.store, w.record as never, input, lap.promise, 5);
    w.reserve();
    expect((await answer).ok).toBe(true);
    expect(w.written).toEqual([]);
    lap.reject(new Error("continuo went away"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(w.written).toHaveLength(1);
    expect(w.written[0]?.messageId).toBe("start-stopped-lap-1");
    expect(w.written[0]?.asks).toBe(true);
    expect(w.written[0]?.body).toContain("continuo went away");
  });

  it("writes no stop for a lap already at its gate", async () => {
    const w = world();
    const lap = deferred();
    const answer = answerOnceReserved(w.store, w.record as never, input, lap.promise, 5);
    w.reserve();
    expect((await answer).ok).toBe(true);
    w.gate();
    lap.reject(new Error("the model reading failed"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(w.written).toEqual([]);
  });

  it("says a refusal before any row as the press's own answer", async () => {
    const w = world();
    const refused: Started = { ok: false, why: "startRefusedNoPlan", note: "no plan" };
    expect(
      await answerOnceReserved(w.store, w.record as never, input, Promise.resolve(refused), 5),
    ).toBe(refused);
    expect(w.written).toEqual([]);
  });

  it("says a throw before any row as a refusal, not a crash", async () => {
    const w = world();
    const answer = await answerOnceReserved(
      w.store,
      w.record as never,
      input,
      Promise.reject(new Error("boom")),
      5,
    );
    expect(answer.ok).toBe(false);
    expect(answer.note).toContain("boom");
    expect(w.written).toEqual([]);
  });
});
