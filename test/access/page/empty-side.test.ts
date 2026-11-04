/**
 * The right face with nothing waiting (DECISIONS.md D-0083 rule 4).
 *
 * Three claims, and they are three kinds. **What the face holds** is rule 4's
 * list read back off the markup: the week's six figures and each running
 * request with its allowance and its five steps. **What it must not hold** is
 * amber, which is a property of the stylesheet rather than of any one render
 * -- nothing on this face waits on a person, so the colour that means *a
 * person must act* is not declared for it at all. **That it reaches the live
 * page** is asserted through the server, because a face composed and never
 * placed is the state this slice replaces.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { EmptySide } from "../../../src/access/page/empty-side.js";
import { stepsOf, WEEK_MS } from "../../../src/access/page-logic/week.js";
import { JA } from "../../../src/access/wording/ja.js";
import { EN } from "../../../src/access/wording.js";
import type { IterationRecord } from "../../../src/store/records.js";
import { fresh, openRequest, operatorPage, portsOver, reserve } from "../page-world.js";

const lap = (over: Partial<IterationRecord>): IterationRecord =>
  ({ status: "performing", gateOutcome: null, plan: {}, ...over }) as IterationRecord;

const side = (
  figures: Parameters<typeof EmptySide>[0]["figures"],
  running: Parameters<typeof EmptySide>[0]["running"] = [],
) =>
  renderToStaticMarkup(
    EmptySide({ wording: EN, figures, running, hrefOf: (id) => `/?thread=${id}&lang=en` }),
  );

const week = {
  asked: 6,
  finished: 4,
  answered: 3,
  decidedWithoutAsking: 31,
  // A budget holding work up, which is one of the two states the week's money
  // is drawn in at all (`D-0207` rule 1).
  budget: {
    bearing: "holdingUp" as const,
    allowance: {
      spentUsd: 18.63,
      heldUsd: 0,
      heldTries: 0,
      heldInProgress: false,
      approvedUsd: 50,
      leftUsd: 31.37,
    },
  },
};

test("the week's six figures are all on the face", () => {
  const html = side(week);
  for (const said of [EN.sevenDays, EN.weekAsked, EN.weekFinished, EN.weekAnswered, EN.weekDecided])
    expect(html).toContain(said);
  expect(html).toContain(">6<");
  expect(html).toContain(">31<");
  // Spent and what is left, as the pair rule 6 never separates.
  expect(html).toContain("$18.63 of $50.00");
  expect(html).toContain("$31.37");
});

test("with no approval read, the week says so instead of drawing a spend", () => {
  // Rule 6's refusal: the two figures travel together or neither is drawn,
  // and the sentence is the left face's own (`weekNoAllowance`).
  const html = side({ ...week, budget: { bearing: "holdingUp", allowance: null } });
  expect(html).toContain(EN.weekNoAllowance);
  expect(html).not.toContain("$");
});

test("the budget says what is holding work up and what to do, and nothing longer", () => {
  // D-0207 rule 5: the reason it is on the face and the next thing the person
  // does, beside the figures. Both language sets say both, because a screen
  // does not ship until every shipped language says it (D-0079).
  const html = side(week);
  expect(html).toContain(EN.weekBudgetHeldUp);
  expect(html).toContain(EN.weekBudgetHeldUpNext);
  for (const said of [
    JA.weekBudgetHeldUp,
    JA.weekBudgetHeldUpNext,
    JA.weekBudgetYours,
    JA.weekBudgetYoursNext,
  ])
    expect(said.length).toBeGreaterThan(0);
  // Short words, not an explanation of how a budget is computed.
  for (const said of [EN.weekBudgetHeldUp, EN.weekBudgetHeldUpNext])
    expect(said.length).toBeLessThan(80);
});

test("a decision of the person's draws the week's budget under its own words", () => {
  const html = side({ ...week, budget: { ...week.budget, bearing: "yours" } });
  expect(html).toContain(EN.weekBudgetYours);
  expect(html).toContain(EN.weekBudgetYoursNext);
  expect(html).not.toContain(EN.weekBudgetHeldUp);
  // Rule 3: where it is drawn, the pair is drawn as it was.
  expect(html).toContain("$18.63 of $50.00");
});

test("with room left and nothing to decide, no budget figure is on the face and nothing replaces it", () => {
  // D-0207 rules 1 and 4: the reading is withheld, and no sentence, blank cell
  // or zero stands where it was.
  const html = side({ ...week, budget: null });
  expect(html).not.toContain("$");
  for (const said of [
    EN.weekSpentFigure,
    EN.weekLeft,
    EN.weekAllowance,
    EN.weekNoAllowance,
    EN.weekBudgetHeldUp,
    EN.weekBudgetYours,
  ])
    expect(html).not.toContain(said);
  // The rest of the seven days is untouched: the face is shorter, not gone.
  for (const said of [EN.sevenDays, EN.weekAsked, EN.weekFinished, EN.weekAnswered, EN.weekDecided])
    expect(html).toContain(said);
});

test("a running request carries its allowance and the five steps to its end", () => {
  const html = side(week, [
    {
      messageId: "req-1",
      title: "the invoice needs the tax broken out",
      repository: "shop/app",
      goingSaid: "18m",
      allowance: {
        spentUsd: 0.62,
        heldUsd: 2.5,
        heldTries: 1,
        heldInProgress: false,
        approvedUsd: 5,
      },
      tries: { at: 1, of: 3 },
      steps: stepsOf(lap({}), [{ drafter: "rondo/checks", verdict: "clear" }]),
    },
  ]);
  expect(html).toContain("the invoice needs the tax broken out");
  expect(html).toContain("shop/app");
  expect(html).toContain("$0.62 of $5.00, with $2.50 held for a try whose cost was not reported");
  expect(html).toContain(EN.govTries(1, 3));
  // The card's count is the scope's, not the request's: the words say so (rondo#624).
  expect(EN.govTries(1, 3)).toContain("in this scope");
  expect(JA.govTries(1, 3)).toContain("この範囲で");
  for (const step of [EN.stepWork, EN.stepChecks, EN.stepReading, EN.stepApproval, EN.stepLanding])
    expect(html).toContain(step);
  // The way in is the thread's address and never a press: what a press needs
  // is inside the box that holds it (D-0082 rule 7), and there is no box here.
  expect(html).toContain('href="/?thread=req-1&amp;lang=en"');
  expect(html).not.toContain("<form");
  expect(html).not.toContain("<button");
  // And the face says it is not a queue.
  expect(html).toContain(EN.runningNote);
});

test("with nothing running the face says so, and does not say that nothing needs answering", () => {
  const html = side(week);
  expect(html).toContain(EN.runningNone);
  // The note is about work that is under way; with none, there is nothing for
  // it to be true of.
  expect(html).not.toContain(EN.runningNote);
});

test("no amber is declared for this face", () => {
  // Rule 4's own words. It is asserted against the stylesheet rather than a
  // render because a colour is not a thing one string of markup can answer
  // for: `--color-wait` is the token that means *a person must act*
  // (D-0082 rule 2), and nothing on this face does.
  const css = readFileSync(new URL("../../../page/side.css", import.meta.url), "utf8");
  expect(css).toContain(".side-step-waiting");
  expect(css).not.toContain("--color-wait");
});

test("the empty state's right face is on the page the server answers with", async () => {
  const world = fresh();
  await openRequest(world, "req-i-0001", "make the CSV import faster", 2_000);
  await reserve(world, "i-0001", "make the CSV import faster", null, "req-i-0001");
  for (const [from, to] of [
    ["planned", "admitting"],
    ["admitting", "admitted"],
    ["admitted", "performing"],
  ] as const) {
    await world.store.transition("i-0001", from, to, {}, 2_000);
  }
  const html = await operatorPage(portsOver(world, "ada", []), "t", { kind: "summary" });
  // Nothing waits on the person, so the centre asks what they want and the
  // right face is the week (rule 4).
  expect(html).toContain(EN.emptyAsk);
  expect(html).toContain(EN.sevenDays);
  expect(html).toContain(EN.runningHeading);
  // The running request, with the step it is on.
  expect(html).toContain("make the CSV import faster");
  expect(html).toContain(EN.stepLanding);
  expect(html).toContain("side-step-waiting");
  // One request was asked inside the window, and it has not finished. The
  // figures are requests and not laps: a request tried three times and taken
  // in once has finished once.
  expect(html).toContain(`${EN.weekAsked}</dt><dd>1</dd>`);
  expect(html).toContain(`${EN.weekFinished}</dt><dd>0</dd>`);
  // Nothing is holding the budget up and no scope waits, so the week's money
  // is not on the face at all (D-0207 rule 1) -- and nothing says it is fine.
  for (const said of [
    EN.weekAllowance,
    EN.weekSpentFigure,
    EN.weekLeft,
    EN.weekBudgetHeldUp,
    EN.weekBudgetYours,
  ])
    expect(html).not.toContain(said);
  // The running request's own allowance is not the week's and is unchanged
  // (rule 2): this lap was admitted under no approval, and its line says so
  // where the week's withheld reading says nothing.
  expect(html).toContain(`<span>${EN.weekNoAllowance}</span>`);
});

test("a thread's right face is still the slice that has not been built", async () => {
  // Gate point 7 orders this: rule 5's material and rule 6 in full are the
  // right face of a *thread*, and this slice is the empty state's only.
  const world = fresh();
  await openRequest(world, "req-i-0001", "make the CSV import faster", 2_000);
  await reserve(world, "i-0001", "make the CSV import faster", null, "req-i-0001");
  const html = await operatorPage(portsOver(world, "ada", []), "t", {
    kind: "thread",
    messageId: "req-i-0001",
    to: null,
  });
  expect(html).toContain("face-side");
  expect(html).not.toContain(EN.sevenDays);
});

test("the window is the seven days rule 4 names", () => {
  // The clock these fixtures render against is 5s past the epoch, so nothing
  // is older than the window; this holds the constant itself, which is what a
  // figure drawn as *the last seven days* rests on.
  expect(WEEK_MS).toBe(7 * 24 * 60 * 60 * 1000);
});
