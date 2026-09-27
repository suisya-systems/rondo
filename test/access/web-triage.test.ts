/**
 * What rondo would ask for next, as the page draws it (D-0097 points 2.4,
 * 4.2 to 4.6), over a real store whose proposal row the real host wrote.
 *
 * What is held: under the request box, one block per repository; with no goal
 * the block leads to a drafted goal and lists nothing; a candidate is drawn in
 * full with both presses; *put it in the box* draws the box holding the
 * drafted request, written out with its open points; and nothing of it is
 * amber.
 */
import { expect, test } from "vitest";

import type { CommandOutcome } from "../../src/access/forge.js";
import { triageHost } from "../../src/access/triage-host.js";
import { EN } from "../../src/access/wording.js";
import { bytesOf, fresh, operatorPage, portsOver } from "./page-world.js";

const listed: CommandOutcome = {
  commandLine: "gh api repos/o/r/issues",
  status: 0,
  signal: null,
  stdout: JSON.stringify({ number: 7, title: "setup asks for a shell", labels: [] }),
  stderr: "",
  spawnError: null,
};

async function proposed() {
  let minted = 0;
  const world = fresh();
  await world.record.recordGoal({
    goalId: "goal-1",
    repository: "o/r",
    clauses: [{ said: "they never open a terminal", unmetIf: "a terminal is ever required" }],
    writtenBy: "ada",
    writtenAtMs: 1_000,
  });
  const host = triageHost({
    store: world.store,
    record: world.record,
    repositories: async () => ["o/r"],
    listIssues: async () => await Promise.resolve(listed),
    runDrafter: async () =>
      await Promise.resolve({
        kind: "answered" as const,
        costUsd: 0.02,
        finalMessage: JSON.stringify({
          candidates: [
            {
              key: "issue:o/r#7",
              clause: 1,
              request: "Make setup in o/r finish without a shell",
              why: "Setup asks for a terminal today.",
              openPoints: [{ point: "Windows", recommendation: "the same path as Linux" }],
            },
          ],
        }),
      }),
    forgeHost: null,
    now: () => 2_000,
    mintId: () => `triage-${String(++minted)}`,
    language: null,
    log: () => undefined,
  });
  host.kick();
  await host.idle();
  const ports = {
    ...portsOver(world),
    triageRepositories: async () => ["o/r", "o/rondo"],
    triageWritable: true,
  };
  return { world, ports, host };
}

test("under the request box: the candidate in full with both presses, and a block with no goal leads to one", async () => {
  const { ports } = await proposed();
  const html = await operatorPage(ports, "t", { kind: "requests" });
  const section = html.slice(html.indexOf('class="triage"'));
  expect(html.indexOf('class="triage"')).toBeGreaterThan(html.indexOf('id="composer"'));
  expect(section).toContain(EN.triageHeading);
  expect(section).toContain("Make setup in o/r finish without a shell");
  expect(section).toContain("1. they never open a terminal");
  expect(section).toContain("https://github.com/o/r/issues/7");
  expect(section).toContain("the same path as Linux");
  expect(section).toContain(EN.triagePutInBox);
  expect(section).toContain('action="/not-now?lang=en"');
  expect(section).toContain('value="issue:o/r#7"');
  // Point 2.4 (a): no goal, nothing ranked -- the press is to write one.
  expect(section).toContain(EN.triageNoGoal);
  expect(section).toContain("/?goal=o%2Frondo&amp;lang=en");
  // D-0082 rule 2: nothing here waits on the person.
  expect(section.slice(0, section.indexOf("</section>"))).not.toMatch(/amber|warn/);
});

test("what a redraw could change under a person is marked for the wash, and the clock's own line is not (rondo#494)", async () => {
  const { ports } = await proposed();
  const html = await operatorPage(ports, "t", { kind: "requests" });
  const section = html.slice(html.indexOf('class="triage"'));
  // The card the flow could re-read out from under a person.
  expect(section).toContain('class="triage-card" data-can-act="candidate"');
  // **And its read line is left out of what is compared**: it moves with the
  // clock, so a card carrying it would wash itself once a minute.
  expect(section).toContain('class="triage-read" data-ticks=""');
  // The word the mark wears where a browser was asked for no motion, resolved
  // by the server in this request's language.
  expect(html).toContain(`data-changed-word="${EN.changedMark}"`);
  expect(html).toContain('<script src="/changed.js" defer="">');
  // Both halves of what is drawn for it: the fade, and the static mark instead
  // of the fade.
  const styles = bytesOf("page/app.css").toString("utf8");
  expect(styles).toContain("@keyframes just-changed");
  expect(styles).toContain("animation: just-changed 3s ease-out");
  expect(styles).toMatch(
    /@media \(prefers-reduced-motion: reduce\) \{\s*\[data-just-changed\] \{\s*animation: none;/,
  );
  expect(styles).toContain("content: attr(data-just-changed)");
});

test("put it in the box draws the box holding the drafted request, open points written out", async () => {
  const { ports } = await proposed();
  // The box is drawn only where a message can be sent: a minter says so.
  const html = await operatorPage(
    ports,
    "t",
    { kind: "requests", take: { proposalId: "triage-1", candidate: "issue:o/r#7" } },
    EN,
    () => "msg-1",
  );
  const at = html.indexOf("data-draft-take");
  const box = html.slice(at, html.indexOf("</textarea>", at));
  expect(box).toContain('data-draft-take="triage-1:issue:o/r#7"');
  expect(box).toContain("Make setup in o/r finish without a shell");
  expect(box).toContain("- Windows: the same path as Linux");
  expect(box).toContain("o/r#7");
  // A candidate the proposal does not hold fills nothing.
  const none = await operatorPage(
    ports,
    "t",
    { kind: "requests", take: { proposalId: "triage-1", candidate: "issue:o/r#99" } },
    EN,
    () => "msg-1",
  );
  expect(none).toContain("<textarea");
  expect(none).not.toContain("data-draft-take");
});

test("the goal page drafts rondo's own completion definition, and keeps a kept goal's words", async () => {
  const { ports } = await proposed();
  // React spells an apostrophe `&#x27;`; the words are compared as read.
  const drafted = (
    await operatorPage(ports, "t", { kind: "goal", repository: "o/rondo" })
  ).replaceAll("&#x27;", "'");
  expect(drafted).toContain(EN.goalDraft);
  expect(drafted).toContain(EN.goalDraftClauses[0] ?? "missing");
  expect(drafted).toContain('action="/goal?lang=en"');
  // rondo#408: the press is above the clauses, under the heading and the lead.
  expect(drafted.indexOf(EN.goalKeep)).toBeLessThan(drafted.indexOf('id="clause-1"'));
  expect(drafted.indexOf(EN.goalKeep)).toBeGreaterThan(drafted.indexOf(EN.goalLead));
  const kept = await operatorPage(ports, "t", { kind: "goal", repository: "o/r" });
  expect(kept).toContain("they never open a terminal");
  expect(kept).not.toContain(EN.goalDraft);
  // Without a write port the form is drawn and its press is not.
  const readOnly = await operatorPage({ ...ports, triageWritable: false }, "t", {
    kind: "goal",
    repository: "o/r",
  });
  expect(readOnly).not.toContain(EN.goalKeep);
});

test("a box taken from an older proposal still fills after a newer reading is written", async () => {
  const { world, ports, host } = await proposed();
  // A new goal moves the material, so the host writes a second row.
  await world.record.recordGoal({
    goalId: "goal-2",
    repository: "o/r",
    clauses: [{ said: "they never open a terminal", unmetIf: "a terminal is ever required" }],
    writtenBy: "ada",
    writtenAtMs: 1_500,
  });
  host.kick();
  await host.idle();
  expect((await world.record.latestTriage()).map((row) => row.proposalId)).toEqual(["triage-2"]);
  // Before that reading, a changed goal draws "not read yet", never the old ranking.
  await world.record.recordGoal({
    goalId: "goal-3",
    repository: "o/r",
    clauses: [{ said: "something else entirely", unmetIf: "it is not so" }],
    writtenBy: "ada",
    writtenAtMs: 1_800,
  });
  const stale = await operatorPage(ports, "t", { kind: "requests" });
  expect(stale).toContain(EN.triageNotReadYet);
  expect(stale).not.toContain(EN.triagePutInBox);
  const html = await operatorPage(
    ports,
    "t",
    { kind: "requests", take: { proposalId: "triage-1", candidate: "issue:o/r#7" } },
    EN,
    () => "msg-1",
  );
  expect(html).toContain('data-draft-take="triage-1:issue:o/r#7"');
});

test("a suggestion is drawn as the decision it suggests, not as advice (rondo#492)", async () => {
  const { asDecision } = await import("../../src/access/page/triage.js");
  // Lap 18's prefills, and the English framings.
  expect(asDecision("進めずに争点として提示することを推奨")).toBe("進めずに争点として提示する");
  expect(asDecision("読み取り側に合わせることを推奨します。")).toBe("読み取り側に合わせる");
  expect(asDecision("案 A を推奨")).toBe("案 A");
  expect(asDecision("推奨: キーチェーンから読む")).toBe("キーチェーンから読む");
  expect(asDecision("Recommended: keep it one release")).toBe("Keep it one release");
  expect(asDecision("I recommend that we keep the flag")).toBe("We keep the flag");
  // A decision already, or nothing left once stripped, stays as written.
  expect(asDecision("The keychain")).toBe("The keychain");
  expect(asDecision("npm ci under src/access")).toBe("npm ci under src/access");
  expect(asDecision("推奨")).toBe("推奨");
});

test("a candidate still mixing scripts is marked on the card, on a runner-up and in the ask (rondo#492)", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { TriageSection, triageBlocks } = await import("../../src/access/page/triage.js");
  const one = (number: number) => ({
    key: `issue:o/r#${String(number)}`,
    clause: 1,
    request: `o/r の репозиторий ${String(number)}`,
    why: "理由",
    openPoints: [{ point: "p", recommendation: "r" }],
    source: { form: "issue" as const, repository: "o/r", number },
    title: "t",
    labels: [],
    mixedScript: true,
  });
  const goal = {
    goalId: "g-1",
    repository: "o/r",
    clauses: [{ said: "s", unmetIf: "u" }],
    writtenBy: "ada",
    writtenAtMs: 1,
  };
  const payload = {
    repository: "o/r",
    goalId: "g-1",
    ranked: [one(1), one(2)],
    withheld: [],
    read: { issues: 2, stopped: 0 },
    unavailable: null,
  };
  const ask = {
    askId: "ask-1",
    repository: "o/r",
    goalId: "g-1",
    scopeDecisionId: "sd-1",
    proposalId: "t-1",
    candidate: "issue:o/r#1",
    points: [{ point: "p", recommendation: "r" }],
    request: null,
    why: null,
    askedAtMs: 2,
    answer: null,
  };
  const html = renderToStaticMarkup(
    TriageSection({
      wording: EN,
      token: "t",
      blocks: triageBlocks(
        EN,
        {
          repositories: ["o/r"],
          goals: [goal],
          latest: [
            {
              proposalId: "t-1",
              drafter: "d",
              repository: "o/r",
              payload: {},
              snapshot: {},
              createdAtMs: 1,
            },
          ],
          payloads: new Map([["t-1", payload]]),
          goalScopes: new Map([["g-1", { state: "running" as const }]]),
          flowAsks: [ask],
        },
        3,
      ),
    }),
  );
  // The card, the runner-up and the ask each say it; the ask ties it to the field.
  expect(html.split(EN.triageMixedScript)).toHaveLength(4);
  expect(html).toContain('aria-describedby="flow-ask-o-r-mixed"');
});

test("an ask left open over a candidate an earlier answer covers is not waited on (rondo#504)", async () => {
  const { waitingPointsAsk } = await import("../../src/access/page/triage.js");
  const ask = (askId: string, answer: null | { answers: string[] }) => ({
    askId,
    repository: "o/r",
    goalId: "g-1",
    scopeDecisionId: "sd-1",
    proposalId: "t-1",
    candidate: "issue:o/r#1",
    points: [{ point: "p", recommendation: "r" }],
    request: null,
    why: null,
    askedAtMs: 2,
    answer:
      answer === null
        ? null
        : { ...answer, answeredBy: "ada", answeredAtMs: 3, request: null, why: null },
  });
  const payload = {
    repository: "o/r",
    goalId: "g-1",
    ranked: [{ key: "issue:o/r#1" }],
  } as never;
  const open = ask("ask-2", null);
  expect(waitingPointsAsk([open], "g-1", payload, [])).toBe(open);
  expect(waitingPointsAsk([ask("ask-1", { answers: ["a"] }), open], "g-1", payload, [])).toBe(
    undefined,
  );
});
