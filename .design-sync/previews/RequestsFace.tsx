/** @jsxImportSource react */
import { chromeFor, RequestsFace } from "@suisya-systems/rondo-page";

const ja = chromeFor("ja");
const hrefOf = (id: string) => `/?thread=${id}&lang=ja`;

export const Default = () => (
  <RequestsFace
    wording={ja}
    hrefOf={hrefOf}
    agoOf={() => "12分前"}
    allowance={{ spent: "$18.63", approved: "$50.00", left: "$31.37" }}
    newRequestHref="/?new=1&lang=ja"
    lastLookedSaid="前回はここまで見ました"
    openId="req-1"
    list={{
      yourTurn: [
        {
          messageId: "req-1",
          title: "請求書に税額の内訳を出したい",
          repository: "shop/app",
          state: "waitingOnYou",
          press: true,
          atMs: 3,
        },
      ],
      days: [
        {
          cut: "today",
          rows: [
            {
              messageId: "req-2",
              title: "ログイン画面の文言を見直す",
              repository: "shop/app",
              state: "running",
              atMs: 2,
            },
            {
              messageId: "req-3",
              title: "CSV 出力の文字化けを直す",
              repository: "shop/admin",
              state: "finished",
              atMs: 1,
            },
          ],
        },
        {
          cut: "yesterday",
          rows: [
            {
              messageId: "req-4",
              title: "検索結果の並び順を新しい順に",
              repository: "shop/app",
              state: "stopped",
              atMs: 0,
            },
            {
              messageId: "req-5",
              title: "README の導入手順を更新",
              repository: null,
              state: "notStarted",
              atMs: 0,
            },
          ],
        },
      ],
      lastLookedAbove: "req-3",
    }}
  />
);

export const Empty = () => (
  <RequestsFace
    wording={ja}
    hrefOf={hrefOf}
    agoOf={() => "たった今"}
    allowance={null}
    newRequestHref="/?new=1&lang=ja"
    lastLookedSaid=""
    openId={null}
    list={{ yourTurn: [], days: [], lastLookedAbove: null }}
  />
);
