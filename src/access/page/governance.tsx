/** @jsxImportSource react */
/**
 * The governance line, under every thread's title, at every width
 * (DECISIONS.md D-0083 rule 6).
 *
 * **One line and not a card, permanent and not a fold.** A person answering a
 * question should not have to go looking for what was agreed; rule 6 spends
 * the width on it rather than on prose.
 *
 * **Five of rule 6's six items, and the sixth said rather than dropped.** What
 * is missing is *how many things rondo decided without asking*, and the line
 * says so in its own words -- because the alternative is a line that reads as
 * complete while one of its facts is absent. It is not drawn as `0`: zero
 * would be rondo claiming it decided nothing without asking, and rondo cannot
 * read that per request yet (`page-logic/governance.ts`'s `WITHHELD_NOT_READ`).
 */
import type { ChainLink, Governance } from "../page-logic/governance.js";
import type { Chrome } from "../wording.js";

function chainSaid(wording: Chrome, link: ChainLink): string {
  switch (link.step) {
    case "answer":
      return wording.chainAnswer;
    case "proposal":
      return wording.chainProposal;
    default:
      return wording.chainMerge;
  }
}

export function GovernanceLine({
  wording,
  governance,
  askedSaid,
}: {
  readonly wording: Chrome;
  readonly governance: Governance;
  /** When it was asked, already said: only the caller has read the clock. */
  readonly askedSaid: string;
}) {
  const { repository, allowance, tries, chain } = governance;
  return (
    <p className="gov">
      {repository === null ? null : <span className="gov-repo">{repository}</span>}
      <span>{askedSaid}</span>
      {/*
       * **Both figures or neither** (rule 6). With no approval to read, one
       * sentence stands for the pair rather than a spend nobody agreed to.
       */}
      <span className="gov-spend">
        {allowance === null
          ? wording.weekNoAllowance
          : wording.govSpent(allowance.spentUsd.toFixed(2), allowance.approvedUsd.toFixed(2))}
      </span>
      {tries === null ? null : <span>{wording.govTries(tries.at, tries.of)}</span>}
      <span className="gov-chain">
        {chain.map((link) => (
          <span className={`gov-step gov-${link.state}`} key={link.step}>
            {chainSaid(wording, link)}
          </span>
        ))}
      </span>
      {/*
       * The sixth item, named. It is the right face's to count and explain
       * (rule 6), and until that is built this says which fact is not on the
       * line rather than letting the line read as whole.
       */}
      <span className="gov-missing">{wording.govDecidedNotRead}</span>
    </p>
  );
}
