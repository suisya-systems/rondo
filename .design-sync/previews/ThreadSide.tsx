/** @jsxImportSource react */
import { chromeFor, ThreadSide } from "@suisya-systems/rondo-page";

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

const steps = [
  { name: "work", state: "done" },
  { name: "checks", state: "done" },
  { name: "reading", state: "done" },
  { name: "approval", state: "waiting" },
  { name: "landing", state: "yours" },
] as const;

export const Asking = () => (
  <ThreadSide
    wording={ja}
    governance={governance}
    steps={steps}
    asking={true}
    material={<p className="text-body">変更は 3 ファイル、テストはすべて通過しました。</p>}
  />
);

export const NothingAsked = () => (
  <ThreadSide wording={ja} governance={governance} steps={steps} asking={false} material={null} />
);
