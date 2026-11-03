/** @jsxImportSource react */
import { FoldedLine } from "@suisya-systems/rondo-page";

export const Shut = () => (
  <FoldedLine
    open="開く"
    fold={{
      kind: "fold",
      id: "f1",
      said: "自動チェックを 3 回行いました",
      at: "10:42",
      lines: 3,
      inside: [
        {
          kind: "event",
          event: {
            id: "e1",
            kind: "failed",
            said: "型チェックで 2 件の失敗がありました",
            at: "10:40",
            atMs: 1,
          },
        },
        {
          kind: "event",
          event: {
            id: "e2",
            kind: "failed",
            said: "テストが 1 件失敗しました",
            at: "10:41",
            atMs: 2,
          },
        },
        {
          kind: "event",
          event: {
            id: "e3",
            kind: "passed",
            said: "自動チェックが通りました（12 件）",
            at: "10:42",
            atMs: 3,
          },
        },
      ],
    }}
  />
);
