/** @jsxImportSource react */
import { chromeFor, EmptySide } from "@suisya-systems/rondo-page";

const ja = chromeFor("ja");
const week = {
  asked: 6,
  finished: 4,
  answered: 3,
  decidedWithoutAsking: 31,
  allowance: {
    spentUsd: 18.63,
    heldUsd: 0,
    heldTries: 0,
    heldInProgress: false,
    approvedUsd: 50,
    leftUsd: 31.37,
  },
};
const hrefOf = (id: string) => `/?thread=${id}&lang=ja`;

export const WithRunning = () => (
  <EmptySide
    wording={ja}
    figures={week}
    hrefOf={hrefOf}
    running={[
      {
        messageId: "req-1",
        title: "請求書に税額の内訳を出したい",
        repository: "shop/app",
        goingSaid: "18分",
        allowance: {
          spentUsd: 0.62,
          heldUsd: 2.5,
          heldTries: 1,
          heldInProgress: true,
          approvedUsd: 5,
        },
        tries: { at: 1, of: 3 },
        steps: [
          { name: "work", state: "done" },
          { name: "checks", state: "waiting" },
          { name: "reading", state: "ahead" },
          { name: "approval", state: "ahead" },
          { name: "landing", state: "yours" },
        ],
      },
    ]}
  />
);

export const NothingRunning = () => (
  <EmptySide wording={ja} figures={week} hrefOf={hrefOf} running={[]} />
);

export const NoAllowance = () => (
  <EmptySide wording={ja} figures={{ ...week, allowance: null }} hrefOf={hrefOf} running={[]} />
);
