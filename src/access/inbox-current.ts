/**
 * Which proposals that bind nothing are still about something open (rondo#579,
 * D-0175).
 *
 * A proposal that binds nothing is never answered by a `human_decision`, so
 * `openProposals` returns every one of them for ever: a lap's explanations, its
 * revise drafts, each reading of what to ask for next. The inbox listed them
 * all as waiting on the person, and after eleven days there were a hundred of
 * them over the few that did wait. **What waits is the newest one about a
 * subject still open**; the rest are folded into a count, and every row is
 * still in the store and still read back by `rondo show --proposal-id`.
 */
import { isApprovableKind, type OpenProposal } from "../store/records.js";

/** The ones still listed, and how many were folded. */
export interface NonBindingSplit {
  readonly current: readonly OpenProposal[];
  readonly movedOn: number;
}

/**
 * Split the open proposals that bind nothing into the current and the moved on.
 *
 * A proposal is current when its subject is still open and nothing newer of its
 * kind is about the same subject:
 *
 *  - **about a lap**: the lap is still live (`liveIds`, undecodable rows
 *    included, since they still hold a slot), and this is the newest of its
 *    kind about that lap;
 *  - **a triage reading**: it is its repository's newest (`latestTriage`,
 *    which is what the page draws), since a newer reading replaces it;
 *  - **about no row** (a between-laps explanation, a split): the newest of its
 *    kind.
 *
 * ponytail: "newest of its kind" for a split about no row folds an older split
 * for a different request; a split is answered on the scope screen, which is
 * where it waits, so the inbox's line is a pointer and not the queue.
 */
export function splitNonBinding(
  open: readonly OpenProposal[],
  liveIds: ReadonlySet<string>,
  latestTriage: ReadonlySet<string>,
): NonBindingSplit {
  const nonBinding = open.filter((proposal) => !isApprovableKind(proposal.kind));
  // `openProposals` is oldest first, so the last one seen per key is the newest.
  const newest = new Map<string, string>();
  for (const proposal of nonBinding) {
    newest.set(`${proposal.kind}\u0000${proposal.iterationId ?? ""}`, proposal.proposalId);
  }
  const current = nonBinding.filter((proposal) => {
    if (proposal.kind === "triage") {
      return latestTriage.has(proposal.proposalId);
    }
    if (proposal.iterationId !== null && !liveIds.has(proposal.iterationId)) {
      return false;
    }
    return (
      newest.get(`${proposal.kind}\u0000${proposal.iterationId ?? ""}`) === proposal.proposalId
    );
  });
  return { current, movedOn: nonBinding.length - current.length };
}
