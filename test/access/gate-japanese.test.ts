/**
 * rondo's own sentences on the gate are in the page's language, and git's are
 * not in front of the person.
 *
 * Two leftovers the Japanese screenshots found: what a reader did not look at
 * was drawn as the terminal's English lines on every page (rondo#69's
 * `readingCoverage`, joined), and a workspace that would not read put git's
 * command line and stderr in the body of *what changed* (D-0076 rule 4.5).
 */
import { expect, test } from "vitest";

import { chromeFor, EN } from "../../src/access/wording.js";
import { READING_COVERAGE } from "../../src/store/records.js";
import {
  fresh,
  gateWithChecks,
  modelFindings,
  operatorPage,
  portsOver,
  readableWithoutOpening,
  structured,
} from "./page-world.js";

const GIT_SAID =
  "git -C /work/gone rev-parse --verify --quiet refs/remotes/origin/main exited 128: " +
  "fatal: cannot change to /work/gone: No such file or directory";

async function gatePage(lang = EN, unreadable = false): Promise<string> {
  const world = fresh();
  await gateWithChecks(world);
  await modelFindings(world);
  const material = async () => ({
    ...(await structured()),
    ...(unreadable
      ? { work: { kind: "unreadable" as const, part: "history" as const, reason: GIT_SAID } }
      : {}),
  });
  const html = await operatorPage(
    { ...portsOver(world, "ada", []), material },
    "t",
    { kind: "thread", messageId: "req-1", to: null },
    lang,
  );
  return html.replaceAll("&#39;", "'").replaceAll("&amp;", "&");
}

test("the Japanese gate says what each reader did not look at in Japanese (rondo#69, D-0055)", async () => {
  const ja = chromeFor("ja");
  const html = await gatePage(ja);
  expect(html).toContain(ja.readingCovered("historyAndStatus"));
  expect(html).toContain(ja.readingCovered("model"));
  for (const line of Object.values(READING_COVERAGE).flat()) {
    expect(html, line).not.toContain(line);
  }
});

test("the English gate still says the terminal's own lines", async () => {
  const html = await gatePage(EN);
  expect(html).toContain(READING_COVERAGE.historyAndStatus.join(" "));
  expect(html).toContain(READING_COVERAGE.model.join(" "));
});

test("a workspace that would not read says so, and git's own line stays in the fold", async () => {
  for (const lang of [EN, chromeFor("ja")]) {
    const html = await gatePage(lang, true);
    expect(readableWithoutOpening(html, lang.changedUnreadable)).toBe(true);
    expect(html).toContain(GIT_SAID);
    expect(readableWithoutOpening(html, GIT_SAID)).toBe(false);
  }
});

test("the Japanese gate says what the worker ran in Japanese, apart from the reviewer's account (D-0104, #410)", async () => {
  const ja = chromeFor("ja");
  const html = await gatePage(ja);
  expect(html).toContain(ja.workerRan);
  expect(html).toContain(ja.workerRanUnrecorded);
  expect(html).toContain(`${ja.checksReader} · </span>${ja.whatItRead}`);
  expect(html).not.toContain(EN.workerRanUnrecorded);
});
