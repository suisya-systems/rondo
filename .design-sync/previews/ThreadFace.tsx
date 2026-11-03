/** @jsxImportSource react */
import { chromeFor, GovernanceLine, ThreadFace } from "@suisya-systems/rondo-page";

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

const message = (id: string, who: "person" | "rondo", body: string, at: string) => ({
  kind: "message" as const,
  message: {
    id,
    who,
    voice: who === "person" ? "operator" : "drafter",
    said: who === "person" ? "あなた" : "rondo",
    body,
    drawn: null,
    at,
    atTitle: at,
    waiting: null,
    answered: null,
    bases: [],
    basesLabel: "根拠",
    pending: [],
    pendingSaid: "",
    inReplyTo: null,
    reply: null,
  },
});

const items = [
  message("m1", "person", "請求書の PDF に、税率ごとの税額の内訳を出してください。", "10:20"),
  {
    kind: "event" as const,
    event: {
      id: "e1",
      kind: "person" as const,
      said: "あなたが範囲を承認しました",
      at: "10:30",
      atMs: 1,
    },
  },
  {
    kind: "event" as const,
    event: {
      id: "e2",
      kind: "passed" as const,
      said: "自動チェックが通りました（12 件）",
      at: "10:42",
      atMs: 2,
    },
  },
  message("m2", "rondo", "変更ができました。内容を確かめて承認してください。", "10:45"),
];

export const WaitingOnYou = () => (
  <ThreadFace
    title="請求書に税額の内訳を出したい"
    governance={<GovernanceLine wording={ja} governance={governance} askedSaid="25分前" />}
    result={null}
    walk={{ said: "あなたの番 1 / 2", nextHref: "/?thread=req-2&lang=ja", nextSaid: "次へ" }}
    items={items}
    foldOpen="開く"
    lastLookedAbove="e1"
    lastLookedSaid="前回はここまで見ました"
    answering={
      <form className="space-y-2 rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-body font-semibold">この変更を承認しますか</p>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 font-semibold text-background"
        >
          承認して取り込む
        </button>
      </form>
    }
    adding={null}
    acts={null}
    next={null}
  />
);
