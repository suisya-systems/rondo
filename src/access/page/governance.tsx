/** @jsxImportSource react */
/**
 * The governance line, under every thread's title, at every width
 * (DECISIONS.md D-0083 rule 6).
 *
 * **One line and not a card, permanent and not a fold.** A person answering a
 * question should not have to go looking for what was agreed; rule 6 spends
 * the width on it rather than on prose.
 *
 * **All six of rule 6's items** (rondo#350). The one that used to be missing
 * -- *how many things rondo decided without asking* -- is read from this
 * request's own withheld rows now (`withheldFor`), so the line carries the
 * count and the right face carries the same count with the rule behind each.
 * The note that used to admit the absence is gone with the absence.
 *
 * **Rule 6's ban is kept**: a spend is never drawn without the figure it was
 * approved against, so the pair travels together or one sentence stands for
 * both.
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
       * The sixth item (rule 6). A count and not a sentence: the right face
       * carries the same number with the rule behind each, and this line is
       * the reason a person knows to look.
       */}
      <span className="gov-decided">{wording.govDecided(governance.decided.count)}</span>
    </p>
  );
}
