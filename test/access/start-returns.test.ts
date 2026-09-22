import { describe, expect, it, vi } from "vitest";
import { answerOnceReserved } from "../../src/access/cli.js";
import type { Started } from "../../src/access/web-app.js";
import { JA } from "../../src/access/wording/ja.js";
import { EN } from "../../src/access/wording.js";

// D-0109 (rondo#409): the start press answers once its lap's row is there.
const input = { iterationId: "lap-1", requestMessageId: "msg-1" };

function world() {
  let reserved = false;
  let status = "performing";
  let refusing = false;
  const written: { messageId: string; asks: boolean; body: string }[] = [];
  const ended: { from: string; to: string; fields: { failureKind?: string | null } }[] = [];
  const store = {
    read: async (id: string) =>
      (reserved && id === input.iterationId
        ? { kind: "read", record: { id, status, reason: null } }
        : { kind: "absent" }) as never,
    transition: async (
      id: string,
      from: string,
      to: string,
      fields: { failureKind?: string | null },
    ) => {
      if (refusing) {
        return { kind: "unexpectedStatus", found: "performing" } as never;
      }
      ended.push({ from, to, fields });
      status = to;
      return { kind: "transitioned", record: { id, status: to } } as never;
    },
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
    ended,
    reserve: () => (reserved = true),
    gate: (to: string) => (status = to),
    refuseTransition: () => (refusing = true),
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

/** rondo's own sentence for the fault goes to the console, never in front of the person. */
function quietConsole() {
  return vi.spyOn(process.stderr, "write").mockImplementation(() => true);
}

describe("answerOnceReserved", () => {
  it("answers when the row appears, ends a later failure's lap and asks in the person's words", async () => {
    const w = world();
    const stderr = quietConsole();
    const lap = deferred();
    const answer = answerOnceReserved(w.store, w.record as never, JA, input, lap.promise, 5);
    w.reserve();
    expect((await answer).ok).toBe(true);
    expect(w.written).toEqual([]);
    lap.reject(new Error("continuo went away"));
    await vi.waitFor(() => expect(w.written).toHaveLength(1));

    // The lap is ended before the person is told, so the ask is true when read.
    expect(w.ended).toEqual([
      {
        from: "performing",
        to: "failed",
        fields: expect.objectContaining({ failureKind: "defect" }),
      },
    ]);
    expect(w.written[0]?.messageId).toBe("start-stopped-lap-1");
    expect(w.written[0]?.asks).toBe(true);
    expect(w.written[0]?.body).toBe(JA.startStoppedSaid);
    expect(w.written[0]?.body).not.toContain("continuo went away");
    expect(stderr.mock.calls.map(([line]) => String(line)).join("")).toContain(
      "continuo went away",
    );
    stderr.mockRestore();
  });

  it.each(["awaiting_human", "closed"])(
    "ends nothing and writes no stop for a lap whose gate opened (%s)",
    async (status) => {
      const w = world();
      const stderr = quietConsole();
      const lap = deferred();
      const answer = answerOnceReserved(w.store, w.record as never, EN, input, lap.promise, 5);
      w.reserve();
      expect((await answer).ok).toBe(true);
      w.gate(status);
      lap.reject(new Error("the model reading failed"));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(w.written).toEqual([]);
      expect(w.ended).toEqual([]);
      stderr.mockRestore();
    },
  );

  it("ends a lap reserved and then lost between two polls, and answers the refusal", async () => {
    // Codex: `over` can turn true with the row already there, so the loop must
    // not leave it behind. The press has not answered, so no ask is written.
    const w = world();
    const stderr = quietConsole();
    const answer = await answerOnceReserved(
      w.store,
      w.record as never,
      EN,
      input,
      (async () => {
        w.reserve();
        throw new Error("continuo went away");
      })(),
      50,
    );
    expect(answer.ok).toBe(false);
    expect(w.ended).toEqual([
      {
        from: "performing",
        to: "failed",
        fields: expect.objectContaining({ failureKind: "defect" }),
      },
    ]);
    expect(w.written).toEqual([]);
    stderr.mockRestore();
  });

  it("does not invite a restart when the lap could not be ended", async () => {
    const w = world();
    const stderr = quietConsole();
    w.refuseTransition();
    const lap = deferred();
    const answer = answerOnceReserved(w.store, w.record as never, EN, input, lap.promise, 5);
    w.reserve();
    expect((await answer).ok).toBe(true);
    lap.reject(new Error("continuo went away"));
    await vi.waitFor(() => expect(w.written).toHaveLength(1));
    expect(w.written[0]?.body).toBe(EN.startStoppedHeldSaid);
    expect(w.written[0]?.asks).toBe(true);
    stderr.mockRestore();
  });

  it("says a refusal before any row as the press's own answer", async () => {
    const w = world();
    const refused: Started = { ok: false, why: "startRefusedNoPlan", note: "no plan" };
    expect(
      await answerOnceReserved(w.store, w.record as never, EN, input, Promise.resolve(refused), 5),
    ).toBe(refused);
    expect(w.written).toEqual([]);
    expect(w.ended).toEqual([]);
  });

  it("says a throw before any row as a refusal, not a crash", async () => {
    const w = world();
    const stderr = quietConsole();
    const answer = await answerOnceReserved(
      w.store,
      w.record as never,
      EN,
      input,
      Promise.reject(new Error("boom")),
      5,
    );
    expect(answer.ok).toBe(false);
    expect(answer.note).toContain("boom");
    expect(w.written).toEqual([]);
    expect(w.ended).toEqual([]);
    stderr.mockRestore();
  });
});
