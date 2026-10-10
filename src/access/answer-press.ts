/**
 * Which answer a press on `/answer-ask` is, and the words it records (D-0072
 * rule 4, rondo#512, D-0190 rules 5 and 6).
 *
 * Its own module because `web-app.ts` is at its size cap: the route reads the
 * form and hands this the posted value, the typed words and the ask answered.
 */
import type { AnswerOutcome, ThreadMessageDraft } from "../store/records.js";
import type { Chrome } from "./wording.js";

/** A press the route records: what was posted, the outcome and option stored, and the body. */
export interface PressedAnswer {
  readonly posted: "carry_on" | "stop" | "raise_carry_on" | "option";
  readonly outcome: AnswerOutcome;
  /** The 0-based option pressed (D-0190 rule 5.1), null on every other press. */
  readonly option: number | null;
  readonly body: string;
}

/** An option press's value, `option:<n>` with n written as an index is (no sign, no leading zero). */
const OPTION = /^option:(0|[1-9][0-9]{0,5})$/;

/**
 * The press `posted` is, or the refusal it gets. **Never defaulted** (D-0072
 * rule 4): a value naming no answer, or an option the ask does not offer, is
 * the form refusal -- rondo picking one would answer for the person.
 *
 * **An answer needs no words** (rondo#512): an empty box records the pressed
 * button's own words -- for an option, the option's text (D-0190 rule 5.2).
 * The one exception is the free press on an ask with options, "Answer in my
 * words" (rule 6), whose whole content is the words.
 */
export function pressedAnswer(
  posted: unknown,
  typed: string,
  asked: ThreadMessageDraft | undefined,
  wording: Chrome,
): PressedAnswer | "sendRefusedForm" | "answerRefusedNoWords" {
  const words = typed.trim() === "" ? null : typed;
  const offered = asked?.askOptions?.options;
  const chosen = typeof posted === "string" ? OPTION.exec(posted) : null;
  if (chosen !== null) {
    const option = Number(chosen[1]);
    const text = offered?.[option]?.text;
    return text === undefined
      ? "sendRefusedForm"
      : { posted: "option", outcome: "carry_on", option, body: words ?? text };
  }
  if (posted === "carry_on" && offered !== undefined && words === null) {
    return "answerRefusedNoWords";
  }
  if (posted !== "carry_on" && posted !== "stop" && posted !== "raise_carry_on") {
    return "sendRefusedForm";
  }
  const label =
    posted === "stop"
      ? wording.answerStopAction
      : posted === "raise_carry_on"
        ? wording.answerRaiseAction
        : wording.answerCarryOnAction;
  return {
    posted,
    outcome: posted === "stop" ? "stop" : "carry_on",
    option: null,
    body: words ?? label,
  };
}
