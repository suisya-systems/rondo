/**
 * The decision-record numbers a lap is handed, in its prompt (D-0098 rule
 * 3.3): "your entry is `D-0112`, with its index row". rondo reserves the
 * numbers at admission and says them here, after the definition of done, so
 * the worker writes no number the store did not hand out and the gate's number
 * test (rule 3.6) has one answer to hold it to.
 *
 * **ASCII** (D-0004), like every other string rondo puts on continuo's command
 * line.
 */

import { recordNumber } from "../store/lanes.js";

/** The line that opens the section. Exported so a lap's prompt can be told from its plan's. */
export const NUMBERS_OPENING = "\n\n---\nDecision record";

/**
 * The section for `numbers`, consecutive and at least one, in `record`: one
 * sentence naming each, and the rule that no other number is written.
 */
export function numbersSection(record: string, numbers: readonly number[]): string {
  const named = numbers.map(recordNumber);
  const listed =
    named.length === 1 ? named.join("") : `${named.slice(0, -1).join(", ")} and ${named.at(-1)}`;
  const entries = named.length === 1 ? "Your entry" : "Your entries";
  return [
    `${NUMBERS_OPENING} (rondo reserved these numbers for this work):`,
    `${entries} in ${record} ${named.length === 1 ? "is" : "are"} ${listed}, ` +
      `${named.length === 1 ? "with its" : "each with its"} index row. Write no other number; ` +
      "rondo checks the record's new headings and index rows against these at the gate.",
    // The one spelling `recordNumbers` reads (D-0103 rule 3.2), said in words
    // so the prompt stays ASCII: a heading in any other spelling is not seen.
    `Spell each heading '## ${named[0]}', a space, an em dash (U+2014), a space and the title, ` +
      `and each index row '| ${named[0]} |' followed by the rest of the row; rondo reads no ` +
      "other spelling.",
  ].join("\n");
}

/** `count` consecutive numbers above both `floor` and `highest` (D-0098 rule 3.3). */
export function nextNumbers(floor: number, highest: number, count: number): readonly number[] {
  const first = Math.max(floor, highest) + 1;
  return Array.from({ length: count }, (_, i) => first + i);
}
