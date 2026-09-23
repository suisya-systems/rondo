/**
 * The page says the result (rondo#376): what was answered at the gate, that a
 * pull request was opened and where, and what its checks came to -- as a state
 * in the person's language, beside rondo's reports, which stay English
 * (`D-0055` rule 4).
 *
 * **The reports are written by the real writer** (`reportToRequest`), so what
 * the page reads back is the sentence rondo actually records, not a copy of it
 * kept here.
 */
import { expect, test } from "vitest";
import { pullRequestUpdated } from "../../../src/access/cli.js";
import { reportToRequest } from "../../../src/access/conductor.js";
import { basisWord } from "../../../src/access/page/vocabulary.js";
import { resultOf } from "../../../src/access/page-logic/result.js";
import { lapEvents } from "../../../src/access/page-logic/thread-events.js";
import { threadsOf } from "../../../src/access/page-logic/threads.js";
import { chromeFor, EN } from "../../../src/access/wording.js";
import type { IterationRecord } from "../../../src/store/records.js";
import {
  fresh,
  openGate,
  openRequest,
  operatorPage,
  planFor,
  portsOver,
  recordAnswer,
  reserve,
} from "../page-world.js";

const PR = "https://github.com/suisya-systems/rondo/pull/372";

/** One request whose one lap was answered at its gate, and nothing after. */
async function approved(answer: "approve" | "revise" | null = "approve") {
  const world = fresh();
  await openRequest(world, "req-r", "#291 の文言を分けて", 1_000);
  await reserve(world, "i-r", "#291 の文言を分けて", null, "req-r");
  await openGate(world, "i-r");
  if (answer !== null) {
    await recordAnswer(world, "i-r", answer);
  }
  const closed = await world.store.transition(
    "i-r",
    "awaiting_human",
    "closed",
    { gateOutcome: "answered_and_forwarded" },
    5_000,
  );
  expect(closed.kind).toBe("transitioned");
  return world;
}

const threadOf = (world: ReturnType<typeof fresh>) => ({
  record: world.record,
  store: world.store,
});

async function published(world: ReturnType<typeof fresh>) {
  await reportToRequest(threadOf(world), "i-r", { kind: "published", pullRequestUrl: PR }, 6_000);
}

async function checked(
  world: ReturnType<typeof fresh>,
  reading:
    | { kind: "green"; counted: number; skipped: number }
    | { kind: "red"; failed: string[]; cancelled: string[]; timedOut: string[] }
    | { kind: "none" },
  atMs = 7_000,
) {
  await reportToRequest(
    threadOf(world),
    "i-r",
    { kind: "checks", commit: "abc1234", reading },
    atMs,
  );
}

const view = { kind: "thread", messageId: "req-r", to: null } as const;
const en = async (world: ReturnType<typeof fresh>) =>
  await operatorPage(portsOver(world), "t", view);
const ja = async (world: ReturnType<typeof fresh>) =>
  await operatorPage(portsOver(world, "ada", null, "ja"), "t", view, chromeFor("ja"));

/** The thread's header: the title, the governance line and the result under them. */
function head(html: string): string {
  const at = html.indexOf('class="thread-head"');
  return html.slice(at, html.indexOf("</header>", at));
}

test("straight after approve, the page says approved and not published, and never taken in", async () => {
  // Lap 11: 「2 回目: 終わりました。変更は取り込み済みです。」 after approve, with
  // nothing pushed. 取り込み済み reads as merged.
  const world = await approved();
  const english = await en(world);
  expect(english).toContain("You approved the work. It is not published yet");
  expect(english).not.toContain("taken in");
  expect(head(english)).toContain("Not published yet");
  expect(head(english)).toContain("Merging is yours");
  // Neither merged nor not merged: rondo does not watch a merge (Codex).
  expect(head(english)).not.toMatch(/Not merged|Merged/);

  const japanese = await ja(world);
  expect(japanese).toContain("承認しました。まだ公開していません");
  expect(japanese).not.toContain("取り込み済み");
  expect(head(japanese)).toContain("承認済み");
  expect(head(japanese)).toContain("まだ公開していません");
  // The merge is said as the person's, and never as done.
  expect(head(japanese)).toContain("マージはあなたが行います");
  expect(head(japanese)).not.toContain("まだです");
});

test("once published, the pull request is on the page as a link, in the person's language", async () => {
  // Lap 11: 「どこにPRができたのかの通知もないから自分でGithub見に行く必要がある」.
  const world = await approved();
  await published(world);
  const japanese = await ja(world);
  const top = head(japanese);
  expect(top).toContain("プルリクエストを開きました:");
  expect(top).toContain(`<a href="${PR}">#372</a>`);
  // Checks not answered yet read as running, and not as green.
  expect(top).toContain("実行中");
  expect(top).not.toContain("緑");
  // The line in the thread says it too, with the same link.
  expect(japanese).toContain("公開しました。プルリクエストを開きました:");
  // The approval line no longer says it is unpublished.
  expect(japanese).not.toContain("まだ公開していません");
  // And the list's row answers without opening the thread.
  const requests = await operatorPage(
    portsOver(world, "ada", null, "ja"),
    "t",
    { kind: "requests" },
    chromeFor("ja"),
  );
  expect(requests).toContain("プルリクエスト #372・チェック 実行中");
});

test("green is said as green, by colour and word, and a skipped check is not said to have passed", async () => {
  // Lap 11: 「変更がグリーンになったことが、全くわからない」, and the report said
  // "every one of them passed" over 6 successes and 1 skip.
  const world = await approved();
  await published(world);
  await checked(world, { kind: "green", counted: 7, skipped: 1 });

  const report = (await world.record.threadMessages()) as unknown as {
    messages: { messageId: string; body: string }[];
  };
  const green = report.messages.find((message) => message.messageId === "report-checks-i-r-green");
  expect(green?.body).toContain("6 passed and 1 was skipped, and none failed");
  expect(green?.body).not.toContain("every one of them passed");

  const japanese = await ja(world);
  expect(head(japanese)).toContain('class="result-checks result-checks-green"');
  expect(head(japanese)).toContain("<b>緑</b>");
  expect(head(japanese)).toContain("6 件通過、1 件スキップ");
  expect(japanese).toContain("#372 のチェック: 緑（6 件通過、1 件スキップ）");
  const english = await en(world);
  expect(head(english)).toContain("6 passed, 1 skipped");
  expect(english).toContain("The checks on #372: green (6 passed, 1 skipped).");
  expect(english).not.toMatch(/all 7 passed/);
});

test("red names what failed, and a later green is what the state says", async () => {
  const world = await approved();
  await published(world);
  await checked(world, { kind: "red", failed: ["build", "lint"], cancelled: [], timedOut: [] });
  const red = await ja(world);
  expect(head(red)).toContain('class="result-checks result-checks-red"');
  expect(head(red)).toContain("<b>赤</b>");
  expect(head(red)).toContain("失敗: build、lint");

  await checked(world, { kind: "green", counted: 2, skipped: 0 }, 8_000);
  const green = await ja(world);
  expect(head(green)).toContain("<b>緑</b>");
  expect(head(green)).toContain("2 件すべて通過");
  // A rerun that goes red again is retold under its time, and is what the state says.
  await reportToRequest(
    threadOf(world),
    "i-r",
    {
      kind: "checks",
      commit: "abc1234",
      reading: { kind: "red", failed: ["build"], cancelled: [], timedOut: [] },
      retold: 9_000,
    },
    9_000,
  );
  expect(head(await ja(world))).toContain("<b>赤</b>");
});

test("a cancelled or timed-out check is said as what it came to, and is not green (continuo D-1113)", async () => {
  const world = await approved();
  await published(world);
  await checked(world, { kind: "red", failed: [], cancelled: ["deploy"], timedOut: ["e2e"] });
  const english = await en(world);
  expect(head(english)).toContain('class="result-checks result-checks-red"');
  expect(head(english)).toContain("cancelled: deploy; timed out: e2e");
  expect(head(english)).not.toContain("failed:");
  const japanese = await ja(world);
  expect(head(japanese)).toContain("キャンセル: deploy／タイムアウト: e2e");
});

test("a change asked for whose next try never started is not said to be approved (rondo#385)", async () => {
  // The owner pressed *ask for a change*, the next try was refused, and the
  // closed lap read 「承認しました。まだ公開していません」 with a pull-request
  // button under it: rondo saying a person approved work they had turned down.
  const world = await approved("revise");
  const japanese = await ja(world);
  expect(japanese).toContain("変更を頼みました。次の回は始まっていません。");
  expect(japanese).not.toContain("承認しました");
  expect(head(japanese)).not.toContain("承認済み");
  const requests = await operatorPage(
    portsOver(world, "ada", null, "ja"),
    "t",
    { kind: "requests" },
    chromeFor("ja"),
  );
  expect(requests).not.toContain("承認済み");
});

test("a lap answered before the record existed says rondo does not know, and claims no approval", async () => {
  const world = await approved(null);
  const japanese = await ja(world);
  expect(japanese).toContain("承認か変更依頼か、記録がありません");
  expect(japanese).not.toContain("承認しました");
  expect(head(japanese)).not.toContain("承認済み");
  const english = await en(world);
  expect(english).toContain(EN.evAnswerUnrecorded);
});

test("the result is read off the recorded sentences, and an old green claims no split", () => {
  const said = (entries: [string, string, number][]) =>
    new Map(entries.map(([id, body, atMs]) => [id, { body, atMs }]));
  expect(resultOf(said([]), "i-1")).toBeNull();
  const old = resultOf(
    said([
      ["report-published-i-1", `Lap 'i-1' was published: pull request ${PR} was opened.`, 1],
      [
        "report-checks-i-1-green",
        "Lap 'i-1' is green: the forge reported 7 check(s) on commit 'x', and every one of them passed.",
        2,
      ],
    ]),
    "i-1",
  );
  // Written before rondo#376, "every one of them passed" was said over skips
  // too, so the page says only that none failed.
  expect(old?.checks).toEqual({ kind: "green", counted: 7, passed: null, skipped: null });
  expect(old?.number).toBe("372");
  expect(chromeFor("ja").checksDetail(old?.checks ?? { kind: "none" })).toBe("7 件、失敗なし");
});

/** A lap row, with the parts a test varies. */
function lap(parts: Partial<IterationRecord>): IterationRecord {
  return {
    id: "i-1",
    status: "closed",
    gateOutcome: "answered_and_forwarded",
    createdAtMs: 1,
    updatedAtMs: 2,
    reason: null,
    failureKind: null,
    gateAnswer: "approve",
    plan: { topic_branch: "rondo/i-1", base_branch: "main" },
    ...parts,
  } as IterationRecord;
}

test("an answered gate says what was answered: approved, a change asked for, or neither", () => {
  const ended = (record: IterationRecord, revised: boolean) =>
    lapEvents(
      EN,
      record,
      [],
      () => true,
      () => "now",
      null,
      { revised, result: null },
    ).at(-1);
  expect(ended(lap({}), false)?.said).toBe(
    "You approved the work. It is not published yet: no pull request has been opened.",
  );
  // **Ask for a change closes the gate the same way**, so what tells it apart
  // is the answer rondo recorded when it carried it (rondo#385, D-0092).
  expect(ended(lap({ gateAnswer: "revise" }), true)?.said).toBe(
    "You asked for a change. The next try works on it.",
  );
  // rondo#385 itself: the next try was refused, so none was built on this one
  // -- and the line still says a change was asked for, never an approval.
  expect(ended(lap({ gateAnswer: "revise" }), false)?.said).toBe(
    "You asked for a change. The next try has not started.",
  );
  // The record wins over the next try: an approval is an approval.
  expect(ended(lap({ gateAnswer: "approve" }), true)?.said).toContain("You approved the work.");
  // A lap answered before the record existed: a next try built on it can only
  // have been a change, and without one rondo says it does not know.
  expect(ended(lap({ gateAnswer: null }), true)?.said).toBe(
    "You asked for a change. The next try works on it.",
  );
  expect(ended(lap({ gateAnswer: null }), false)?.said).toBe(EN.evAnswerUnrecorded);
  expect(ended(lap({ gateOutcome: "withdrawn" }), false)?.said).toBe(
    "The confirmation closed without an approval.",
  );
  // The person's own answer is ink, not the green a passing check gets.
  expect(ended(lap({}), false)?.kind).toBe("person");
});

test("a basis is named by what it is, and never by the id it is stored under (D-0076)", () => {
  // Lap 11 had `proposal draft-24c87431-...` in the thread.
  const threads = threadsOf([], new Set(), new Map());
  for (const [basis, said] of [
    [{ form: "proposal", proposalId: "draft-24c87431" }, "rondo の提案"],
    [{ form: "iteration", iterationId: "lap-590e0e66" }, "この依頼の作業"],
    [{ form: "continuoRun", runId: "rondo-lap-590e0e66" }, "作業の実行記録"],
    [{ form: "scope", scopeId: "scope-1" }, "取り決めた範囲"],
  ] as const) {
    const word = basisWord(chromeFor("ja"), basis, threads, null, "ada");
    expect(word.said).toBe(said);
    expect(JSON.stringify(word)).not.toMatch(/draft-|lap-|scope-1/);
  }
});

// --- the merge press (rondo#380, D-0091) ------------------------------------

const merging = async (world: ReturnType<typeof fresh>, lang: "en" | "ja" = "ja") =>
  await operatorPage(
    { ...portsOver(world, "ada", null, lang), mergeable: true },
    "t",
    view,
    chromeFor(lang),
  );

/** A way to merge on a page: the thread's link to the screen, or the screen's press. */
const MERGE_WAY = /\?merge=|\/merge\?/;

/** The merge's confirm screen (rondo#437 item 6). */
const mergeScreen = async (world: ReturnType<typeof fresh>, lang: "en" | "ja" = "ja") =>
  await operatorPage(
    { ...portsOver(world, "ada", null, lang), mergeable: true },
    "t",
    { kind: "merge", iterationId: "i-r" },
    chromeFor(lang),
  );

test("green on the head with nothing waiting, the next step is a merge press for that head", async () => {
  // Lap 11: green at 22:26:48, merged on GitHub at 22:29:50 -- 「rondoからマージボタン押せたらいいなぁ」.
  const world = await approved();
  await published(world);
  await checked(world, { kind: "green", counted: 7, skipped: 1 });
  // rondo#437 item 6: the thread leads to the screen; it does not merge.
  const thread = await merging(world);
  expect(thread).toContain('href="/?merge=i-r&amp;lang=ja"');
  expect(thread).not.toContain('action="/merge?');
  const page = await mergeScreen(world);
  // What happens, before the press: where it goes, which commit, and no undo.
  const words = chromeFor("ja");
  expect(page).toContain(words.mergeConfirmInto("#372", "main"));
  expect(page).toContain(words.mergeConfirmCommit("abc1234"));
  expect(page).toContain(words.mergeConfirmNoUndo);
  expect(page.indexOf(words.mergeConfirmNoUndo)).toBeLessThan(page.indexOf('action="/merge?'));
  expect(page).toContain('action="/merge?lang=ja"');
  expect(page).toContain('name="head" value="abc1234"');
  expect(page).toContain('name="iteration" value="i-r"');
  expect(page).toContain("プルリクエストをマージする");
  expect(page).toContain('data-busy="マージしています…"');
  // With no merge port there is no press, and red or running is no press either.
  expect(await ja(world)).not.toMatch(MERGE_WAY);
  const red = await approved();
  await published(red);
  await checked(red, { kind: "red", failed: ["build"], cancelled: [], timedOut: [] });
  expect(await merging(red)).not.toMatch(MERGE_WAY);
  // A screen reached by its address offers no press where the thread offers none.
  const redScreen = await mergeScreen(red);
  expect(redScreen).not.toContain('action="/merge?');
  expect(redScreen).toContain(chromeFor("ja").mergeConfirmNotNow);
  const running = await approved();
  await published(running);
  expect(await merging(running)).not.toMatch(MERGE_WAY);
});

test("a question still waiting on the person keeps the merge press off the page", async () => {
  const world = await approved();
  await published(world);
  await checked(world, { kind: "green", counted: 2, skipped: 0 });
  const asked = await world.record.recordThreadMessage({
    messageId: "ask-1",
    body: "Which one did you mean?",
    authorKind: "drafter",
    authorId: "the drafter",
    inReplyTo: "req-r",
    atMs: 8_000,
    bases: [{ form: "message", messageId: "req-r" }],
    asks: true,
  });
  expect(asked).toMatchObject({ kind: "recorded" });
  expect(await merging(world)).not.toMatch(MERGE_WAY);
});

test("once merged, the strip says where it went and how, and the press is gone", async () => {
  const world = await approved();
  await published(world);
  await checked(world, { kind: "green", counted: 2, skipped: 0 });
  await reportToRequest(
    threadOf(world),
    "i-r",
    { kind: "merged", pullRequestUrl: PR, into: "main", method: "squash", mergeCommit: "def5678" },
    9_000,
  );
  const japanese = await merging(world);
  expect(head(japanese)).toContain("main にマージしました（1 つのコミットにまとめて）");
  expect(head(japanese)).not.toContain("マージはあなたが行います");
  expect(japanese).not.toMatch(MERGE_WAY);
  expect(head(await merging(world, "en"))).toContain("Merged into main (squashed into one commit)");
});

test("a red written before continuo D-1113 still reads, every name as failed", () => {
  const byId = new Map([
    ["report-published-i-old", { body: `Opened ${PR}.`, atMs: 1 }],
    [
      "report-checks-i-old-red",
      {
        body:
          "Lap 'i-old' is not green: on commit 'abc1234' the forge reports 'build', 'lint' as " +
          "failed. rondo read this and did nothing else with the pull request.",
        atMs: 2,
      },
    ],
  ]);
  expect(resultOf(byId, "i-old")).toMatchObject({
    checks: { kind: "red", failed: ["build", "lint"], cancelled: [], timedOut: [] },
    checksCommit: "abc1234",
  });
});

// --- what the forge did after rondo read it (rondo#411 to #413) --------------

test("a conflict is said as why no check runs, with what to do, and no press (rondo#411)", async () => {
  const world = await approved();
  await published(world);
  await reportToRequest(
    threadOf(world),
    "i-r",
    { kind: "conflict", pullRequestUrl: PR, head: "abc1234", base: "main", baseCommit: "b1" },
    7_000,
  );
  await checked(world, { kind: "none" }, 7_000);
  const japanese = await merging(world);
  expect(head(japanese)).toContain('class="result-checks result-checks-conflict"');
  expect(head(japanese)).toContain("#372 は main と競合しているため、チェックが動きません。");
  expect(head(japanese)).toContain("push してください");
  expect(japanese).not.toMatch(MERGE_WAY);
  const english = await en(world);
  expect(head(english)).toContain("#372 conflicts with main, so the forge runs no checks on it.");
  const requests = await operatorPage(
    portsOver(world, "ada", null, "ja"),
    "t",
    { kind: "requests" },
    chromeFor("ja"),
  );
  expect(requests).toContain("プルリクエスト #372・取り込み先と競合");
  // A green on that head later means it was resolved without a push.
  await checked(world, { kind: "green", counted: 2, skipped: 0 }, 8_000);
  expect(head(await ja(world))).not.toContain("競合");
});

test("a head moved outside rondo is shown with its commits, and the press names the new head (rondo#412)", async () => {
  const world = await approved();
  await published(world);
  await checked(world, { kind: "green", counted: 2, skipped: 0 });
  await reportToRequest(
    threadOf(world),
    "i-r",
    {
      kind: "moved",
      pullRequestUrl: PR,
      from: "abc1234",
      to: "fff0000aa",
      commits: [{ sha: "fff0000aa", subject: "resolve the conflict with main" }],
    },
    8_000,
  );
  // Moved, and nothing read on the new head: the old green is not its.
  const waiting = await merging(world);
  expect(head(waiting)).toContain("abc1234 → fff0000");
  expect(head(waiting)).toContain("resolve the conflict with main");
  expect(head(waiting)).toContain("実行中");
  expect(waiting).not.toMatch(MERGE_WAY);
  await reportToRequest(
    threadOf(world),
    "i-r",
    {
      kind: "checks",
      commit: "fff0000aa",
      reading: { kind: "green", counted: 2, skipped: 0 },
      moved: true,
    },
    9_000,
  );
  const green = await merging(world);
  expect(green).toContain("そのコミットも含めてマージする");
  expect(green).toContain("この作業のものではないコミットが 1 件");
  // The screen the link leads to presses the new head, and says what it takes in.
  const screen = await mergeScreen(world);
  expect(screen).toContain('name="head" value="fff0000aa"');
  expect(screen).toContain("そのコミットも含めてマージする");
  expect(screen).toContain("この作業のものではないコミットが 1 件");
});

test("merged outside rondo ends the request: who merged it, no press, and the clock stops (rondo#413)", async () => {
  const world = await approved();
  await published(world);
  await checked(world, { kind: "green", counted: 2, skipped: 0 });
  await reportToRequest(
    threadOf(world),
    "i-r",
    { kind: "mergedOutside", pullRequestUrl: PR, into: "main", by: "someone", mergeCommit: "m1" },
    61_000,
  );
  const japanese = await merging(world);
  expect(head(japanese)).toContain("GitHub 上で someone が main にマージしました");
  expect(head(japanese)).toContain("でマージ");
  expect(japanese).not.toMatch(MERGE_WAY);
  expect(head(await merging(world, "en"))).toContain("Merged into main by someone on the forge");
});

test("closed unmerged on the forge ends the request, and no press is offered (rondo#413)", async () => {
  const world = await approved();
  await published(world);
  await checked(world, { kind: "green", counted: 2, skipped: 0 });
  await reportToRequest(threadOf(world), "i-r", { kind: "closed", pullRequestUrl: PR }, 61_000);
  const japanese = await merging(world);
  expect(head(japanese)).toContain("マージされないまま、GitHub 上で閉じられました。");
  expect(head(japanese)).not.toContain("マージはあなたが行います");
  // Nothing remains, and the merge is not drawn as a step still ahead or done.
  expect(head(japanese)).not.toContain("gov-step gov-yours");
  expect(head(japanese)).toContain("で閉じられた");
  expect(japanese).not.toMatch(MERGE_WAY);
  const requests = await operatorPage(
    portsOver(world, "ada", null, "ja"),
    "t",
    { kind: "requests" },
    chromeFor("ja"),
  );
  expect(requests).toContain("プルリクエスト #372・マージされずに閉じられました");
});

test("a lap reads only its own lines, and a branch pushed back to its head reads that head's checks (Codex round 2)", () => {
  const said = (entries: [string, string, number][]) =>
    new Map(entries.map(([id, body, atMs]) => [id, { body, atMs }]));
  const lines: [string, string, number][] = [
    ["report-published-lap", `Lap 'lap' was published: pull request ${PR} was opened.`, 1],
    [
      "report-checks-lap-green",
      "Lap 'lap' is green: 2 check(s) on commit 'aaa', and 2 passed and 0 were skipped, and none failed.",
      2,
    ],
    // Another lap whose id starts with this one's.
    [
      "report-moved-lap-next-bbb",
      "Lap 'lap-next' moved: pull request x is at commit 'bbb', and the head the lap pushed and rondo read is 'ccc'.",
      3,
    ],
  ];
  expect(resultOf(said(lines), "lap")).toMatchObject({ moved: null, checks: { kind: "green" } });
  const back = resultOf(
    said([
      ...lines,
      [
        "report-moved-lap-bbb",
        "Lap 'lap' moved: pull request x is at commit 'bbb', and the head the lap pushed and rondo read is 'aaa'.",
        4,
      ],
      [
        "report-checks-lap-red-bbb",
        "Lap 'lap' is not green: on commit 'bbb' the forge reports 'build' as failed.",
        5,
      ],
      [
        "report-moved-lap-aaa",
        "Lap 'lap' moved: pull request x is at commit 'aaa', and the head the lap pushed and rondo read is 'aaa'.",
        6,
      ],
    ]),
    "lap",
  );
  // Back on its own head: not moved, and the red on the other head is not its.
  expect(back).toMatchObject({ moved: null, checks: { kind: "green" }, checksCommit: "aaa" });
});

// --- rondo#417 (D-0105): rondo offers to settle the conflict ----------------

/** A page whose host can start a conflict fix, the lap admitted under `dec-1`. */
const fixing = async (world: ReturnType<typeof fresh>, lang: "en" | "ja" = "ja") =>
  await operatorPage(
    { ...portsOver(world, "ada", null, lang, "dec-1"), mergeable: true, fixesConflicts: true },
    "t",
    view,
    chromeFor(lang),
    null,
    null,
    () => "i-fix",
  );

async function conflicting() {
  const world = await approved();
  await published(world);
  await reportToRequest(
    threadOf(world),
    "i-r",
    { kind: "conflict", pullRequestUrl: PR, head: "abc1234", base: "main", baseCommit: "b1" },
    7_000,
  );
  return world;
}

test("a conflicting pull request is offered rondo's fix at the top, as a press under the lap's approval", async () => {
  const world = await conflicting();
  const japanese = await fixing(world);
  expect(japanese).toContain('action="/fix-conflict?lang=ja"');
  expect(japanese).toContain('name="iteration" value="i-r"');
  expect(japanese).toContain('name="scope_decision" value="dec-1"');
  expect(japanese).toContain('name="successor" value="i-fix"');
  expect(japanese).toContain("rondo に競合を解消してもらう");
  expect(japanese).toContain("#372 は main と競合していて、チェックが動きません。");
  // The band names both ways while the press is there (D-0106: the press is above it).
  expect(head(japanese)).toContain("すぐ下の「次にやること」のボタンで rondo に解消させるか");
  // The pull request is still open, so no other scope is offered beside the
  // press (rondo#437), and the row that would carry one is not drawn.
  expect(japanese).not.toContain('class="thread-acts');
  const english = await fixing(world, "en");
  expect(english).toContain("Have rondo resolve the conflict");
  // No port, no approval, or no conflict: no press, and the band says the old way.
  const bare = await merging(world);
  expect(bare).not.toContain("/fix-conflict?");
  expect(head(bare)).toContain("push してください");
  expect(
    await operatorPage(
      { ...portsOver(world, "ada", null, "ja"), fixesConflicts: true },
      "t",
      view,
      chromeFor("ja"),
      null,
      null,
      () => "i-fix",
    ),
  ).not.toContain("/fix-conflict?");
  const green = await approved();
  await published(green);
  await checked(green, { kind: "green", counted: 2, skipped: 0 });
  expect(await fixing(green)).not.toContain("/fix-conflict?");
});

test("while the fix's attempt runs, no press is drawn and the band says rondo is settling it", async () => {
  const world = await conflicting();
  const succeeded = await world.store.reserve({
    numbers: null,
    id: "i-fix",
    request: "#291 の文言を分けて",
    plan: planFor("i-fix"),
    spend: null,
    scopeSpend: null,
    claim: null,
    nowMs: 8_000,
    supersedesIterationId: "i-r",
    requestMessageId: "req-r",
    runId: "rondo-i-fix",
    topicBranch: "rondo/i-fix",
    workspace: "/srv/work/i-fix",
  });
  expect(succeeded.kind).toBe("reserved");
  const japanese = await fixing(world);
  expect(japanese).not.toContain("/fix-conflict?");
  expect(head(japanese)).toContain("rondo が main を取り込む新しい回で、競合を解消しています。");
  expect(head(japanese)).not.toContain("push してください");
});

test("a fix's publish names the open pull request and its branch, up the line, and opens nothing", async () => {
  const world = await conflicting();
  const fixPlan = (id: string) => ({
    ...planFor(id),
    take_in: {
      commit: "c".repeat(40),
      branch: `rondo/base/rondo-${id}`,
      remote_branch: "main",
      paths: [],
      cause: "conflict",
    },
  });
  for (const [id, above] of [
    ["i-fix", "i-r"],
    ["i-fix2", "i-fix"],
  ] as const) {
    const reserved = await world.store.reserve({
      numbers: null,
      id,
      request: "#291 の文言を分けて",
      plan: fixPlan(id),
      spend: null,
      scopeSpend: null,
      claim: null,
      nowMs: 8_000,
      supersedesIterationId: above,
      requestMessageId: "req-r",
      runId: `rondo-${id}`,
      topicBranch: `rondo/${id}`,
      workspace: `/srv/work/${id}`,
    });
    expect(reserved.kind).toBe("reserved");
  }
  const read = async (id: string) => {
    const row = await world.store.read(id);
    if (row.kind !== "read") throw new Error(id);
    return await pullRequestUpdated(row.record, world.store, world.record);
  };
  // The first fix goes onto the branch the lap opened the pull request from.
  expect(await read("i-fix")).toEqual({ url: PR, onto: "rondo/i-r" });
  // A fix of that fix, once it is published onto it, goes onto the same branch.
  await reportToRequest(
    threadOf(world),
    "i-fix",
    { kind: "published", pullRequestUrl: PR, onto: "rondo/i-r" },
    9_000,
  );
  expect(await read("i-fix2")).toEqual({ url: PR, onto: "rondo/i-r" });
  // A lap that is below no published one opens its own, as before.
  expect(await read("i-r")).toBeNull();
  // A fix that took the base in and was then revised hands its pull request on:
  // the revision takes nothing in, and still goes onto the same branch (Codex round 1).
  const revisedFix = await world.store.reserve({
    numbers: null,
    id: "i-fix3",
    request: "#291 の文言を分けて",
    plan: planFor("i-fix3"),
    spend: null,
    scopeSpend: null,
    claim: null,
    nowMs: 9_500,
    supersedesIterationId: "i-fix2",
    requestMessageId: "req-r",
    runId: "rondo-i-fix3",
    topicBranch: "rondo/i-fix3",
    workspace: "/srv/work/i-fix3",
  });
  expect(revisedFix.kind).toBe("reserved");
  expect(await read("i-fix3")).toEqual({ url: PR, onto: "rondo/i-r" });
  // A pull request merged since is not pushed onto.
  await reportToRequest(
    threadOf(world),
    "i-fix",
    { kind: "merged", pullRequestUrl: PR, into: "main", method: "squash", mergeCommit: "d1" },
    9_800,
  );
  expect(await read("i-fix3")).toMatchObject({
    refusal: expect.stringContaining("merged or closed"),
  });
  // And the result is the fix's once it is published: the same pull request.
  const said = await world.record.threadMessages();
  if (said.kind !== "read") throw new Error(said.reason);
  const byId = threadsOf(said.messages, new Set(), new Map()).byId;
  expect(resultOf(byId, "i-fix")?.url).toBe(PR);
});

test("D-0105: a question about the request leaves the fix offered; one about this line withholds it", async () => {
  const world = await conflicting();
  const ask = async (messageId: string, bases: { form: string; [key: string]: string }[]) =>
    expect(
      await world.record.recordThreadMessage({
        messageId,
        body: "Which one did you mean?",
        authorKind: "drafter",
        authorId: "the drafter",
        inReplyTo: "req-r",
        atMs: 8_000,
        bases,
        asks: true,
      }),
    ).toMatchObject({ kind: "recorded" });
  // The drafter's question about the request: answered in its own box, and the
  // fix is still the next step, above it (D-0106 rule 4 as D-0105 reads it).
  await ask("ask-request", [{ form: "message", messageId: "req-r" }]);
  const offered = await fixing(world);
  expect(offered).toContain('action="/fix-conflict?lang=ja"');
  // A question about this line's own lap withholds it, as the scope's verdict would.
  await ask("ask-line", [{ form: "iteration", iterationId: "i-r" }]);
  expect(await fixing(world)).not.toContain("/fix-conflict?");
});

test("D-0105: the thread's conflict line says rondo can resolve it, and the update's note opens nothing", async () => {
  const world = await conflicting();
  const said = await world.record.threadMessages();
  if (said.kind !== "read") throw new Error(said.reason);
  const conflict = said.messages.find((one) => one.messageId.startsWith("report-conflict-i-r-"));
  expect(conflict?.body).toContain("rondo can resolve it in one more attempt");
  expect(conflict?.body).not.toContain("does not resolve");
  expect(EN.publishNoteUpdate).toContain("opens no pull request");
  expect(chromeFor("ja").publishNoteUpdate).toContain("プルリクエストは作らず");
});
