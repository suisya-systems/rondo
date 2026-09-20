/**
 * What the gate found outside the files a work keeps reaches the page
 * (rondo#294, `D-0073` rule 5).
 *
 * **The comparison existed and was invisible.** Since rondo#293 the gate reads
 * what a lap changed and compares it with the files its work keeps to itself,
 * and the result was appended to the conductor's report -- which the command
 * line prints and nothing else does. A person who starts work from the page and
 * answers it from the page met a collision when the two changes were merged,
 * which is the thing the comparison is for. These tests hold the other end
 * open: the same facts, drawn where the press is.
 *
 * **They assert wording and not markup.** What is pinned is that a sentence
 * from the set reaches the screen unfolded, that it is drawn in the set the
 * request resolved to, and that no identifier of rondo's rides along with it
 * (`D-0076` sections 2 and 3). All three survive the page being drawn by
 * something else.
 */
import { expect, test } from "vitest";

import { pageReach } from "../../src/access/cli.js";
import type { ClaimReach } from "../../src/access/page/contract.js";
import { chromeFor, EN } from "../../src/access/wording.js";
import { fresh, gateWithChecks, operatorPage, portsOver, structured } from "./page-world.js";

const COLLIDED: ClaimReach = {
  kind: "outside",
  collided: ["src/store/sqlite.ts"],
  unheld: ["README.md"],
};

/** The gate as the page draws it, with this much found outside what the work keeps. */
async function gatePage(reach: ClaimReach | undefined, lang = EN): Promise<string> {
  const world = fresh();
  await gateWithChecks(world);
  const material = async () => ({
    ...(await structured()),
    ...(reach === undefined ? {} : { reach }),
  });
  return await operatorPage(
    { ...portsOver(world, "ada", []), material },
    "t",
    { kind: "thread", messageId: "req-1", to: null },
    lang,
  );
}

/**
 * Whether some text can be read without opening anything -- `gate-elements`'
 * own question, asked here for the same reason: a fold is not a drop, and a
 * collision behind one is still a collision the reader has to go looking for.
 */
function readableWithoutOpening(html: string, text: string): boolean {
  const at = html.indexOf(text);
  if (at === -1) {
    return false;
  }
  let depth = 0;
  const shut: number[] = [];
  for (const found of html.slice(0, at).matchAll(/<details\b[^>]*>|<\/details>/g)) {
    if (found[0].startsWith("</")) {
      depth -= 1;
      if (shut.at(-1) === depth) {
        shut.pop();
      }
    } else {
      if (!/\bopen\b/.test(found[0])) {
        shut.push(depth);
      }
      depth += 1;
    }
  }
  return shut.length === 0;
}

test("a collision the gate found is on the page, unfolded, beside the press", async () => {
  const html = await gatePage(COLLIDED);
  expect(html).toContain(EN.reachHeading);
  expect(readableWithoutOpening(html, EN.reachCollided(["src/store/sqlite.ts"]))).toBe(true);
  // The person's own path, as itself (D-0076 rule 2.3).
  expect(html).toContain("src/store/sqlite.ts");
});

test("a path nobody keeps is said too, and said as the lesser of the two", async () => {
  const html = await gatePage(COLLIDED);
  expect(html).toContain(EN.reachUnheld(["README.md"]));
  // Both stand together: the collision is not softened by the note beside it.
  expect(html).toContain(EN.reachCollided(["src/store/sqlite.ts"]));
});

test("no line of rondo's is named where the person reads it (D-0076)", async () => {
  const html = await gatePage(COLLIDED);
  // The card itself, and not the page around it: the thread this gate is in
  // names the lap in its own locators, which is not what rule 2 is about.
  const card = /<section id="reach"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
  expect(card).toContain("src/store/sqlite.ts");
  // The line the ledger holds this against is `i-0001`, and the one it collides
  // with has an id of its own. Neither is in what the person is given to read:
  // the card says the paths and what is happening to them.
  expect(card).not.toMatch(/\bi-\d{4}\b/);
});

test("the comparison is drawn in the language the request resolved to (D-0079)", async () => {
  const ja = chromeFor("ja");
  const html = await gatePage(COLLIDED, ja);
  expect(html).toContain(ja.reachHeading);
  expect(html).toContain(ja.reachCollided(["src/store/sqlite.ts"]));
  expect(html).not.toContain(EN.reachHeading);
});

test("a comparison that could not be taken says so, and keeps rondo's reason in the fold", async () => {
  const html = await gatePage({ kind: "unread", reason: "git would not say" });
  expect(readableWithoutOpening(html, EN.reachUnread)).toBe(true);
  // rondo's own words are there for whoever maintains it, and not in front of
  // the person (D-0076 rule 4.5).
  expect(html).toContain("git would not say");
  expect(readableWithoutOpening(html, "git would not say")).toBe(false);
});

test("nothing is drawn where the work stayed inside what it keeps", async () => {
  for (const reach of [{ kind: "inside" } as const, undefined]) {
    const html = await gatePage(reach);
    expect(html).not.toContain(EN.reachHeading);
    expect(html).not.toContain(EN.reachUnread);
  }
});

test("what crosses to the page is the paths, once each, and no line", () => {
  const reach = pageReach({
    kind: "outside",
    lineageId: "i-0001",
    held: [
      { lineageId: "i-store", sharedPaths: ["src/store/sqlite.ts"] },
      // Two works can keep one file between them; the person is told about it
      // once, because the file is what they act on.
      { lineageId: "i-other", sharedPaths: ["src/store/sqlite.ts", "src/store/lanes.ts"] },
    ],
    unheld: ["README.md"],
  });
  expect(reach).toEqual({
    kind: "outside",
    collided: ["src/store/sqlite.ts", "src/store/lanes.ts"],
    unheld: ["README.md"],
  });
});

test("the two cases with nothing to draw cross as themselves", () => {
  expect(pageReach({ kind: "inside" })).toEqual({ kind: "inside" });
  expect(pageReach({ kind: "uncompared", reason: "git would not say" })).toEqual({
    kind: "unread",
    reason: "git would not say",
  });
});

test("the collision is quoted in the answering box, where the press is", async () => {
  const html = await gatePage(COLLIDED);
  // The box keeps what a press is answered over, because the card it came from
  // drops below the thread at 1280 (D-0082 rule 7). The section is the one the
  // standing findings are quoted in.
  const standing = /<section id="standing"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
  expect(standing).toContain(EN.reachCollided(["src/store/sqlite.ts"]));
  // The path nobody keeps blocks nothing, so it is not something to answer
  // over and stays on the card.
  expect(standing).not.toContain(EN.reachUnheld(["README.md"]));
});
