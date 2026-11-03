/** @jsxImportSource react */
import { EventLine } from "@suisya-systems/rondo-page";

export const Passed = () => (
  <EventLine
    event={{
      id: "e1",
      kind: "passed",
      said: "自動チェックが通りました（12 件）",
      at: "10:42",
      atMs: 0,
    }}
  />
);

export const Failed = () => (
  <EventLine
    event={{
      id: "e2",
      kind: "failed",
      said: "型チェックで 2 件の失敗がありました",
      at: "10:40",
      atMs: 0,
    }}
  />
);

export const Decided = () => (
  <EventLine
    event={{
      id: "e3",
      kind: "decided",
      said: "rondo が尋ねずに決めました: 既定のブランチ名を使用",
      at: "10:31",
      atMs: 0,
    }}
  />
);

export const Person = () => (
  <EventLine
    event={{ id: "e4", kind: "person", said: "あなたが範囲を承認しました", at: "10:30", atMs: 0 }}
  />
);
