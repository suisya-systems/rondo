/**
 * The request thread and the iteration's request link (D-0061 rules 1-4, steps
 * 5.1 and 5.2).
 *
 * Against a real in-memory `node:sqlite`, for `advisory-record.test.ts`'s
 * reason: the refusals are reads inside the writer's own transaction, and a
 * fake would assert the fake. Every planted refusal is paired with the
 * neighbouring case that must still be recorded.
 */
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { main, parseBasis, parseCommand } from "../../src/access/cli.js";
import { consoleSeams } from "../../src/access/console.js";
import { CONSERVATIVE_HOST_POLICY } from "../../src/refrain/policy.js";
import type { ThreadMessageDraft } from "../../src/store/records.js";
import { advisoryRecord, iterationStore, openAdvisoryRecord } from "../../src/store/sqlite.js";

const operator = (parts: Partial<ThreadMessageDraft> = {}): ThreadMessageDraft => ({
  messageId: "m-request",
  body: "  please make the inbox show requests\n\nand nothing else  ",
  authorKind: "operator",
  authorId: "oidc|operator-1",
  inReplyTo: null,
  atMs: 1_000,
  bases: [],
  asks: false,
  ...parts,
});

const drafter = (parts: Partial<ThreadMessageDraft> = {}): ThreadMessageDraft =>
  operator({
    messageId: "m-question",
    body: "Which inbox: the terminal one or the page?",
    authorKind: "drafter",
    authorId: "rondo/deterministic/1",
    inReplyTo: "m-request",
    atMs: 2_000,
    bases: [{ form: "message", messageId: "m-request" }],
    asks: true,
    ...parts,
  });

const count = (connection: DatabaseSync): unknown =>
  (connection.prepare("SELECT COUNT(*) AS n FROM conversation_message").get() as { n: number }).n;

const reserve = (
  store: ReturnType<typeof iterationStore>,
  id: string,
  requestMessageId: string | null,
) =>
  store.reserve({
    id,
    request: "do the thing",
    plan: { run_id: `rondo-${id}` },
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: `/srv/work/iter-${id}`,
    supersedesIterationId: null,
    requestMessageId,
    spend: null,
    nowMs: 5_000,
  });

// --- Rule 2: what a message holds -----------------------------------------

test("a request and its reply are stored column by column, the body byte for byte", async () => {
  const connection = new DatabaseSync(":memory:");
  const record = advisoryRecord(connection);

  expect(await record.recordThreadMessage(operator())).toEqual({ kind: "recorded" });
  expect(await record.recordThreadMessage(drafter())).toEqual({ kind: "recorded" });

  const rows = connection
    .prepare("SELECT * FROM conversation_message ORDER BY at_ms")
    .all() as Record<string, unknown>[];
  expect(rows).toEqual([
    {
      message_id: "m-request",
      body: "  please make the inbox show requests\n\nand nothing else  ",
      author_kind: "operator",
      author_id: "oidc|operator-1",
      in_reply_to: null,
      at_ms: 1_000,
      bases: "[]",
      asks: 0,
    },
    {
      message_id: "m-question",
      body: "Which inbox: the terminal one or the page?",
      author_kind: "drafter",
      author_id: "rondo/deterministic/1",
      in_reply_to: "m-request",
      at_ms: 2_000,
      bases: '[{"form":"message","messageId":"m-request"}]',
      asks: 1,
    },
  ]);
});

test("rule 3: the thread has no column for a gate answer, a decision, a status, a plan or a tier", () => {
  // The refusals rule 3 names are held by the shape, so the column list is
  // what is asserted: an insert cannot observe an absence.
  const connection = new DatabaseSync(":memory:");
  advisoryRecord(connection);
  const columns = (
    connection.prepare("PRAGMA table_info(conversation_message)").all() as Record<string, unknown>[]
  ).map((column) => column["name"]);
  expect(columns).toEqual([
    "message_id",
    "body",
    "author_kind",
    "author_id",
    "in_reply_to",
    "at_ms",
    "bases",
    "asks",
  ]);
});

test("rule 3: nothing in src edits or deletes a message", () => {
  // Append-only, like every record kind: a correction is a reply.
  const sources: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (path.endsWith(".ts")) {
        sources.push(readFileSync(path, "utf-8"));
      }
    }
  };
  walk(join(import.meta.dirname, "../../src"));
  for (const source of sources) {
    expect(source).not.toMatch(
      /UPDATE\s+conversation_message|DELETE\s+FROM\s+conversation_message/i,
    );
  }
});

// --- Rule 2.6: the drafter's bases, planted -------------------------------

test("PLANTED: a drafter message with no basis is refused, and nothing is written", async () => {
  const connection = new DatabaseSync(":memory:");
  const record = advisoryRecord(connection);
  await record.recordThreadMessage(operator());

  const refused = await record.recordThreadMessage(drafter({ bases: [] }));

  expect(refused.kind).toBe("refused");
  expect(refused.kind === "refused" && refused.reason).toContain("D-0061 rule 2.6");
  expect(count(connection)).toBe(1);
});

test("PLANTED: the same drafter message is recorded with a message:ID basis, and an operator needs none", async () => {
  const record = advisoryRecord(new DatabaseSync(":memory:"));
  expect(await record.recordThreadMessage(operator())).toEqual({ kind: "recorded" });
  expect(await record.recordThreadMessage(drafter())).toEqual({ kind: "recorded" });
  expect(
    await record.recordThreadMessage(
      drafter({ messageId: "m-report", bases: [{ form: "iteration", iterationId: "i-1" }] }),
    ),
  ).toEqual({ kind: "recorded" });
});

test("PLANTED: a message:ID basis naming no message is refused", async () => {
  const connection = new DatabaseSync(":memory:");
  const record = advisoryRecord(connection);
  await record.recordThreadMessage(operator());

  const refused = await record.recordThreadMessage(
    drafter({ bases: [{ form: "message", messageId: "m-never-said" }] }),
  );

  expect(refused.kind === "refused" && refused.reason).toContain("m-never-said");
  expect(count(connection)).toBe(1);
});

test("a message:ID basis is typed on the command line like every other form", () => {
  expect(parseBasis("message:m-request")).toEqual({ form: "message", messageId: "m-request" });
  expect(parseBasis("message:")).toBeNull();
});

// --- Rule 2's other refusals ----------------------------------------------

test("a reply to nothing, or to an elevation's bare id, is refused", async () => {
  const connection = new DatabaseSync(":memory:");
  const record = advisoryRecord(connection);
  await record.recordMessage("m-elevated");

  for (const inReplyTo of ["m-missing", "m-elevated"]) {
    const refused = await record.recordThreadMessage(operator({ messageId: "m-reply", inReplyTo }));
    expect(refused.kind === "refused" && refused.reason).toContain("D-0061 rule 2.4");
  }
  expect(count(connection)).toBe(1);
});

test("an unknown voice, a blank author, an empty body and a reused id are refused", async () => {
  const record = advisoryRecord(new DatabaseSync(":memory:"));
  await record.recordThreadMessage(operator());

  const kinds = await Promise.all([
    record.recordThreadMessage(
      operator({ messageId: "a", authorKind: "system" as ThreadMessageDraft["authorKind"] }),
    ),
    record.recordThreadMessage(operator({ messageId: "b", authorId: "  " })),
    record.recordThreadMessage(operator({ messageId: "c", body: "" })),
    record.recordThreadMessage(operator()),
  ]);
  expect(kinds.map((outcome) => outcome.kind)).toEqual([
    "refused",
    "refused",
    "refused",
    "refused",
  ]);
});

test("rule 2.5: a thread message is a change, and an elevation's clockless id is not", async () => {
  const record = advisoryRecord(new DatabaseSync(":memory:"));
  await record.recordMessage("m-elevated");
  await record.recordThreadMessage(operator());

  expect(await record.changedSince(0)).toEqual([
    { kind: "conversation_message", id: "m-request", atMs: 1_000 },
  ]);
});

test("a database whose conversation is one column gains the thread's columns on open", () => {
  const connection = new DatabaseSync(":memory:");
  connection.exec("CREATE TABLE conversation_message (message_id TEXT PRIMARY KEY)");
  connection.exec("INSERT INTO conversation_message VALUES ('m-old')");

  iterationStore(connection, CONSERVATIVE_HOST_POLICY);

  const columns = (
    connection.prepare("PRAGMA table_info(conversation_message)").all() as Record<string, unknown>[]
  ).map((column) => column["name"]);
  expect(columns).toContain("asks");
  expect(columns).toContain("at_ms");
  expect(count(connection)).toBe(1);
});

// --- Rule 4: the iteration's request link ---------------------------------

test("a lap reserved under the message that opened a request records it, and two laps may share it", async () => {
  const connection = new DatabaseSync(":memory:");
  const record = advisoryRecord(connection);
  const store = iterationStore(connection, { maxOccupying: 5, maxLive: 5 });
  await record.recordThreadMessage(operator());

  const first = await reserve(store, "a", "m-request");
  const second = await reserve(store, "b", "m-request");
  const unlinked = await reserve(store, "c", null);

  expect(first.kind === "reserved" && first.record.requestMessageId).toBe("m-request");
  expect(second.kind === "reserved" && second.record.requestMessageId).toBe("m-request");
  expect(unlinked.kind === "reserved" && unlinked.record.requestMessageId).toBeNull();
});

test("PLANTED: a lap naming a reply, an elevation's id or nothing is refused, and no row is written", async () => {
  const connection = new DatabaseSync(":memory:");
  const record = advisoryRecord(connection);
  const store = iterationStore(connection, { maxOccupying: 5, maxLive: 5 });
  await record.recordThreadMessage(operator());
  await record.recordThreadMessage(drafter());
  await record.recordMessage("m-elevated");

  for (const [id, messageId] of [
    ["a", "m-question"],
    ["b", "m-elevated"],
    ["c", "m-missing"],
  ] as const) {
    const refused = await reserve(store, id, messageId);
    expect(refused.kind).toBe("requestRefused");
    expect(refused.kind === "requestRefused" && refused.reason).toContain(messageId);
  }
  expect((connection.prepare("SELECT COUNT(*) AS n FROM iteration").get() as { n: number }).n).toBe(
    0,
  );
});

// --- Step 5.1's verbs -----------------------------------------------------

test("request and reply take only their own flags", () => {
  expect(
    parseCommand(["request", "--actor-id", "me", "--message-id", "m-1", "--body=hi"]).kind,
  ).toBe("parsed");
  expect(
    parseCommand(["request", "--actor-id", "me", "--message-id", "m-1", "--in-reply-to", "m-0"])
      .kind,
  ).toBe("refused");
  expect(parseCommand(["start", "--message-id", "m-1"]).kind).toBe("parsed");
});

test("rondo request and rondo reply write operator messages as the approver", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "rondo-thread-")), "store.db");
  const environment = { RONDO_STORE: path, RONDO_APPROVER: "me" };
  const errors: string[] = [];
  const originalWrite = consoleSeams.write;
  const originalError = consoleSeams.writeError;
  consoleSeams.write = () => {};
  consoleSeams.writeError = (text: string) => {
    errors.push(text);
  };
  try {
    expect(
      await main(
        ["request", "--actor-id", "me", "--message-id", "m-1", "--body=-- leading dash kept"],
        environment,
      ),
    ).toBe(0);
    expect(
      await main(
        ["reply", "--actor-id", "me", "--message-id", "m-2", "--in-reply-to", "m-1", "--body=ok"],
        environment,
      ),
    ).toBe(0);
    // Somebody else is refused before anything is written, and so is a reply to nothing.
    expect(
      await main(["request", "--actor-id", "you", "--message-id", "m-3", "--body=x"], environment),
    ).toBe(2);
    expect(
      await main(
        ["reply", "--actor-id", "me", "--message-id", "m-4", "--in-reply-to", "m-9", "--body=x"],
        environment,
      ),
    ).toBe(2);
  } finally {
    consoleSeams.write = originalWrite;
    consoleSeams.writeError = originalError;
  }
  expect(errors.join("")).toContain("m-9");
  const changes = await openAdvisoryRecord(path).changedSince(0);
  expect(changes.map((change) => change.id)).toEqual(["m-1", "m-2"]);
  const connection = new DatabaseSync(path);
  expect(
    connection
      .prepare(
        "SELECT body, author_kind, author_id, asks FROM conversation_message WHERE message_id = 'm-1'",
      )
      .get(),
  ).toEqual({ body: "-- leading dash kept", author_kind: "operator", author_id: "me", asks: 0 });
  connection.close();
});
