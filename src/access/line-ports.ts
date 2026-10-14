/**
 * The page's ports over a line and its laps (D-0073 rule 4.3, D-0163,
 * rondo#655): the release of a line's files, what a line keeps, and the end of
 * a lap only a person can end. Moved out of `web-app.ts`, which is at its size
 * cap; each checks its press there, through {@link spendPress}.
 */
import { type Press, spendPress } from "./web-app.js";

/**
 * What one release press names (D-0073 rule 4.3): a lap of the line, and the
 * claim and laps the screen was drawn over, so a press over a line that moved
 * since -- released, retried, or taken back -- releases nothing. The person
 * typed none of it.
 */
export interface ReleaseInput {
  readonly iterationId: string;
  readonly claimId: string;
  readonly lapIds: readonly string[];
}

/** Why a release press released nothing, as the wording key the page says it in. */
export type ReleaseRefusal = "releaseRefusedChanged" | "releaseRefusedNotRecorded";

export interface Released {
  readonly ok: boolean;
  readonly note: string;
  readonly why?: ReleaseRefusal;
}

/** Release one line's files, as the person's judgement that its work is done. */
export type ReleaseFromWeb = (input: ReleaseInput) => Promise<Released>;

/**
 * The sixth thing this surface may write (D-0073 rule 4.3, rondo#288): a
 * line's files released by a person, which the ledger records as theirs.
 *
 * **The check is inside this capability**, as it is in every port above: whoever
 * holds this object releases nothing without a press `mintPress` minted
 * and nobody has spent. Its own class, because ending a claim is not answering
 * a gate or publishing, and a holder of those must not be able to do it.
 */
export class ReleasePort {
  readonly #release: ReleaseFromWeb;

  constructor(release: ReleaseFromWeb) {
    this.#release = release;
  }

  /** Release one line's files, on one press. */
  async release(press: Press, input: ReleaseInput): Promise<Released> {
    if (!spendPress(press)) {
      return { ok: false, note: "nothing was released: this was not a person's press" };
    }
    return await this.#release(input);
  }
}

/**
 * What one press that changes a line's files names (D-0163): a lap of the
 * line, the claim and laps the screen was drawn over, and the files the
 * person wrote it is to keep now.
 */
export interface HoldsInput {
  readonly iterationId: string;
  readonly claimId: string;
  readonly lapIds: readonly string[];
  readonly paths: readonly string[];
}

/** Why a press that changes a line's files changed nothing, as the wording key the page says it in. */
export type HoldsRefusal =
  | "holdsRefusedChanged"
  | "holdsRefusedBusy"
  | "holdsRefusedKept"
  | "holdsRefusedUnread"
  | "holdsRefusedPaths"
  | "holdsRefusedNotRecorded";

export interface HoldsMoved {
  readonly ok: boolean;
  readonly note: string;
  readonly why?: HoldsRefusal;
  /** On `holdsRefusedKept`: the files the work changed, which it keeps. */
  readonly paths?: readonly string[];
  /** On a move that waits (D-0201 rule 2): the files it takes once other work lets them go. */
  readonly waiting?: readonly string[];
}

/** Change which files one open line keeps, as the person wrote them. */
export type HoldsFromWeb = (input: HoldsInput) => Promise<HoldsMoved>;

/**
 * What a line keeps, changed by a person while it is open (D-0073 rules 4.1
 * and 4.2, D-0163): its own class for {@link ReleasePort}'s reason, and the
 * check is inside it as it is there.
 */
export class HoldsPort {
  readonly #move: HoldsFromWeb;

  constructor(move: HoldsFromWeb) {
    this.#move = move;
  }

  /** Change one line's files, on one press. */
  async move(press: Press, input: HoldsInput): Promise<HoldsMoved> {
    if (!spendPress(press)) {
      return { ok: false, note: "nothing was changed: this was not a person's press" };
    }
    return await this.#move(input);
  }
}

/** What one end press names (rondo#655): the lap, and the person's reason in their own words. */
export interface EndInput {
  readonly iterationId: string;
  readonly reason: string;
}

/** Why an end press ended nothing, as the wording key the page says it in. */
export type EndRefusal = "endRefusedChanged" | "endRefusedNotRecorded";

/** What an end press came to: the request the lap answers, or why nothing was ended. */
export type Ended =
  | { readonly ok: true; readonly requestMessageId: string | null }
  | { readonly ok: false; readonly why: EndRefusal; readonly note: string };

/**
 * A lap ended by a person (rondo#655): one that is stalled, held by a start
 * that threw, or will not decode, and so keeps its room, money and files until
 * somebody decides. Its own class for {@link ReleasePort}'s reason, and the
 * check is inside it as it is there.
 */
export class EndPort {
  readonly #end: (input: EndInput) => Promise<Ended>;

  constructor(end: (input: EndInput) => Promise<Ended>) {
    this.#end = end;
  }

  /** End one lap, on one press. */
  async end(press: Press, input: EndInput): Promise<Ended> {
    if (!spendPress(press)) {
      return {
        ok: false,
        why: "endRefusedNotRecorded",
        note: "nothing was ended: this was not a person's press",
      };
    }
    return await this.#end(input);
  }
}
