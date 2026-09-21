/**
 * The next step, named, weighted and answering its press (rondo#375, lap 11's
 * N-48 and N-52).
 *
 * Four of the owner's seven stops on lap 11 were the page not saying something:
 * *Set the scope* was the quietest thing on a thread where it was the only way
 * forward, *Publish* did not say it opens a pull request, and neither a start
 * nor a publish showed that the press had been received. These hold the markup
 * that says each of those; `page-scripts.test.ts` holds what the script does
 * with it.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

import { PRIMARY, SECONDARY } from "../../src/access/page/vocabulary.js";
import { chromeFor, EN } from "../../src/access/wording.js";
import { fresh, gateWithChecks, openRequest, operatorPage, portsOver } from "./page-world.js";

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

/** The class list of the element whose opening tag carries `id="<id>"`. */
function classOf(html: string, id: string): string {
  const tag = html.slice(html.lastIndexOf("<", html.indexOf(`id="${id}"`)));
  return /class="([^"]*)"/.exec(tag.slice(0, tag.indexOf(">")))?.[1] ?? "";
}

/** The opening tag of the first button whose text is `label`. */
function buttonTag(html: string, label: string): string {
  const end = html.indexOf(`>${label}</button>`);
  expect(end).toBeGreaterThan(-1);
  return html.slice(html.lastIndexOf("<button", end), end + 1);
}

const threadOf = (messageId: string) => ({ kind: "thread" as const, messageId, to: null });

test("a request with no work yet draws *set the scope* filled: it is the only way forward", async () => {
  const world = fresh();
  await openRequest(world, "req-1", "add a retry budget");
  const html = await operatorPage(portsOver(world), "t", threadOf("req-1"));
  expect(classOf(html, "scope-req-1")).toBe(`${PRIMARY} h-9 px-4 text-sm`);
});

test("a thread with a gate waiting leaves the gate as the press, and the scope outlined", async () => {
  const world = fresh();
  await gateWithChecks(world);
  const html = await operatorPage(portsOver(world), "t", threadOf("req-1"));
  expect(classOf(html, "scope-req-1")).toBe(`${SECONDARY} h-7 px-3 text-meta`);
});

test("an approved lap's next step is drawn filled and named for what it does: a pull request", async () => {
  const world = fresh();
  await gateWithChecks(world);
  await world.store.transition(
    "i-0001",
    "awaiting_human",
    "closed",
    { gateOutcome: "answered_and_forwarded" },
    5_000,
  );
  const html = await operatorPage(
    portsOver(world, "ada", [], null, null, async () => DRY_RUN),
    "t",
    threadOf("req-1"),
  );
  expect(classOf(html, "publish-i-0001")).toBe(`${PRIMARY} h-9 px-4 text-sm`);
  expect(html).toContain(`id="publish-i-0001"`);
  expect(html).toContain(">Open a pull request</a>");
  // The scope is another scope now, and a second filled way would be a choice.
  expect(classOf(html, "scope-req-1")).toBe(`${SECONDARY} h-7 px-3 text-meta`);
  // And in Japanese, from what it does rather than from the English line.
  expect(chromeFor("ja").publishAction).toBe("プルリクエストを作る");
});

test("every press says what it is doing once pressed, and a long one what it waits on", async () => {
  const world = fresh();
  await gateWithChecks(world);
  // The gate's approve. Its *ask for a change* needs an approval to count a
  // second lap against, which this lap has none of; the source check below
  // holds that one.
  const gate = await operatorPage(portsOver(world), "t", threadOf("req-1"));
  expect(gate).toContain(`data-busy="${EN.approveBusy}"`);
  await world.store.transition(
    "i-0001",
    "awaiting_human",
    "closed",
    { gateOutcome: "answered_and_forwarded" },
    5_000,
  );
  const publish = await operatorPage(
    portsOver(world, "ada", [], null, null, async () => DRY_RUN),
    "t",
    { kind: "publish", iterationId: "i-0001" },
  );
  expect(buttonTag(publish, EN.publishAction)).toContain(`data-busy="${EN.publishBusy}"`);
  // Hidden until the press: with script off the landing page is what answers.
  expect(publish).toContain(`hidden="" role="status"`);
  expect(publish).toContain(EN.publishBusyNote);
});

const source = (path: string) =>
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../..", path), "utf8");

test("the presses that start a lap carry their busy label and what a lap waits on", () => {
  // *Ask for a change* starts the second lap, and waits on it as a start does.
  const revise = source("src/access/web.tsx");
  expect(revise).toContain("data-busy={wording.reviseBusy}");
  expect(revise.match(/\{wording\.lapBusyNote\}/g)).toHaveLength(1);
  const scope = source("src/access/screens/scope.tsx");
  // Both starts -- the plan's own and the one under an approval -- and every
  // scope press.
  expect(scope.match(/data-busy=\{wording\.startBusy\}/g)).toHaveLength(2);
  expect(scope.match(/\{wording\.lapBusyNote\}/g)).toHaveLength(2);
  expect(scope.match(/data-busy=\{wording\.scopeBusy\}/g)).toHaveLength(3);
});

test("setup's last word is the one that opens the page, and no terminal step comes after it", () => {
  const setup = source("scripts/dogfood-env.sh");
  const ready = setup.slice(setup.lastIndexOf("cat <<READY"), setup.lastIndexOf("\nREADY"));
  const lines = ready.split("\n").filter((line) => line.trim() !== "");
  expect(lines.at(-1)).toBe("  rondo");
  // The terminal's way in is kept, beside the environment, and not on screen.
  expect(ready).not.toContain("bin/rondo.mjs");
  expect(ready).toContain("$terminal_notes");
  expect(setup).toMatch(/cat >"\$terminal_notes" <<TERMINAL[\s\S]*bin\/rondo\.mjs start/);
});
