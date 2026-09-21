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

test("green on the head with nothing waiting, the next step is a merge press for that head", async () => {
  // Lap 11: green at 22:26:48, merged on GitHub at 22:29:50 -- 「rondoからマージボタン押せたらいいなぁ」.
  const world = await approved();
  await published(world);
  await checked(world, { kind: "green", counted: 7, skipped: 1 });
  const page = await merging(world);
  expect(page).toContain('action="/merge?lang=ja"');
  expect(page).toContain('name="head" value="abc1234"');
  expect(page).toContain('name="iteration" value="i-r"');
  expect(page).toContain("プルリクエストをマージする");
  expect(page).toContain('data-busy="マージしています…"');
  // With no merge port there is no press, and red or running is no press either.
  expect(await ja(world)).not.toContain("/merge?");
  const red = await approved();
  await published(red);
  await checked(red, { kind: "red", failed: ["build"], cancelled: [], timedOut: [] });
  expect(await merging(red)).not.toContain("/merge?");
  const running = await approved();
  await published(running);
  expect(await merging(running)).not.toContain("/merge?");
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
  expect(await merging(world)).not.toContain("/merge?");
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
  expect(japanese).not.toContain("/merge?");
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
