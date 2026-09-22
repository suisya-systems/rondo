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
import { fresh, operatorPage, portsOver } from "./page-world.js";

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
