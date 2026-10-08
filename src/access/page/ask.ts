/**
 * What the page draws to ask rondo, and over what rondo answers (rondo#401,
 * D-0177): the "?" beside a message or a lap, and the band over an answer of
 * the explainer's, with what that answer cost.
 *
 * **The "?" is a link, not a script** (CSP forbids inline script): it puts the
 * reply box in question mode by address, so the language switch and the poll
 * keep it. What it is about travels as a locator, never on screen (D-0076).
 */
import {
  EXPLAINER_PREFIX,
  type IterationRecord,
  type ThreadMessageDraft,
} from "../../store/records.js";
import type { AdvisoryRecord } from "../../store/sqlite.js";
import { viewHref } from "../page-logic/routes.js";
import type { Chrome } from "../wording.js";
import { money } from "./vocabulary.js";

/** The "?" about `locator`, asked in `root`'s thread; `to` is the message the box replies to. */
export function askLink(
  wording: Chrome,
  root: string,
  to: string | null,
  locator: string,
): { readonly href: string; readonly said: string; readonly title: string } {
  return {
    href: `${viewHref({ kind: "thread", messageId: root, to, ask: locator }, wording.lang)}#composer`,
    said: wording.askButton,
    title: wording.askButtonTitle,
  };
}

/** The laps waiting at a gate, by gate id: where a cited lap or gate is answered. */
export function gatesOf(laps: readonly IterationRecord[]): ReadonlyMap<string, string> {
  return new Map(
    laps.flatMap((lap) =>
      lap.status === "awaiting_human" && lap.gateId !== null ? [[lap.gateId, lap.id] as const] : [],
    ),
  );
}

/**
 * The band over each explainer answer among `messages`, by message id, with
 * what it cost read off its proposal's snapshot (`src/access/explainer/host.ts`
 * writes it). A model that ran is counted whatever it answered; one whose cost
 * was not reported is counted at the cap. An answer whose proposal does not
 * read still gets the band, with no cost said. `body` is the answer's text
 * without the band and cost its body repeats, or null to draw the body whole.
 */
export async function answerBands(
  record: Pick<AdvisoryRecord, "readProposal">,
  messages: readonly ThreadMessageDraft[],
  wording: Chrome,
): Promise<
  ReadonlyMap<
    string,
    { readonly heading: string; readonly cost: string; readonly body: string | null }
  >
> {
  const answers = messages.filter(
    (message) => message.authorKind === "drafter" && message.authorId.startsWith(EXPLAINER_PREFIX),
  );
  return new Map(
    await Promise.all(
      answers.map(async (message) => {
        const proposalId = message.bases.find((basis) => basis["form"] === "proposal")?.[
          "proposalId"
        ];
        const read = typeof proposalId === "string" ? await record.readProposal(proposalId) : null;
        const snapshot = read?.kind === "read" ? read.proposal.snapshot : null;
        const why = snapshot?.["unexplained"];
        const kind = typeof why === "object" ? (why as { kind?: unknown } | null)?.kind : null;
        const counted = snapshot?.["counted"];
        const ran =
          typeof counted === "boolean"
            ? counted
            : why == null || kind === "failed" || kind === "refused";
        const cost = snapshot?.["cost_usd"];
        const cap = snapshot?.["cap_usd"];
        const said =
          snapshot == null
            ? ""
            : typeof cost === "number"
              ? wording.answerCost(money(cost))
              : ran && typeof cap === "number"
                ? wording.answerCostUnread(money(cap))
                : wording.answerFree;
        const page = snapshot?.["page"];
        const body = typeof page === "string" && page !== "" ? page : null;
        return [
          message.messageId,
          { heading: wording.answerBandHeading, cost: said, body },
        ] as const;
      }),
    ),
  );
}
