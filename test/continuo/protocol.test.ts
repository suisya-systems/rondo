/**
 * The decoder's cases, which are the ones that must not wait for a subprocess.
 *
 * `test/continuo/smoke.test.ts` proves rondo drives a real continuo; this file
 * proves rondo decodes what a continuo could say, including the things a green
 * seam never says. Every case here is a pure function call over bytes, so the
 * failure paths -- an unknown schema, a payload that will not read, prose where
 * a document was expected -- are exercised on every run, on every platform, in
 * milliseconds, rather than only when something has already gone wrong.
 */
import { describe, expect, test } from "vitest";

import {
  type ContinuoResult,
  DB_CREATE,
  decode,
  decodeMeasureReport,
  GATE_CLOSE,
  GATE_LIST,
  GATE_SHOW,
  type InvocationOutput,
  LAP_PERFORM,
  RUN_ADMIT,
} from "../../src/continuo/protocol.js";

/** A finished invocation, with the fields a case does not care about defaulted. */
function output(overrides: Partial<InvocationOutput>): InvocationOutput {
  return { status: 0, signal: null, stdout: "", stderr: "", ...overrides };
}

/** The success envelope for a verb, plus whatever payload the case wants. */
function success(schema: string, payload: Record<string, unknown>): string {
  return `${JSON.stringify({ schema, ok: true, db: "/tmp/cp.sqlite3", ...payload })}\n`;
}

/** The refusal envelope, as continuo writes it to stderr. */
function refusal(schema: string, errorClass: string, message: string): string {
  return `${JSON.stringify({
    schema,
    ok: false,
    db: "/tmp/cp.sqlite3",
    error: { class: errorClass, message },
  })}\n`;
}

/** The kind, for a case that asserts only which of the five outcomes it got. */
function kindOf<T>(result: ContinuoResult<T>): string {
  return result.kind;
}

describe("a document rondo understands", () => {
  test("db create is read into rondo's own record", () => {
    const result = decode(
      DB_CREATE,
      output({ stdout: success(DB_CREATE.schema, { schema_version: 4, head_version: 4 }) }),
    );
    expect(result).toEqual({
      kind: "answered",
      db: "/tmp/cp.sqlite3",
      payload: { schemaVersion: 4, headVersion: 4 },
    });
  });

  test("run admit reads the three fields rondo uses and ignores continuo's events", () => {
    const result = decode(
      RUN_ADMIT,
      output({
        stdout: success(RUN_ADMIT.schema, {
          run_id: "r1",
          status: "created",
          created_at_ms: 1_788_618_380_687,
          events: { run_created: { event_id: "run_created/r1", seq: 1 } },
        }),
      }),
    );
    expect(result).toEqual({
      kind: "answered",
      db: "/tmp/cp.sqlite3",
      payload: { runId: "r1", status: "created", createdAtMs: 1_788_618_380_687 },
    });
  });

  test("an empty gate list is a success, not an absence", () => {
    const result = decode(GATE_LIST, output({ stdout: success(GATE_LIST.schema, { gates: [] }) }));
    expect(result).toEqual({ kind: "answered", db: "/tmp/cp.sqlite3", payload: [] });
  });

  test("a gate row is read; a null run id and a null deadline are answers, not faults", () => {
    // continuo's `OpenGateSummary.runId` is `string | null` at the pinned sha
    // -- a subject-scoped gate belongs to no run -- and the column is emitted
    // verbatim. A decoder that required a string here would call continuo's
    // ordinary answer a broken document.
    const result = decode(
      GATE_LIST,
      output({
        stdout: success(GATE_LIST.schema, {
          gates: [
            {
              gate_id: "g1",
              gate_type: "human_answer",
              run_id: null,
              stage: "presented",
              stage_entered_at_ms: 1,
              deadline_at_ms: null,
            },
          ],
        }),
      }),
    );
    expect(result).toEqual({
      kind: "answered",
      db: "/tmp/cp.sqlite3",
      payload: [
        {
          gateId: "g1",
          gateType: "human_answer",
          runId: null,
          stage: "presented",
          deadlineAtMs: null,
        },
      ],
    });
  });

  test("gate close carries whether THIS call performed the close", () => {
    // `closed: false` is the idempotent repeat of an identical close and is a
    // success. A decoder that read it as a refusal would turn continuo's
    // idempotence into an error rondo invented.
    const result = decode(
      GATE_CLOSE,
      output({
        stdout: success(GATE_CLOSE.schema, {
          gate_id: "g1",
          closed: false,
          outcome: "withdrawn",
          from_stage: "presented",
          to_stage: "presented",
        }),
      }),
    );
    expect(result).toEqual({
      kind: "answered",
      db: "/tmp/cp.sqlite3",
      payload: {
        gateId: "g1",
        closed: false,
        outcome: "withdrawn",
        fromStage: "presented",
        toStage: "presented",
      },
    });
  });

  test("an open gate's null outcome reads as null rather than failing", () => {
    const result = decode(
      GATE_SHOW,
      output({
        stdout: success(GATE_SHOW.schema, {
          gate_id: "g1",
          gate_type: "human_answer",
          run_id: "r1",
          stage: "presented",
          outcome: null,
          rationale: null,
          options: [],
          relays: [],
          transitions: [],
        }),
      }),
    );
    expect(result).toEqual({
      kind: "answered",
      db: "/tmp/cp.sqlite3",
      payload: {
        gateId: "g1",
        gateType: "human_answer",
        runId: "r1",
        stage: "presented",
        outcome: null,
      },
    });
  });

  test("a key rondo has never heard of is accepted, because /1 says it may appear", () => {
    // continuo's `/1` policy is explicit that a verb which grows a field keeps
    // its schema id. A decoder that refused unknown keys would go red on
    // continuo's next additive release and buy nothing for it.
    const result = decode(
      DB_CREATE,
      output({
        stdout: success(DB_CREATE.schema, {
          schema_version: 4,
          head_version: 4,
          migrations_applied: ["0001"],
          something_from_the_future: { nested: true },
        }),
      }),
    );
    expect(kindOf(result)).toBe("answered");
  });
});

describe("continuo's own refusals", () => {
  test("a refusal envelope is decoded, and the class is carried as a hint", () => {
    const result = decode(
      GATE_SHOW,
      output({
        status: 2,
        stderr: refusal(GATE_SHOW.schema, "UnknownGateRefused", "gate nope does not exist"),
      }),
    );
    expect(result).toEqual({
      kind: "refused",
      db: "/tmp/cp.sqlite3",
      errorClass: "UnknownGateRefused",
      message: "gate nope does not exist",
    });
  });

  test("gate close refuses in the envelope, which is what D-0017 rule 1 turns on", () => {
    const result = decode(
      GATE_CLOSE,
      output({
        status: 2,
        stderr: refusal(GATE_CLOSE.schema, "UnknownGateRefused", "no gate 'nope'"),
      }),
    );
    expect(kindOf(result)).toBe("refused");
  });

  test("argparse prose at exit 2 is relayed, not parsed", () => {
    const prose =
      "usage: continuo run close [-h] --db DB --run-id RUN_ID\n" +
      "continuo run close: error: argument --outcome: invalid choice: 'bogus'\n";
    const result = decode(RUN_ADMIT, output({ status: 2, stderr: prose }));
    expect(result).toEqual({ kind: "refusedInProse", text: prose.trim() });
  });

  test("prose reaches rondo unchanged, non-ASCII included", () => {
    // The decoder does not escape: `src/access/console.ts` does, once, at the
    // boundary where characters become output. A value rondo holds is still
    // the value continuo sent.
    const prose = "error: no such database '/tmp/日本.sqlite3'";
    const result = decode(GATE_SHOW, output({ status: 2, stderr: prose }));
    expect(result).toEqual({ kind: "refusedInProse", text: prose });
  });
});

describe("a seam that is not the seam rondo was built against", () => {
  test("an unrecognised schema version is a clean protocol refusal", () => {
    const result = decode(
      GATE_LIST,
      output({ stdout: success("continuo.gate.list/2", { gates: [] }) }),
    );
    expect(result).toEqual({
      kind: "protocolRefusal",
      reason: expect.stringContaining("continuo.gate.list/2"),
    });
  });

  test("another verb's document is refused even when it would otherwise read", () => {
    const result = decode(GATE_LIST, output({ stdout: success(GATE_SHOW.schema, { gates: [] }) }));
    expect(kindOf(result)).toBe("protocolRefusal");
  });

  test("a document with no schema key is refused rather than guessed at", () => {
    const result = decode(
      DB_CREATE,
      output({ stdout: `${JSON.stringify({ ok: true, db: "/tmp/x", schema_version: 4 })}\n` }),
    );
    expect(result).toEqual({
      kind: "protocolRefusal",
      reason: expect.stringContaining("no 'schema' string"),
    });
  });
});

describe("a document rondo recognised and cannot read, which is rondo's own defect", () => {
  // The schema matched, and rondo verified this build's revision against a
  // committed sha before driving it. So a `/1` document from that exact build
  // whose known fields are the wrong type is not the seam moving -- it is
  // rondo's model of a build it pinned being wrong. Calling it a protocol
  // refusal would blunt the signal the pin exists to make loud.
  test("a payload whose field has the wrong type names the field", () => {
    const result = decode(
      DB_CREATE,
      output({ stdout: success(DB_CREATE.schema, { schema_version: "4", head_version: 4 }) }),
    );
    expect(result).toEqual({
      kind: "invokerDefect",
      reason: expect.stringContaining("'schema_version' is a string"),
    });
  });

  test("a NULLABLE field that is absent is a defect, because absent is not null", () => {
    // At the pinned sha every one of these keys is emitted on every document
    // that carries it, so a missing key is a document that does not match the
    // shape rondo pinned. Folding absent into null would be the decoder
    // declining to validate in exactly the place it looks like it validates.
    const result = decode(
      GATE_SHOW,
      output({
        stdout: success(GATE_SHOW.schema, {
          gate_id: "g1",
          gate_type: "human_answer",
          stage: "presented",
          outcome: null,
        }),
      }),
    );
    expect(result).toEqual({
      kind: "invokerDefect",
      reason: expect.stringContaining("'run_id' is absent"),
    });
  });

  test("an absent nullable deadline is a defect for the same reason", () => {
    const result = decode(
      GATE_LIST,
      output({
        stdout: success(GATE_LIST.schema, {
          gates: [{ gate_id: "g1", gate_type: "human_answer", run_id: null, stage: "presented" }],
        }),
      }),
    );
    expect(result).toEqual({
      kind: "invokerDefect",
      reason: expect.stringContaining("'deadline_at_ms' is absent"),
    });
  });

  test("a required field that is simply missing is named as absent", () => {
    const result = decode(GATE_SHOW, output({ stdout: success(GATE_SHOW.schema, {}) }));
    expect(result).toEqual({
      kind: "invokerDefect",
      reason: expect.stringContaining("'gate_id' is absent"),
    });
  });

  test("ok:false on exit 0 contradicts the stream contract", () => {
    const result = decode(
      DB_CREATE,
      output({
        stdout: `${JSON.stringify({ schema: DB_CREATE.schema, ok: false, db: "/tmp/x" })}\n`,
      }),
    );
    expect(result).toEqual({
      kind: "invokerDefect",
      reason: expect.stringContaining("'ok' is false"),
    });
  });

  test("ok:true on exit 2 is the mirror-image contradiction", () => {
    const result = decode(
      GATE_SHOW,
      output({
        status: 2,
        stderr: `${JSON.stringify({ schema: GATE_SHOW.schema, ok: true, db: "/tmp/x" })}\n`,
      }),
    );
    expect(result).toEqual({
      kind: "invokerDefect",
      reason: expect.stringContaining("'ok' is true"),
    });
  });
});

describe("rondo's own defects, which an operator should never be shown", () => {
  test("exit 0 with nothing on stdout is a defect, not a protocol disagreement", () => {
    const result = decode(GATE_LIST, output({ stdout: "" }));
    expect(result).toEqual({
      kind: "invokerDefect",
      reason: expect.stringContaining("stdout held no JSON document"),
    });
  });

  test("an exit 1 stack from a malformed operator value is rondo's to fix", () => {
    // D-0015's exception 2: a relative --workspace or an empty --run-id escapes
    // continuo as exit 1 and a raw stack. rondo validates before spawning, so
    // reaching this branch means the validation missed something.
    const result = decode(
      RUN_ADMIT,
      output({
        status: 1,
        stderr: "LapRunIntentUsageError: workspace must be a fully qualified absolute path",
      }),
    );
    expect(result).toEqual({
      kind: "invokerDefect",
      reason: expect.stringContaining("exited 1"),
    });
  });

  test("a child killed by a signal is a defect and says which signal", () => {
    const result = decode(GATE_LIST, output({ status: null, signal: "SIGKILL" }));
    expect(result).toEqual({
      kind: "invokerDefect",
      reason: expect.stringContaining("SIGKILL"),
    });
  });
});

describe("measure report, the one verb whose success is unwrapped", () => {
  test("an unwrapped report is identified by report_kind", () => {
    const result = decodeMeasureReport(
      output({
        stdout: `${JSON.stringify({
          report_kind: "interlock-measurement-report",
          verdict: "green",
          header: {},
        })}\n`,
      }),
    );
    expect(result).toEqual({
      kind: "answered",
      db: null,
      payload: { reportKind: "interlock-measurement-report" },
    });
  });

  test("its exit-2 answer is prose, because this verb has no envelope at all", () => {
    // Read off continuo's `src/measurement/cli.ts` at the pinned revision: the
    // module mounts `--json` and never calls the envelope's `successLine` or
    // `refusalLine`, because there the flag is only another spelling of
    // `--format json`. An earlier draft of the decoder invented a
    // `continuo.measure.report/1` refusal document; no such document exists.
    const prose = "continuo measure report: error: argument --json: another spelling of ...";
    const result = decodeMeasureReport(output({ status: 2, stderr: prose }));
    expect(result).toEqual({ kind: "refusedInProse", text: prose });
  });

  test("a report whose kind will not read is rondo's defect, not a refusal", () => {
    const result = decodeMeasureReport(
      output({ stdout: `${JSON.stringify({ report_kind: 7, verdict: "green" })}\n` }),
    );
    expect(result).toEqual({
      kind: "invokerDefect",
      reason: expect.stringContaining("'report_kind' is a number"),
    });
  });
});

/**
 * `lap perform`'s document, as continuo's `report()` writes it, minus whatever
 * a case removes and plus whatever it changes.
 *
 * A whole document per case rather than a payload fragment, because the
 * eleven fields are read together and the interesting failures are about a
 * single key being wrong while the other ten are right.
 */
function lapPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    run_id: "r1",
    workspace: "/srv/work/r1",
    topic_branch: "topic/r1",
    base_commit: "9f1c0b2e5a4d3c6b8f7a0e1d2c3b4a5968770123",
    session_id: "s-r1-1",
    session_path: "started",
    gate_id: "g-r1-1",
    event_id: "report_ingested/r1",
    event_seq: 7,
    endpoint_lease_failure: null,
    elapsed_deadline_at_ms: null,
    ...overrides,
  };
}

describe("lap perform, the verb whose document is the only record of a lap", () => {
  test("a clean lap reads into all eleven fields", () => {
    const result = decode(
      LAP_PERFORM,
      output({ stdout: success(LAP_PERFORM.schema, lapPayload()) }),
    );
    expect(result).toEqual({
      kind: "answered",
      db: "/tmp/cp.sqlite3",
      payload: {
        runId: "r1",
        workspace: "/srv/work/r1",
        topicBranch: "topic/r1",
        baseCommit: "9f1c0b2e5a4d3c6b8f7a0e1d2c3b4a5968770123",
        sessionId: "s-r1-1",
        // The walk's own name, not a path. The fixture says `started` because
        // that is one of the three words continuo actually sends.
        sessionPath: "started",
        gateId: "g-r1-1",
        eventId: "report_ingested/r1",
        eventSeq: 7,
        endpointLeaseFailure: null,
        elapsedDeadlineAtMs: null,
      },
    });
  });

  test("a lease failure is reduced to continuo's message", () => {
    const result = decode(
      LAP_PERFORM,
      output({
        stdout: success(
          LAP_PERFORM.schema,
          lapPayload({ endpoint_lease_failure: { message: "outbox-delivery held by other" } }),
        ),
      }),
    );
    expect(result).toEqual({
      kind: "answered",
      db: "/tmp/cp.sqlite3",
      payload: expect.objectContaining({
        endpointLeaseFailure: "outbox-delivery held by other",
      }),
    });
  });

  test("a null lease failure is an answer and an absent one is a defect", () => {
    // continuo states the key is "always present, and null when there is
    // nothing to say", and says a host that had to tell absent from null to
    // learn the lap was clean would be reading the absence of evidence as
    // evidence. So the two cases are asserted together: they are the same rule
    // seen from both sides.
    const present = decode(
      LAP_PERFORM,
      output({ stdout: success(LAP_PERFORM.schema, lapPayload({ endpoint_lease_failure: null })) }),
    );
    expect(present).toEqual({
      kind: "answered",
      db: "/tmp/cp.sqlite3",
      payload: expect.objectContaining({ endpointLeaseFailure: null }),
    });

    const absent = lapPayload();
    delete absent.endpoint_lease_failure;
    expect(decode(LAP_PERFORM, output({ stdout: success(LAP_PERFORM.schema, absent) }))).toEqual({
      kind: "invokerDefect",
      reason: expect.stringContaining("'endpoint_lease_failure' is absent"),
    });
  });

  test("a lease failure object with no message is a defect, not an empty reason", () => {
    const result = decode(
      LAP_PERFORM,
      output({
        stdout: success(LAP_PERFORM.schema, lapPayload({ endpoint_lease_failure: {} })),
      }),
    );
    expect(result).toEqual({
      kind: "invokerDefect",
      reason: expect.stringContaining("'message' is absent"),
    });
  });

  test("a null elapsed deadline is an answer: continuo drops it rather than the report", () => {
    const result = decode(
      LAP_PERFORM,
      output({
        stdout: success(LAP_PERFORM.schema, lapPayload({ elapsed_deadline_at_ms: null })),
      }),
    );
    expect(result).toEqual({
      kind: "answered",
      db: "/tmp/cp.sqlite3",
      payload: expect.objectContaining({ elapsedDeadlineAtMs: null }),
    });
  });

  test("an elapsed deadline that did pass is carried as the number it is", () => {
    const result = decode(
      LAP_PERFORM,
      output({
        stdout: success(
          LAP_PERFORM.schema,
          lapPayload({ elapsed_deadline_at_ms: 1_788_618_380_687 }),
        ),
      }),
    );
    expect(result).toEqual({
      kind: "answered",
      db: "/tmp/cp.sqlite3",
      payload: expect.objectContaining({ elapsedDeadlineAtMs: 1_788_618_380_687 }),
    });
  });

  test("another version of the same verb is a protocol refusal, not a coercion", () => {
    // The `/1` is the whole version story: a renamed key or a null that starts
    // meaning something else becomes `/2`, and this is how rondo notices.
    const result = decode(
      LAP_PERFORM,
      output({ stdout: success("continuo.lap.perform/2", lapPayload()) }),
    );
    expect(result).toEqual({
      kind: "protocolRefusal",
      reason: expect.stringContaining("continuo.lap.perform/2"),
    });
  });

  test("a field of the wrong type under the RIGHT schema is rondo's own defect", () => {
    // rondo verified this build against a committed sha before driving it, so
    // a `/1` document from that build whose `event_seq` is a string is rondo's
    // model being wrong rather than the seam having moved.
    const result = decode(
      LAP_PERFORM,
      output({ stdout: success(LAP_PERFORM.schema, lapPayload({ event_seq: "7" })) }),
    );
    expect(result).toEqual({
      kind: "invokerDefect",
      reason: expect.stringContaining("'event_seq' is a string"),
    });
  });

  test("its bound is not the control plane's, because a lap walks a worker", () => {
    // The number itself is a floor the invoker overrides per call; what this
    // case defends is that `lap perform` is not bounded by the sixty seconds
    // the five control-plane verbs share, which would have killed every real
    // lap at one fifteenth of continuo's own turn timeout.
    expect(LAP_PERFORM.timeoutMs).toBeGreaterThan(GATE_SHOW.timeoutMs);
    expect(GATE_SHOW.timeoutMs).toBe(60_000);
  });
});
