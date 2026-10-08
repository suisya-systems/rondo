/**
 * The store's schema: the `CREATE` statements every open applies, the columns
 * added to databases written before them, and the migration that adds them.
 *
 * Split out of `src/store/sqlite.ts` (D-0171), which still owns the driver.
 */

import { SUSPENDED_STATUSES, TERMINAL_STATUSES } from "./records.js";
import type { SqlRow, StoreConnection } from "./rows.js";

/**
 * The terminal set, rendered as SQL literals from the one place it is written.
 *
 * Derived from `TERMINAL_STATUSES` rather than retyped into the DDL, so the set
 * has one spelling: D-0019 rule 10 chose the generated-column shape over a
 * partial index whose `WHERE` repeats the list precisely so that adding a
 * terminal status is one edit in `records.ts`. The interpolation is safe by
 * construction -- the values are this repository's own frozen tuple of
 * lowercase identifiers, not anything a caller supplies -- and it is the only
 * interpolation in this file; every other value is a bound parameter.
 */
const TERMINAL_SQL_LITERALS = TERMINAL_STATUSES.map((status) => `'${status}'`).join(", ");

/**
 * The terminal set plus the two suspended statuses, as SQL literals.
 *
 * The `occupying` column's whole definition, and it is derived from
 * `records.ts` for {@link TERMINAL_SQL_LITERALS}'s reason: `maxOccupying`
 * counts exactly this column, so the bound and the column are one definition
 * and the set has one spelling (D-0023 rule 8).
 */
const UNOCCUPIED_SQL_LITERALS = [...TERMINAL_STATUSES, ...SUSPENDED_STATUSES]
  .map((status) => `'${status}'`)
  .join(", ");

/**
 * The generated columns, as SQL expressions, written once.
 *
 * Named here rather than inline in the DDL because they are needed twice: once
 * by `CREATE TABLE` for a database that does not exist yet, and once by
 * {@link migrate} for one that does. Two spellings of a generated column would
 * be two definitions of a bound.
 */
const GENERATED_COLUMNS = Object.freeze({
  live: `INTEGER GENERATED ALWAYS AS (
                          CASE WHEN status IN (${TERMINAL_SQL_LITERALS}) THEN NULL ELSE 1 END
                        ) VIRTUAL`,
  occupying: `INTEGER GENERATED ALWAYS AS (
                          CASE WHEN status IN (${UNOCCUPIED_SQL_LITERALS}) THEN NULL ELSE 1 END
                        ) VIRTUAL`,
  holds_identifiers: `INTEGER GENERATED ALWAYS AS (
                          CASE WHEN status IN (${TERMINAL_SQL_LITERALS}) AND identifiers_spent = 0
                            THEN NULL ELSE 1 END
                        ) VIRTUAL`,
});

/**
 * The schema, created idempotently on construction.
 *
 * `request` and `plan` are `NOT NULL` because `IterationRecord` says they are
 * never absent, and a column that permits what the type forbids is a schema
 * that disagrees with the code reading it. Everything the write order of
 * D-0019 rule 10 learns *later* -- the run id, the observed continuo revision,
 * the three digests, the gate -- is nullable, because it is legitimately
 * unknown at the moment the row is first written.
 *
 * **`supersedes_iteration_id` is the one nullable column that is not an
 * "unknown yet"** (D-0030). It is written by `reserve()` or never, and null
 * means this iteration revises nothing rather than that its lineage has not
 * been established. It is **not** a foreign key, for `admission_refusal`'s
 * reason below: this database declares none at all, and one on a single column
 * would make the schema claim that referential integrity is enforced somewhere
 * it is not. What stands in its place is a check inside `reserve()`'s own
 * transaction, where the predecessor can be read under the write lock.
 *
 * **`live` is no longer an invariant the database holds, and that is D-0023.**
 * It stays as a column and keeps its meaning -- "this row has not reached a
 * terminal status" -- but the unique index over it is gone, because a unique
 * index expresses "at most one" and nothing else: `UNIQUE(live)` over a column
 * whose only non-null value is `1` is a bound of one *by construction*, and
 * there is no "at most N" index to widen it into. What replaces it is a count
 * read inside `reserve()`'s own `BEGIN IMMEDIATE`.
 *
 * **What that costs is stated here rather than argued away.** Under the index,
 * a row inserted from outside this code -- `sqlite3` on the file, a hand-edited
 * migration -- could not violate single-flight, because the database refused
 * it. Under a counted bound the invariant lives in `reserve()`'s transaction
 * and an out-of-band insert violates it silently. D-0019 rule 10 bought
 * "making 'at most one non-terminal iteration' the *database's* invariant", and
 * that is what is being spent. D-0023 rule 11 records it, and names the slot
 * table as the alternative that would have kept it.
 *
 * `occupying` and `holds_identifiers` are the two generated columns that
 * replace what the index was doing, and neither is a bound: they are the sets
 * the bounds are counted over and the claims the partial unique indexes are
 * taken over. See {@link GENERATED_COLUMNS}.
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS iteration (
  id                    TEXT    PRIMARY KEY,
  status                TEXT    NOT NULL,
  request               TEXT    NOT NULL,
  plan                  TEXT    NOT NULL,
  plan_digest           TEXT    NOT NULL,
  attempts              INTEGER NOT NULL,
  run_id                TEXT,
  topic_branch          TEXT,
  workspace             TEXT,
  identifiers_spent     INTEGER NOT NULL DEFAULT 0,
  supersedes_iteration_id TEXT,
  -- TEXT and not NOT NULL, deliberately (D-0083). Every lap names a request
  -- now, and what makes that so is the record type and start requiring
  -- --message-id: the type and the call paths. A constraint here would add no
  -- safety the type does not already give, and it would make the migration
  -- that adds this column to a store written before it impossible -- ALTER
  -- TABLE ADD COLUMN NOT NULL has no value to give the rows already there.
  request_message_id    TEXT,
  -- The worker provider this lap runs on (rondo#462): the one the person
  -- chose, or the host's default *resolved at reservation* when they chose
  -- none. Written by reserve() and by nothing afterwards: the choice is made
  -- before the lap starts, which is the answer the person gave to "can it be
  -- changed part way through".
  --
  -- **The resolved name and not the choice alone.** A row that kept only an
  -- explicit choice left the page to name the default it fell back to, and the
  -- page could only read the default the host runs *now* -- so moving
  -- RONDO_WORKER_PROVIDER relabelled every past lap as having run on the new
  -- worker. The name is therefore settled once, at the start, and the screen
  -- reads this column and nothing else.
  --
  -- Nullable with no back-fill, as every column added after a row could exist
  -- is: a row written before this recorded nothing, and NULL reads as
  -- "unknown" rather than as a provider rondo would be inventing.
  worker_provider       TEXT,
  -- Whether the provider beside it is the person's own choice (1) or the
  -- host's default resolved for them (0), for rows written since rondo
  -- recorded it (rondo#462). NULL beside a NULL provider is a row from before
  -- either.
  worker_provider_chosen INTEGER,
  continuo_revision     TEXT,
  agent_type_digest     TEXT,
  config_digest         TEXT,
  contract_digest       TEXT,
  classification        TEXT,
  classification_reason TEXT,
  neutral_role_name     TEXT,
  continuo_role         TEXT,
  model_tier            TEXT,
  model                 TEXT,
  gate_id               TEXT,
  gate_stage            TEXT,
  gate_outcome          TEXT,
  session_id            TEXT,
  session_path          TEXT,
  permission_denials    TEXT,
  -- The commands the lap ran, continuo's JSON text (continuo D-1112). Three
  -- states as permission_denials: NULL is no reading, "null" is continuo
  -- unable to say, an array's text is what ran.
  lap_commands          TEXT,
  -- What the lap spent (D-0046). REAL for the dollars, INTEGER for the count
  -- and the milliseconds, and every one of them nullable: a null is "rondo did
  -- not read it" and 0 is a lap that spent nothing.
  lap_cost_usd          REAL,
  lap_turns             INTEGER,
  lap_duration_ms       INTEGER,
  -- The room the scope's budget left this lap when it was sent (D-0121). NULL
  -- where it was admitted under no approval, or the lap was never sent.
  lap_budget_cap_usd    REAL,
  -- The remote publish pushed this lap's branch to (rondo#286, D-0153). NULL
  -- is "rondo holds no record", which the landing reading reads as neither
  -- landed nor not landed.
  published_remote      TEXT,
  -- Which processes drive a performing lap (D-0139): NULL on a row sent
  -- before them, which is told lost by its ceiling instead.
  driver_host           TEXT,
  driver_pid            INTEGER,
  lap_pid               INTEGER,
  reason                TEXT,
  -- Whose failure a terminal 'failed' was (rondo#348). Nullable, and null on
  -- every row written before it: nothing on such a row recovers the kind, so
  -- there is no back-fill and a null displays as the status always displayed.
  failure_kind          TEXT,
  created_at_ms         INTEGER NOT NULL,
  updated_at_ms         INTEGER NOT NULL,
  live                  ${GENERATED_COLUMNS.live},
  occupying             ${GENERATED_COLUMNS.occupying},
  holds_identifiers     ${GENERATED_COLUMNS.holds_identifiers}
);
-- D-0023 rule 14. The demand record, and it is deliberately not the iteration
-- table: a capacity refusal must reserve nothing, take no lock and cost no row
-- *there*, which is what D-0019 rule 9 and the dogfood's 1 ms measurement both
-- rest on. Without this table a refusal leaves no trace at all, and the bound
-- could only ever be raised because somebody complained rather than because
-- somebody was counted.
CREATE TABLE IF NOT EXISTS admission_refusal (
  refused_at_ms         INTEGER NOT NULL,
  request               TEXT    NOT NULL,
  bound_name            TEXT    NOT NULL,
  bound                 INTEGER NOT NULL,
  occupancy             INTEGER NOT NULL,
  -- D-0073 rule 3.1: a lane-claim refusal (bound_name 'laneClaim') names the
  -- open lines it would have shared a path with, as canonical JSON
  -- [{lineageId, sharedPaths}]. Its bound is 0 shared paths and its occupancy
  -- the number the admission would have shared. Null on a capacity refusal.
  holders               TEXT
);

-- D-0029 rule 8. One reading of what a lap produced, per row that produced one.
--
-- **Append-only, and with no status column on purpose.** A row that could be
-- rewritten to clear would be a record of what somebody wished had been read
-- (D-0022 rule 4, whose shape this copies). Immutability here is a property of
-- the schema and of there being no writer that updates -- not of a trigger, and
-- the entry claims it at that grade.
--
-- iteration_id is not a foreign key, for admission_refusal's reason: this
-- database has no foreign keys at all, and adding one to a single table would
-- make the schema say that referential integrity is enforced somewhere it is
-- not. It is also not unique: a second reading of the same row is a later fact
-- about it and not a correction of the first, so the newest is what a reader
-- takes and both stay readable.
--
-- The evidence columns are nullable together: null exactly when the verdict is
-- unavailable. findings is canonical JSON of an array of strings rather
-- than a joined string, because a finding may contain any character a person's
-- branch name may and a separator would be a bug waiting for that character.
CREATE TABLE IF NOT EXISTS lap_reading (
  iteration_id          TEXT    NOT NULL,
  read_at_ms            INTEGER NOT NULL,
  drafter               TEXT    NOT NULL,
  verdict               TEXT    NOT NULL,
  findings              TEXT    NOT NULL,
  base_ref              TEXT,
  base_commit           TEXT,
  tip_commit            TEXT,
  material_digest       TEXT,
  commit_count          INTEGER,
  file_count            INTEGER,
  unavailable_reason    TEXT,
  -- D-0065 2.2: a model reading's per-finding severity and bases (canonical JSON
  -- of an array parallel to findings) and rondo's digest of the document it
  -- delivered. Both NULL on a deterministic reading. Also in
  -- LAP_READING_ADDED_COLUMNS, for a table created before them.
  graded                TEXT,
  delivered_digest      TEXT
);

CREATE INDEX IF NOT EXISTS lap_reading_by_iteration
  ON lap_reading(iteration_id, read_at_ms);

-- #70. What the person at the gate says they checked before answering it.
--
-- **Append-only, no status column, no writer that updates**: D-0022 rule 4's
-- grade, by D-0022 rule 4's two means, exactly as lap_reading above.
--
-- **Every column is the operator's word or rondo's clock, and there is no
-- column for a result.** rondo did not run what this row names and did not see
-- it run, so a verdict column here would be a place to write an outcome nobody
-- observed -- and a reader could not tell it from lap_reading's verdict, which
-- rondo did reach itself. What rondo actually knows is who typed what, and
-- when they typed it, so those are the columns and the table's name says which
-- of them is load-bearing: it holds a claim.
--
-- Not unique per iteration, for lap_reading's reason: a second answer to a
-- second gate on the same row is a later fact and not a correction of the
-- first.
CREATE TABLE IF NOT EXISTS operator_verification_claim (
  iteration_id          TEXT    NOT NULL,
  claimed_at_ms         INTEGER NOT NULL,
  actor_id              TEXT    NOT NULL,
  claim                 TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS operator_verification_claim_by_iteration
  ON operator_verification_claim(iteration_id, claimed_at_ms);

-- rondo#385 / D-0092. Which of the gate's two answers a person gave.
--
-- **Beside the gate answer and not on the iteration row.** approve and revise
-- both close a gate answered_and_forwarded, so the row's gate_outcome cannot
-- tell them apart, and a column there would be one more field a transition
-- could write. This is written by the gate walk alone, at the moment continuo
-- has accepted the answer's body, so it holds exactly the answer continuo
-- holds: a walk refused before that point writes nothing, and continuo refuses
-- a second, different body for the same gate (AnswerAlreadyRecorded).
--
-- One row per gate, so re-issuing the same answer after an interrupted walk is
-- INSERT OR IGNORE and not a second fact. Append-only, like the tables above.
CREATE TABLE IF NOT EXISTS gate_answer (
  iteration_id          TEXT    NOT NULL,
  gate_id               TEXT    NOT NULL,
  answer                TEXT    NOT NULL,
  actor_id              TEXT    NOT NULL,
  answered_at_ms        INTEGER NOT NULL,
  PRIMARY KEY (iteration_id, gate_id),
  CHECK (answer IN ('approve', 'revise'))
);

-- D-0032. The advisory record: what was proposed, what was composed from it,
-- what a person answered, what that answer was spent on, where the operator's
-- reading stopped, and what was put in front of them or kept from them.
--
-- **Seven append-only tables and no status column anywhere.** D-0022 rule 4's
-- grade is inherited exactly, and by the same means: immutability is a property
-- of the schema and of the absence of any writer that updates, not of a
-- trigger. There are no triggers in this file.
--
-- No foreign keys, for admission_refusal's reason above: this database
-- declares none at all, and adding some here would make the schema claim that
-- referential integrity is enforced somewhere it is not. What stands in their
-- place, where it matters, is a read inside the writer's own BEGIN IMMEDIATE
-- -- which is where D-0032 rule 5's refusal lives.
--
-- No indexes beyond the primary keys. Every query below is a full scan of a
-- table rondo has never yet written a row to, and an index chosen before a
-- measurement is a guess about a shape nobody has seen.

-- D-0036 rule 3. The conversation, fixed only as far as elevation reaches.
--
-- **One column, and the count is the decision rather than an unfinished
-- table.** Rule 3 fixes three properties and names the rest -- the body's type,
-- its authorship, ordering, threading, retention, and whether the surface ever
-- writes here before an operator does -- as explicitly undecided. So every
-- column that is absent is one this table is not yet allowed to choose, and the
-- task that first composes a message is who chooses them (D-0036's residuals).
--
--   1. **A message id is durable and immutable**: the primary key of an
--      append-only table with no writer that updates, which is D-0022 rule 4's
--      grade reached by D-0022 rule 4's two means. recordMessage refuses a
--      second row under an id that already exists, so the immutability is a
--      refusal a caller can observe and not only an absence of code.
--   2. **An observation is a message here**, and there is no observation table
--      anywhere in this schema. That is the one link #41 section 3's chain had
--      no home for, and proposal.elevated_from_message_id is what points at
--      it.
--   3. **A gate answer never lives here, and here it cannot**: there is no
--      column to put one in. D-0020 rule 5's constraint -- gate_transition.body
--      is the verbatim human answer, and a paraphrase in that slot records as
--      human approval -- is held by the shape rather than by a CHECK somebody
--      has to remember to write, and elevation is the first thing that could
--      have violated it by accident.
--
-- **D-0061 rule 2 widens it into the request thread**, and takes the choices
-- above on purpose: body, author_kind / author_id, in_reply_to (null opens a
-- request), at_ms (a caller clock, so a message is in CHANGE_SOURCES), bases
-- (canonical JSON of locators, non-empty on a drafter message) and asks (0/1).
-- Every one is nullable because an elevation's message, written before or
-- beside them, is still only an id; recordThreadMessage is the writer that
-- fills them, and it refuses what rule 2 refuses. Rule 3's refusals -- a gate
-- answer, a decision, a status, a plan, an agent type or a tier, an edit or a
-- deletion -- are held by the shape: no column for any of them and no writer
-- that updates.
CREATE TABLE IF NOT EXISTS conversation_message (
  message_id                  TEXT    PRIMARY KEY,
  body                        TEXT,
  author_kind                 TEXT,
  author_id                   TEXT,
  in_reply_to                 TEXT,
  at_ms                       INTEGER,
  bases                       TEXT,
  asks                        INTEGER,
  -- D-0072 rule 1: which of the two answers an answering press carried, NULL
  -- on every message that answers nothing. Nullable like the seven above and
  -- for a stronger reason -- a row written before this column cannot be told
  -- from one written after it, which is the defect (#206) rather than a gap to
  -- back-fill -- and the writer refuses a value anywhere but on an operator's
  -- reply to an ask.
  answer_outcome              TEXT
);

-- D-0022 rule 4, extended by D-0032 rules 1, 2, 3, 7 and 8.
--
-- payload and snapshot are held verbatim beside a digest of their own bytes,
-- for D-0019 rule 4's reason exactly: a digest detects that a source has moved
-- and does not hand back the rows the proposal was made from. The snapshot is
-- also what makes D-0032 rule 2 affordable -- a basis pointing into it renders
-- inline with no copy -- and it never carries a gate answer's body, whose one
-- home is continuo.
--
-- **The three CHECKs are the three properties D-0032 fixed and nothing more.**
-- candidate_contract_digest exists and is kept null (D-0022 rule 4's "null on
-- a proposal, always"), so the claim is enforced by the database rather than by
-- a sentence in a design document. derivation is non-null exactly when the
-- kind is explanation (rule 8). The two elevation columns are null together
-- (rule 7), because an observation with no elevator and an elevator with no
-- observation are each half a link.
--
-- **kind deliberately carries no CHECK.** It is a closed union whose
-- unrecognised members are refused by the *reader* (D-0022 rule 4) and, for the
-- one question that matters, by the writer of human_decision below: a kind
-- this rondo does not know is not in the approvable set, so it cannot be
-- answered. That is iteration.status's precedent, which is likewise unchecked
-- in the schema and refused at decode.
CREATE TABLE IF NOT EXISTS proposal (
  proposal_id                 TEXT    PRIMARY KEY,
  kind                        TEXT    NOT NULL,
  drafter                     TEXT    NOT NULL,
  payload                     TEXT    NOT NULL,
  proposal_digest             TEXT    NOT NULL,
  snapshot                    TEXT    NOT NULL,
  snapshot_digest             TEXT    NOT NULL,
  derivation                  TEXT,
  iteration_id                TEXT,
  supersedes_iteration_id     TEXT,
  supersedes_proposal_id      TEXT,
  predecessor_plan_digest     TEXT,
  predecessor_contract_digest TEXT,
  candidate_contract_digest   TEXT,
  agent_type_digest           TEXT,
  config_digest               TEXT,
  contract_digest             TEXT,
  continuo_revision           TEXT,
  cadenza_revision            TEXT,
  elevated_from_message_id    TEXT,
  elevated_by_actor_id        TEXT,
  created_at_ms               INTEGER NOT NULL,
  CHECK (candidate_contract_digest IS NULL),
  CHECK ((derivation IS NOT NULL) = (kind = 'explanation')),
  CHECK ((elevated_from_message_id IS NULL) = (elevated_by_actor_id IS NULL))
);

-- D-0022 rule 18. The contract the human was **shown**, written before it is
-- presented.
--
-- A proposal carries candidate *inputs*; this is the thing on the screen, and it
-- must outlive both a refusal and a crash. contract holds the fields as
-- issued so contract_digest can be recomputed rather than trusted (D-0020
-- rule 4 fact 1), and cadenza_revision records which pin composed it -- the
-- pin's mobility is a fact, having fired once already.
CREATE TABLE IF NOT EXISTS composition (
  composition_id              TEXT    PRIMARY KEY,
  proposal_id                 TEXT    NOT NULL,
  contract                    TEXT    NOT NULL,
  contract_digest             TEXT    NOT NULL,
  supersedes_contract_digest  TEXT,
  cadenza_revision            TEXT    NOT NULL,
  composed_at_ms              INTEGER NOT NULL
);

-- D-0022 rule 9 and D-0032 rules 5 and 6. What a person answered.
--
-- **outcome is why this is a row and not an absence** (D-0032 rule 6):
-- "declined" and "never answered" are different facts, and without the
-- distinction #41's inbox cannot tell what is waiting on the operator from what
-- the operator has already settled. approved is a reference into
-- composition.contract_digest and is non-null exactly on an approval -- a
-- refusal approves no digest, and a digest with no approval behind it would be
-- an issuance waiting to happen. **The reference is enforced by the writer and
-- not by a CHECK** (D-0049 rules 2 and 7): SQLite cannot state a cross-table
-- reference here, and D-0032 rule 12 fixed which three properties this schema
-- does state.
--
-- gate_id and gate_transition_seq are route G's reference to continuo's own
-- record and are null together on route S, where no gate exists. They are a
-- reference and never a copy: the body is continuo's, and A-8 gives that fact
-- exactly one home.
--
-- actor_id is the approver and recorded_by is the surface. They are two
-- columns because they are two facts, and a surface that recorded itself as the
-- approver would be the one substitution this table exists to make visible.
CREATE TABLE IF NOT EXISTS human_decision (
  decision_id                 TEXT    PRIMARY KEY,
  proposal_id                 TEXT    NOT NULL,
  outcome                     TEXT    NOT NULL,
  approved                    TEXT,
  predecessor                 TEXT,
  actor_id                    TEXT    NOT NULL,
  recorded_by                 TEXT    NOT NULL,
  gate_id                     TEXT,
  gate_transition_seq         INTEGER,
  decided_at_ms               INTEGER NOT NULL,
  CHECK (outcome IN ('approved', 'declined')),
  CHECK ((approved IS NOT NULL) = (outcome = 'approved')),
  CHECK ((gate_id IS NULL) = (gate_transition_seq IS NULL))
);

-- advisory.md 6.4 / D-0022 rule 16. One continuo transition backs at most one
-- decision.
--
-- Without it two decision rows may name one gate answer -- two surfaces, two
-- browser tabs, one person answering once -- and each could then be spent
-- independently, which is the single-use guarantee of D-0022 rule 9 defeated
-- one level above the primary key that holds it. A person answered once, so
-- there is one answer.
--
-- Partial, over the route-G rows only. Route S has no gate to name and its two
-- columns are null together, and SQLite already treats NULLs in a unique index
-- as distinct -- but the predicate is written out rather than inherited, for
-- CLAIM_INDEXES' reason: a row that names no transition claims none, and
-- several such rows are not a collision.
CREATE UNIQUE INDEX IF NOT EXISTS human_decision_gate_transition
  ON human_decision(gate_id, gate_transition_seq) WHERE gate_id IS NOT NULL;

-- advisory.md 6.3 / D-0022 rule 9. Single use is a transaction, not a check.
--
-- decision_id is the **primary key**, so a second issuance against one answer
-- collides on it and is refused by the database rather than by a check somebody
-- remembered to write -- and human_decision stays a table nothing ever
-- updates. An earlier draft set a consumed_by column on the decision, which
-- would have made "immutable" a word this schema used about a row it rewrites.
CREATE TABLE IF NOT EXISTS decision_consumption (
  decision_id                 TEXT    PRIMARY KEY,
  contract_digest             TEXT    NOT NULL,
  consumed_at_ms              INTEGER NOT NULL
);

-- D-0032 rule 9. The durable last-look mark: one row per look.
--
-- viewed_at_ms is **the bound the render's own query used**, sampled before
-- the render reads and written after it, not the clock at the end. Writing the
-- end clock would lose every row committed while the render was running: it was
-- never displayed, and its timestamp precedes the mark, so the "what changed"
-- query would omit it for ever. The failure this shape accepts is showing
-- something twice.
--
-- **Its ceiling is named rather than hidden.** A timestamp cursor is not
-- lossless: these are the *caller's* clocks, taken before the writer enters
-- BEGIN IMMEDIATE, so a writer that samples before the render's bound and
-- commits after the render's query has produced a row the operator never saw
-- and whose timestamp is already behind the mark. The upgrade path is a
-- per-table commit-ordered cursor over rowid; it is not taken now because it
-- makes this table's shape a function of the set of record kinds, and because
-- rondo has one operator, one surface and one writer at a time.
--
-- **Per-item read/unread flags are refused**: one row per look answers the same
-- question as N rows per item, and a per-item flag is a mutable column on an
-- immutable record.
CREATE TABLE IF NOT EXISTS operator_view (
  actor_id                    TEXT    NOT NULL,
  viewed_at_ms                INTEGER NOT NULL
);

-- D-0032 rule 10. Both sides of the silence, in one table.
--
-- One table rather than two because the numerator and the denominator have to
-- come from the same place: a withheld-only table makes the count of what *was*
-- put to the operator somebody else's problem, and the only candidate is
-- human_decision, which counts answers and not presentations.
--
-- subject_id is nullable because the most common withholding has nothing to
-- carry one: it was never composed into a proposal at all.
--
-- **rule_name is required on the withheld side, and it is the point of the
-- table.** The CHECK refuses a null or an empty one from any writer, including
-- one editing the file by hand; the writer below refuses a blank one and says
-- why in rondo's own words.
CREATE TABLE IF NOT EXISTS operator_attention (
  at_ms                       INTEGER NOT NULL,
  subject_kind                TEXT    NOT NULL,
  subject_id                  TEXT,
  disposition                 TEXT    NOT NULL,
  rule_name                   TEXT,
  CHECK (disposition IN ('presented', 'withheld')),
  CHECK (disposition = 'presented' OR (rule_name IS NOT NULL AND rule_name <> ''))
);

-- D-0036 rule 1. A presentation is counted once per subject, not once per
-- render.
--
-- The inbox is looked at repeatedly across gaps (#41 section 4), so counting at
-- each render makes one unanswered proposal, looked at twenty times over a
-- morning, report twenty presentations -- and D-0032 rule 10's GROUP BY stops
-- reading as "six were put to you, forty were not" the moment its numerator
-- counts renders and its denominator counts subjects.
--
-- Partial and over the presented side only, in the shape D-0023's claims
-- already use. A repeat is a **no-op and not a refusal** (the writer's
-- ON CONFLICT DO NOTHING): the invariant every presented subject has a row
-- still holds, so a re-render is not the case explain's presentedUncounted arm
-- exists to report. SQLite treating NULLs as distinct here is the behaviour
-- wanted rather than one tolerated -- the most common withholding carries no
-- subject_id at all, and those must never collide with each other.
--
-- **No backfill, and the reason is a fact about the writers rather than
-- optimism.** Creating a unique index over rows that already collide fails, and
-- both stores exec this schema on open -- so a database holding two presented
-- rows for one subject would stop opening. There is exactly one presented
-- writer (explain), and the subject_id it writes is the proposal primary key it
-- has just inserted, so a second row for one subject was never reachable: the
-- proposal insert collides first and nothing is presented. If a second writer
-- ever counts a subject it did not just create, the backfill is that change's
-- and not this one's.
--
-- **The ceiling, stated rather than hidden.** *When* a subject was first shown
-- is preserved; *how often* is not, and is not recoverable afterwards. If that
-- question ever has to be answered, this rule is what moves -- not a column
-- added beside it.
CREATE UNIQUE INDEX IF NOT EXISTS operator_attention_presented_subject
  ON operator_attention(subject_kind, subject_id) WHERE disposition = 'presented';

-- D-0066 section 1. A scope: what a person approves once, in fields a machine
-- can test (D-0064 rule 3.1).
--
-- **Immutable and append-only, with no status column** (D-0022 rule 4's
-- shape). A change is a successor row naming supersedes_scope_id (rule 1.4),
-- and "retired" is not a flag on this row but the existence of an approved
-- scope_decision on a descendant -- so there is nothing to update, and nothing
-- here ever is.
--
-- payload is held verbatim beside scope_digest, contentDigest over it, for
-- proposal.payload's reason: what is approved is the digest (rule 1.3), and a
-- reader re-derives it rather than trusting the column. bases is canonical
-- JSON too; the writer refuses a drafter row whose bases are empty (rule 1.5).
--
-- **The one CHECK is author_kind's closed pair** (D-0061 rule 2.3's voice
-- column). Every other rule -- the payload's shape, the dangling supersedes,
-- the requests and agent types that must name rows -- is a writer refusal
-- inside BEGIN IMMEDIATE, for human_decision's reason: SQLite cannot state a
-- cross-table reference here, and this schema declares no foreign keys.
CREATE TABLE IF NOT EXISTS scope (
  scope_id                    TEXT    PRIMARY KEY,
  payload                     TEXT    NOT NULL,
  scope_digest                TEXT    NOT NULL,
  supersedes_scope_id         TEXT,
  author_kind                 TEXT    NOT NULL,
  author_id                   TEXT    NOT NULL,
  bases                       TEXT    NOT NULL,
  created_at_ms               INTEGER NOT NULL,
  CHECK (author_kind IN ('operator', 'drafter'))
);

-- D-0066 section 2. A person's answer to one scope row (P1), and **never a
-- human_decision row**: that table's approved references a composed contract,
-- and a scope has none -- changing that reference is D-0049's falsifier, not a
-- column to reuse (rule 2.1).
--
-- outcome is a row on both sides for D-0032 rule 6's reason. scope_digest is
-- the digest the person was shown, and the writer refuses one that is not the
-- named row's in D-0049 rule 2's dangling-reference shape (rule 2.2).
--
-- **scope_id is UNIQUE, and that is rule 2.3 made structural**: one decision
-- per scope row. D-0047 rule 6 refuses two answers to one question; a scope row,
-- unlike a proposal, has nothing to choose among, so the database can hold it.
-- A person who declined and changes their mind approves a new row with the
-- same payload.
CREATE TABLE IF NOT EXISTS scope_decision (
  scope_decision_id           TEXT    PRIMARY KEY,
  scope_id                    TEXT    NOT NULL UNIQUE,
  scope_digest                TEXT    NOT NULL,
  outcome                     TEXT    NOT NULL,
  actor_id                    TEXT    NOT NULL,
  recorded_by                 TEXT    NOT NULL,
  decided_at_ms               INTEGER NOT NULL,
  CHECK (outcome IN ('approved', 'declined'))
);

-- D-0066 section 3. One row per act taken under an approved scope, written in
-- the act's own transaction.
--
-- **The primary key is (scope_decision_id, act_kind, subject_id)**, so the same
-- act is never recorded twice against one approval and the database refuses it
-- rather than a check (rule 3.1, decision_consumption's reason). A
-- scope_decision authorises many acts, each once (rule 5.2).
--
-- act_kind is a closed union the writer refuses outside of, and today it has
-- two writable members: admission, whose subject_id is the iteration id and
-- whose row lands in reserve()'s BEGIN IMMEDIATE beside the iteration row
-- (rule 3.2), merge_default_branch, a merge on green claimed before the
-- forge is asked, once per iteration (D-0126), gate_answer, the
-- organisation's answer claimed before the gate is walked, once per gate
-- (D-0125 rule 5), push_branch and open_pull_request, a scoped publish's
-- two legs, each claimed before it runs, once per iteration (rondo#470), and
-- triage_reading, a triage proposal whose ranking the flow host injected from,
-- claimed before the injection so its model spend counts toward the goal
-- scope's cost (rondo#469), and explanation_reading, an explainer's answer
-- proposal, claimed with the answer so its model spend counts toward the
-- approval it was asked under (D-0177). **No CHECK spells the union**: proposal.kind's
-- precedent, so that a new writable act kind changes a constant and not a table.
--
-- **Budgets are counted from these rows and never kept as counters** (rule 3.4,
-- D-0022 rule 8): laps is a COUNT, cost is a join to iteration.lap_cost_usd.
-- proposal_id names the split proposal an admitted plan came from and is null
-- for an in-scope retry (rule 3.3); it is where "decided without asking" is
-- read from, so no column is added to the iteration row (rule 3.5).
CREATE TABLE IF NOT EXISTS scope_consumption (
  scope_decision_id           TEXT    NOT NULL,
  act_kind                    TEXT    NOT NULL,
  subject_id                  TEXT    NOT NULL,
  proposal_id                 TEXT,
  consumed_at_ms              INTEGER NOT NULL,
  PRIMARY KEY (scope_decision_id, act_kind, subject_id)
);

-- D-0069 section 1. An agent type rondo holds without a paid lap: recorded from
-- an operator's plan in the transaction that writes the scope naming it, so a
-- scope's agent_types test reads an iteration row OR this row (D-0062 rule 1.2's
-- second concrete form).
--
-- **Append-only, and the digest is the primary key**: the first record of a
-- digest is the record, and a later scope naming the same digest writes nothing
-- here. agent_type_input is canonical JSON, copied byte for byte from the plan;
-- agent_type_digest is cadenza's over it, computed in src/access (D-0006), and
-- plan_digest names the plan document it was read from. A row stays behind when
-- its scope is declined (D-0069 section 1 (a)'s loss).
CREATE TABLE IF NOT EXISTS agent_type_record (
  agent_type_digest           TEXT    PRIMARY KEY,
  agent_type_input            TEXT    NOT NULL,
  plan_digest                 TEXT    NOT NULL,
  recorded_by                 TEXT    NOT NULL,
  recorded_at_ms              INTEGER NOT NULL
);

-- D-0075 rule 2.2. The plan setup composed, recorded by setup's last step
-- into the store it provisioned, so a fresh store holds its first plan without
-- anyone carrying a file. **One row per setup run, append-only**: the same
-- bytes recorded twice are two rows and the newer dates the plan. plan is
-- canonical JSON and plan_digest is over it; recorded_by is the approver.
CREATE TABLE IF NOT EXISTS setup_plan (
  setup_id                    TEXT    PRIMARY KEY,
  plan                        TEXT    NOT NULL,
  plan_digest                 TEXT    NOT NULL,
  recorded_by                 TEXT    NOT NULL,
  recorded_at_ms              INTEGER NOT NULL
);

-- D-0071 rule 3.3: at most one drafter run per thread at a time, across every
-- process that serves this store. A lease, not a record: taken before the model
-- is invoked so two hosts do not both pay for one thread, released when the
-- run's write is done, and lapsed at until_ms if its holder died holding it.
CREATE TABLE IF NOT EXISTS drafter_lease (
  request_message_id          TEXT    PRIMARY KEY,
  holder                      TEXT    NOT NULL,
  until_ms                    INTEGER NOT NULL
);

-- Where the conversation stood when a model drafter host first ran on this
-- store: messages at or before last_rowid predate the drafter, and starting a
-- host never spends a draft on them unasked. One row, written once. rowid and
-- not at_ms, because a caller's clock can step back and insertion order cannot.
CREATE TABLE IF NOT EXISTS drafter_epoch (
  id                          INTEGER PRIMARY KEY CHECK (id = 1),
  last_rowid                  INTEGER NOT NULL,
  started_at_ms               INTEGER NOT NULL
);

-- drafter_epoch's shape for D-0078's issue reader: operator messages at or
-- before last_rowid were written before a host that reads named issues first
-- ran here, and their issues are not read unasked -- a thread that ended long
-- ago does not gain the forge's words because rondo was upgraded.
CREATE TABLE IF NOT EXISTS issue_reader_epoch (
  id                          INTEGER PRIMARY KEY CHECK (id = 1),
  last_rowid                  INTEGER NOT NULL,
  started_at_ms               INTEGER NOT NULL
);

-- D-0073 rule 2.1. The lane ledger: which paths a line holds, from its
-- admission until its work lands or it ends.
--
-- **Immutable and append-only, with no status column** (D-0022 rule 4's
-- shape). A claim changes only by a successor row naming the head it
-- replaces; a successor with paths '[]' is a release (rule 4.3). A line's
-- in-force claim is the row no successor names, and there is exactly one:
-- **supersedes_claim_id is UNIQUE**, so two successors written from one stale
-- read cannot both land, and **one root per lineage** is the partial index
-- below, so two first rows cannot either. lineage_id is the lineage's first
-- iteration id (D-0030). paths is canonical JSON, sorted.
CREATE TABLE IF NOT EXISTS lane_claim (
  claim_id                    TEXT    PRIMARY KEY,
  lineage_id                  TEXT    NOT NULL,
  repository                  TEXT    NOT NULL,
  paths                       TEXT    NOT NULL,
  supersedes_claim_id         TEXT    UNIQUE,
  author_kind                 TEXT    NOT NULL,
  author_id                   TEXT    NOT NULL,
  bases                       TEXT    NOT NULL,
  created_at_ms               INTEGER NOT NULL,
  why                         TEXT,
  CHECK (author_kind IN ('operator', 'drafter'))
);
CREATE UNIQUE INDEX IF NOT EXISTS lane_claim_one_root
  ON lane_claim(lineage_id) WHERE supersedes_claim_id IS NULL;

-- D-0097 point 2.1 (a). The goal a person wrote down for one repository, as
-- numbered clauses each saying when it is unmet (point 2.2 (a)). **Append-only
-- with its date**: an edit is a new row, the newest row of a repository is its
-- goal, and a triage proposal names the goal_id it was ranked against, so what
-- a proposal was ranked against stays readable after the goal moves on.
-- clauses is canonical JSON, [{said, unmetIf}, ...] in the goal's order.
CREATE TABLE IF NOT EXISTS goal (
  goal_id                     TEXT    PRIMARY KEY,
  repository                  TEXT    NOT NULL,
  clauses                     TEXT    NOT NULL,
  written_by                  TEXT    NOT NULL,
  written_at_ms               INTEGER NOT NULL
);

-- D-0097 point 4.5 (a). A person's *not now* on one candidate of one triage
-- proposal: who, when, and which candidate. A row beside the proposal and not
-- a column on it, because a proposal row is immutable (D-0022 rule 4); it is
-- read with the proposal it names. The next reading withholds that candidate,
-- and says it was put aside.
CREATE TABLE IF NOT EXISTS triage_decline (
  decline_id                  TEXT    PRIMARY KEY,
  proposal_id                 TEXT    NOT NULL,
  candidate                   TEXT    NOT NULL,
  declined_by                 TEXT    NOT NULL,
  declined_at_ms              INTEGER NOT NULL
);

-- rondo#488. A stop the flow host met before its goal scope's first request,
-- when there is no thread to ask in. Append-only; the newest row of an
-- approval is its stop until a request is written. facts is canonical JSON,
-- {reason, ...} with what a person acts on as fields.
CREATE TABLE IF NOT EXISTS flow_stop (
  stop_id                     TEXT    PRIMARY KEY,
  scope_decision_id           TEXT    NOT NULL,
  repository                  TEXT    NOT NULL,
  facts                       TEXT    NOT NULL,
  at_ms                       INTEGER NOT NULL
);

-- rondo#487 (D-0128). The flow host's ask over a candidate's open points, and
-- the person's answer: two append-only rows, the answer beside the ask and not
-- a column on it, for triage_decline's reason. One answer per ask (its key).
-- points and answers are canonical JSON: [{point, recommendation}, ...] and
-- the answers in the same order.
CREATE TABLE IF NOT EXISTS flow_ask (
  ask_id                      TEXT    PRIMARY KEY,
  repository                  TEXT    NOT NULL,
  goal_id                     TEXT    NOT NULL,
  scope_decision_id           TEXT    NOT NULL,
  proposal_id                 TEXT    NOT NULL,
  candidate                   TEXT    NOT NULL,
  points                      TEXT    NOT NULL,
  asked_at_ms                 INTEGER NOT NULL,
  request                     TEXT,
  why                         TEXT
);

CREATE TABLE IF NOT EXISTS flow_answer (
  ask_id                      TEXT    PRIMARY KEY,
  answers                     TEXT    NOT NULL,
  answered_by                 TEXT    NOT NULL,
  answered_at_ms              INTEGER NOT NULL,
  request                     TEXT,
  why                         TEXT
);

-- rondo#490 (D-0144). A reading of English-held text in the person's
-- language, on their press: keyed by the original's digest and the language,
-- written once (the first reading stands). The original stays the record;
-- nothing else names these rows.
CREATE TABLE IF NOT EXISTS translation (
  digest                      TEXT    NOT NULL,
  language                    TEXT    NOT NULL,
  text                        TEXT    NOT NULL,
  drafter                     TEXT    NOT NULL,
  cost_usd                    REAL,
  read_at_ms                  INTEGER NOT NULL,
  PRIMARY KEY (digest, language)
);

-- D-0098 rule 3.2. A decision-record number a line was handed at admission.
--
-- **Immutable and append-only, with no status column** (lane_claim's shape).
-- A release is a successor row naming the reservation it releases in
-- releases_reservation_id and repeating its triple; a released number is a gap
-- in the record and is never handed out again (rule 3.4). **(repository,
-- record, number) is unique over every reservation row ever written**: the
-- partial index below leaves out only release rows, which repeat the triple of
-- the row they release. record is the repository-relative path the plan's
-- decision_record names; lineage_id is the lineage's first iteration id.
CREATE TABLE IF NOT EXISTS number_reservation (
  reservation_id              TEXT    PRIMARY KEY,
  repository                  TEXT    NOT NULL,
  record                      TEXT    NOT NULL,
  number                      INTEGER NOT NULL,
  lineage_id                  TEXT    NOT NULL,
  releases_reservation_id     TEXT    UNIQUE,
  bases                       TEXT    NOT NULL,
  created_at_ms               INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS number_reservation_once
  ON number_reservation(repository, record, number) WHERE releases_reservation_id IS NULL;

-- D-0098 rule 5.3. A closing lap: one redo after the review exit, under a scope
-- whose below_threshold is fix_unread, that is **not read again**.
--
-- **Immutable and append-only**, written by reserve() beside the redo's
-- scope_consumption row, both or neither. Its presence is the whole marker: the
-- model reading is skipped for iteration_id, which is what keeps the lap from
-- being a round and a further redo from being decidable (one closing lap by
-- construction). read_tip_commit is the tip the reviewer last read (the
-- predecessor's model reading), reading_read_at_ms that reading's clock, and
-- findings the canonical JSON of the below-threshold finding indexes it answers.
CREATE TABLE IF NOT EXISTS closing_lap (
  iteration_id                TEXT    PRIMARY KEY,
  predecessor_id              TEXT    NOT NULL,
  read_tip_commit             TEXT    NOT NULL,
  reading_read_at_ms          INTEGER NOT NULL,
  findings                    TEXT    NOT NULL,
  created_at_ms               INTEGER NOT NULL
);

-- rondo#284, D-0158. A person's scoped start that the lane ledger refused
-- because another line holds its files: kept here, by the iteration id its
-- form minted, and attempted again by the resident host's tick until its
-- files are free. settled_at_ms is null while it waits; outcome is 'started'
-- or rondo's own sentence for the refusal that ended the wait. The one row
-- written on a second refusal of the same form is the first.
CREATE TABLE IF NOT EXISTS held_start (
  iteration_id                TEXT    PRIMARY KEY,
  request_message_id          TEXT    NOT NULL,
  scope_decision_id           TEXT    NOT NULL,
  plan_digest                 TEXT    NOT NULL,
  repository                  TEXT    NOT NULL,
  held_at_ms                  INTEGER NOT NULL,
  settled_at_ms               INTEGER,
  outcome                     TEXT,
  -- rondo#462. The provider the waiting press chose, or NULL for the host's
  -- default: the tick that starts the wait builds the press's input from this
  -- row, so a wait that lost it would start the work on another worker.
  worker_provider             TEXT
);
`;

/**
 * The allocator's three claims, as partial unique indexes.
 *
 * **Applied after {@link migrate} rather than with {@link SCHEMA}, and the
 * order is load-bearing.** Each index names `holds_identifiers` in its `WHERE`,
 * and on a database created before D-0023 that column does not exist until the
 * migration adds it -- so creating these with the tables would fail on exactly
 * the databases the migration exists for.
 *
 * `AND <column> IS NOT NULL` in each predicate because SQLite treats NULLs as
 * distinct in a unique index but the intent is worth stating rather than
 * inheriting: a row that has not been allocated a triple yet claims no name,
 * and several such rows are not a collision.
 *
 * D-0023 rule 7. The reason these are indexes over a generated column rather
 * than three plain UNIQUE constraints is that a claim must outlive the
 * iteration that made it. A *live* row holds its triple, so no concurrent
 * iteration can be handed it. A *terminal, spent* row keeps holding it for
 * ever -- continuo's run exists, the branch exists, the worktree exists, and
 * reissuing any of those names is how a design hands a second run a branch a
 * merged pull request still owns. A *terminal, unspent* row releases it, which
 * is the one case a plain UNIQUE could not express.
 */
export const CLAIM_INDEXES = `
CREATE UNIQUE INDEX IF NOT EXISTS iteration_holds_run_id
  ON iteration(run_id) WHERE holds_identifiers IS NOT NULL AND run_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS iteration_holds_topic_branch
  ON iteration(topic_branch) WHERE holds_identifiers IS NOT NULL AND topic_branch IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS iteration_holds_workspace
  ON iteration(workspace) WHERE holds_identifiers IS NOT NULL AND workspace IS NOT NULL;
`;

/**
 * The columns a database created before the entry that added them does not
 * have.
 *
 * **This exists because rondo had no migration mechanism and now needs one.**
 * `CREATE TABLE IF NOT EXISTS` is a no-op against a table that is already
 * there, whatever its columns, so every DDL change since D-0019 would have
 * reached new databases only -- and D-0023 is the first change that adds a
 * column at all, which is why the gap had never been stepped in.
 *
 * The shape is deliberately the small one: a declarative list of columns, a
 * diff against what the table actually has, and an `ALTER TABLE ADD COLUMN` for
 * each one missing. There is no version number and no ordered directory of
 * migration files. continuo carries that machinery and is right to; rondo's
 * store is one module over one table with no down-migration and no branch in
 * its history, and a version counter would be a mechanism whose failure modes
 * exceed the thing it guards. **It is a reversible choice**: the moment a
 * second table needs a coordinated change, this becomes the wrong shape.
 *
 * **D-0030 is the second entry to add a column, and it is the evidence for that
 * paragraph rather than a strain on it.** `supersedes_iteration_id` is one
 * nullable column on the same table, needing no back-fill -- a database written
 * before it holds no revision it could record, because `revise` had nowhere to
 * write one -- so the list grows by a line and the mechanism does not grow at
 * all. That is what D-0027 rule 9 was waiting for when it deferred the lineage
 * "to the entry that adds a migration to the store".
 *
 * **`pragma_table_xinfo` rather than `pragma_table_info`, and that is not a
 * preference.** `table_info` does not list generated columns at all, so a diff
 * taken against it would try to add `live`, `occupying` and
 * `holds_identifiers` on every open and fail with `duplicate column name` on
 * the second one. `table_xinfo` lists them, marked `hidden = 2`.
 *
 * A `VIRTUAL` generated column can be added by `ALTER TABLE`; a `STORED` one
 * cannot, portably. All three of rondo's are `VIRTUAL`.
 */
const ADDED_COLUMNS = Object.freeze({
  topic_branch: "TEXT",
  workspace: "TEXT",
  identifiers_spent: "INTEGER NOT NULL DEFAULT 0",
  supersedes_iteration_id: "TEXT",
  // D-0061 rule 4: nullable and no back-fill, for supersedes_iteration_id's
  // reason -- no row written before it could have named a request.
  request_message_id: "TEXT",
  permission_denials: "TEXT",
  // D-0046's three, and the third entry to add a column: nullable, no
  // back-fill, and nothing a database written before them could have recorded
  // -- rondo read none of the three until this entry, so an existing row's null
  // is the truth about it rather than a gap to fill.
  lap_cost_usd: "REAL",
  lap_turns: "INTEGER",
  lap_duration_ms: "INTEGER",
  // rondo#348, and the fourth entry to add a column to this table: nullable,
  // no back-fill, for D-0046's reason exactly -- the interpreter dropped the
  // kind before it wrote the row, so an existing row's null is the truth about
  // it rather than a gap something could fill.
  failure_kind: "TEXT",
  // continuo D-1112: nullable, no back-fill -- a row written before it was
  // read from the transcript at review time, which this column replaces.
  lap_commands: "TEXT",
  // D-0121: nullable, no back-fill -- no lap before it was sent with a cap.
  lap_budget_cap_usd: "REAL",
  // rondo#286 (D-0153): nullable, no back-fill -- no publish before it
  // recorded where it pushed, so a null is the truth about such a row and the
  // landing reading answers `undetermined` over it.
  published_remote: "TEXT",
  // rondo#462: nullable, no back-fill -- no lap before it recorded which
  // worker ran it, so a null is the truth about such a row and the page says
  // it is unknown rather than naming today's default over yesterday's lap.
  worker_provider: "TEXT",
  // rondo#462: nullable, no back-fill -- it says what `worker_provider` is,
  // and a row with no provider has no answer to give.
  worker_provider_chosen: "INTEGER",
  // D-0139: nullable, no back-fill -- no lap before it recorded its processes.
  driver_host: "TEXT",
  driver_pid: "INTEGER",
  lap_pid: "INTEGER",
  occupying: GENERATED_COLUMNS.occupying,
  holds_identifiers: GENERATED_COLUMNS.holds_identifiers,
});

/**
 * {@link ADDED_COLUMNS} for the second table to grow one: `lap_reading`'s two
 * D-0065 columns. Nullable and without back-fill, for D-0046's reason: no row
 * written before them was a model reading, so an existing row's NULL is the
 * truth about it.
 */
const LAP_READING_ADDED_COLUMNS = Object.freeze({
  graded: "TEXT",
  delivered_digest: "TEXT",
});

/**
 * D-0061 rule 2's seven columns, for a `conversation_message` created while it
 * was one column. No back-fill: an existing row is an elevation's id and has
 * no body, author or clock to recover.
 *
 * **`answer_outcome` (D-0072) is the one column whose absence of a back-fill
 * changes behaviour, and it is deliberate.** A reply written before this entry
 * released the hold on its ask whatever it said, which is #206; nothing on the
 * row says whether the person meant "carry on" or "stop", so no back-fill could
 * be honest. Those replies stay NULL and their asks re-open, which stops the
 * lines they held rather than admitting work under a reading nobody recorded --
 * fail closed, in D-0047 rule 7's direction. A person ends such a stop by
 * answering it once more, now with an outcome.
 */
export const CONVERSATION_ADDED_COLUMNS = Object.freeze({
  body: "TEXT",
  author_kind: "TEXT",
  author_id: "TEXT",
  in_reply_to: "TEXT",
  at_ms: "INTEGER",
  bases: "TEXT",
  asks: "INTEGER",
  answer_outcome: "TEXT",
});

/**
 * rondo#492: the request's words on the flow's ask as asked and on its answer
 * as pressed. Nullable, no back-fill: an ask before it asked no words, and its
 * answer edited none.
 */
export function addFlowWords(connection: StoreConnection): void {
  addMissingColumns(connection, "flow_ask", { request: "TEXT", why: "TEXT" });
  addMissingColumns(connection, "flow_answer", { request: "TEXT", why: "TEXT" });
}

/** Add every column of `columns` that `table` lacks, inside the caller's transaction. */
export function addMissingColumns(
  connection: StoreConnection,
  table: string,
  columns: Readonly<Record<string, string>>,
): readonly string[] {
  const present = new Set(
    connection
      .prepare(`SELECT name FROM pragma_table_xinfo('${table}')`)
      .all()
      .map((row) => String((row as SqlRow)["name"])),
  );
  const added: string[] = [];
  for (const [column, declaration] of Object.entries(columns)) {
    if (!present.has(column)) {
      connection.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${declaration}`);
      added.push(column);
    }
  }
  return added;
}

/**
 * Bring an existing database up to the schema above.
 *
 * Idempotent, and safe on a database that has just been created by
 * {@link SCHEMA}: every column is already there, so the diff is empty.
 *
 * **Dropping `iteration_one_live` is a decision's consequence and not a
 * housekeeping step.** It is the index D-0019 rule 10 made the single-flight
 * invariant *the database's*, and on an existing database this line is the
 * exact moment that stops being true: afterwards the bound is enforced by
 * `reserve()`'s counted refusal, in this process, and an insert that does not
 * go through it is unopposed. Leaving the index in place instead was not an
 * option -- it refuses a second live row unconditionally, so an operator's
 * existing database would have silently ignored `maxLive` and kept behaving as
 * if D-0023 had not landed.
 *
 * **It is reversible only while the bound it replaced would still hold.**
 * `CREATE UNIQUE INDEX iteration_one_live` can be re-run to restore the
 * database-side guarantee, and it will succeed exactly when at most one
 * non-terminal row exists at that moment. Once a host has actually admitted a
 * second live iteration, recreating the index fails until the operator ends one
 * of them; the migration is reversible, the history it enabled is not.
 */
export function migrate(connection: StoreConnection): void {
  // **One transaction around the whole upgrade, and that is not tidiness.**
  // `ALTER TABLE` commits on its own, so a process that stopped between adding
  // `identifiers_spent` and back-filling it would leave a database whose
  // columns are present and whose claims are wrong -- and the next open would
  // find nothing missing, skip the back-fill for ever, and quietly release
  // every spent legacy claim. `BEGIN IMMEDIATE` also makes two first opens
  // race for the write lock rather than for the `ALTER`.
  connection.exec("BEGIN IMMEDIATE");
  try {
    if (addMissingColumns(connection, "iteration", ADDED_COLUMNS).includes("identifiers_spent")) {
      backfill(connection);
    }
    addMissingColumns(connection, "lap_reading", LAP_READING_ADDED_COLUMNS);
    addMissingColumns(connection, "conversation_message", CONVERSATION_ADDED_COLUMNS);
    addMissingColumns(connection, "admission_refusal", { holders: "TEXT" });
    // rondo#462: nullable, no back-fill -- no wait before it chose a provider.
    addMissingColumns(connection, "held_start", { worker_provider: "TEXT" });
    // rondo#509: nullable, no back-fill -- no claim before it said why.
    addMissingColumns(connection, "lane_claim", { why: "TEXT" });
    addFlowWords(connection);
    connection.exec("DROP INDEX IF EXISTS iteration_one_live");
    connection.exec("COMMIT");
  } catch (error) {
    try {
      connection.exec("ROLLBACK");
    } catch {
      // The transaction was already resolved, or the connection is gone.
    }
    throw error;
  }
}

/**
 * Give every pre-D-0023 row the identifiers and the claim it actually had.
 *
 * **The order of these four statements is the whole of their correctness.**
 * Before D-0023 the run id was written by the transition into `admitting` and
 * by nothing earlier, so `run_id IS NOT NULL` on the *row* is exactly "this
 * iteration spent its identifiers". That signal has to be read before anything
 * writes a run id from the plan, or it is destroyed -- so `identifiers_spent`
 * is set first, and the three columns are filled afterwards.
 *
 * The values come from the stored plan, because that is where they were: the
 * triple was the operator's and travelled in the plan payload, and the row
 * carried only the run id and only once it was admitted. A legacy row whose
 * branch and workspace stayed NULL would sit outside all three claim indexes,
 * so a later iteration could be handed a branch git already has -- which is the
 * failure the indexes exist to prevent, reintroduced by the upgrade itself.
 *
 * `json_extract` returns NULL for a plan that does not carry the key, which
 * leaves the column NULL and the row out of the indexes: correct, because a row
 * whose plan never named a branch never claimed one.
 *
 * **`json_valid` is the guard, and a corrupt row must not brick the store.**
 * `json_extract` raises on malformed JSON, and one damaged historical row would
 * otherwise stop the whole database opening -- including for `abandon()`, which
 * is the one path that exists to end exactly such a row and which deliberately
 * leaves its plan bytes untouched. So an unreadable plan yields no back-fill
 * for that row and no error: it keeps NULL identifiers, stays outside the claim
 * indexes, and remains reachable by the recovery that was built for it.
 */
function backfill(connection: StoreConnection): void {
  connection.exec(
    "UPDATE iteration SET identifiers_spent = 1 WHERE run_id IS NOT NULL AND identifiers_spent = 0",
  );
  for (const [column, key] of [
    ["run_id", "$.run_id"],
    ["topic_branch", "$.topic_branch"],
    ["workspace", "$.workspace"],
  ] as const) {
    connection.exec(
      `UPDATE iteration SET ${column} = json_extract(plan, '${key}') ` +
        `WHERE ${column} IS NULL AND json_valid(plan)`,
    );
  }
}

/**
 * Every table a change can land in, beside how it spells its own identity and
 * its own clock.
 *
 * Written once, as data, because {@link AdvisoryRecord.changedSince} is a
 * `UNION ALL` over all of them and a list maintained in prose beside a list
 * maintained in SQL is two lists. The rule for membership is **total rather
 * than curated**: every append-only table in this schema that carries a
 * caller-clock timestamp is here, so a record kind added later is one row here
 * rather than a judgement about whether the operator would want to see it.
 *
 * **`operator_view` is the one exclusion, and it is the cursor itself.** A mark
 * is written by the render at the end of the render, so including it would make
 * every look report itself as a change the operator has not seen.
 *
 * `conversation_message` joined when D-0061 rule 2.5 gave a message a clock,
 * which was D-0036 rule 3's open question answered on purpose.
 *
 * `iteration` contributes `updated_at_ms` rather than `created_at_ms`: it is
 * the one mutable row in the store, and what changed about it is when it last
 * moved.
 */
export const CHANGE_SOURCES = Object.freeze([
  { kind: "iteration", table: "iteration", id: "id", at: "updated_at_ms" },
  {
    kind: "admission_refusal",
    table: "admission_refusal",
    id: "CAST(rowid AS TEXT)",
    at: "refused_at_ms",
  },
  { kind: "lap_reading", table: "lap_reading", id: "iteration_id", at: "read_at_ms" },
  {
    kind: "operator_verification_claim",
    table: "operator_verification_claim",
    id: "iteration_id",
    at: "claimed_at_ms",
  },
  { kind: "gate_answer", table: "gate_answer", id: "iteration_id", at: "answered_at_ms" },
  { kind: "proposal", table: "proposal", id: "proposal_id", at: "created_at_ms" },
  { kind: "composition", table: "composition", id: "composition_id", at: "composed_at_ms" },
  { kind: "human_decision", table: "human_decision", id: "decision_id", at: "decided_at_ms" },
  {
    kind: "decision_consumption",
    table: "decision_consumption",
    id: "decision_id",
    at: "consumed_at_ms",
  },
  { kind: "operator_attention", table: "operator_attention", id: "subject_id", at: "at_ms" },
  // D-0061 rule 2.5: a thread message carries a clock, so it is a change. An
  // elevation's id-only row has a NULL at_ms and never matches the bound.
  {
    kind: "conversation_message",
    table: "conversation_message",
    id: "message_id",
    at: "at_ms",
  },
  // D-0066's three tables, by the membership rule above: each is append-only
  // and carries a caller clock. A consumption is identified by its subject (the
  // iteration it admitted), which is the id a reader follows.
  { kind: "scope", table: "scope", id: "scope_id", at: "created_at_ms" },
  { kind: "scope_decision", table: "scope_decision", id: "scope_decision_id", at: "decided_at_ms" },
  {
    kind: "scope_consumption",
    table: "scope_consumption",
    id: "subject_id",
    at: "consumed_at_ms",
  },
  {
    kind: "agent_type_record",
    table: "agent_type_record",
    id: "agent_type_digest",
    at: "recorded_at_ms",
  },
  { kind: "setup_plan", table: "setup_plan", id: "setup_id", at: "recorded_at_ms" },
  { kind: "lane_claim", table: "lane_claim", id: "claim_id", at: "created_at_ms" },
  // rondo#284: a held start's wait, and its end, which redraws the scope
  // screen's start where the tick's attempt was refused for another reason.
  // Mutable like `iteration`, so it contributes its latest clock.
  {
    kind: "held_start",
    table: "held_start",
    id: "iteration_id",
    at: "COALESCE(settled_at_ms, held_at_ms)",
  },
] as const);

/**
 * {@link AdvisoryRecord.changedSince}'s one statement, built from
 * {@link CHANGE_SOURCES}.
 *
 * The only interpolation is table and column names chosen from the frozen tuple
 * above -- never anything a caller supplies -- which is the same licence
 * `TERMINAL_SQL_LITERALS` takes and under the same rule: `tMs` is a bound
 * parameter, once per branch.
 */
export const CHANGES_SINCE_SQL = `${CHANGE_SOURCES.map(
  (source) =>
    `SELECT '${source.kind}' AS kind, ${source.id} AS id, ${source.at} AS at_ms ` +
    `FROM ${source.table} WHERE ${source.at} >= ?`,
).join(" UNION ALL ")} ORDER BY at_ms, kind, id`;
