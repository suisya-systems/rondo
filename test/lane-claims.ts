/**
 * A claim of one line's own (D-0073 rule 2.3), for tests that reserve several
 * first laps in one repository and probe something other than the lane ledger:
 * each line holds a directory no other line names, so the ledger refuses none
 * of them and the test still measures what it was written for.
 */
import type { LaneClaimAsk } from "../src/store/records.js";

export const ownLane = (id: string): LaneClaimAsk => ({
  paths: [`lanes/${id}/`],
  authorKind: "drafter",
  authorId: "test/own-lane",
  bases: [],
});

/** {@link ownLane} for a first lap, and null for a redo, which continues its lineage's claim. */
export const laneFor = (id: string, supersedesIterationId: string | null): LaneClaimAsk | null =>
  supersedesIterationId === null ? ownLane(id) : null;
