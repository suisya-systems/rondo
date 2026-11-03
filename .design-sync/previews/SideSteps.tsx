/** @jsxImportSource react */
import { chromeFor, SideSteps } from "@suisya-systems/rondo-page";

const ja = chromeFor("ja");

export const WaitingOnApproval = () => (
  <SideSteps
    wording={ja}
    steps={[
      { name: "work", state: "done" },
      { name: "checks", state: "done" },
      { name: "reading", state: "done" },
      { name: "approval", state: "waiting" },
      { name: "landing", state: "yours" },
    ]}
  />
);

export const Working = () => (
  <SideSteps
    wording={ja}
    steps={[
      { name: "work", state: "waiting" },
      { name: "checks", state: "ahead" },
      { name: "reading", state: "ahead" },
      { name: "approval", state: "ahead" },
      { name: "landing", state: "yours" },
    ]}
  />
);

export const English = () => (
  <SideSteps
    wording={chromeFor("en")}
    steps={[
      { name: "work", state: "done" },
      { name: "checks", state: "waiting" },
      { name: "reading", state: "ahead" },
      { name: "approval", state: "ahead" },
      { name: "landing", state: "yours" },
    ]}
  />
);
