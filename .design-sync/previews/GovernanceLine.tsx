/** @jsxImportSource react */
import { chromeFor, GovernanceLine } from "@suisya-systems/rondo-page";

const ja = chromeFor("ja");
const governance = {
  repository: "shop/app",
  askedAtMs: 1_760_000_000_000,
  allowance: { spentUsd: 5, heldUsd: 0, heldTries: 0, heldInProgress: false, approvedUsd: 50 },
  byTry: [{ costUsd: 5, running: false }],
  atBudgetCap: null,
  tries: { at: 1, of: 4 },
  worker: { provider: "claude", chosen: false },
  chain: [
    { step: "answer", state: "waiting" },
    { step: "proposal", state: "yours" },
    { step: "merge", state: "yours" },
  ],
  touches: { places: [{ repository: "shop/app", root: "/work/shop-app" }], acts: ["push_branch"] },
  decided: { count: 0, byRule: [] },
} as const;

export const Agreed = () => (
  <GovernanceLine wording={ja} governance={governance} askedSaid="2時間前" />
);

export const SeveralParts = () => (
  <GovernanceLine
    wording={ja}
    governance={governance}
    askedSaid="昨日"
    others="ほかの 2 つの部分は進行中"
  />
);

export const NoApproval = () => (
  <GovernanceLine
    wording={ja}
    governance={{ ...governance, allowance: null, tries: null, touches: null }}
    askedSaid="5分前"
  />
);
