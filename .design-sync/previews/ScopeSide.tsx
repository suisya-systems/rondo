/** @jsxImportSource react */
import { chromeFor, ScopeSide } from "@suisya-systems/rondo-page";

const ja = chromeFor("ja");

export const ScopeWaiting = () => (
  <ScopeSide
    wording={ja}
    steps={[
      { name: "scope", state: "waiting" },
      { name: "work", state: "ahead" },
      { name: "checks", state: "ahead" },
      { name: "reading", state: "ahead" },
      { name: "approval", state: "ahead" },
      { name: "landing", state: "yours" },
    ]}
  />
);
