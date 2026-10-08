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
import { EXPLAINER_PREFIX, isApprovableKind, type OpenProposal } from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { storedSuccessorId } from "./advisory.js";

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
  // An explainer's answer is read in its thread, where it was asked (D-0177):
  // not listed here and not counted as moved on.
  const nonBinding = open.filter(
    (proposal) =>
      !isApprovableKind(proposal.kind) && !proposal.drafter.startsWith(EXPLAINER_PREFIX),
  );
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

/**
 * The approvable open proposals whose successor identity is already in the
 * store (rondo#584, D-0176).
 *
 * `proposeRetry` refuses a taken successor when it drafts, and nothing checks
 * again while the proposal stays open. Once another admission holds the
 * identity, approving this one cannot run anything: `admit()` refuses on the
 * identifiers that admission already holds. A row that will not read is left
 * waiting, since only a successor seen in the store is evidence it is taken.
 */
export async function takenSuccessors(
  ports: {
    readonly store: Pick<IterationStore, "read">;
    readonly record: Pick<AdvisoryRecord, "readProposal">;
  },
  open: readonly OpenProposal[],
): Promise<ReadonlySet<string>> {
  const taken = new Set<string>();
  for (const proposal of open.filter((each) => isApprovableKind(each.kind))) {
    const stored = await ports.record.readProposal(proposal.proposalId);
    const successorId = stored.kind === "read" ? storedSuccessorId(stored.proposal) : null;
    // Not absent is taken, as `proposeRetry` decides it: an undecodable row
    // still holds its primary key.
    if (successorId !== null && (await ports.store.read(successorId)).kind !== "absent") {
      taken.add(proposal.proposalId);
    }
  }
  return taken;
}

/** The approvable proposals still waiting on the person: the inbox's list and the page's count. */
export function waitingBinding(
  open: readonly OpenProposal[],
  taken: ReadonlySet<string>,
): readonly OpenProposal[] {
  return open.filter(
    (proposal) => isApprovableKind(proposal.kind) && !taken.has(proposal.proposalId),
  );
}
