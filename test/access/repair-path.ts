/**
 * rondo#551's completion bar, as one scenario two suites drive: **a published
 * pull request's check goes red, the thread says so, and the repair the page
 * offers lands a commit on that pull request's own head branch.**
 *
 * `test/access/repair-path.test.ts` drives it over a stand-in continuo, so it
 * runs wherever the suite does; `test/access/press-path.test.ts` drives it over
 * the pinned build, which CI provisions. The scenario is the same function, so
 * the two cannot drift apart on what they claim.
 *
 * ## What is real, and what is stood in for
 *
 * **Real:** the page rondo serves (`serveOperatorPage` over a store on disk),
 * every press as the page's own function behind its route, the forms as the
 * page drew them (token and all), the checks host, the re-run's `POST` as
 * `rerunFailedJobs` spells and spawns it, the approval a re-run and a repair are
 * taken under (`scopedAuthority`, `admitUnderScope`), the repair lap's plan
 * (`revisionPlan`), and every `git` -- the lap's worktree, its commits, and the
 * push to a bare repository that stands as the forge's remote.
 *
 * **Stood in for, each at the narrowest boundary it has:**
 *
 * - **The forge's CLI** -- an executable named `gh`, first on `PATH`, as
 *   `press-path.test.ts`'s publish cases stand it in: it answers `pr create`
 *   with an address, the re-run `POST` with nothing, and the pull request's
 *   state with `OPEN`, and records every argv it was handed.
 * - **The forge's checks** -- the checks host's `readChecks` port. What goes
 *   red is the forge's to say, and continuo's `ci observe`/`ci show` fold is
 *   `test/access/checks.test.ts`'s; this port hands the host the reading the
 *   fold would have made.
 * - **The worker's turn** -- `fixtures/committing-worker.mjs`, which commits
 *   once in the worktree it is started in (see its header for why inside the
 *   turn), wrapping continuo's own fake worker where there is one.
 * - **The merge** -- the checks host's `mergeOnGreen` port, recorded rather
 *   than run: whether a green merges is `test/access/merge.test.ts`'s, and
 *   what this asks is only that the green on the repair's head asks it.
 * - **continuo itself, in `repair-path.test.ts` only** -- see that file.
 */
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

import { type ChecksRead, checksHost, type FailingCheck } from "../../src/access/checks-host.js";
import { rerunFailedJobs } from "../../src/access/forge.js";
import { scopedAuthority } from "../../src/access/merge.js";
import { answerFromPage, conflictFixFromPage } from "../../src/access/page-actions.js";
import { publishFromPage, publishingForPage } from "../../src/access/page-publish-actions.js";
import { recordScopeFromPage, startScopedFromPage } from "../../src/access/page-scope-actions.js";
import { agentTypeRecordOf } from "../../src/access/scope.js";
import {
  AnswerPort,
  newIterationId,
  newScopeId,
  PublishPort,
  RevisePort,
  type ScopeFormDraft,
  type ServedPorts,
} from "../../src/access/web-app.js";
import { run, startContinuo } from "../../src/continuo/invoker.js";
import { DB_CREATE } from "../../src/continuo/protocol.js";
import { allocate } from "../../src/refrain/allocator.js";
import {
  admittedPlan,
  planPayload,
  type RunPlan,
  readRunPlan,
  runPlan,
} from "../../src/refrain/plan.js";
import { CHECKS_REPAIR_HEAD } from "../../src/refrain/revision.js";
import { planDigest } from "../../src/store/plan.js";
import { type IterationRecord, planField } from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";
import { EVIDENCE, get, PLAN, portsOver, post, serving } from "./page-world.js";

/** The worker's turn, committing once (see its header). */
export const COMMITTING_WORKER = fileURLToPath(
  new URL("./fixtures/committing-worker.mjs", import.meta.url),
);

/** Where the stood-in forge says the pull request is. */
export const PULL_REQUEST_URL = "https://github.com/suisya-systems/rondo/pull/4242";
const FORGE_REPO = "suisya-systems/rondo";

/** One git command in `directory`, with an identity. */
export function git(directory: string, ...args: string[]): string {
  return execFileSync("git", ["-C", directory, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "rondo test",
      GIT_AUTHOR_EMAIL: "test@example.invalid",
      GIT_COMMITTER_NAME: "rondo test",
      GIT_COMMITTER_EMAIL: "test@example.invalid",
    },
  }).trim();
}

/** A cadenza-valid agent type, as `press-path.test.ts` holds one. */
const AGENT_TYPE_INPUT = {
  agentTypeId: "worker-basic",
  vocabularyVersion: 1,
  granted: ["command.run"],
  askable: ["branch.push"],
  loopPolicy: { maxReviewRounds: 2, noProgressWindow: 3, noProgressRepeat: 2 },
  executorPolicy: { roleName: "worker", modelTier: "standard", reportingDuties: [] },
};

/** `press-path.test.ts`'s press plan, with the worker command given. */
function planDocument(dir: string, repository: string, claudeCommand: readonly string[]) {
  const plan: RunPlan = {
    ...PLAN,
    db: join(dir, "continuo.sqlite3"),
    repository,
    workspaceRoot: join(dir, "work"),
    artifactRoot: join(dir, "artifacts"),
    stateRoot: join(dir, "state"),
    interlockRoot: join(dir, "interlock"),
    claudeOrgPath: join(dir, "claude-org"),
    endpointDestinationDir: join(dir, "dropbox"),
    endpointModule: join(dir, "endpoint.js"),
    node: process.execPath,
    claudeCommand: [...claudeCommand],
    agentTypeInput: AGENT_TYPE_INPUT as unknown as RunPlan["agentTypeInput"],
    parties: { issuer: "rondo-host", grantee: "unset" } as unknown as RunPlan["parties"],
    intendedAction: { capabilities: ["command.run"] } as unknown as RunPlan["intendedAction"],
    catalogLayers: [
      {
        layer: "tracked",
        origin: "the repair fixture",
        baseDir: join(dir, "catalog"),
        data: {
          schema_version: 1,
          project: {
            rondo: {
              source: { kind: "git_url", url: "https://example.invalid/org/rondo.git" },
              base_branch: "main",
              allowed_bash: ["npm run:*"],
            },
          },
        },
      },
    ],
    pollIntervalMs: 20,
  };
  const validated = runPlan(plan);
  if (validated.kind !== "planned") {
    throw new Error(`the repair fixture plan is not valid: ${validated.reason}`);
  }
  const allocation = allocate("repair-plan-fixture", plan.workspaceRoot);
  if (allocation.kind !== "allocated") {
    throw new Error(`the repair fixture id does not allocate: ${allocation.reason}`);
  }
  const admitted = admittedPlan(validated.plan, allocation.allocation);
  if (admitted.kind !== "planned") {
    throw new Error(`the repair fixture allocation is not valid: ${admitted.reason}`);
  }
  return planPayload(admitted.plan);
}

/** What the stood-in `gh` was handed, one argv per call, in order. */
interface StoodInForge {
  readonly pathEntry: string;
  asked(): readonly (readonly string[])[];
}

/**
 * The forge's CLI, stood in for as `press-path.test.ts` stands it in: a POSIX
 * shell script named `gh` that hands its argv to a node program, which records
 * it and answers the three calls this path makes. Anything else is refused, so
 * a call this scenario did not expect fails loudly instead of reaching a forge.
 */
function standInForge(dir: string): StoodInForge {
  const root = mkdtempSync(join(dir, "forge-cli-"));
  const log = join(root, "asked.jsonl");
  writeFileSync(log, "", "utf8");
  const program = join(root, "gh.mjs");
  writeFileSync(
    program,
    [
      'import { appendFileSync } from "node:fs";',
      "const argv = process.argv.slice(2);",
      `appendFileSync(${JSON.stringify(log)}, JSON.stringify(argv) + "\\n");`,
      'if (argv[0] === "pr" && argv[1] === "create") {',
      `  process.stdout.write(${JSON.stringify(`${PULL_REQUEST_URL}\n`)});`,
      "  process.exit(0);",
      "}",
      'if (argv[0] === "api" && argv.includes("POST") && argv.at(-1).endsWith("/rerun-failed-jobs")) {',
      "  process.exit(0);",
      "}",
      'if (argv[0] === "api" && argv[1] === "graphql") {',
      "  process.stdout.write(JSON.stringify({",
      '    state: "OPEN", headRefOid: "0".repeat(40), baseRefName: "main", mergeCommit: null,',
      '    isMergeQueueEnabled: false, repository: { defaultBranchRef: { name: "main" } },',
      "  }));",
      "  process.exit(0);",
      "}",
      'process.stderr.write("the stood-in gh does not answer this call\\n");',
      "process.exit(1);",
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    join(root, "gh"),
    `#!/bin/sh\nexec '${process.execPath}' '${program}' "$@"\n`,
    "utf8",
  );
  chmodSync(join(root, "gh"), 0o755);
  return {
    pathEntry: root,
    asked: () =>
      readFileSync(log, "utf8")
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => JSON.parse(line) as string[]),
  };
}

/** The hidden fields of the form whose tag opens with `opening`, as the page drew them. */
function formFields(html: string, opening: string): Record<string, string> {
  const at = html.indexOf(opening);
  expect(at, `the page draws no form opening '${opening}'`).toBeGreaterThanOrEqual(0);
  const form = html.slice(at, html.indexOf("</form>", at));
  return Object.fromEntries(
    [...form.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)"\/>/g)].map((one) => [
      one[1] ?? "",
      (one[2] ?? "").replaceAll("&amp;", "&").replaceAll("&quot;", '"'),
    ]),
  );
}

/** A page as a browser reads its text: `'` in either spelling the escaper chose. */
const text = (html: string) => html.replaceAll("&#39;", "'").replaceAll("&#x27;", "'");

/** One lap's row, read. */
async function rowOf(
  store: ReturnType<typeof iterationStore>,
  id: string,
): Promise<IterationRecord> {
  const read = await store.read(id);
  if (read.kind !== "read") {
    throw new Error(`lap '${id}' would not read: ${JSON.stringify(read)}`);
  }
  return read.record;
}

/**
 * The scenario, end to end. `environment` is what every press is handed, and
 * names the continuo they start; `claudeCommand` is the plan's worker command.
 */
export async function repairScenario(options: {
  readonly label: string;
  readonly environment: Readonly<Record<string, string>>;
  readonly claudeCommand: readonly string[];
}): Promise<void> {
  const { environment } = options;
  const dir = mkdtempSync(join(tmpdir(), `rondo-repair-${options.label}-`));

  // A repository whose `origin` is a bare repository: the forge's remote.
  const repository = join(dir, "repo");
  const bare = `${repository}.git`;
  mkdirSync(repository);
  execFileSync("git", ["init", "--quiet", "--initial-branch", "main", repository]);
  writeFileSync(join(repository, "README.md"), "# base\n", "utf8");
  git(repository, "add", "README.md");
  git(repository, "commit", "--quiet", "-m", "chore: the base");
  execFileSync("git", ["init", "--quiet", "--bare", "--initial-branch", "main", bare]);
  git(repository, "remote", "add", "origin", bare);
  git(repository, "push", "--quiet", "origin", "main");
  for (const child of ["artifacts", "state", "interlock", "claude-org", "dropbox"]) {
    mkdirSync(join(dir, child));
  }

  const storePath = join(dir, "store.db");
  const connection = new DatabaseSync(storePath);
  const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
  const record = advisoryRecord(connection);
  try {
    const started = await startContinuo(environment);
    if (started.kind !== "ready") {
      expect.unreachable(`continuo did not verify: ${started.reason}`);
    }
    const created = await run(started.continuo, DB_CREATE, ["--db", join(dir, "continuo.sqlite3")]);
    expect(created.kind).toBe("answered");

    // A request, the plan held in its thread, and the person's approval of a
    // scope over it that includes the merge -- which is what a re-run is taken
    // under (rondo#551), and what a merge on green needs (D-0126).
    const requestMessageId = `request-${options.label}`;
    const said = async (messageId: string, body: string, inReplyTo: string | null, atMs: number) =>
      expect(
        (
          await record.recordThreadMessage({
            messageId,
            body,
            authorKind: "operator",
            authorId: "ada",
            inReplyTo,
            atMs,
            bases: [],
            asks: false,
          })
        ).kind,
      ).toBe("recorded");
    await said(requestMessageId, "Add a retry budget, and make it end.", null, 1_000);
    const document = planDocument(dir, repository, options.claudeCommand);
    await said(`${requestMessageId}-plan`, JSON.stringify(document), requestMessageId, 1_100);
    const readBack = readRunPlan(document);
    if (readBack.kind !== "planned") {
      throw new Error(`the fixture plan does not read back: ${readBack.reason}`);
    }
    const agentType = agentTypeRecordOf(readBack.plan, document);
    if ("refusal" in agentType) {
      throw new Error(`the fixture agent type builds no record: ${agentType.refusal}`);
    }
    const draft: ScopeFormDraft = {
      scopeId: newScopeId(),
      requestMessageId,
      planDigest: planDigest(document),
      agentTypeDigest: agentType.record.agentTypeDigest,
      budgets: {
        laps: 4,
        review_rounds: 2,
        cost_usd: 50,
        cost_reserve_usd: 5,
        expires_at_ms: 9_999_999_999_999,
      },
      severityThreshold: "major",
      outwardActs: ["merge_default_branch"],
    };
    const scoped = await recordScopeFromPage(environment, store, storePath, "ada", draft);
    expect(scoped.ok, scoped.note).toBe(true);
    const scopeDecisionId = scoped.scopeDecisionId ?? "";

    // The page, served over the store, with the presses it serves: the page's
    // own functions, as `rondo web` wires them.
    const asked = { repo: FORGE_REPO, remote: "origin", allowRemoteMismatch: true };
    const ports: ServedPorts = {
      ...portsOver({ connection, store, record }, "ada"),
      now: Date.now,
      // The approve press's port: the page draws no press at all without one.
      answer: new AnswerPort(
        async (iterationId, body, claim) =>
          await answerFromPage(environment, store, storePath, "ada", iterationId, body, claim),
      ),
      // The card is drawn where the host can fix, as `rondo web` says it can
      // wherever it has an approver.
      fixesConflicts: true,
      revise: new RevisePort(
        async () => await Promise.resolve({ ok: false, note: "not this scenario's press" }),
        async (input) => await conflictFixFromPage(environment, store, storePath, "ada", input),
      ),
      publish: new PublishPort(
        async (input) => await publishFromPage(environment, store, storePath, "ada", asked, input),
      ),
      // No body is composed, as in `press-path.test.ts`: the screen and the press
      // both read the row a preview would have recorded, and find none.
      publishing: async (row) => await publishingForPage(environment, store, asked, row, record),
    };
    const forge = standInForge(dir);
    const path = process.env.PATH;
    process.env.PATH = `${forge.pathEntry}${delimiter}${path ?? ""}`;
    const page = await serving(ports);
    const thread = async () =>
      text((await get(page.base, `/?thread=${requestMessageId}&lang=en`)).body);
    const isCreate = (argv: readonly string[]) => argv[0] === "pr" && argv[1] === "create";

    try {
      // --- 1. The first lap: started, approved, published from the page. ------
      const firstId = newIterationId();
      const first = await startScopedFromPage(environment, store, storePath, "ada", {
        iterationId: firstId,
        requestMessageId,
        scopeDecisionId,
        planDigest: draft.planDigest,
      });
      expect(first.ok, `${first.why ?? ""}: ${first.note}`).toBe(true);
      expect((await rowOf(store, firstId)).status).toBe("awaiting_human");
      // **The model's reading, as store state** -- `press-path.test.ts`'s
      // `readingAtTheGate`, word for word, for its reason: no model runs here
      // (the plan names no review criterion), and a redo under a scope refuses
      // at its readings test where the reading is unavailable (D-0065 5.4).
      // What is under test is the repair, not the reading.
      expect(
        (
          await store.appendReading(
            firstId,
            {
              drafter: "rondo/model/1/gpt-6-astra",
              verdict: "concerns",
              findings: ["the backoff is not capped"],
              graded: [
                {
                  severity: "major",
                  bases: [{ kind: "file", path: "README.md", line: 1 }],
                  basisResolved: true,
                },
              ],
              evidence: EVIDENCE,
              unavailableReason: null,
            },
            Date.now(),
          )
        ).kind,
      ).toBe("appended");
      const approved = await answerFromPage(
        environment,
        store,
        storePath,
        "ada",
        firstId,
        "Go on.",
        null,
      );
      expect(approved.ok, approved.note).toBe(true);
      const firstRow = await rowOf(store, firstId);
      const firstWorkspace = firstRow.workspace ?? "";
      const firstTip = git(firstWorkspace, "rev-parse", "HEAD");
      const headBranch = planField(firstRow, "topic_branch");
      expect(headBranch).toBe(firstRow.topicBranch);

      const publishOnPage = async (iterationId: string) => {
        const screen = text((await get(page.base, `/?publish=${iterationId}&lang=en`)).body);
        const despite = screen.includes('id="publish-despite-form"');
        const fields = formFields(
          screen,
          despite ? '<form id="publish-despite-form"' : '<form id="publish-form"',
        );
        const pressed = await post(page.base, fields, {}, "/publish?lang=en");
        expect(pressed.status, pressed.body).toBe(303);
      };
      await publishOnPage(firstId);
      expect(forge.asked().filter(isCreate)).toHaveLength(1);
      expect(git(bare, "rev-parse", `refs/heads/${headBranch}`)).toBe(firstTip);
      const messages = async () => {
        const read = await record.threadMessages();
        if (read.kind !== "read") {
          throw new Error(`the thread would not read: ${read.reason}`);
        }
        return read.messages;
      };
      expect(
        (await messages()).find((one) => one.messageId === `report-published-${firstId}`)?.body,
      ).toContain(PULL_REQUEST_URL);

      // --- 2. The checks host reads red, and re-runs the failed job once. ------
      let next: ChecksRead;
      const readFor: string[] = [];
      const merges: { readonly iterationId: string; readonly head: string }[] = [];
      const open = {
        state: "open" as const,
        conflicting: false,
        base: "main",
        baseCommit: null,
        mergedBy: null,
        mergeCommit: null,
      };
      const red = (head: string, failing: readonly FailingCheck[]): ChecksRead => ({
        reading: { kind: "red", failed: ["test"], cancelled: [], timedOut: [] },
        head,
        pullRequest: open,
        failing,
        unfinishedRuns: [],
      });
      const host = checksHost({
        store,
        record,
        removeWorkspace: async () => {
          throw new Error("nothing in this scenario is merged, so nothing is closed out");
        },
        readChecks: async (request) => {
          readFor.push(`${request.repo}#${String(request.number)}`);
          return next;
        },
        readCommits: async () => {
          throw new Error("no head in this scenario is moved outside rondo");
        },
        mergeOnGreen: async (iterationId, head) => {
          merges.push({ iterationId, head });
          return null;
        },
        rerun: {
          authorised: async (iterationId) =>
            (await scopedAuthority({ store, record, now: Date.now }, iterationId, [
              "merge_default_branch",
            ])) !== null,
          rerunFailedJobs,
        },
        host: null,
        now: Date.now,
        log: () => undefined,
      });
      const scan = async () => {
        host.kick();
        await host.idle();
      };
      const reruns = () =>
        forge.asked().filter((argv) => argv[0] === "api" && argv.includes("POST"));

      next = red(firstTip, [{ checkRunId: 111, runId: 10, name: "test" }]);
      await scan();
      expect(readFor).toEqual(["suisya-systems/rondo#4242"]);
      expect(reruns()).toEqual([
        ["api", "--method", "POST", `repos/${FORGE_REPO}/actions/runs/10/rerun-failed-jobs`],
      ]);
      let shown = await thread();
      expect(shown).toContain(
        "The checks on #4242 failed, so rondo re-ran the failed checks once.",
      );
      expect(shown).not.toContain("Have rondo reproduce and fix the failing checks");

      // The same red again, before the re-run's attempts are queued: nothing
      // new is said, and nothing is re-run a second time.
      const before = (await messages()).length;
      await scan();
      expect(reruns()).toHaveLength(1);
      expect(await messages()).toHaveLength(before);

      // --- 3. The re-run's attempt fails too: the thread offers the repair. ----
      next = red(firstTip, [{ checkRunId: 222, runId: 10, name: "test" }]);
      await scan();
      expect(reruns()).toHaveLength(1);
      shown = await thread();
      expect(shown).toContain("The checks on #4242 did not pass: 'test'.");
      expect(shown).toContain("Have rondo reproduce and fix the failing checks");

      // --- 4. The repair press, as the page drew it. --------------------------
      const fix = formFields(shown, `<form id="fix-conflict-${firstId}"`);
      expect(fix).toMatchObject({
        iteration: firstId,
        cause: "red",
        scope_decision: scopeDecisionId,
      });
      const pressed = await post(page.base, fix, {}, "/fix-conflict?lang=en");
      expect(pressed.status, text(pressed.body).replace(/<[^>]+>/g, " ")).toBe(303);
      const repairId = fix["successor"] ?? "";
      const repair = await rowOf(store, repairId);
      // A redo of the published lap, under the same approval, cut from the pull
      // request's own head branch, asked to reproduce and repair the named check.
      expect(repair.supersedesIterationId).toBe(firstId);
      expect(repair.status).toBe("awaiting_human");
      expect(await record.scopeDecisionAdmitting(repairId)).toBe(scopeDecisionId);
      expect(planField(repair, "base_branch")).toBe(headBranch);
      const prompt = planField(repair, "prompt");
      expect(prompt).toContain(CHECKS_REPAIR_HEAD);
      expect(prompt).toContain("'test' failed");
      expect(prompt).toContain("First reproduce the failure here");

      // --- 5. The repair is approved and published from the page. -------------
      const repairWorkspace = repair.workspace ?? "";
      const repairTip = git(repairWorkspace, "rev-parse", "HEAD");
      expect(git(repairWorkspace, "rev-parse", "HEAD^")).toBe(firstTip);
      const repairApproved = await answerFromPage(
        environment,
        store,
        storePath,
        "ada",
        repairId,
        "Go on.",
        null,
      );
      expect(repairApproved.ok, repairApproved.note).toBe(true);
      await publishOnPage(repairId);

      // The pull request's head branch moved to the repair's commit, the repair's
      // own branch never reached the forge, and no second pull request was opened.
      expect(git(bare, "rev-parse", `refs/heads/${headBranch}`)).toBe(repairTip);
      expect(
        git(bare, "for-each-ref", "--format=%(refname)", "refs/heads/").split("\n").toSorted(),
      ).toEqual(["refs/heads/main", `refs/heads/${headBranch}`].toSorted());
      expect(repair.topicBranch).not.toBe(headBranch);
      expect(forge.asked().filter(isCreate)).toHaveLength(1);
      expect(
        (await messages()).find((one) => one.messageId === `report-published-${repairId}`)?.body,
      ).toContain(`were pushed onto '${headBranch}'`);

      // --- 6. Green on the repair's head asks for the merge on green. ---------
      next = {
        reading: { kind: "green", counted: 1, skipped: 0 },
        head: repairTip,
        pullRequest: open,
        failing: [],
        unfinishedRuns: [],
      };
      await scan();
      expect(readFor.at(-1)).toBe("suisya-systems/rondo#4242");
      expect(merges).toEqual([{ iterationId: repairId, head: repairTip }]);
    } finally {
      page.stop.abort();
      await page.served;
      if (path === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = path;
      }
    }
  } finally {
    connection.close();
  }
}

/**
 * A continuo `repair-path.test.ts` can start anywhere: `fixtures/stand-in-continuo.mjs`
 * copied to `<dir>/dist/cli.js` -- the only path shape the invoker drives --
 * with the pinned `--version` line written in, so the startup check passes as
 * it does for the real build. Returns the path to hand `RONDO_CONTINUO_CLI`.
 */
export function standInContinuo(versionLine: string): string {
  const dir = mkdtempSync(join(tmpdir(), "rondo-stand-in-continuo-"));
  mkdirSync(join(dir, "dist"));
  const cli = join(dir, "dist", "cli.js");
  const source = fileURLToPath(new URL("./fixtures/stand-in-continuo.mjs", import.meta.url));
  writeFileSync(
    cli,
    readFileSync(source, "utf8").replace("__PINNED_VERSION_LINE__", versionLine),
    "utf8",
  );
  // An ES module outside any package that says so: `node` would otherwise
  // read `dist/cli.js` as CommonJS.
  writeFileSync(join(dir, "package.json"), '{ "type": "module" }\n', "utf8");
  expect(existsSync(cli)).toBe(true);
  return cli;
}
