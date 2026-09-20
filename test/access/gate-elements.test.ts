/**
 * The answering box carries every element the gate had (DECISIONS.md D-0083
 * rule 9).
 *
 * **This file is a net, and it exists because the rule says a statement is not
 * enough.** D-0083 rule 9 ends: *"An element of the gate leaves the box only by
 * a decision that names it and says why. A redesign that omits one has not
 * decided anything; it has a bug."* Its own falsifier adds that the rule *"is
 * not enforceable by statement and needs a test"* -- and the entry records that
 * both mock-ups dropped two of these elements without anyone choosing to.
 *
 * **Written to survive the foundation changing.** The page moves from server
 * JSX to React, so nothing here reads a class name or a tag shape. What it
 * asserts is that a *field of this name* is submitted, that a *word from the
 * wording set* reaches the screen, that a *press* is or is not offered, and
 * that a finding is readable *without opening anything*. All four stay true
 * however the markup is produced; the entry point is the only line that has to
 * change when the box moves into the thread.
 *
 * The three cases below are rule 9's elements 1 to 4. Element 2's second half
 * -- `approveDespite` drawn as *its own press*, beside the recommendation
 * rather than as a relabelling of one button -- is what D-0083 decision 4
 * changes, so it arrives with the box that implements it and is asserted
 * there. What this file pins is that neither wording is ever lost.
 */
import { expect, test } from "vitest";
import { APPROVE_BODY } from "../../src/access/web.js";
import { EN } from "../../src/access/wording.js";
import {
  EVIDENCE,
  fresh,
  gateWithChecks,
  modelFindings,
  operatorPage,
  portsOver,
  structured,
} from "./page-world.js";

/** The gate as a person meets it, with a model finding standing over it. */
async function gateWithFinding(): Promise<string> {
  const world = fresh();
  await gateWithChecks(world);
  await modelFindings(world);
  return await operatorPage({ ...portsOver(world, "ada", []), material: structured }, "t", {
    kind: "answer",
    iterationId: "i-0001",
  });
}

/** The gate with both readings clean, so no finding stands over it. */
async function gateWithNoFinding(): Promise<string> {
  const world = fresh();
  await gateWithChecks(world);
  const appended = await world.store.appendReading(
    "i-0001",
    {
      drafter: "rondo/model/1/gpt-6-astra",
      verdict: "clear",
      findings: [],
      graded: [],
      evidence: EVIDENCE,
      unavailableReason: null,
    },
    4_000,
  );
  expect(appended.kind).toBe("appended");
  return await operatorPage({ ...portsOver(world, "ada", []), material: structured }, "t", {
    kind: "answer",
    iterationId: "i-0001",
  });
}

/**
 * Whether a form control of this name is submitted with the page.
 *
 * The `name` is the contract with the write port -- it is what arrives in the
 * body -- so it is the one part of a field that cannot be restyled away, and
 * it means the same thing whichever library drew the control.
 */
function submitsField(html: string, name: string): boolean {
  return new RegExp(`name=["']${name}["']`).test(html);
}

/** Every press the page offers, by the words on it. */
function pressLabels(html: string): readonly string[] {
  return [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map((found) =>
    (found[1] ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

/**
 * Whether some text can be read without opening anything.
 *
 * A fold is not a drop (D-0042): a folded claim is still in the document and
 * still recorded as shown. But rule 9.4 asks for the finding **unfolded**, so
 * "it appears in the HTML" is too weak a question. This walks the disclosures
 * enclosing the text and answers false if any of them is shut.
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

test("rule 9.1: the free-text 'what you checked' field is submitted with the answer", async () => {
  const html = await gateWithFinding();
  // The field itself, by the name the write port reads it under (D-0045).
  expect(submitsField(html, "verified")).toBe(true);
  // And it says where the words go, beside the press they go with.
  expect(html).toContain(EN.claimLabel);
  // **No `maxlength`.** A browser cuts a pasted claim silently, and a claim
  // recorded shorter than it was said is one the person did not make; the port
  // refuses an over-long one in words instead. This is the element most easily
  // lost to a component library's defaults.
  expect(/name=["']verified["'][^>]*maxlength/i.test(html)).toBe(false);
});

test("rule 9.2: both of the wording set's despite sentences reach the screen", async () => {
  const html = await gateWithFinding();
  expect(html).toContain(EN.approveDespite);
  expect(html).toContain(EN.approveDespitePlain);
});

test("rule 9.3: while a finding stands, no plain approve is offered", async () => {
  const html = await gateWithFinding();
  const labels = pressLabels(html);
  // The despite press is there...
  expect(labels).toContain(EN.approveDespite);
  // ...and the plain one is not, because two presses that record different
  // things must not look like a choice of wording (gate point 4, withheld).
  expect(labels).not.toContain(APPROVE_BODY);
});

test("with no finding standing, the plain approve is the press", async () => {
  const html = await gateWithNoFinding();
  const labels = pressLabels(html);
  expect(labels).toContain(APPROVE_BODY);
  expect(labels).not.toContain(EN.approveDespite);
});

test("the fold reader tells an open disclosure from a shut one", () => {
  // `readableWithoutOpening` is the only non-trivial thing this file computes,
  // and rule 9.4 rests on it, so it is checked directly rather than only
  // through a page. A page has many copies of a finding and one of them being
  // unfolded is the whole claim -- which is why the mutation "fold one copy"
  // correctly leaves the case below green.
  expect(readableWithoutOpening("<p>plain</p>", "plain")).toBe(true);
  expect(readableWithoutOpening("<details><summary>s</summary>hid</details>", "hid")).toBe(false);
  expect(readableWithoutOpening("<details open><summary>s</summary>shown</details>", "shown")).toBe(
    true,
  );
  // Shut inside open is still shut; open inside shut is still shut.
  expect(
    readableWithoutOpening(
      "<details open><details><summary>s</summary>deep</details></details>",
      "deep",
    ),
  ).toBe(false);
  // A disclosure that has already closed before the text does not hide it.
  expect(readableWithoutOpening("<details><summary>s</summary>x</details>after", "after")).toBe(
    true,
  );
  expect(readableWithoutOpening("<p>plain</p>", "absent")).toBe(false);
});

test("rule 9.4: the finding is readable without opening anything", async () => {
  const html = await gateWithFinding();
  // `modelFindings` raises this one over the lap at the gate.
  const finding = "the loop never stops";
  expect(html).toContain(finding);
  expect(readableWithoutOpening(html, finding)).toBe(true);
});
