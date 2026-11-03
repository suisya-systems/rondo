/** @jsxImportSource react */
import { chromeFor, PartsSide } from "@suisya-systems/rondo-page";

const ja = chromeFor("ja");

export const ThreeParts = () => (
  <PartsSide
    wording={ja}
    parts={[
      {
        name: "1. 請求書の税額欄",
        said: "取り込み済み",
        yours: false,
        links: [{ href: "https://github.com/shop/app/pull/41", said: "#41" }],
      },
      {
        name: "2. 明細 PDF の再出力",
        said: "承認を待っています",
        yours: true,
        links: [
          { href: "#answering", said: "回答する" },
          { href: "#ask", said: "?", ask: true },
        ],
      },
      { name: "3. 管理画面の表示", said: "2 の取り込みを待っています", yours: false, links: [] },
    ]}
  />
);
