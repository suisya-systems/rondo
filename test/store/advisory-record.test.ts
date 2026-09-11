/**
 * The advisory record: the DDL, the two writer refusals, rule 5's planted case
 * and rule 11's three enumeration queries (D-0032).
 *
 * Against a real `node:sqlite` in-memory database, for `reading.test.ts`'s
 * reason: the properties under test here are the database's -- a `CHECK` that
 * refuses a column combination, a primary key that refuses a second issuance,
 * a read and a write inside one `BEGIN IMMEDIATE`, and three queries that
 * return rows nothing else in the store returns -- and a fake would be
 * asserting the fake.
 *
 * **The planted cases are the point of this file** (D-0032 rule 5, in the shape
 * D-0029 rule 12 uses). A writer refusal that is never observed firing is
 * indistinguishable from a writer refusal that was never wired up: both leave a
 * green suite. So every refusal below is asserted twice -- once firing on a
 * case planted to trip it, and once *not* firing on the neighbouring case that
 * must still be recorded.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { CONSERVATIVE_HOST_POLICY } from "../../src/refrain/policy.js";
import { canonicalJson, contentDigest } from "../../src/store/plan.js";
import type {
  CompositionDraft,
  HumanDecisionDraft,
  JsonRecord,
  OperatorAttention,
  ProposalDraft,
} from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";

const freshConnection = () => new DatabaseSync(":memory:");

const PAYLOAD: JsonRecord = {
  // D-0032 rule 1's shape: an ordered option set with exactly one
  // recommendation, inside the one immutable payload. The store holds it
  // verbatim and never reads into it, so nothing below asserts on its members
  // -- what is asserted is that the bytes come back and the digest describes
  // them.
  options: [
    { label: "widen to the two keys the lap named", recommended: true, basis: { snapshot: "$.a" } },
    { label: "leave the contract as it is", recommended: false, basis: { snapshot: "$.b" } },
  ],
};

const SNAPSHOT: JsonRecord = { iteration: "i-0001", classification: "needs_approval" };

const proposal = (parts: Partial<ProposalDraft> = {}): ProposalDraft => ({
  proposalId: "p-0001",
  kind: "widening_successor",
  drafter: "rondo/deterministic/1",
  payload: PAYLOAD,
  snapshot: SNAPSHOT,
  derivation: null,
  iterationId: "i-0001",
  supersedesIterationId: null,
  supersedesProposalId: null,
  predecessorPlanDigest: null,
  predecessorContractDigest: `sha256:${"d".repeat(64)}`,
  agentTypeDigest: null,
  configDigest: null,
  contractDigest: null,
  continuoRevision: null,
  cadenzaRevision: null,
  elevatedFromMessageId: null,
  elevatedByActorId: null,
  createdAtMs: 1_000,
  ...parts,
});

const composition = (parts: Partial<CompositionDraft> = {}): CompositionDraft => ({
  compositionId: "c-0001",
  proposalId: "p-0001",
  contract: { grantee: "rondo/iter-0001", keys: ["read", "write"] },
  contractDigest: `sha256:${"e".repeat(64)}`,
  supersedesContractDigest: `sha256:${"d".repeat(64)}`,
  cadenzaRevision: "cadenza@abcdef0",
  composedAtMs: 2_000,
  ...parts,
});

const decision = (parts: Partial<HumanDecisionDraft> = {}): HumanDecisionDraft => ({
  decisionId: "d-0001",
  proposalId: "p-0001",
  outcome: "approved",
  approved: `sha256:${"e".repeat(64)}`,
  predecessor: `sha256:${"d".repeat(64)}`,
  actorId: "oidc|operator-1",
  recordedBy: "rondo/surface/cli",
  gateId: null,
  gateTransitionSeq: null,
  decidedAtMs: 3_000,
  ...parts,
});

const attention = (parts: Partial<OperatorAttention> = {}): OperatorAttention => ({
  atMs: 4_000,
  subjectKind: "proposal",
  subjectId: "p-0001",
  disposition: "presented",
  ruleName: null,
  ...parts,
});

// --- The DDL (D-0032 rule 12, step 1) -------------------------------------

test("a proposal is held verbatim beside a digest of its own bytes", async () => {
  // D-0022 rule 4. Verbatim rather than digested-only, because a digest detects
  // that a source has moved and does not hand back the rows the proposal was
  // made from -- and because D-0032 rule 2's inline bases are pointers into
  // this snapshot, which only works while the snapshot is still here.
  const connection = freshConnection();
  const record = advisoryRecord(connection);

  expect(await record.recordProposal(proposal())).toEqual({ kind: "recorded" });

  const row = connection.prepare("SELECT * FROM proposal WHERE proposal_id = ?").get("p-0001") as
    | Record<string, unknown>
    | undefined;
  expect(row?.["payload"]).toBe(canonicalJson(PAYLOAD));
  expect(row?.["proposal_digest"]).toBe(contentDigest(PAYLOAD));
  expect(row?.["snapshot"]).toBe(canonicalJson(SNAPSHOT));
  expect(row?.["snapshot_digest"]).toBe(contentDigest(SNAPSHOT));
  expect(row?.["kind"]).toBe("widening_successor");
  expect(row?.["drafter"]).toBe("rondo/deterministic/1");
});

test("the schema keeps candidate_contract_digest null, so no writer can fill it", () => {
  // D-0022 rule 4's "null on a proposal, always", enforced by the database
  // rather than by a sentence in a design document: a digest here would be the
  // advisory claiming to have composed something, and what the composition
  // produced is its own row.
  const connection = freshConnection();
  advisoryRecord(connection);

  expect(() =>
    connection
      .prepare(
        "INSERT INTO proposal (proposal_id, kind, drafter, payload, proposal_digest, snapshot, " +
          "snapshot_digest, candidate_contract_digest, created_at_ms) " +
          "VALUES ('p-x', 'run_plan', 'somebody', '{}', 'sha256:x', '{}', 'sha256:y', " +
          "'sha256:z', 1)",
      )
      .run(),
  ).toThrow(/CHECK constraint failed/);
});

test("derivation is required on an explanation and refused on every other kind", async () => {
  // D-0032 rule 8. A diagram drawn from identifier names and one derived from
  // call structure render identically, and without the attribute the reader
  // cannot spot-check. Both directions, because a column that is merely
  // *allowed* on an explanation would let the absence pass unnoticed.
  const record = advisoryRecord(freshConnection());

  expect(
    (await record.recordProposal(proposal({ proposalId: "p-no-derivation", kind: "explanation" })))
      .kind,
  ).toBe("defect");
  expect(
    await record.recordProposal(
      proposal({ proposalId: "p-explains", kind: "explanation", derivation: "call_structure" }),
    ),
  ).toEqual({ kind: "recorded" });
  expect(
    (await record.recordProposal(proposal({ proposalId: "p-plan", derivation: "call_structure" })))
      .kind,
  ).toBe("defect");
});

test("the two elevation columns are null together", async () => {
  // D-0032 rule 7. An observation with no elevator and an elevator with no
  // observation are each half of the one link where authority enters #41's
  // chain, and half a link is not a provenance record.
  const record = advisoryRecord(freshConnection());
  // Both rows below name a message that is in the conversation, so what they
  // observe is this CHECK and not D-0036 rule 4's refusal, which would
  // otherwise answer first for a message that is not there.
  await record.recordMessage("m-0007");

  expect(
    await record.recordProposal(
      proposal({
        proposalId: "p-elevated",
        elevatedFromMessageId: "m-0007",
        elevatedByActorId: "oidc|operator-1",
      }),
    ),
  ).toEqual({ kind: "recorded" });
  expect(
    (
      await record.recordProposal(
        proposal({ proposalId: "p-half", elevatedFromMessageId: "m-0007" }),
      )
    ).kind,
  ).toBe("defect");
});

test("a declined decision approves no digest, and an approval must name one", async () => {
  // D-0032 rule 6. "Declined" and "never answered" are different rows; a
  // declined row that carried an approved digest would be an issuance waiting
  // to happen, and an approval with none would be an answer with no referent.
  const record = advisoryRecord(freshConnection());
  await record.recordProposal(proposal());

  expect(
    await record.recordDecision(
      decision({ decisionId: "d-no", outcome: "declined", approved: null }),
    ),
  ).toEqual({ kind: "recorded" });
  expect(
    (await record.recordDecision(decision({ decisionId: "d-bad", outcome: "declined" }))).kind,
  ).toBe("defect");
  expect(
    (await record.recordDecision(decision({ decisionId: "d-empty", approved: null }))).kind,
  ).toBe("defect");
});

// --- Rule 5's writer refusal, and its planted case ------------------------

test("PLANTED: a decision naming an explanation is refused, and says why", async () => {
  // **D-0032 rule 5's planted case.** `explanation` binds nothing, ever, and
  // this is the case planted to trip the refusal: an explanation reaches the
  // decision writer as an ordinary proposal id, and the only thing standing
  // between it and a recorded approval is the kind read inside the writer's
  // own transaction.
  const connection = freshConnection();
  const record = advisoryRecord(connection);
  await record.recordProposal(
    proposal({ proposalId: "p-explains", kind: "explanation", derivation: "identifier_names" }),
  );

  const refused = await record.recordDecision(
    decision({ decisionId: "d-explains", proposalId: "p-explains" }),
  );

  expect(refused.kind).toBe("refused");
  expect(refused.kind === "refused" && refused.reason).toContain("binds nothing");
  expect(refused.kind === "refused" && refused.reason).toContain("explanation");
  // And nothing was written: the refusal happens inside the transaction that
  // would have carried the insert, so a refused answer leaves no row behind.
  expect(
    connection.prepare("SELECT COUNT(*) AS n FROM human_decision").get() as Record<string, unknown>,
  ).toEqual({ n: 0 });
});

test("PLANTED: the same decision against an approvable kind is recorded", async () => {
  // **The non-vacuity half, and it is why the case above is worth anything.** A
  // refusal that fired on everything would be a writer that records nothing,
  // and a green suite over it would look exactly like a green suite over a
  // working one. This is the neighbouring case that must still land.
  const record = advisoryRecord(freshConnection());
  await record.recordProposal(proposal({ proposalId: "p-widens" }));

  expect(
    await record.recordDecision(decision({ decisionId: "d-widens", proposalId: "p-widens" })),
  ).toEqual({ kind: "recorded" });
});

test("every approvable kind is answerable and explanation is the only one that is not", async () => {
  // Rule 5 as a table rather than as one example, so that a kind moved between
  // the two sets is a red test. Authority is a function of `kind` alone: the
  // drafter, the payload and the outcome are identical across all five rows.
  const record = advisoryRecord(freshConnection());
  const answered: Record<string, string> = {};
  for (const kind of ["agent_type", "run_plan", "contract_keys", "widening_successor"] as const) {
    await record.recordProposal(proposal({ proposalId: `p-${kind}`, kind }));
    answered[kind] = (
      await record.recordDecision(decision({ decisionId: `d-${kind}`, proposalId: `p-${kind}` }))
    ).kind;
  }
  await record.recordProposal(
    proposal({ proposalId: "p-explanation", kind: "explanation", derivation: "tests_that_ran" }),
  );
  answered["explanation"] = (
    await record.recordDecision(decision({ decisionId: "d-exp", proposalId: "p-explanation" }))
  ).kind;

  expect(answered).toEqual({
    agent_type: "recorded",
    run_plan: "recorded",
    contract_keys: "recorded",
    widening_successor: "recorded",
    explanation: "refused",
  });
});

test("PLANTED: a kind this rondo does not know is refused rather than guessed at", async () => {
  // D-0022 rule 4's reader refusal, reached by rule 5's writer without a second
  // spelling of the union: a kind outside the closed union is not in the
  // approvable set. Planted with raw SQL because no typed caller can produce
  // it -- which is exactly the row a person editing the file with `sqlite3`
  // can.
  const connection = freshConnection();
  const record = advisoryRecord(connection);
  connection
    .prepare(
      "INSERT INTO proposal (proposal_id, kind, drafter, payload, proposal_digest, snapshot, " +
        "snapshot_digest, created_at_ms) VALUES ('p-alien', 'auto_approve', 'somebody', '{}', " +
        "'sha256:x', '{}', 'sha256:y', 1)",
    )
    .run();

  const refused = await record.recordDecision(
    decision({ decisionId: "d-alien", proposalId: "p-alien" }),
  );

  expect(refused.kind).toBe("refused");
  expect(refused.kind === "refused" && refused.reason).toContain("auto_approve");
});

test("a decision naming no proposal at all is refused", async () => {
  // There is no kind to read, so there is no authority to derive. Refused
  // rather than recorded as a dangling row, because the one column rule 5 rests
  // on would be absent.
  const record = advisoryRecord(freshConnection());

  const refused = await record.recordDecision(decision({ proposalId: "p-missing" }));

  expect(refused.kind).toBe("refused");
  expect(refused.kind === "refused" && refused.reason).toContain("p-missing");
});

// --- The conversation, and rule 4's writer refusal (D-0036) ---------------

test("a message is an id and nothing else, so a gate answer cannot live there", async () => {
  // **D-0036 rule 3's three properties, read off the schema.** The third one --
  // a gate answer never lives in the conversation (D-0020 rule 5) -- is held by
  // the shape rather than by a CHECK: there is no column to put a body in, so
  // the paraphrase that would record as human approval has nowhere to go. This
  // asserts the column list rather than one insert, because the property is the
  // absence of the other columns and an insert cannot observe an absence.
  const connection = freshConnection();
  const record = advisoryRecord(connection);

  expect(await record.recordMessage("m-0001")).toEqual({ kind: "recorded" });
  expect(
    (
      connection.prepare("PRAGMA table_info(conversation_message)").all() as Record<
        string,
        unknown
      >[]
    ).map((column) => column["name"]),
  ).toEqual(["message_id"]);
});

test("a message id is immutable: a second row under one id is refused", async () => {
  // Rule 3's first property, as a refusal a caller can observe. The store holds
  // no body, so it cannot tell a repeat of one message from a different message
  // reusing an id -- and taking the second write as a no-op would let a
  // reference that has already been elevated come to mean something else.
  const record = advisoryRecord(freshConnection());
  await record.recordMessage("m-0001");

  const refused = await record.recordMessage("m-0001");

  expect(refused.kind).toBe("refused");
  expect(refused.kind === "refused" && refused.reason).toContain("durable and immutable");
});

test("PLANTED: a proposal elevated from a message that is not there is refused", async () => {
  // **D-0036 rule 4's planted case.** The elevation pair passes the schema's
  // CHECK -- both columns are non-null, which is all D-0032 rule 7 asks -- so
  // the only thing standing between a dangling chain and a recorded proposal is
  // the lookup inside this writer's own transaction.
  const connection = freshConnection();
  const record = advisoryRecord(connection);

  const refused = await record.recordProposal(
    proposal({
      proposalId: "p-elevated",
      elevatedFromMessageId: "m-never-said",
      elevatedByActorId: "oidc|operator-1",
    }),
  );

  expect(refused.kind).toBe("refused");
  expect(refused.kind === "refused" && refused.reason).toContain("m-never-said");
  expect(refused.kind === "refused" && refused.reason).toContain("no message in this conversation");
  // And nothing was written: the refusal happens inside the transaction that
  // would have carried the insert, so a refused elevation leaves no proposal
  // behind to be read as one that was never elevated.
  expect(
    connection.prepare("SELECT COUNT(*) AS n FROM proposal").get() as Record<string, unknown>,
  ).toEqual({ n: 0 });
});

test("PLANTED: the same proposal is recorded once the message it names exists", async () => {
  // **The non-vacuity half.** A refusal that fired on every elevation would be
  // a writer that records no chain at all, and D-0032 rule 7's two columns
  // would stay null-together for ever for a new reason -- which is a green
  // suite over a store that lost the feature it just gained.
  const connection = freshConnection();
  const record = advisoryRecord(connection);
  await record.recordMessage("m-0001");

  expect(
    await record.recordProposal(
      proposal({
        proposalId: "p-elevated",
        elevatedFromMessageId: "m-0001",
        elevatedByActorId: "oidc|operator-1",
      }),
    ),
  ).toEqual({ kind: "recorded" });

  const row = connection
    .prepare("SELECT elevated_from_message_id, elevated_by_actor_id FROM proposal")
    .get() as Record<string, unknown>;
  expect(row["elevated_from_message_id"]).toBe("m-0001");
  expect(row["elevated_by_actor_id"]).toBe("oidc|operator-1");
});

test("PLANTED: a proposal that elevates nothing is recorded, message or no message", async () => {
  // The second neighbouring case, and the one every existing writer takes:
  // `explain` writes the pair as null (D-0032 rule 7), so a refusal reaching
  // rows that name no message would stop the one proposal rondo composes today.
  const record = advisoryRecord(freshConnection());

  expect(await record.recordProposal(proposal({ proposalId: "p-plain" }))).toEqual({
    kind: "recorded",
  });
});

// --- Rule 10's writer refusal ---------------------------------------------

test("PLANTED: a withholding whose rule cannot be named is refused, and says why", async () => {
  // **D-0032 rule 10's writer refusal.** "Suppressed 40" is a number;
  // "suppressed 40, of which 31 by the duplicate-delivery rule" is a record.
  // The blank case is planted beside the null one because a caller that had to
  // supply *something* is the caller most likely to supply a space.
  const connection = freshConnection();
  const record = advisoryRecord(connection);

  for (const ruleName of [null, "", "   "]) {
    const refused = await record.recordAttention(
      attention({ disposition: "withheld", ruleName, subjectId: null }),
    );
    expect(refused.kind).toBe("refused");
    expect(refused.kind === "refused" && refused.reason).toContain("name the rule");
  }
  expect(
    connection.prepare("SELECT COUNT(*) AS n FROM operator_attention").get() as Record<
      string,
      unknown
    >,
  ).toEqual({ n: 0 });
});

test("PLANTED: a named withholding and an unnamed presentation are both recorded", async () => {
  // The non-vacuity half. `rule_name` is required on the withheld side and on
  // that side only: a presentation has no rule to name, and demanding one would
  // make the numerator harder to write than the denominator.
  const record = advisoryRecord(freshConnection());

  expect(
    await record.recordAttention(
      attention({ disposition: "withheld", subjectId: null, ruleName: "duplicate_delivery" }),
    ),
  ).toEqual({ kind: "recorded" });
  expect(await record.recordAttention(attention())).toEqual({ kind: "recorded" });
});

test("the schema refuses an unnamed withholding inserted from outside this code", () => {
  // The writer refusal covers the caller; this covers the file. A row inserted
  // with `sqlite3` that suppressed something and named no rule would be
  // silence the table cannot account for, which is the one thing rule 10
  // exists to bound.
  const connection = freshConnection();
  advisoryRecord(connection);

  expect(() =>
    connection
      .prepare(
        "INSERT INTO operator_attention (at_ms, subject_kind, disposition) " +
          "VALUES (1, 'proposal', 'withheld')",
      )
      .run(),
  ).toThrow(/CHECK constraint failed/);
});

test("both sides of the silence come out of one GROUP BY", async () => {
  // D-0032 rule 10's screen: "six were put to you, forty were not, here is the
  // breakdown". One table, so the numerator and the denominator come from the
  // same place -- `human_decision` would report zero presented until somebody
  // answered.
  const connection = freshConnection();
  const record = advisoryRecord(connection);
  await record.recordAttention(attention({ subjectId: "p-1" }));
  await record.recordAttention(attention({ subjectId: "p-2" }));
  await record.recordAttention(
    attention({ disposition: "withheld", subjectId: null, ruleName: "duplicate_delivery" }),
  );
  await record.recordAttention(
    attention({ disposition: "withheld", subjectId: null, ruleName: "duplicate_delivery" }),
  );
  await record.recordAttention(
    attention({ disposition: "withheld", subjectId: null, ruleName: "below_threshold" }),
  );

  const breakdown = connection
    .prepare(
      "SELECT disposition, rule_name, COUNT(*) AS n FROM operator_attention " +
        "GROUP BY disposition, rule_name ORDER BY disposition, rule_name",
    )
    .all();

  expect(breakdown).toEqual([
    { disposition: "presented", rule_name: null, n: 2 },
    { disposition: "withheld", rule_name: "below_threshold", n: 1 },
    { disposition: "withheld", rule_name: "duplicate_delivery", n: 2 },
  ]);
});

test("a subject presented twice is counted once, and the repeat is a no-op", async () => {
  // D-0036 rule 1. The inbox re-renders the same item across gaps, so counting
  // per render makes one unanswered proposal, looked at twenty times over a
  // morning, report twenty presentations -- and rule 10's ratio then compares a
  // count of renders against a count of subjects.
  const connection = freshConnection();
  const record = advisoryRecord(connection);

  expect(await record.recordAttention(attention({ atMs: 4_000 }))).toEqual({ kind: "recorded" });
  // **Recorded, not refused** (D-0036 rule 1). `presentedUncounted` says the
  // surface's own accounting is short; a re-render is not that case, because the
  // subject already has its row.
  expect(await record.recordAttention(attention({ atMs: 9_000 }))).toEqual({ kind: "recorded" });
  // A different subject is a different presentation, and the ratio's numerator
  // is a count of subjects.
  expect(await record.recordAttention(attention({ subjectId: "p-0002" }))).toEqual({
    kind: "recorded",
  });

  expect(
    connection
      .prepare(
        "SELECT subject_id, at_ms FROM operator_attention WHERE disposition = 'presented' " +
          "ORDER BY subject_id",
      )
      .all(),
  ).toEqual([
    // The **first** look's clock survives: when a subject was first shown is
    // preserved, how often it was shown is the stated ceiling.
    { subject_id: "p-0001", at_ms: 4_000 },
    { subject_id: "p-0002", at_ms: 4_000 },
  ]);
});

test("the once-per-subject index leaves the withheld side alone", async () => {
  // The index is partial over `presented` for D-0032 rule 10's reason: the most
  // common withholding was never composed into anything with an id, and two of
  // them are two withholdings and not one repeated. Same subject, same rule,
  // twice, on both shapes of `subject_id`.
  const connection = freshConnection();
  const record = advisoryRecord(connection);
  const withheld = { disposition: "withheld", ruleName: "duplicate_delivery" } as const;

  await record.recordAttention(attention({ ...withheld, subjectId: null }));
  await record.recordAttention(attention({ ...withheld, subjectId: null }));
  await record.recordAttention(attention({ ...withheld, subjectId: "p-0001" }));
  await record.recordAttention(attention({ ...withheld, subjectId: "p-0001" }));
  // A presented row carrying no id collides with nothing either: NULLs are
  // distinct in the index, which is the wanted behaviour and not a tolerated one.
  await record.recordAttention(attention({ subjectId: null }));
  await record.recordAttention(attention({ subjectId: null }));

  expect(connection.prepare("SELECT COUNT(*) AS n FROM operator_attention").get()).toEqual({
    n: 6,
  });
});

// --- Rule 11's three enumeration queries ----------------------------------

test("an approved decision that was never spent is enumerable", async () => {
  // D-0022 rule 19's acceptance criterion, inherited unchanged: under rule 17
  // an approved plan that is never admitted leaves no trace anywhere else --
  // cadenza holds nothing, continuo was never told, and the iteration that
  // would have carried it does not exist.
  const record = advisoryRecord(freshConnection());
  await record.recordProposal(proposal());
  await record.recordComposition(composition());
  await record.recordDecision(decision({ decisionId: "d-spent" }));
  await record.recordDecision(decision({ decisionId: "d-unspent", decidedAtMs: 3_500 }));
  await record.consumeDecision("d-spent", `sha256:${"e".repeat(64)}`, 4_000);

  const unconsumed = await record.unconsumedDecisions();

  expect(unconsumed).toEqual([
    {
      decisionId: "d-unspent",
      proposalId: "p-0001",
      approved: `sha256:${"e".repeat(64)}`,
      actorId: "oidc|operator-1",
      decidedAtMs: 3_500,
    },
  ]);
});

test("a declined decision is not an unspent approval", async () => {
  // D-0032 rule 6: a refusal consumes nothing by design, so listing one here
  // would report every refusal as an issuance still owed.
  const record = advisoryRecord(freshConnection());
  await record.recordProposal(proposal());
  await record.recordDecision(
    decision({ decisionId: "d-no", outcome: "declined", approved: null }),
  );

  expect(await record.unconsumedDecisions()).toEqual([]);
});

test("one decision authorises at most one issuance", async () => {
  // `advisory.md` 6.3: single use is a transaction, not a check. The second
  // attempt collides on `decision_consumption`'s primary key and is refused by
  // the database rather than by a check somebody remembered to write.
  const record = advisoryRecord(freshConnection());
  await record.recordProposal(proposal());
  await record.recordDecision(decision());

  expect(await record.consumeDecision("d-0001", `sha256:${"e".repeat(64)}`, 4_000)).toEqual({
    kind: "recorded",
  });
  const second = await record.consumeDecision("d-0001", `sha256:${"e".repeat(64)}`, 5_000);

  expect(second.kind).toBe("refused");
  expect(second.kind === "refused" && second.reason).toContain("already been spent");
});

test("a consumption must name a decision, an approval, and the digest it approved", async () => {
  // **`decision_consumption` is what `unconsumedDecisions` subtracts**, so a
  // consumption that names nothing, names a refusal, or names a digest nobody
  // approved is not a harmless row: it is a subtraction that silently empties
  // D-0022 rule 19's own detector. All three are refused, and each says which
  // of the three it was.
  const record = advisoryRecord(freshConnection());
  await record.recordProposal(proposal());
  await record.recordDecision(decision());
  await record.recordDecision(
    decision({ decisionId: "d-no", outcome: "declined", approved: null, decidedAtMs: 3_500 }),
  );

  const absent = await record.consumeDecision("d-absent", `sha256:${"e".repeat(64)}`, 4_000);
  const declined = await record.consumeDecision("d-no", `sha256:${"e".repeat(64)}`, 4_000);
  const wrong = await record.consumeDecision("d-0001", `sha256:${"f".repeat(64)}`, 4_000);

  expect(absent.kind).toBe("refused");
  expect(absent.kind === "refused" && absent.reason).toContain("no human decision");
  expect(declined.kind).toBe("refused");
  expect(declined.kind === "refused" && declined.reason).toContain("declined");
  expect(wrong.kind).toBe("refused");
  expect(wrong.kind === "refused" && wrong.reason).toContain("is what a person approved");
  // The non-vacuity half: the approval is still unspent, and spending it on the
  // digest it actually approved still works.
  expect((await record.unconsumedDecisions()).map((row) => row.decisionId)).toEqual(["d-0001"]);
  expect(await record.consumeDecision("d-0001", `sha256:${"e".repeat(64)}`, 5_000)).toEqual({
    kind: "recorded",
  });
});

test("one gate answer backs at most one decision", async () => {
  // advisory.md 6.4 / D-0022 rule 16. Two rows naming one continuo transition
  // would be one person's single answer turned into two spendable approvals,
  // which defeats D-0022 rule 9 one level above the primary key that holds it.
  const record = advisoryRecord(freshConnection());
  await record.recordProposal(proposal());
  const routeG = { gateId: "g-0001", gateTransitionSeq: 7 };

  expect(await record.recordDecision(decision({ decisionId: "d-g1", ...routeG }))).toEqual({
    kind: "recorded",
  });
  expect((await record.recordDecision(decision({ decisionId: "d-g2", ...routeG }))).kind).toBe(
    "defect",
  );
  // Route S names no transition, so any number of its rows coexist.
  expect(await record.recordDecision(decision({ decisionId: "d-s1" }))).toEqual({
    kind: "recorded",
  });
  expect(await record.recordDecision(decision({ decisionId: "d-s2" }))).toEqual({
    kind: "recorded",
  });
});

test("terminal iterations are enumerable, which nothing else in the store does", async () => {
  // D-0022's residual, discharged (D-0032 rule 11). `read` needs an id already
  // known and `readLive` filters terminal rows out, so the abandoned iteration
  // the advisory component exists to explain could not be found at all.
  const connection = freshConnection();
  const store = iterationStore(connection, CONSERVATIVE_HOST_POLICY);
  // Reserved and ended one at a time, because the conservative policy's bound
  // is one live iteration -- which is the same reason `readLive` alone cannot
  // answer this question.
  for (const [id, at, ends] of [
    ["i-done", 1_000, "closed"],
    ["i-gone", 3_000, "abandoned"],
    ["i-live", 5_000, null],
  ] as const) {
    await store.reserve({
      id,
      request: "do the thing",
      plan: { run_id: `r-${id}` },
      nowMs: at,
      supersedesIterationId: null,
      runId: `rondo-${id}`,
      topicBranch: `rondo/${id}`,
      workspace: `/srv/work/${id}`,
    });
    if (ends !== null) {
      await store.transition(id, "planned", ends, {}, at + 1_000);
    }
  }

  const terminal = await store.terminalIterations();

  expect(
    terminal.map((outcome) => (outcome.kind === "read" ? outcome.record.id : outcome.kind)),
  ).toEqual(["i-done", "i-gone"]);
  expect((await store.readLive()).map((o) => (o.kind === "read" ? o.record.id : o.kind))).toEqual([
    "i-live",
  ]);
});

test("what changed since a mark spans the record kinds and includes the bound", async () => {
  // D-0032 rule 11's third query, and rule 9's inclusive comparison. The mark
  // is the upper limit the render's own queries used, so a row bearing exactly
  // that timestamp may or may not have been displayed -- and the failure this
  // shape accepts is showing it twice rather than losing it.
  const connection = freshConnection();
  const store = iterationStore(connection, CONSERVATIVE_HOST_POLICY);
  const record = advisoryRecord(connection);
  await store.reserve({
    id: "i-0001",
    request: "do the thing",
    plan: { run_id: "r-1" },
    nowMs: 1_000,
    supersedesIterationId: null,
    runId: "rondo-i-0001",
    topicBranch: "rondo/i-0001",
    workspace: "/srv/work/i-0001",
  });
  await record.recordProposal(proposal({ createdAtMs: 2_000 }));
  await record.recordComposition(composition({ composedAtMs: 3_000 }));
  await record.recordDecision(decision({ decidedAtMs: 4_000 }));
  await record.consumeDecision("d-0001", `sha256:${"e".repeat(64)}`, 5_000);
  await record.recordAttention(attention({ atMs: 6_000 }));

  expect(await record.changedSince(3_000)).toEqual([
    { kind: "composition", id: "c-0001", atMs: 3_000 },
    { kind: "human_decision", id: "d-0001", atMs: 4_000 },
    { kind: "decision_consumption", id: "d-0001", atMs: 5_000 },
    { kind: "operator_attention", id: "p-0001", atMs: 6_000 },
  ]);
  // The iteration's own row is in the same answer, by its `updated_at_ms`.
  expect((await record.changedSince(1_000)).map((change) => change.kind)).toEqual([
    "iteration",
    "proposal",
    "composition",
    "human_decision",
    "decision_consumption",
    "operator_attention",
  ]);
});

test("a look does not report itself as something the operator has not seen", async () => {
  // `operator_view` is the cursor and is the one append-only table excluded
  // from the change feed: a mark is written at the end of the render, so
  // including it would make every look a change waiting for the next one.
  const record = advisoryRecord(freshConnection());
  await record.recordView("oidc|operator-1", 7_000);

  expect(await record.changedSince(0)).toEqual([]);
});

test("a withholding with no subject is a change with a null id, not an empty one", async () => {
  // The most common withholding was never composed into anything with an id,
  // and a reader that saw "" would go looking for a row named that.
  const record = advisoryRecord(freshConnection());
  await record.recordAttention(
    attention({
      atMs: 8_000,
      subjectId: null,
      disposition: "withheld",
      ruleName: "below_threshold",
    }),
  );

  expect(await record.changedSince(0)).toEqual([
    { kind: "operator_attention", id: null, atMs: 8_000 },
  ]);
});

// --- Rule 9's mark --------------------------------------------------------

test("the last look is the furthest one, per actor, and null before the first", async () => {
  // D-0032 rule 9. `MAX` rather than the newest row: the marks are the
  // caller's clocks and the question is how far the reading has reached.
  const record = advisoryRecord(freshConnection());

  expect(await record.lastView("oidc|operator-1")).toBeNull();
  await record.recordView("oidc|operator-1", 9_000);
  await record.recordView("oidc|operator-1", 8_000);
  await record.recordView("oidc|operator-2", 12_000);

  expect(await record.lastView("oidc|operator-1")).toBe(9_000);
  expect(await record.lastView("oidc|operator-2")).toBe(12_000);
});

test("the advisory tables arrive on a database that predates them", async () => {
  // Every statement in `SCHEMA` is `IF NOT EXISTS`, so a store opened over an
  // older database gains the seven tables without a column migration -- and
  // either port may be the one that opens it, because both apply the schema.
  const connection = freshConnection();
  iterationStore(connection, CONSERVATIVE_HOST_POLICY);

  const record = advisoryRecord(connection);

  expect(await record.recordProposal(proposal())).toEqual({ kind: "recorded" });
  expect(await record.unconsumedDecisions()).toEqual([]);
});

// --- Reading one proposal back (#39) --------------------------------------

test("a proposal reads back whole, with the answer that settled it", async () => {
  // #39. The alternatives, the recommendation and every basis are in `payload`
  // and the material they point into is in `snapshot`, so a reader over those
  // two is what makes a gate answerable later than the moment it was drafted.
  const record = advisoryRecord(freshConnection());
  await record.recordProposal(proposal());
  await record.recordComposition(composition());
  await record.recordDecision(decision());

  const outcome = await record.readProposal("p-0001");

  expect(outcome).toEqual({
    kind: "read",
    proposal: {
      proposalId: "p-0001",
      kind: "widening_successor",
      drafter: "rondo/deterministic/1",
      payload: PAYLOAD,
      snapshot: SNAPSHOT,
      derivation: null,
      iterationId: "i-0001",
      elevatedFromMessageId: null,
      elevatedByActorId: null,
      createdAtMs: 1_000,
      decision: {
        decisionId: "d-0001",
        outcome: "approved",
        approved: `sha256:${"e".repeat(64)}`,
        actorId: "oidc|operator-1",
        decidedAtMs: 3_000,
      },
    },
  });
});

test("an unanswered proposal reads back with no decision, and an unknown id is absent", async () => {
  // D-0032 rule 6: "declined" and "never answered" are different rows rather
  // than the same absence, and a screen that could not tell them apart would
  // put the same word on a proposal the operator settled and one nobody has
  // looked at.
  const record = advisoryRecord(freshConnection());
  await record.recordProposal(proposal());

  const outcome = await record.readProposal("p-0001");

  expect(outcome.kind === "read" && outcome.proposal.decision).toBeNull();
  expect(await record.readProposal("p-9999")).toEqual({ kind: "absent" });
});

test("a payload whose digest no longer describes it is unreadable rather than shown", async () => {
  // D-0022 rule 4's "re-derived and not only re-read", planted: the row is
  // edited underneath the store, which is the case the digest exists for. A
  // half-true option set is the one thing that must never reach the person who
  // is about to approve one of its options.
  const connection = freshConnection();
  const record = advisoryRecord(connection);
  await record.recordProposal(proposal());

  connection
    .prepare("UPDATE proposal SET payload = ? WHERE proposal_id = ?")
    .run(canonicalJson({ options: [] }), "p-0001");

  const outcome = await record.readProposal("p-0001");

  expect(outcome.kind).toBe("unreadable");
  expect(outcome.kind === "unreadable" && outcome.reason).toContain("proposal_digest");
});
