/** @jsxImportSource react */
import { EventLines } from "@suisya-systems/rondo-page";

const events = [
  { id: "e1", kind: "person", said: "あなたが範囲を承認しました", at: "10:30", atMs: 1 },
  { id: "e2", kind: "other", said: "作業を始めました", at: "10:31", atMs: 2 },
  { id: "e3", kind: "failed", said: "型チェックで 2 件の失敗がありました", at: "10:40", atMs: 3 },
  { id: "e4", kind: "passed", said: "自動チェックが通りました（12 件）", at: "10:42", atMs: 4 },
] as const;

export const WithLastLooked = () => (
  <EventLines
    events={events}
    lastLookedAbove="e2"
    lastLookedSaid="前回はここまで見ました（10:35）"
  />
);
