/**
 * What leaves the machine once a lap has ended: the publish screen and its
 * dry run (#233 S5, D-0060, D-0081, #248), and the release the approver makes
 * from it (D-0073 rule 4.3, rondo#288).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import {
  publishFromPage,
  publishingForPage,
  publishPlanFor,
  releaseFromPage,
} from "../../src/access/cli.js";
import { inspectLapWork } from "../../src/access/forge.js";
import type {} from "../../src/access/inbox.js";
import { evidenceOf, READING_REMOTE } from "../../src/access/review.js";
import { chromeFor, EN } from "../../src/access/wording.js";
import { CLI_PATH_ENV } from "../../src/continuo/invoker.js";
import { allocate } from "../../src/refrain/allocator.js";
import { admittedPlan, planPayload, runPlan } from "../../src/refrain/plan.js";
import { APPROVED_OUTCOME } from "../../src/store/records.js";
import { iterationStore } from "../../src/store/sqlite.js";
import { ownLane } from "../lane-claims.js";
import { openRequest, REQUEST } from "../request-fixture.js";
import {
  fresh,
  gateWithChecks,
  openGate,
  operatorPage,
  PLAN,
  planFor,
  portsOver,
  recordAnswer,
  reserve,
  WINDOWS_HEAVY_TIMEOUT_MS,
} from "./page-world.js";

/** One approved, ended lap: the only state with a publish screen (rondo#233 S5). */
async function approvedLap(world: ReturnType<typeof fresh>): Promise<void> {
  await gateWithChecks(world);
  // What the approve press records beside the gate answer (D-0092).
  await recordAnswer(world, "i-0001");
  const closed = await world.store.transition(
    "i-0001",
    "awaiting_human",
    "closed",
    // The one outcome that is a person having answered (`approvedForPublication`).
    { gateOutcome: "answered_and_forwarded" },
    5_000,
  );
  expect(closed.kind).toBe("transitioned");
}

/** A dry-run as `publishingForPage` reads one, with nothing refusing. */
const DRY_RUN = {
  kind: "ready" as const,
  shown: `sha256:${"a".repeat(64)}`,
  target: {
    workspace: "/tmp/work/i-0001",
    remote: "origin",
    pushUrls: ["https://github.com/suisya-systems/rondo.git"],
    topicBranch: "rondo/i-0001",
    baseBranch: "main",
    headRef: "rondo/i-0001",
    repo: "github.com/suisya-systems/rondo",
    runId: "run-0001",
  },
  title: "feat: a retry budget",
  body: "## What changed\n\n- a retry budget\n",
  warnings: [],
  modelReading: [],
  review: null,
};

test("the publish screen shows the dry-run and one press, and nothing has left the machine (#233 S5)", async () => {
  const world = fresh();
  await approvedLap(world);
  const html = await operatorPage(
    portsOver(world, "ada", [], null, null, async () => DRY_RUN),
    "t",
    { kind: "publish", iterationId: "i-0001" },
  );
  const screen = html.slice(html.indexOf('id="publish"'));

  // What would happen, in sentences and not in command lines: this page never
  // sends a person to a terminal.
  expect(screen).toContain("Push the branch rondo/i-0001 to origin.");
  expect(screen).toContain("Open a pull request on github.com/suisya-systems/rondo, against main.");
  expect(screen).toContain("Close the run run-0001 as completed.");
  // Where the push goes, and not only what the remote is called: it is part of
  // what the press's digest refuses over, so it is part of what was shown.
  expect(screen).toContain("That push reaches https://github.com/suisya-systems/rondo.git.");
  // The text a reviewer will read, on the screen that publishes it.
  expect(screen).toContain("feat: a retry budget");
  expect(screen).toContain("## What changed");
  // **And drawn open, never behind a fold** (D-0082 rule 7, rondo#317): what
  // this press sends is what the press needs, so it is read before the press
  // and not one open away. It was a `<details>` the page always rendered shut.
  expect(screen).toContain('<div id="publish-body">');
  expect(screen).not.toContain('<details id="publish-body"');
  // One press, carrying the digest of exactly this dry-run and nothing typed.
  expect(screen).toContain('<form id="publish-form" method="post" action="/publish?lang=en"');
  expect(screen).toContain('<input type="hidden" name="iteration" value="i-0001"/>');
  expect(screen).toContain(`<input type="hidden" name="shown" value="${DRY_RUN.shown}"/>`);
  expect(screen).toContain(">Open a pull request</button>");
  // No override where there is nothing to override.
  expect(screen).not.toContain('id="publish-despite"');
  // **The screen does not redraw itself**: it is what a person is reading in
  // order to press (`isLive`).
  expect(html).not.toContain('hx-trigger="every 5s"');
});

test("the publish screen offers the override as its own press, under the refusal it overrules (#233 S5, D-0060)", async () => {
  const world = fresh();
  await approvedLap(world);
  const html = await operatorPage(
    portsOver(world, "ada", [], null, null, async () => ({
      ...DRY_RUN,
      review: {
        why: "moved" as const,
        readTip: "b".repeat(40),
        nowTip: "c".repeat(40),
      },
    })),
    "t",
    { kind: "publish", iterationId: "i-0001" },
  );
  const screen = html.slice(html.indexOf('id="publish"'));

  expect(screen).toContain("The reading does not cover this");
  expect(screen).toContain(`The reading was taken over ${"b".repeat(40)}`);
  // **Its own press**, with the field that says which of the two it is, and
  // the ordinary publish button is not drawn beside it.
  expect(screen).toContain('<form id="publish-despite-form" method="post"');
  expect(screen).toContain('<input type="hidden" name="despite_review" value="yes"/>');
  expect(screen).toContain(">Open the pull request anyway</button>");
  expect(screen).not.toContain('id="publish-form"');
});

test("a lap that names no repository to publish to says so on its own screen (D-0081 rule 3.2)", async () => {
  const world = fresh();
  await approvedLap(world);
  const html = await operatorPage(
    portsOver(world, "ada", [], null, null, async () => ({
      kind: "refused" as const,
      block: { why: "noRepo" as const },
    })),
    "t",
    { kind: "publish", iterationId: "i-0001" },
  );
  const screen = html.slice(html.indexOf('id="publish"'));

  // What is missing, whose it is to set, and nothing the person is expected to
  // do here: the repository is recorded when the place the work happens is set
  // up, which is not an act on this page (D-0076 rule 4.1).
  expect(screen).toContain("does not say where its pull request would be opened");
  expect(screen).toContain("whoever installed rondo");
  expect(screen).not.toContain("<form");
  // Not a flag, not a field name, and not the host-wide sentence that used to
  // stand in for this.
  expect(screen).not.toContain("--repo");
  expect(screen).not.toContain("forge_repository");
  expect(screen).not.toContain("Nothing can be published from this page");
});

test("a lap that cannot be published says why on the screen, and draws no button (#233 S5, D-0060 rule 4)", async () => {
  const world = fresh();
  await approvedLap(world);
  const html = await operatorPage(
    portsOver(world, "ada", [], null, null, async () => ({
      kind: "refused" as const,
      block: {
        why: "uncommitted" as const,
        paths: ["src/notifier.ts", "notes.md"],
        elsewhere: "main",
      },
    })),
    "t",
    { kind: "publish", iterationId: "i-0001" },
  );
  const screen = html.slice(html.indexOf('id="publish"'));

  expect(screen).toContain("src/notifier.ts, notes.md");
  expect(screen).toContain("The workspace has main checked out");
  // The remedies are about the paths, and none of them is a flag.
  expect(screen).toContain("commit them yourself in the workspace");
  expect(screen).not.toContain("--despite-review");
  expect(screen).not.toContain("<form");
});

test("the publish screen draws the body as markdown with the request as a fold, and the exact body is one press away (#248)", async () => {
  // As `requestBlock` writes it: the request quotes a code block and a stray
  // `</details>` of its own, and the fence is sized past its backticks.
  const request = "Add a retry budget.\n```ts\nretry(3)\n```\n</details>\nDo not push.";
  const body = [
    "## What changed",
    "",
    "- `abc1234` a retry budget",
    "",
    "## How this got here",
    "",
    "- rondo walked run `run-0001`.",
    "",
    "<details>",
    "<summary>The request this lap was given (written for the agent, not a description of the change)</summary>",
    "",
    "````",
    request,
    "````",
    "",
    "</details>",
    "",
    "This pull request was opened by `rondo publish`, which an operator ran. Merging it is not.",
  ].join("\n");
  const world = fresh();
  await approvedLap(world);
  const html = await operatorPage(
    portsOver(world, "ada", [], null, null, async () => ({ ...DRY_RUN, body })),
    "t",
    { kind: "publish", iterationId: "i-0001" },
  );
  const screen = html.slice(html.indexOf('id="publish"'));
  const drawn = screen.slice(
    screen.indexOf('id="publish-body-drawn"'),
    screen.indexOf('id="publish-body-exact"'),
  );
  const exact = screen.slice(screen.indexOf('id="publish-body-exact"'));

  // Drawn: markdown as a forge draws it, and the wrapper is the page's own
  // fold, labelled with the summary's words, with none of its markup showing.
  expect(drawn).toContain("<h2>What changed</h2>");
  expect(drawn).toContain("<li><code>abc1234</code> a retry budget</li>");
  expect(drawn).toContain('<details id="publish-body-request"');
  expect(drawn).toContain(
    "The request this lap was given (written for the agent, not a description of the change)",
  );
  expect(drawn).not.toContain("&lt;summary&gt;");
  expect(drawn).not.toContain("&lt;details&gt;");
  expect(drawn).not.toContain("````");
  // The request inside the fold is a code block, whole, its own `</details>`
  // included, and the text after the fold is still drawn.
  expect(drawn).toContain("retry(3)\n```\n&lt;/details&gt;\nDo not push.");
  expect(drawn).toContain("which an operator ran. Merging it is not.");
  // Raw: a named control beside Preview, and the body exactly as it is sent.
  expect(screen).toContain('<legend class="sr-only">Show the body as</legend>');
  expect(screen).toMatch(/id="publish-body-preview" class="sr-only" checked=""\/>Preview<\/label>/);
  expect(screen).toContain('id="publish-body-raw" class="sr-only"/>Raw</label>');
  expect(exact).toContain(
    body.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
  );

  // A body without the fold -- one too large to quote the request -- is still
  // drawn as markdown, and its source is still one press away.
  const plain = await operatorPage(
    portsOver(world, "ada", [], null, null, async () => DRY_RUN),
    "t",
    { kind: "publish", iterationId: "i-0001" },
  );
  expect(plain).toContain("<h2>What changed</h2>");
  expect(plain).toContain('id="publish-body-raw"');
  expect(plain).not.toContain('id="publish-body-request"');

  // A wrapper that does not close as `requestBlock` closes one is not guessed
  // at: no fold is drawn, and its markup is escaped as the text it is.
  const broken = await operatorPage(
    portsOver(world, "ada", [], null, null, async () => ({
      ...DRY_RUN,
      body: body.replace("````\n\n</details>\n", "````\n\n"),
    })),
    "t",
    { kind: "publish", iterationId: "i-0001" },
  );
  expect(broken).not.toContain('id="publish-body-request"');
  expect(broken).toContain("&lt;summary&gt;The request this lap was given");
});

test("the drawn body passes no HTML, runs no link, and fetches no image (#248)", async () => {
  const world = fresh();
  await approvedLap(world);
  const html = await operatorPage(
    portsOver(world, "ada", [], null, null, async () => ({
      ...DRY_RUN,
      body: [
        "- `abc1234` <script>alert(1)</script> <img src=x onerror=alert(2)>",
        "- [run me](javascript:alert(3)) and [read me](https://example.com/doc)",
        "- ![a pixel](https://tracker.example/p.png) and [![a badge](https://t.example/b.svg)](https://t.example/)",
        "- a note[^1]",
        "",
        "[^1]: the footnote",
      ].join("\n"),
    })),
    "t",
    { kind: "publish", iterationId: "i-0001" },
  );
  const screen = html.slice(html.indexOf('id="publish"'));
  const drawn = screen.slice(
    screen.indexOf('id="publish-body-drawn"'),
    screen.indexOf('id="publish-body-exact"'),
  );

  // Raw HTML is escaped as text, and nothing in the body becomes a tag.
  expect(drawn).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  expect(drawn).toContain("&lt;img src=x onerror=alert(2)&gt;");
  expect(drawn).not.toContain("<script");
  expect(drawn).not.toContain("<img");
  // A link that would run is its text alone; one that would not opens in a
  // new tab and carries no referrer.
  expect(drawn).not.toContain("javascript:");
  expect(drawn).toContain("<li>run me and <a ");
  expect(drawn).toContain(
    '<a target="_blank" rel="noopener noreferrer" href="https://example.com/doc">read me</a>',
  );
  // An image is a link to where it is, and is not fetched; inside a link it is
  // its name, since a link cannot hold one.
  expect(drawn).toContain(
    '<a target="_blank" rel="noopener noreferrer" href="https://tracker.example/p.png">a pixel</a>',
  );
  expect(drawn).toContain(
    '<a target="_blank" rel="noopener noreferrer" href="https://t.example/">a badge</a>',
  );
  // A footnote's link stays on this page.
  expect(drawn).toContain('<a href="#user-content-fn-1"');
});

test("the publish screen is in the page's language, and the model's reading is material beside it (#233 S5, D-0065 5.5)", async () => {
  const world = fresh();
  await approvedLap(world);
  const html = await operatorPage(
    portsOver(world, "ada", [], null, null, async () => ({
      ...DRY_RUN,
      warnings: ["--allow-remote-mismatch: pushing to 'grace' and opening against upstream."],
      modelReading: ["review  2 point(s) raised (rondo/model/gpt-6-astra):"],
    })),
    "t",
    { kind: "publish", iterationId: "i-0001" },
    chromeFor("ja"),
  );
  const screen = html.slice(html.indexOf('id="publish"'));

  expect(html).toContain('<html lang="ja">');
  expect(screen).toContain("ブランチ rondo/i-0001 を origin へ push します。");
  expect(screen).toContain("モデルが読んだこと");
  expect(screen).toContain("review  2 point(s) raised");
  expect(screen).toContain("rondo が気づいたこと");
  expect(screen).toContain('action="/publish?lang=ja"');
});

test(
  "a publish press refuses on the lap's own state before anything leaves this machine (#233 S5)",
  async () => {
    // **Every refusal here is reached before git or the forge is asked**, which
    // is what makes them reachable in a file with no repository on disk: a lap
    // that would not read, one that has not ended, and one whose gate ended
    // without a person answering it are all refused off the row.
    const dir = mkdtempSync(join(tmpdir(), "rondo-publish-refusals-"));
    const storePath = join(dir, "store.db");
    const connection = new DatabaseSync(storePath);
    const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
    await openRequest(connection);
    const asked = { repo: "suisya-systems/rondo", remote: "origin", allowRemoteMismatch: false };
    const pressing = (iterationId: string, despiteReview = false) =>
      publishFromPage({ RONDO_APPROVER: "ada" }, store, storePath, "ada", asked, {
        iterationId,
        shown: `sha256:${"a".repeat(64)}`,
        despiteReview,
      });

    const gone = await pressing("lap-not-there");
    expect(gone.ok).toBe(false);
    expect(gone.why).toBe("publishRefusedGone");

    const live = "lap-00000000-0000-4000-8000-0000000000b1";
    const reserved = await store.reserve({
      numbers: null,
      id: live,
      request: "add a retry budget",
      plan: planFor(live),
      spend: null,
      scopeSpend: null,
      claim: ownLane(live),
      nowMs: 1_000,
      supersedesIterationId: null,
      requestMessageId: REQUEST,
      runId: `rondo-${live}`,
      topicBranch: `rondo/${live}`,
      workspace: `/srv/work/${live}`,
    });
    expect(reserved.kind).toBe("reserved");
    const running = await pressing(live);
    expect(running.ok).toBe(false);
    expect(running.why).toBe("publishRefusedNotClosed");

    for (const [from, to] of [
      ["planned", "admitting"],
      ["admitting", "admitted"],
      ["admitted", "performing"],
      ["performing", "awaiting_human"],
    ] as const) {
      const moved = await store.transition(
        live,
        from,
        to,
        to === "awaiting_human" ? { gateId: `gate-${live}` } : {},
        2_000,
      );
      expect(moved.kind).toBe("transitioned");
    }
    // A gate that ended without a person answering it closes the lap and is not
    // an approval: publishing on it would open a pull request whose body says
    // somebody approved this.
    const closed = await store.transition(
      live,
      "awaiting_human",
      "closed",
      { gateOutcome: "withdrawn" },
      3_000,
    );
    expect(closed.kind).toBe("transitioned");
    const withdrawn = await pressing(live);
    expect(withdrawn.ok).toBe(false);
    expect(withdrawn.why).toBe("publishRefusedNotApproved");

    // **Two presses of one screen are one publish**, and a press that read
    // something else is refused rather than joined: a push cannot be taken back.
    const [first, same, other] = await Promise.all([
      pressing("lap-not-there"),
      pressing("lap-not-there"),
      pressing("lap-not-there", true),
    ]);
    expect(same).toEqual(first);
    expect(other.ok).toBe(false);
    expect(other.why).toBe("publishRefusedStillRunning");
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

/**
 * One closed, approved lap with a real git workspace to publish from, for the
 * checks that only exist once a plan can actually be composed (rondo#233 S5).
 *
 * `git` is spawned here rather than faked, because what is under test is the
 * comparison between two reads of the same workspace, and a faked read cannot
 * disagree with itself the way the real thing is meant to be caught doing.
 */
async function publishableWorld(
  /**
   * What the store holds about this work: a reading that describes it, one
   * taken over a tip it has moved off, or none at all -- which is the state the
   * override press exists for and the one whose refusal carries no tip of its
   * own (Codex round 2).
   */
  reading: "clear" | "stale" | "none",
  /** Commits on the topic branch, one file each: past `LIST_LIMIT` the body truncates. */
  commits = 1,
  /** The remote's URL; the default is a repository nobody has. */
  remoteUrl = "https://github.com/suisya-systems/rondo-not-real.git",
): Promise<{
  readonly store: ReturnType<typeof iterationStore>;
  readonly storePath: string;
  readonly iterationId: string;
  readonly workspace: string;
  readonly asked: { repo: string; remote: string; allowRemoteMismatch: boolean };
}> {
  const dir = mkdtempSync(join(tmpdir(), "rondo-publish-"));
  const storePath = join(dir, "store.db");
  const connection = new DatabaseSync(storePath);
  const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
  await openRequest(connection);
  const iterationId = "lap-00000000-0000-4000-8000-0000000000c1";
  const workspaceRoot = join(dir, "work");
  const planned = runPlan({ ...PLAN, workspaceRoot, repository: join(dir, "repo") });
  if (planned.kind !== "planned") {
    throw new Error(`the fixture plan is not valid: ${planned.reason}`);
  }
  const allocation = allocate(iterationId, workspaceRoot);
  if (allocation.kind !== "allocated") {
    throw new Error(`the fixture id does not allocate: ${allocation.reason}`);
  }
  const admitted = admittedPlan(planned.plan, allocation.allocation);
  if (admitted.kind !== "planned") {
    throw new Error(`the fixture allocation is not valid: ${admitted.reason}`);
  }
  const payload = planPayload(admitted.plan);
  const workspace = String(payload.workspace);
  const topicBranch = String(payload.topic_branch);
  const run = (...args: string[]) =>
    execFileSync("git", ["-C", workspace, ...args], {
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "rondo test",
        GIT_AUTHOR_EMAIL: "test@example.invalid",
        GIT_COMMITTER_NAME: "rondo test",
        GIT_COMMITTER_EMAIL: "test@example.invalid",
      },
    });
  mkdirSync(workspace, { recursive: true });
  execFileSync("git", ["init", "--quiet", "--initial-branch", "main", workspace], {
    encoding: "utf8",
  });
  writeFileSync(join(workspace, "README.md"), "# base\n", "utf8");
  run("add", "README.md");
  run("commit", "--quiet", "-m", "chore: the base");
  run("checkout", "--quiet", "-b", topicBranch);
  for (let n = 1; n <= commits; n += 1) {
    writeFileSync(
      join(workspace, `counter-${String(n)}.ts`),
      `export const laps = ${n};\n`,
      "utf8",
    );
    run("add", `counter-${String(n)}.ts`);
    run("commit", "--quiet", "-m", `feat: count the laps (${n})`);
  }
  // A remote that agrees with `asked.repo` and is not a repository anybody has:
  // the preflight needs one, and no test may be one press away from a push.
  run("remote", "add", "origin", remoteUrl);

  const reserved = await store.reserve({
    numbers: null,
    id: iterationId,
    request: "count the laps",
    plan: payload,
    spend: null,
    scopeSpend: null,
    claim: ownLane(iterationId),
    nowMs: 1_000,
    supersedesIterationId: null,
    requestMessageId: REQUEST,
    runId: `rondo-${iterationId}`,
    topicBranch,
    workspace,
  });
  expect(reserved.kind).toBe("reserved");
  const read = await inspectLapWork({
    workspace,
    remote: READING_REMOTE,
    baseBranch: String(payload.base_branch),
    topicBranch,
  });
  if (read.kind !== "read") {
    throw new Error(`the fixture workspace would not read: ${JSON.stringify(read)}`);
  }
  const measured = evidenceOf(read);
  const taken =
    reading === "none"
      ? undefined
      : {
          drafter: "rondo/deterministic/2",
          verdict: "clear" as const,
          findings: [],
          // A stale reading is one taken over a tip the branch has moved off,
          // which is D-0060 rule 5's refusal and what the second press is for.
          evidence: reading === "stale" ? { ...measured, tipCommit: "9".repeat(40) } : measured,
          unavailableReason: null,
        };
  for (const [from, to, fields, carried] of [
    ["planned", "admitting", {}, undefined],
    ["admitting", "admitted", {}, undefined],
    ["admitted", "performing", {}, undefined],
    ["performing", "awaiting_human", { gateId: `gate-${iterationId}` }, taken],
    ["awaiting_human", "closed", { gateOutcome: "answered_and_forwarded" }, undefined],
  ] as const) {
    if (to === "closed") {
      // What the approve press records beside the gate answer (D-0092).
      await store.recordGateAnswer(iterationId, `gate-${iterationId}`, "approve", "ada", 2_000);
    }
    const moved = await store.transition(iterationId, from, to, fields, 2_000, carried);
    expect(moved.kind, to).toBe("transitioned");
  }
  return {
    store,
    storePath,
    iterationId,
    workspace,
    asked: {
      repo: "suisya-systems/rondo-not-real",
      remote: "origin",
      allowRemoteMismatch: false,
    },
  };
}

test(
  "a publish press acts only on the dry-run the screen showed, re-read inside the press (#233 S5)",
  async () => {
    // **The property D-0059 section 5a's Q1 is built on**, and the only one of
    // this slice's checks a person cannot see working: what the screen drew is
    // read again here, and a press carrying anything else publishes nothing.
    // Every press below refuses before the push, so nothing leaves this machine.
    const world = await publishableWorld("clear");
    const record = await world.store.read(world.iterationId);
    if (record.kind !== "read") {
      throw new Error("the fixture row would not read");
    }
    const shown = await publishingForPage(
      { RONDO_APPROVER: "ada" },
      world.store,
      world.asked,
      record.record,
    );
    if (shown.kind !== "ready") {
      throw new Error(`the fixture would not plan: ${JSON.stringify(shown)}`);
    }
    // The reading covers this work, so the screen drew the ordinary press.
    expect(shown.review).toBe(null);
    const pressing = (input: { shown: string; despiteReview: boolean }) =>
      publishFromPage({ RONDO_APPROVER: "ada" }, world.store, world.storePath, "ada", world.asked, {
        iterationId: world.iterationId,
        ...input,
      });

    // A digest that is not this dry-run's is a press from some other screen.
    const elsewhere = await pressing({ shown: `sha256:${"e".repeat(64)}`, despiteReview: false });
    expect(elsewhere.ok).toBe(false);
    expect(elsewhere.why).toBe("publishRefusedChanged");

    // The override is refused where there is nothing to override: it is an answer
    // to a question this screen did not ask.
    const overruling = await pressing({ shown: shown.shown, despiteReview: true });
    expect(overruling.ok).toBe(false);
    expect(overruling.why).toBe("publishRefusedNothingOverruled");

    // **The destination moving is the screen drifting** (Codex round 1). Under
    // `--allow-remote-mismatch` a remote re-pointed at another repository of the
    // same owner leaves the head, the warning and every other field of the plan
    // alone, so a digest over the remote's *name* would have let this press
    // through to a repository the screen never named.
    //
    // **Two forks of one owner, which is the case nothing else here can see**:
    // the head is spelled `owner:branch` and the warning names the owner, so both
    // are the same string before and after. Only the destination moved.
    const workspace = String(record.record.plan.workspace);
    const setUrl = (url: string) =>
      execFileSync("git", ["-C", workspace, "remote", "set-url", "origin", url], {
        encoding: "utf8",
      });
    setUrl("https://github.com/grace/fork-a.git");
    const moved = { ...world.asked, allowRemoteMismatch: true };
    const before = await publishingForPage(
      { RONDO_APPROVER: "ada" },
      world.store,
      moved,
      record.record,
    );
    if (before.kind !== "ready") {
      throw new Error(`the fixture would not plan: ${JSON.stringify(before)}`);
    }
    setUrl("https://github.com/grace/fork-b.git");
    const after = await publishingForPage(
      { RONDO_APPROVER: "ada" },
      world.store,
      moved,
      record.record,
    );
    if (after.kind !== "ready") {
      throw new Error(`the fixture would not plan: ${JSON.stringify(after)}`);
    }
    // Everything a person could have read on the screen is the same; the
    // destination is not, and that is what the digest has to catch.
    expect(after.target.headRef).toBe(before.target.headRef);
    expect(after.warnings).toEqual(before.warnings);
    expect(after.target.pushUrls).not.toEqual(before.target.pushUrls);
    const elsewhereEntirely = await publishFromPage(
      { RONDO_APPROVER: "ada" },
      world.store,
      world.storePath,
      "ada",
      moved,
      { iterationId: world.iterationId, shown: before.shown, despiteReview: false },
    );
    expect(elsewhereEntirely.ok).toBe(false);
    expect(elsewhereEntirely.why).toBe("publishRefusedChanged");
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "a publish press does not publish past the reading's refusal; only the second press does (#233 S5, D-0060)",
  async () => {
    const world = await publishableWorld("stale");
    const record = await world.store.read(world.iterationId);
    if (record.kind !== "read") {
      throw new Error("the fixture row would not read");
    }
    const shown = await publishingForPage(
      { RONDO_APPROVER: "ada" },
      world.store,
      world.asked,
      record.record,
    );
    if (shown.kind !== "ready") {
      throw new Error(`the fixture would not plan: ${JSON.stringify(shown)}`);
    }
    // The reading was taken over a tip this branch has moved off, so the screen
    // drew the refusal and, under it, the press that overrules it.
    expect(shown.review?.why).toBe("moved");

    const ordinary = await publishFromPage(
      { RONDO_APPROVER: "ada" },
      world.store,
      world.storePath,
      "ada",
      world.asked,
      { iterationId: world.iterationId, shown: shown.shown, despiteReview: false },
    );
    expect(ordinary.ok).toBe(false);
    expect(ordinary.why).toBe("publishRefusedNotRead");
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "a token in a remote's URL never reaches the screen, and the press still sees the move (#233 S5)",
  async () => {
    // **A page is screenshotted, saved and pasted.** A push URL may carry a token
    // in its userinfo, and the terminal already prints these redacted; the screen
    // must not be the one place the secret survives (Codex round 2).
    const token = "ghp_notarealtokenbutshapedlikeone";
    const world = await publishableWorld(
      "clear",
      1,
      `https://ada:${token}@github.com/suisya-systems/rondo-not-real.git`,
    );
    const record = await world.store.read(world.iterationId);
    if (record.kind !== "read") {
      throw new Error("the fixture row would not read");
    }
    const shown = await publishingForPage(
      { RONDO_APPROVER: "ada" },
      world.store,
      world.asked,
      record.record,
    );
    if (shown.kind !== "ready") {
      throw new Error(`the fixture would not plan: ${JSON.stringify(shown)}`);
    }
    expect(shown.target.pushUrls).toEqual([
      "https://<redacted>@github.com/suisya-systems/rondo-not-real.git",
    ]);
    expect(JSON.stringify(shown)).not.toContain(token);

    // And what the screen draws is that, not something composed again from the
    // raw URL: the projection is the only thing the renderer is handed.
    const page = fresh();
    await approvedLap(page);
    const html = await operatorPage(
      portsOver(page, "ada", [], null, null, async () => shown),
      "t",
      { kind: "publish", iterationId: "i-0001" },
    );
    expect(html).not.toContain(token);
    expect(html).toContain("&lt;redacted&gt;@github.com/suisya-systems/rondo-not-real.git");
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "work amended out of sight of the pull request's text still moves the confirmation (#233 S5)",
  async () => {
    // **The pull request's text is not a fingerprint of the work** (Codex round
    // 2). Past `LIST_LIMIT` the body lists the oldest twenty commits and counts
    // the rest, so amending the newest one changes no line of it; the file
    // statistics survive an amend that keeps the line counts; and the refusal on
    // this screen -- no reading was recorded -- carries no tip of its own. Every
    // field a person could have read is identical across the amend below.
    const world = await publishableWorld("none", 21);
    const record = await world.store.read(world.iterationId);
    if (record.kind !== "read") {
      throw new Error("the fixture row would not read");
    }
    const reading = async () =>
      await publishingForPage({ RONDO_APPROVER: "ada" }, world.store, world.asked, record.record);
    const before = await reading();
    if (before.kind !== "ready") {
      throw new Error(`the fixture would not plan: ${JSON.stringify(before)}`);
    }
    expect(before.review?.why).toBe("noReading");

    // The newest commit, amended: same subject, same file, same one line changed.
    writeFileSync(join(world.workspace, "counter-21.ts"), "export const laps = 99;\n", "utf8");
    execFileSync("git", ["-C", world.workspace, "add", "counter-21.ts"], { encoding: "utf8" });
    execFileSync("git", ["-C", world.workspace, "commit", "--quiet", "--amend", "--no-edit"], {
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "rondo test",
        GIT_AUTHOR_EMAIL: "test@example.invalid",
        GIT_COMMITTER_NAME: "rondo test",
        GIT_COMMITTER_EMAIL: "test@example.invalid",
      },
    });
    const after = await reading();
    if (after.kind !== "ready") {
      throw new Error(`the fixture would not plan: ${JSON.stringify(after)}`);
    }
    // Nothing the screen showed changed -- which is exactly why the text cannot
    // be what identifies the work.
    expect(after.title).toBe(before.title);
    expect(after.body).toBe(before.body);
    expect(after.review).toEqual(before.review);
    expect(after.warnings).toEqual(before.warnings);

    const stale = await publishFromPage(
      { RONDO_APPROVER: "ada" },
      world.store,
      world.storePath,
      "ada",
      world.asked,
      { iterationId: world.iterationId, shown: before.shown, despiteReview: true },
    );
    expect(stale.ok).toBe(false);
    expect(stale.why).toBe("publishRefusedChanged");
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "a branch whose history will not read is still identified by its tip (#233 S5)",
  async () => {
    // **`unreadable` is about the base, not about the branch** (Codex round 3).
    // A worktree that holds no base ref reads as unreadable while the branch it
    // would push resolves perfectly well -- and that is exactly the case where
    // the pull request's text falls back to a fixed shape and the review refusal
    // carries no tip, so nothing else in the plan would notice the work moving.
    const world = await publishableWorld("none", 1);
    const record = await world.store.read(world.iterationId);
    if (record.kind !== "read") {
      throw new Error("the fixture row would not read");
    }
    const git = (...args: string[]) =>
      execFileSync("git", ["-C", world.workspace, ...args], {
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: "rondo test",
          GIT_AUTHOR_EMAIL: "test@example.invalid",
          GIT_COMMITTER_NAME: "rondo test",
          GIT_COMMITTER_EMAIL: "test@example.invalid",
        },
      });
    // The base this lap was cut from, gone from the workspace: neither
    // `refs/remotes/origin/main` nor `refs/heads/main` resolves now.
    git("branch", "--quiet", "-D", "main");
    expect(
      (
        await inspectLapWork({
          workspace: world.workspace,
          remote: READING_REMOTE,
          baseBranch: "main",
          topicBranch: String(record.record.plan.topic_branch),
        })
      ).kind,
    ).toBe("unreadable");

    const reading = async () =>
      await publishingForPage({ RONDO_APPROVER: "ada" }, world.store, world.asked, record.record);
    const before = await reading();
    if (before.kind !== "ready") {
      throw new Error(`the fixture would not plan: ${JSON.stringify(before)}`);
    }
    // The tip amended: the same subject and the same one file, different bytes.
    writeFileSync(join(world.workspace, "counter-1.ts"), "export const laps = 99;\n", "utf8");
    git("add", "counter-1.ts");
    git("commit", "--quiet", "--amend", "--no-edit");
    const after = await reading();
    if (after.kind !== "ready") {
      throw new Error(`the fixture would not plan: ${JSON.stringify(after)}`);
    }
    // Nothing a person read changed: the body is the fallback shape and the
    // refusal is the constant one.
    expect(after.title).toBe(before.title);
    expect(after.body).toBe(before.body);
    expect(after.review).toEqual(before.review);

    const stale = await publishFromPage(
      { RONDO_APPROVER: "ada" },
      world.store,
      world.storePath,
      "ada",
      world.asked,
      { iterationId: world.iterationId, shown: before.shown, despiteReview: true },
    );
    expect(stale.ok).toBe(false);
    expect(stale.why).toBe("publishRefusedChanged");
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "a git status that fails refuses the publish, and the override does not reach it (rondo#179)",
  async () => {
    // **D-0060 rule 5's ground, reached by the other door.** A corrupt index
    // leaves the history readable and `git status` not, so what the push would
    // leave behind is unknown -- and an override answers a judgement, not that.
    // Every press below refuses before the push, so nothing leaves this machine.
    const world = await publishableWorld("stale");
    const record = await world.store.read(world.iterationId);
    if (record.kind !== "read") {
      throw new Error("the fixture row would not read");
    }
    const before = await publishingForPage(
      { RONDO_APPROVER: "ada" },
      world.store,
      world.asked,
      record.record,
    );
    if (before.kind !== "ready") {
      throw new Error(`the fixture would not plan: ${JSON.stringify(before)}`);
    }
    writeFileSync(join(world.workspace, ".git", "index"), "not an index", "utf8");

    const planned = await publishPlanFor(record.record, world.asked, {}, world.store, null);
    expect(planned.kind).toBe("refused");
    if (planned.kind !== "refused") return;
    expect(planned.block.why).toBe("statusUnreadable");
    // What the command line prints: why, and that its flag does not help.
    expect(planned.reason).toContain("git status could not be read");
    expect(planned.reason).toContain("uncommitted work behind is unknown");
    expect(planned.reason).toContain("--despite-review does not change that");

    const screen = await publishingForPage(
      { RONDO_APPROVER: "ada" },
      world.store,
      world.asked,
      record.record,
    );
    expect(screen.kind === "refused" && screen.block.why).toBe("statusUnreadable");
    const pressed = await publishFromPage(
      { RONDO_APPROVER: "ada" },
      world.store,
      world.storePath,
      "ada",
      world.asked,
      { iterationId: world.iterationId, shown: before.shown, despiteReview: true },
    );
    expect(pressed.ok).toBe(false);
    expect(pressed.why).toBe("publishRefusedStatusUnreadable");
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "history that will not read is still publishable past the override, and uncommitted paths are still refused (rondo#179, D-0060)",
  async () => {
    const world = await publishableWorld("clear");
    const record = await world.store.read(world.iterationId);
    if (record.kind !== "read") {
      throw new Error("the fixture row would not read");
    }
    // **`inspectLapWork`'s rule, unchanged**: no base ref, so the history is
    // unreadable, and the plan is ready with a refusal the override passes.
    execFileSync("git", ["-C", world.workspace, "branch", "--quiet", "-D", "main"]);
    const unread = await publishPlanFor(record.record, world.asked, {}, world.store, null);
    expect(unread.kind).toBe("ready");
    if (unread.kind !== "ready") return;
    expect(unread.plan.reviewRefusal?.why).toBe("unreadable");

    // **D-0060's refusal, unchanged**, and still first.
    execFileSync("git", ["-C", world.workspace, "branch", "--quiet", "main", "HEAD~1"]);
    writeFileSync(join(world.workspace, "left-behind.txt"), "not committed\n", "utf8");
    const left = await publishPlanFor(record.record, world.asked, {}, world.store, null);
    expect(left.kind).toBe("refused");
    if (left.kind !== "refused") return;
    expect(left.block).toEqual({ why: "uncommitted", paths: ["left-behind.txt"], elsewhere: null });
    expect(left.reason).toContain("left-behind.txt");
    expect(left.reason).toContain("--despite-review does not change that");
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

/** Close a lap at its gate with an approval, as the gate's press would. */
async function closeApproved(world: ReturnType<typeof fresh>, id: string): Promise<void> {
  await openGate(world, id);
  const closed = await world.store.transition(
    id,
    "awaiting_human",
    "closed",
    { gateOutcome: APPROVED_OUTCOME },
    4_000,
  );
  expect(closed.kind).toBe("transitioned");
}

test("the release screen names the work by its request, says why rondo has not released it, and carries what it was drawn over (D-0073 rule 4.3, rondo#288)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "Rename the settings page");
  await closeApproved(world, "i-0001");
  const screen = { kind: "release", iterationId: "i-0001" } as const;

  for (const wording of [EN, chromeFor("ja")]) {
    const html = await operatorPage(portsOver(world), "t", screen, wording);
    expect(html).toContain("Rename the settings page");
    expect(html).toContain(wording.holds(["lanes/i-0001/"]));
    for (const said of [...wording.releaseWhy, ...wording.releaseEffect]) {
      expect(html).toContain(said);
    }
    expect(html).toContain('action="/release?lang=');
    expect(html).toContain('<input type="hidden" name="iteration" value="i-0001"/>');
    expect(html).toContain('<input type="hidden" name="claim" value="i-0001:1"/>');
    expect(html).toContain('<input type="hidden" name="laps" value="i-0001"/>');
    // It holds still: a press is made from it (the publish screen's rule).
    expect(html).not.toContain('hx-trigger="every 5s"');
  }
  // No approver: the screen, and no press.
  expect(await operatorPage(portsOver(world, null), null, screen)).not.toContain("/release?");

  // A line still in flight keeps its files, and a released one keeps none:
  // each screen says which, and draws no press.
  await reserve(world, "i-0002", "still at its gate");
  await openGate(world, "i-0002");
  const open = await operatorPage(portsOver(world), "t", {
    kind: "release",
    iterationId: "i-0002",
  });
  expect(open).toContain(EN.releaseStillOpen);
  expect(open).not.toContain('action="/release');
  expect(
    (
      await world.store.releaseLane({
        iterationId: "i-0001",
        takenOver: null,
        landed: false,
        authorKind: "operator",
        authorId: "ada",
        bases: [],
        nowMs: 9_000,
      })
    ).kind,
  ).toBe("released");
  // Where the press lands: the screen says the files were released.
  const gone = await operatorPage(portsOver(world), "t", screen);
  expect(gone).toContain(EN.releasedByPerson);
  expect(gone).not.toContain('action="/release');
});

test("the page's release is the approver's and only what the screen showed: a stranger, or a line that moved, releases nothing (D-0073 rule 4.3)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "Rename the settings page");
  await closeApproved(world, "i-0001");
  const claims = () =>
    world.connection
      .prepare("SELECT claim_id, paths, author_kind, author_id FROM lane_claim ORDER BY rowid")
      .all();
  const shown = { iterationId: "i-0001", claimId: "i-0001:1", lapIds: ["i-0001"] };

  // Not the approver, or no approver named: refused before the store.
  for (const environment of [{ RONDO_APPROVER: "grace" }, {}]) {
    expect(await releaseFromPage(environment, world.store, "ada", shown)).toMatchObject({
      ok: false,
      why: "releaseRefusedNotRecorded",
    });
  }
  // A screen drawn over other laps or another claim row: stale, nothing written.
  const env = { RONDO_APPROVER: "ada" };
  for (const stale of [
    { ...shown, claimId: "i-0001:2" },
    { ...shown, lapIds: ["i-0001", "i-0001-r2"] },
  ]) {
    expect(await releaseFromPage(env, world.store, "ada", stale)).toMatchObject({
      ok: false,
      why: "releaseRefusedChanged",
    });
  }
  expect(claims()).toHaveLength(1);

  // The approver, over what was shown: one row of no paths, recorded as theirs.
  expect(await releaseFromPage(env, world.store, "ada", shown)).toEqual({ ok: true, note: "" });
  expect(claims()).toEqual([
    {
      claim_id: "i-0001:1",
      paths: '["lanes/i-0001/"]',
      author_kind: "drafter",
      author_id: "test/own-lane",
    },
    { claim_id: "i-0001:2", paths: "[]", author_kind: "operator", author_id: "ada" },
  ]);
  // Pressed again from the same screen: the line moved, so nothing more.
  expect((await releaseFromPage(env, world.store, "ada", shown)).ok).toBe(false);
  expect(claims()).toHaveLength(2);
});

// -- The one leg of a publish that can be driven for real here (rondo#239) --

/**
 * `#239`'s S5, as far as it goes: the branch really is pushed.
 *
 * The publish press has three legs -- the push, the pull request and the run
 * close -- and #239 asks for a test that drives each and asserts the recorded
 * outcome. **Only the first can be driven here, and it is driven for real.**
 * `pushTopicBranch` runs `git push`, and a bare repository on disk is a real
 * remote, so the push is not stood in for: the assertion is that the remote's
 * ref moved to the workspace's tip.
 *
 * **What the other two need, and why they are not here.** The pull request leg
 * shells out to the forge CLI, which needs a real forge, a repository to open a
 * pull request against and a credential to do it with; a stubbed forge CLI
 * would make this test green over nothing, which is the one thing #239 says not
 * to build. So the press refuses at the second leg,
 * `publishRefusedPullRequestFailed`, and that refusal is asserted here as what
 * it is -- the boundary of what this machine can reach -- rather than papered
 * over. The third leg, the run close, is continuo's and would work; it is
 * simply never reached, because the second fails first and the press stops
 * there on purpose (a push that cannot be taken back must not be followed by a
 * close that claims a pull request exists).
 *
 * **The second leg fails the same way everywhere, and offline** (Codex round
 * 1). Left alone, the failure would be whatever the machine happened to
 * produce: no forge CLI at all on a runner, a 404 over the network on a laptop
 * that has one logged in -- and that second shape can stall for the command's
 * own five-minute bound, which is longer than any timeout this file would
 * otherwise give a case. So the credential is taken away for the duration: an
 * empty configuration directory and no token, which the forge CLI refuses on
 * before it opens a connection. The push above is untouched by that -- it is
 * `git` to a path -- so what stays real stays real, and what cannot be reached
 * is refused for one stated reason instead of three incidental ones.
 *
 * Reaching the second leg at all still requires a verified continuo, because
 * the press starts one **before** it pushes -- so this case carries the same
 * capability gate as `test/access/press-path.test.ts`.
 */
const publishCli = process.env[CLI_PATH_ENV];
const canPublish = publishCli !== undefined && publishCli.trim() !== "";

test.skipIf(!canPublish)(
  "the publish press really pushes the branch, and stops at the leg that needs a forge (#233 S5, rondo#239)" +
    (canPublish ? "" : ` [skipped: ${CLI_PATH_ENV} is unset]`),
  async () => {
    // A bare repository is a real remote: what is pushed is pushed.
    const forge = mkdtempSync(join(tmpdir(), "rondo-publish-forge-"));
    const bare = join(forge, "throwaway.git");
    execFileSync("git", ["init", "--quiet", "--bare", "--initial-branch", "main", bare]);

    const world = await publishableWorld("clear", 1, bare);
    // The remote is a path and `asked.repo` is a forge name, so they cannot
    // agree; the mismatch is overruled here rather than hidden, which is the
    // flag's own purpose.
    const asked = { ...world.asked, allowRemoteMismatch: true };
    const environment = { RONDO_APPROVER: "ada", [CLI_PATH_ENV]: publishCli ?? "" };
    const row = await world.store.read(world.iterationId);
    if (row.kind !== "read") {
      throw new Error("the fixture row would not read");
    }
    const shown = await publishingForPage(environment, world.store, asked, row.record);
    if (shown.kind !== "ready") {
      throw new Error(`the fixture would not plan: ${JSON.stringify(shown)}`);
    }

    // The forge leg, made to fail on the credential rather than on the network.
    // The forge CLI reads these from the environment it inherits, so they are
    // set on this process and put back afterwards.
    const held = {
      GH_CONFIG_DIR: process.env["GH_CONFIG_DIR"],
      GH_TOKEN: process.env["GH_TOKEN"],
      GITHUB_TOKEN: process.env["GITHUB_TOKEN"],
    };
    process.env["GH_CONFIG_DIR"] = mkdtempSync(join(tmpdir(), "rondo-publish-nocreds-"));
    process.env["GH_TOKEN"] = "";
    process.env["GITHUB_TOKEN"] = "";
    let pressed: Awaited<ReturnType<typeof publishFromPage>>;
    try {
      pressed = await publishFromPage(environment, world.store, world.storePath, "ada", asked, {
        iterationId: world.iterationId,
        shown: shown.shown,
        despiteReview: false,
      });
    } finally {
      for (const [name, value] of Object.entries(held)) {
        if (value === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = value;
        }
      }
    }

    // **The push happened.** The remote holds the topic branch, at the tip the
    // workspace is on -- which no refusal path could have produced.
    const tip = execFileSync("git", ["-C", world.workspace, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
    const pushed = execFileSync(
      "git",
      ["-C", bare, "rev-parse", `refs/heads/${row.record.topicBranch ?? ""}`],
      { encoding: "utf8" },
    ).trim();
    expect(pushed).toBe(tip);

    // **And the press stopped where the forge begins.** Not a pass dressed as
    // one: the pull request leg needs a forge this machine does not have, and
    // the press says so in the words the screen shows.
    expect(pressed.ok).toBe(false);
    expect(pressed.why).toBe("publishRefusedPullRequestFailed");
    expect(pressed.note).toContain("the branch is pushed");
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);
