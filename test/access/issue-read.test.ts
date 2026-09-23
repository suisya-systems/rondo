/**
 * D-0078: rondo reads an issue a person's message names, outside the lap,
 * records what it read in the thread as a `forge` message, and quotes it into
 * the prompt -- over a real store and a fake `gh`.
 *
 * What is held: which references a message names; a read is the forge's text
 * byte for byte, and a failure says whose it is; over the bound is not read;
 * the reader answers every reference once and leaves the past alone; the
 * drafter waits for the reads; and the prompt ends with rondo's quote.
 */
import { expect, test } from "vitest";

import { withNamedIssues } from "../../src/access/cli.js";
import { definitionOfDone } from "../../src/access/done.js";
import { drafterHost } from "../../src/access/drafter-host.js";
import type { CommandOutcome } from "../../src/access/forge.js";
import {
  type BareIssueRepository,
  bareIssueRepository,
  type ForgeIssueRead,
  forgeBody,
  ISSUE_BOUND_BYTES,
  ISSUE_READER,
  ISSUES_QUOTE_OPENING,
  issueReader,
  issuesQuote,
  namedIssues,
  parseForgeRead,
  readNamedIssue,
} from "../../src/access/issue-read.js";
import type { HeldPlan } from "../../src/access/model-draft/host.js";
import { readRunPlan } from "../../src/refrain/plan.js";
import type { StoredScope } from "../../src/store/records.js";
import { planDocument, world } from "./fixtures/drafter.js";

type World = Awaited<ReturnType<typeof world>>;

const ran = (stdout: string, status = 0, stderr = ""): CommandOutcome => ({
  commandLine: "gh api",
  status,
  signal: null,
  stdout,
  stderr,
  spawnError: null,
});

/** `gh api`'s two answers for one issue, with bytes a trim or a reflow would change. */
const ISSUE = {
  number: 237,
  title: "Lap 10: the worker cannot read issues",
  state: "open",
  html_url: "https://github.com/suisya-systems/rondo/issues/237",
  user: { login: "ada" },
  created_at: "2026-09-01T00:00:00Z",
  body: "  Item one.\r\n\nItem two -- 日本語も。\n",
};
const COMMENTS = [
  { author: "bob", at: "2026-09-02T00:00:00Z", body: "Items one and two are done." },
  { author: "cy", at: "2026-09-03T00:00:00Z", body: null },
];

function fakeForge(
  answer: ForgeIssueRead = async () => ({
    issue: ran(JSON.stringify(ISSUE)),
    comments: ran(COMMENTS.map((c) => JSON.stringify(c)).join("\n")),
  }),
) {
  const asked: Parameters<ForgeIssueRead>[0][] = [];
  const read: ForgeIssueRead = async (request) => {
    asked.push(request);
    return await answer(request);
  };
  return { read, asked };
}

function readerOver(
  w: World,
  read: ForgeIssueRead,
  bareRepository: (requestMessageId: string) => BareIssueRepository = () => ({ repo: "o/r" }),
  now: () => number = () => 50_000,
) {
  let n = 0;
  let reads = 0;
  const reader = issueReader({
    record: w.record,
    read,
    bareRepository: async (requestMessageId) => bareRepository(requestMessageId),
    now,
    mintId: () => {
      n += 1;
      return `forge-${String(n)}`;
    },
    log: () => undefined,
    onRead: () => {
      reads += 1;
    },
  });
  return { reader, onReads: () => reads };
}

async function forgeMessages(w: World) {
  const read = await w.record.threadMessages();
  if (read.kind !== "read") throw new Error(read.reason);
  return read.messages.filter((m) => m.authorKind === "forge");
}

test("the references a person writes are found, each once, and nothing that only looks like one", () => {
  expect(
    namedIssues(
      "Fix #237 and o/r#12, see https://github.com/x/y/issues/5#issuecomment-1 and " +
        "https://ghe.example/a/b/pull/9. Not abc#1, &#39;, # 4 or #0. Again #237.",
    ),
  ).toEqual([
    { named: "#237", host: null, repo: null, number: 237 },
    { named: "o/r#12", host: null, repo: "o/r", number: 12 },
    { named: "https://github.com/x/y/issues/5", host: "github.com", repo: "x/y", number: 5 },
    { named: "https://ghe.example/a/b/pull/9", host: "ghe.example", repo: "a/b", number: 9 },
  ]);
});

test("a read holds the title, the state, the body and every comment byte for byte (section 2.2)", async () => {
  const { read, asked } = fakeForge();
  const got = await readNamedIssue(namedIssues("#237")[0]!, "o/r", read, 7);
  expect(asked).toEqual([{ host: null, repo: "o/r", number: 237 }]);
  if (!("read" in got)) throw new Error(JSON.stringify(got));
  expect(got.read).toEqual({
    url: ISSUE.html_url,
    number: 237,
    pullRequest: false,
    title: ISSUE.title,
    state: "open",
    author: "ada",
    openedAt: ISSUE.created_at,
    body: ISSUE.body,
    comments: [
      { author: "bob", at: COMMENTS[0]!.at, body: "Items one and two are done." },
      { author: "cy", at: COMMENTS[1]!.at, body: "" },
    ],
  });
  // What the row holds reads back as exactly what was read.
  expect(parseForgeRead(forgeBody(got))).toEqual(got);
});

test("a read that fails says whose failure it is, and over the bound is not read at all (sections 2.3, 4.2)", async () => {
  const ref = namedIssues("#5")[0]!;
  const failing = (outcome: CommandOutcome) =>
    fakeForge(async () => ({ issue: outcome, comments: null })).read;
  const why = async (outcome: CommandOutcome) => {
    const got = await readNamedIssue(ref, "o/r", failing(outcome), 1);
    return "failed" in got ? got.failed.why : "read";
  };
  expect(await why({ ...ran(""), status: null, spawnError: "spawn gh ENOENT" })).toBe("no_gh");
  expect(await why(ran("", 4, "To get started with GitHub CLI, please run:  gh auth login"))).toBe(
    "signed_out",
  );
  expect(await why(ran("", 1, "gh: Not Found (HTTP 404)"))).toBe("missing");
  expect(await why(ran("", 1, "gh: Forbidden (HTTP 403)"))).toBe("refused");
  expect(await why(ran("", 1, "error connecting to api.github.com"))).toBe("failed");
  // A bare `#N` with no forge repository is read nowhere: the first residual.
  const nowhere = await readNamedIssue(ref, null, fakeForge().read, 1);
  expect("failed" in nowhere && nowhere.failed.why).toBe("no_repo");

  const long = fakeForge(async () => ({
    issue: ran(JSON.stringify({ ...ISSUE, body: "x".repeat(ISSUE_BOUND_BYTES) })),
    comments: ran(""),
  }));
  const over = await readNamedIssue(ref, "o/r", long.read, 1);
  expect("failed" in over && over.failed.why).toBe("too_long");
  expect(forgeBody(over)).not.toContain("xxxx");
});

test("the reader answers every reference once, in reply to the message, and leaves the past alone (sections 2.4, 3.1)", async () => {
  const w = await world();
  await w.say("old", "Fix #1.", null, 500);
  const { read, asked } = fakeForge();
  const { reader, onReads } = readerOver(w, read);
  // The first look fixes the reader's epoch, as a host's first scan does.
  expect(await reader.unread([])).toEqual(new Map());
  await w.say("r1", "Fix #237, as o/r#237 says.", null, 1_000);
  const names = Array.from({ length: 7 }, (_, i) => `#${String(i + 10)}`).join(" ");
  await w.say("r2", `Also ${names}.`, "r1", 2_000);
  reader.kick();
  await reader.idle();

  const said = await forgeMessages(w);
  expect(said.every((m) => m.authorId === ISSUE_READER && m.bases.length === 0)).toBe(true);
  expect(said.map((m) => [m.inReplyTo, parseForgeRead(m.body)?.named])).toEqual([
    ["r1", "#237"],
    ["r1", "o/r#237"],
    ...Array.from({ length: 7 }, (_, i) => ["r2", `#${String(i + 10)}`]),
  ]);
  // Five of r2's seven are read; the two past the bound are answered, unread.
  expect(asked).toHaveLength(2 + 5);
  expect(
    said.slice(2).map((m) => {
      const got = parseForgeRead(m.body);
      return got !== null && "failed" in got ? got.failed.why : "read";
    }),
  ).toEqual(["read", "read", "read", "read", "read", "too_many", "too_many"]);
  expect(onReads()).toBe(1);

  // Nothing is left to read, and a second scan reads nothing.
  const thread = await w.record.threadMessages();
  if (thread.kind !== "read") throw new Error(thread.reason);
  expect(await reader.unread(thread.messages)).toEqual(new Map());
  reader.kick();
  await reader.idle();
  expect(asked).toHaveLength(7);
});

test("the store takes a read only in reply to an operator message (section 3.1)", async () => {
  const w = await world();
  await w.say("r1", "Fix #237.", null, 1_000);
  const forge = (messageId: string, inReplyTo: string | null) =>
    w.record.recordThreadMessage({
      messageId,
      body: "{}",
      authorKind: "forge",
      authorId: ISSUE_READER,
      inReplyTo,
      atMs: 2_000,
      bases: [],
      asks: false,
    });
  expect((await forge("f-opens", null)).kind).toBe("refused");
  expect((await forge("f-1", "r1")).kind).toBe("recorded");
  expect((await forge("f-on-forge", "f-1")).kind).toBe("refused");
});

test("the drafter waits until every named issue has its read, and is then handed it (section 3.3)", async () => {
  const w = await world();
  const { read } = fakeForge();
  const { reader } = readerOver(w, read);
  await reader.unread([]);
  await w.say("r1", "Fix #237.", null, 1_000);
  const handed: string[] = [];
  const drafter = drafterHost({
    store: w.store,
    record: w.record,
    now: () => 60_000,
    language: null,
    log: () => undefined,
    mintId: (kind) => `${kind}-${String(handed.length)}-${String(Math.random()).slice(2)}`,
    runDrafter: async (_row, document) => {
      handed.push(document);
      return { kind: "failed", reason: "not under test" };
    },
    issuesUnread: reader.unread,
  });
  drafter.kick();
  await drafter.idle();
  expect(handed).toEqual([]);

  reader.kick();
  await reader.idle();
  drafter.kick();
  await drafter.idle();
  expect(handed).toHaveLength(1);
  expect(handed[0]).toContain("by forge");
  expect(handed[0]).toContain(JSON.stringify(ISSUE.title));
});

test("the prompt ends with rondo's quote of every read, byte for byte, after the request's own words (section 3.4)", async () => {
  const w = await world();
  const { reader } = readerOver(
    w,
    fakeForge(async (request) =>
      request.number === 404
        ? { issue: ran("", 1, "gh: Not Found (HTTP 404)"), comments: null }
        : {
            issue: ran(JSON.stringify(ISSUE)),
            comments: ran(COMMENTS.map((c) => JSON.stringify(c)).join("\n")),
          },
    ).read,
  );
  await reader.unread([]);
  await w.say("r1", "Fix #237 and #404.", null, 1_000);
  reader.kick();
  await reader.idle();

  const planned = readRunPlan({ ...planDocument(), prompt: "Fix #237 and #404." });
  if (planned.kind !== "planned") throw new Error(planned.reason);
  const quoted = await withNamedIssues(w.record, "r1", planned.plan);
  if ("refusal" in quoted) throw new Error(quoted.refusal);
  // After the request and its definition of done (rondo#377), which the quote follows.
  expect(
    quoted.prompt.startsWith(
      `Fix #237 and #404.${definitionOfDone([], planned.plan.turnTimeoutMs)}${ISSUES_QUOTE_OPENING}`,
    ),
  ).toBe(true);
  expect(quoted.prompt).toContain(
    `Title: ${ISSUE.title}\nOpened by ada at ${ISSUE.created_at}:\n${ISSUE.body}`,
  );
  expect(quoted.prompt).toContain(
    `--- comment by bob at ${COMMENTS[0]!.at}:\nItems one and two are done.`,
  );
  expect(quoted.prompt).toContain(
    "=== #404 was named in the request and could not be read, so there is nothing of it here: work from the request.",
  );
  // Nothing else of the plan moves.
  expect({ ...quoted, prompt: "" }).toEqual({ ...planned.plan, prompt: "" });

  const thread = await w.record.threadMessages();
  if (thread.kind !== "read") throw new Error(thread.reason);
  // A request that names nothing is prompted as before.
  expect(issuesQuote(thread.messages, "no-such-request")).toBe("");
});

test("an issue named again is given as of its latest read, and the reads of one request stay under their bound together (sections 2.3, 2.4)", async () => {
  const w = await world();
  let fail = false;
  const big = "y".repeat(40_000);
  const { reader } = readerOver(
    w,
    fakeForge(async (request) =>
      fail && request.number === 237
        ? { issue: ran("", 1, "gh: Not Found (HTTP 404)"), comments: null }
        : {
            issue: ran(
              JSON.stringify({ ...ISSUE, number: request.number, body: `${big}${request.number}` }),
            ),
            comments: ran(""),
          },
    ).read,
  );
  await reader.unread([]);
  // Two 40 000-byte reads fit together; the third would take the request past its bound.
  await w.say("r1", "Fix #237, #51 and #62.", null, 1_000);
  reader.kick();
  await reader.idle();
  let thread = await w.record.threadMessages();
  if (thread.kind !== "read") throw new Error(thread.reason);
  let quote = issuesQuote(thread.messages, "r1");
  expect(quote).toContain(`${big}237`);
  expect(quote).toContain(`${big}51`);
  expect(quote).not.toContain(`${big}62`);
  expect(quote).toContain("=== #62 was named in the request and could not be read");

  // Named again, and not readable now: the worker is not given the old read.
  fail = true;
  await w.say("r1-again", "Look at #237 again.", "r1", 2_000);
  reader.kick();
  await reader.idle();
  thread = await w.record.threadMessages();
  if (thread.kind !== "read") throw new Error(thread.reason);
  quote = issuesQuote(thread.messages, "r1");
  expect(quote).not.toContain(`${big}237`);
  expect(quote).toContain("=== #237 was named in the request and could not be read");

  // A prompt that cannot reach continuo whole is refused, and never cut.
  const planned = readRunPlan({ ...planDocument(), prompt: "z".repeat(130_000) });
  if (planned.kind !== "planned") throw new Error(planned.reason);
  expect(await withNamedIssues(w.record, "r1", planned.plan)).toMatchObject({
    refusal: expect.stringContaining("nothing was cut"),
  });
});

test("a lap is not admitted while an issue its request names is still to be read (section 3.3)", async () => {
  const w = await world();
  const { reader } = readerOver(w, fakeForge().read);
  await reader.unread([]);
  await w.say("r1", "Fix the button.", null, 1_000);
  await w.say("r1-more", "And #237.", "r1", 2_000);
  await w.say("other", "Elsewhere, #9.", null, 3_000);
  const planned = readRunPlan({ ...planDocument(), prompt: "Fix the button." });
  if (planned.kind !== "planned") throw new Error(planned.reason);
  expect(await withNamedIssues(w.record, "r1", planned.plan)).toEqual({
    refusal:
      "rondo has not yet read #237, which this request names; nothing was admitted, and it can " +
      "start once they are read",
  });
  reader.kick();
  await reader.idle();
  const quoted = await withNamedIssues(w.record, "r1", planned.plan);
  expect("prompt" in quoted && quoted.prompt).toContain(ISSUE.title);
});

/** A held plan, as `bareIssueRepository` reads one: where it runs, and its slug. */
const heldIn = (repository: string, forgeRepository: string | null): HeldPlan =>
  ({ repository, forgeRepository }) as unknown as HeldPlan;

/** Ports over the rows: the plans rondo holds, the workspaces its scopes name. */
const rowsHolding = (
  held: readonly HeldPlan[],
  scoped: readonly (readonly string[])[],
  hostRepo: string | null = null,
) => ({
  record: {
    // One scope per group, each replacing and outliving the one before it.
    scopesFor: async () =>
      scoped.map((repositories, index) => ({
        scopeId: `s${String(index)}`,
        supersedesScopeId: index === 0 ? null : `s${String(index - 1)}`,
        createdAtMs: 100 + index,
        payload: { workspaces: repositories.map((repository) => ({ repository })) },
      })) as unknown as readonly StoredScope[],
  },
  held: async () => held,
  hostRepo,
});

/** The reference was named before any scope above, which is the usual order. */
const NAMED_AT = 50;

test("a bare #N is read in the repository of the plan its request is drafted from (D-0081 rule 3.4)", async () => {
  const a = heldIn("/srv/a", "o/a");
  const b = heldIn("/srv/b", "o/b");

  // One repository in play: read there, whatever this host was started with.
  expect(await bareIssueRepository(rowsHolding([a], [], "o/host"), "r1", NAMED_AT)).toEqual({
    repo: "o/a",
  });
  // Two, and nothing has said which: the read waits for the person (rule 2.4).
  expect(await bareIssueRepository(rowsHolding([a, b], [], "o/host"), "r1", NAMED_AT)).toEqual({
    disputed: true,
  });
  // A scope for the request -- the drafter's split, or the person's own -- has
  // said which workspaces the work runs in, so the other plan is out of play.
  expect(await bareIssueRepository(rowsHolding([a, b], [["/srv/b"]]), "r1", NAMED_AT)).toEqual({
    repo: "o/b",
  });
  // **Only the scope in force**: one the person narrowed afterwards is what
  // stands, and the wider one it replaced does not keep the read waiting.
  expect(
    await bareIssueRepository(
      rowsHolding([a, b], [["/srv/a", "/srv/b"], ["/srv/b"]]),
      "r1",
      NAMED_AT,
    ),
  ).toEqual({ repo: "o/b" });
  // Two plans of one repository are one answer, not a dispute.
  expect(
    await bareIssueRepository(rowsHolding([a, heldIn("/srv/a2", "o/a")], []), "r1", NAMED_AT),
  ).toEqual({
    repo: "o/a",
  });
  // No plan in play names a slug: the host's `--repo` answers, as it does for
  // every store set up before the slug moved onto the plan (rule 6.3).
  expect(
    await bareIssueRepository(rowsHolding([heldIn("/srv/a", null)], [], "o/host"), "r1", NAMED_AT),
  ).toEqual({ repo: "o/host" });
  expect(await bareIssueRepository(rowsHolding([], []), "r1", NAMED_AT)).toEqual({ repo: null });
  // **A plan carrying no slug is the host's `--repo`, and is counted as one**:
  // beside a second repository's plan that is two answers, not agreement.
  expect(
    await bareIssueRepository(rowsHolding([heldIn("/srv/a", null), b], [], "o/a"), "r1", NAMED_AT),
  ).toEqual({ disputed: true });
  // The same plan beside one naming what the host names is still one answer.
  expect(
    await bareIssueRepository(rowsHolding([heldIn("/srv/a", null), a], [], "o/a"), "r1", NAMED_AT),
  ).toEqual({ repo: "o/a" });
  // **With no `--repo` either, such a plan's repository is simply not known**,
  // and standing beside one that is known that is two answers, not agreement.
  expect(
    await bareIssueRepository(rowsHolding([heldIn("/srv/a", null), b], []), "r1", NAMED_AT),
  ).toEqual({ disputed: true });

  // **Setup run again for a repository it already recorded is one answer.** An
  // older plan of that repository naming no slug says nothing about it, which
  // is how a store set up before D-0081 comes to name its slug (rule 6.2).
  expect(
    await bareIssueRepository(rowsHolding([heldIn("/srv/a", null), a], []), "r1", NAMED_AT),
  ).toEqual({ repo: "o/a" });
  // Two slugs recorded for one repository is a conflict, not a record of it.
  expect(
    await bareIssueRepository(rowsHolding([a, heldIn("/srv/a", "o/other")], []), "r1", NAMED_AT),
  ).toEqual({ disputed: true });

  // **A scope older than the message that named the issue settles nothing.**
  // A person replying in this thread with work in another repository is
  // answered on the reader's own pass, before any draft over that reply can
  // exist, so the old scope would have the new reference read in the old
  // repository and recorded as read for good.
  expect(await bareIssueRepository(rowsHolding([a, b], [["/srv/a"]]), "r1", 1_000)).toEqual({
    disputed: true,
  });
});

test("a bare #N still in dispute waits for the person: it holds the lap's door and not the drafter (D-0081 rules 2.4, 3.4)", async () => {
  const w = await world();
  const { read, asked } = fakeForge();
  let disputed = true;
  // One clock for both, so what was written before what is what the rows say.
  let clock = 10_000;
  const tick = () => (clock += 1_000);
  const { reader } = readerOver(
    w,
    read,
    () => (disputed ? { disputed: true } : { repo: "o/r" }),
    tick,
  );
  await reader.unread([]);
  await w.say("r1", "Fix #237, like o/r#237.", null, 1_000);
  reader.kick();
  await reader.idle();

  // **Nothing is guessed**: the explicit name is read where it points, and the
  // bare one is not read anywhere, so no `forge` message answers it yet.
  expect(asked).toEqual([{ host: null, repo: "o/r", number: 237 }]);
  expect((await forgeMessages(w)).map((m) => parseForgeRead(m.body)?.named)).toEqual(["o/r#237"]);

  const thread = await w.record.threadMessages();
  if (thread.kind !== "read") throw new Error(thread.reason);
  const waiting = [{ named: "#237", host: null, repo: null, number: 237 }];
  expect(await reader.unread(thread.messages)).toEqual(new Map([["r1", waiting]]));
  // What holds the drafter leaves it out: the drafter's ask is what the read
  // is waiting for, so holding it there would leave the question unasked.
  expect(await reader.unreadUnderway(thread.messages)).toEqual(new Map());

  const handed: string[] = [];
  const drafter = drafterHost({
    store: w.store,
    record: w.record,
    now: tick,
    language: null,
    log: () => undefined,
    mintId: (kind) => `${kind}-${String(handed.length)}-${String(Math.random()).slice(2)}`,
    runDrafter: async (_row, document) => {
      handed.push(document);
      return { kind: "failed", reason: "not under test" };
    },
    issuesUnread: reader.unreadUnderway,
  });
  drafter.kick();
  await drafter.idle();
  expect(handed).toHaveLength(1);

  // **And rondo starts nothing meanwhile**: the door waits on the whole read.
  const planned = readRunPlan({ ...planDocument(), prompt: "Fix #237." });
  if (planned.kind !== "planned") throw new Error(planned.reason);
  expect(await withNamedIssues(w.record, "r1", planned.plan)).toMatchObject({
    refusal: expect.stringContaining("rondo has not yet read #237"),
  });

  // Answered -- a plan is drafted, or the person picks one -- and it is read.
  disputed = false;
  reader.kick();
  await reader.idle();
  expect(asked).toHaveLength(2);
  const quoted = await withNamedIssues(w.record, "r1", planned.plan);
  expect("prompt" in quoted && quoted.prompt).toContain(ISSUE.title);

  // **The draft that let the read happen is not drafted again over it**: the
  // store holds a thread every operator message of which a drafter row covers
  // to be drafted, and writes nothing twice (D-0071 rule 3.2). So the issue
  // reaches this request at the lap's door, quoted, and not in the drafted
  // prompt -- the known limit this rule leaves, recorded here so a change to
  // it is a red test and not a surprise.
  drafter.kick();
  await drafter.idle();
  expect(handed).toHaveLength(1);
});
