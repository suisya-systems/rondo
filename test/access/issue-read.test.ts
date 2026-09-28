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
  bareRepositoryUnsettled,
  type ForgeIssueRead,
  forgeBody,
  ISSUE_BOUND_BYTES,
  ISSUE_READER,
  ISSUES_QUOTE_OPENING,
  issueForDrafter,
  issueReader,
  issuesClosedNow,
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
  const said: string[] = [];
  const reader = issueReader({
    record: w.record,
    read,
    bareRepository: async (requestMessageId) => bareRepository(requestMessageId),
    now,
    mintId: () => {
      n += 1;
      return `forge-${String(n)}`;
    },
    log: (line) => said.push(line),
    onRead: () => {
      reads += 1;
    },
  });
  return { reader, onReads: () => reads, said };
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
  // The failed run and the one more it is given (rondo#554), both over the read.
  expect(handed).toHaveLength(2);
  for (const document of handed) {
    expect(document).toContain("by forge");
    expect(document).toContain(JSON.stringify(ISSUE.title));
  }
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

test("what the drafter is handed of one read is its body and comments, cut from the head (D-0131 rule 2)", () => {
  const read = (body: string, comments: readonly { author: string; at: string; body: string }[]) =>
    forgeBody({
      named: "#237",
      atMs: 1,
      read: {
        url: "https://github.com/o/r/issues/237",
        number: 237,
        pullRequest: false,
        title: ISSUE.title,
        state: "open",
        author: "ada",
        openedAt: "2026-09-01T00:00:00Z",
        body,
        comments: [...comments],
      },
    });
  const comment = { author: "bob", at: "2026-09-02T00:00:00Z", body: "The second thing." };

  // Within the bound, nothing is touched: the body and the comments as read.
  const whole = read("The first thing.", [comment]);
  expect(issueForDrafter(whole)).toBe(whole);
  expect(issueForDrafter(whole)).toContain("The second thing.");

  // Over it, the head is kept and the cut is named. A comment past the bound is
  // cut to nothing rather than dropped, so the reader sees there was one.
  const cut = issueForDrafter(read(`start 日本語${"y".repeat(60)}end`, [comment]), 18);
  const parsed = parseForgeRead(cut);
  if (parsed === null || !("read" in parsed)) throw new Error(cut);
  // Never inside a character: 'start ' is 6 bytes and each kanji is 3, so the
  // three that fit are whole and the 18th byte falls on a 'y'.
  expect(parsed.read.body).toBe("start 日本語yyy");
  expect(parsed.read.comments).toEqual([{ ...comment, body: "" }]);
  expect(new TextEncoder().encode(parsed.read.body).length).toBe(18);
  expect(cut).toContain("rondo cut this issue to its first 18 of");

  // **A continuous head, with no hole in it.** A multibyte character that will
  // not fit leaves bytes of the budget unspent, and no later comment may fill
  // them: body 'あ' under a bound of 2 is cut to nothing, and so is the
  // comment after it, rather than the comment showing its own first two bytes
  // with the body missing.
  const holed = issueForDrafter(read("あ", [{ ...comment, body: "abc" }]), 2);
  const head = parseForgeRead(holed);
  if (head === null || !("read" in head)) throw new Error(holed);
  expect(head.read.body).toBe("");
  expect(head.read.comments).toEqual([{ ...comment, body: "" }]);
  // And the same once a comment is the part that is cut: what follows it is
  // not filled in from the bytes it left.
  const later = issueForDrafter(read("ab", [{ ...comment, body: "あ" }, comment]), 4);
  const parts = parseForgeRead(later);
  if (parts === null || !("read" in parts)) throw new Error(later);
  expect(parts.read.body).toBe("ab");
  expect(parts.read.comments.map((one) => one.body)).toEqual(["", ""]);

  // What is not one of rondo's reads, and a read that failed, come back as they are.
  expect(issueForDrafter("not a read at all", 1)).toBe("not a read at all");
  const failed = forgeBody({ named: "#237", atMs: 1, failed: { why: "no_repo", detail: "why" } });
  expect(issueForDrafter(failed, 1)).toBe(failed);
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

/** One naming that disagrees, as the answer carries it: the plan's own slug. */
const byPlan = (repository: string, repo: string) => ({ repository, repo, named: "plan" as const });
/** The same, answered for a slug-less plan by the host's `--repo`. */
const byFlag = (repository: string, repo: string) => ({ repository, repo, named: "flag" as const });
/** A plan neither it nor the host names a repository for. */
const unnamed = (repository: string) => ({ repository, repo: null, named: "nothing" as const });

test("a bare #N is read in the repository of the plan its request is drafted from (D-0081 rule 3.4)", async () => {
  const a = heldIn("/srv/a", "o/a");
  const b = heldIn("/srv/b", "o/b");

  // One repository in play: read there, whatever this host was started with.
  expect(await bareIssueRepository(rowsHolding([a], [], "o/host"), "r1", NAMED_AT)).toEqual({
    repo: "o/a",
  });
  // Two, and nothing has said which: the read waits for the person (rule 2.4),
  // told which naming came from where (`D-0137` rule 3).
  expect(await bareIssueRepository(rowsHolding([a, b], [], "o/host"), "r1", NAMED_AT)).toEqual({
    disputed: true,
    namings: [byPlan("/srv/a", "o/a"), byPlan("/srv/b", "o/b")],
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
  ).toEqual({ disputed: true, namings: [byFlag("/srv/a", "o/a"), byPlan("/srv/b", "o/b")] });
  // The same plan beside one naming what the host names is still one answer.
  expect(
    await bareIssueRepository(rowsHolding([heldIn("/srv/a", null), a], [], "o/a"), "r1", NAMED_AT),
  ).toEqual({ repo: "o/a" });
  // **With no `--repo` either, such a plan's repository is simply not known**,
  // and standing beside one that is known that is two answers, not agreement.
  expect(
    await bareIssueRepository(rowsHolding([heldIn("/srv/a", null), b], []), "r1", NAMED_AT),
  ).toEqual({ disputed: true, namings: [unnamed("/srv/a"), byPlan("/srv/b", "o/b")] });

  // **Setup run again for a repository it already recorded is one answer.** An
  // older plan of that repository naming no slug says nothing about it, which
  // is how a store set up before D-0081 comes to name its slug (rule 6.2), and
  // with no `--repo` there is no second naming for it to disagree with.
  expect(
    await bareIssueRepository(rowsHolding([heldIn("/srv/a", null), a], []), "r1", NAMED_AT),
  ).toEqual({ repo: "o/a" });
  // Two slugs recorded for one repository is a conflict, not a record of it.
  expect(
    await bareIssueRepository(rowsHolding([a, heldIn("/srv/a", "o/other")], []), "r1", NAMED_AT),
  ).toEqual({
    disputed: true,
    namings: [byPlan("/srv/a", "o/a"), byPlan("/srv/a", "o/other")],
  });

  // **A scope older than the message that named the issue settles nothing.**
  // A person replying in this thread with work in another repository is
  // answered on the reader's own pass, before any draft over that reply can
  // exist, so the old scope would have the new reference read in the old
  // repository and recorded as read for good.
  expect(await bareIssueRepository(rowsHolding([a, b], [["/srv/a"]]), "r1", 1_000)).toEqual({
    disputed: true,
    namings: [byPlan("/srv/a", "o/a"), byPlan("/srv/b", "o/b")],
  });
});

test("a bare #N is read where its request would publish, and a second naming of one repository stops it (D-0137)", async () => {
  // **The case rondo#313 item 2 names.** One local repository holds an old
  // setup row carrying no slug and a newer one naming `o/new`, and the host was
  // started with `--repo o/old`. This reckoning used to take the newer row's
  // slug and read `o/new#N`, while a publish of the older plan fell back to the
  // flag and opened the pull request in `o/old` -- two repositories for one
  // piece of work, chosen silently and in two different places.
  const older = heldIn("/srv/a", null);
  const newer = heldIn("/srv/a", "o/new");
  expect(
    await bareIssueRepository(rowsHolding([older, newer], [], "o/old"), "r1", NAMED_AT),
  ).toEqual({ disputed: true, namings: [byFlag("/srv/a", "o/old"), byPlan("/srv/a", "o/new")] });
  // **And no scope narrows it**: both plans are of the one repository a scope
  // would name, so the person's own answer about which work is meant cannot
  // settle this. What settles it is the flag or the row, which is why the
  // namings say which is which.
  expect(
    await bareIssueRepository(rowsHolding([older, newer], [["/srv/a"]], "o/old"), "r1", NAMED_AT),
  ).toEqual({ disputed: true, namings: [byFlag("/srv/a", "o/old"), byPlan("/srv/a", "o/new")] });

  // **The route through: the flag naming what the plan names.** The same rows
  // under a host started with `--repo o/new` -- or with no flag at all -- are
  // one answer, and the read lands where the publish will.
  expect(
    await bareIssueRepository(rowsHolding([older, newer], [], "o/new"), "r1", NAMED_AT),
  ).toEqual({ repo: "o/new" });
  expect(await bareIssueRepository(rowsHolding([older, newer], []), "r1", NAMED_AT)).toEqual({
    repo: "o/new",
  });
});

test("the line about an unsettled bare #N names which naming came from where (D-0137 rule 3)", () => {
  // Nothing to name: the repository the request is in is not one this store
  // holds a plan for (D-0090), so there is no naming that disagrees.
  expect(bareRepositoryUnsettled([])).toBe("waits on which repository this request is in");

  // Two pieces of work: the person, or the draft, says which is meant.
  expect(bareRepositoryUnsettled([byPlan("/srv/a", "o/a"), unnamed("/srv/b")])).toBe(
    "waits on which repository this request is in: a plan of /srv/a names o/a; a plan of /srv/b " +
      "names none and this host was given no --repo",
  );

  // One piece of work named twice: the sentence says that instead, because no
  // draft and no press will settle it -- one of the two namings has to change.
  expect(bareRepositoryUnsettled([byFlag("/srv/a", "o/old"), byPlan("/srv/a", "o/new")])).toBe(
    "is read where its request would publish, and 2 repositories are named for that one publish: " +
      "a plan of /srv/a names none, so this host's --repo o/old answers for it; a plan of /srv/a " +
      "names o/new; nothing is read until they agree",
  );
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
    () => (disputed ? { disputed: true, namings: [] } : { repo: "o/r" }),
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
  // The failed run and the one more it is given (rondo#554).
  expect(handed).toHaveLength(2);

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

  // **The draft that let the read happen is drafted again over it** (`D-0131`
  // rule 1): a drafter row covers an operator message only with the reads it
  // held, so the landed read leaves the request due and the second run has the
  // issue in its document.
  drafter.kick();
  await drafter.idle();
  // Once, with no second go: the request was drafted once more already.
  expect(handed).toHaveLength(3);
  // The first runs had only the read that needed no settling; the last has both.
  expect(handed[1]?.match(/"rondo_issue_read"/g)).toHaveLength(1);
  expect(handed[2]?.match(/"rondo_issue_read"/g)).toHaveLength(2);
  expect(handed[2]).toContain('"named":"#237"');
});

test("a bare #N two namings of one repository disagree about is not read, and the host says both (D-0137 rules 2, 3)", async () => {
  const w = await world();
  const { read, asked } = fakeForge();
  const { reader, said } = readerOver(w, read, () => ({
    disputed: true,
    namings: [byFlag("/srv/a", "o/old"), byPlan("/srv/a", "o/new")],
  }));
  await reader.unread([]);
  await w.say("r1", "Fix #237.", null, 1_000);
  reader.kick();
  await reader.idle();

  // **Nothing is read and nothing is written**: neither repository is picked
  // for the person, so the lap's door keeps waiting on the reference.
  expect(asked).toEqual([]);
  expect(await forgeMessages(w)).toEqual([]);
  const thread = await w.record.threadMessages();
  if (thread.kind !== "read") throw new Error(thread.reason);
  expect(await reader.unread(thread.messages)).toEqual(
    new Map([["r1", [{ named: "#237", host: null, repo: null, number: 237 }]]]),
  );

  // **And the person is told which two namings disagree, and where each is
  // from**, because ending this means editing one of them.
  expect(said).toEqual([
    "issues   r1: #237 is read where its request would publish, and 2 repositories are named for " +
      "that one publish: a plan of /srv/a names none, so this host's --repo o/old answers for it; " +
      "a plan of /srv/a names o/new; nothing is read until they agree",
  ]);
});

test("a read the store refused is not still to come: the drafter is not held on it (rondo#495)", async () => {
  const w = await world();
  const { read } = fakeForge();
  // The store refuses the `forge` message, so the reader gives the reference up.
  const record = Object.create(w.record) as typeof w.record;
  record.recordThreadMessage = async (draft) =>
    draft.authorKind === "forge"
      ? { kind: "refused" as const, reason: "the store said no" }
      : await w.record.recordThreadMessage(draft);
  const reader = issueReader({
    record,
    read,
    bareRepository: async () => ({ repo: "o/r" }),
    now: () => 50_000,
    mintId: () => "forge-1",
    log: () => {},
    onRead: () => {},
  });
  await reader.unread([]);
  await w.say("r1", "Fix o/r#237.", null, 1_000);
  const thread = await w.record.threadMessages();
  if (thread.kind !== "read") throw new Error(thread.reason);
  expect((await reader.unreadUnderway(thread.messages)).has("r1")).toBe(true);
  reader.kick();
  await reader.idle();
  // Still unread on the thread's own note, and no longer holding the draft.
  expect((await reader.unread(thread.messages)).has("r1")).toBe(true);
  expect(await reader.unreadUnderway(thread.messages)).toEqual(new Map());
});

test("rondo#553: a request's issues read closed only when every one it named is closed on the forge now", async () => {
  const message = (messageId: string, body: string, inReplyTo: string | null) => ({
    messageId,
    body,
    authorKind: inReplyTo === null ? ("operator" as const) : ("forge" as const),
    authorId: inReplyTo === null ? "ada" : ISSUE_READER,
    inReplyTo,
    atMs: 1_000,
    bases: [],
    asks: false,
  });
  const read = (named: string, number: number, pullRequest = false, state = "open") =>
    forgeBody({
      named,
      atMs: 1_000,
      read: {
        url: `https://github.com/suisya-systems/rondo/${pullRequest ? "pull" : "issues"}/${String(number)}`,
        number,
        pullRequest,
        title: "t",
        // As first read: the state then says nothing about now.
        state,
        author: "ada",
        openedAt: "2026-09-01T00:00:00Z",
        body: "",
        comments: [],
      },
    });
  const states = new Map([
    [237, "closed"],
    [238, "open"],
  ]);
  const asked: string[] = [];
  const readState = async (request: { host: string | null; repo: string; number: number }) => {
    asked.push(`${String(request.host)} ${request.repo}#${String(request.number)}`);
    return ran(`${states.get(request.number) ?? "open"}\n`);
  };
  const thread = [
    message("r1", "Fix #237.", null),
    message("f1", read("#237", 237), "r1"),
    message("r2", "Fix #237 and #238.", null),
    message("f2", read("#237", 237), "r2"),
    message("f3", read("#238", 238), "r2"),
    message("r3", "Nothing named.", null),
    message("r4", "Look at #9.", null),
    message("f4", read("#9", 9, true), "r4"),
    message("r5", "Fix #237.", null),
    message(
      "f5",
      forgeBody({ named: "#237", atMs: 1, failed: { why: "failed", detail: "x" } }),
      "r5",
    ),
  ];
  expect(await issuesClosedNow(thread, "r1", readState)).toBe(true);
  // Read again now, not taken from the thread's read.
  expect(asked).toEqual(["github.com suisya-systems/rondo#237"]);
  expect(await issuesClosedNow(thread, "r2", readState)).toBe(false);
  expect(await issuesClosedNow(thread, "r3", readState)).toBe(false);
  // A pull request named is not the request's issue.
  expect(await issuesClosedNow(thread, "r4", readState)).toBe(false);
  // A read that failed says nothing, and neither does one failing now.
  expect(await issuesClosedNow(thread, "r5", readState)).toBe(false);
  // One already closed when the request read it was named for context.
  const context = [
    message("r6", "Like #237.", null),
    message("f6", read("#237", 237, false, "closed"), "r6"),
  ];
  expect(await issuesClosedNow(context, "r6", readState)).toBe(false);
  expect(
    await issuesClosedNow(thread, "r1", async () => await Promise.resolve(ran("", 1, "HTTP 502"))),
  ).toBe(false);
});
