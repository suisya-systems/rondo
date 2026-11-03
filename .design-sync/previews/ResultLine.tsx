/** @jsxImportSource react */
import { chromeFor, ResultLine } from "@suisya-systems/rondo-page";

const ja = chromeFor("ja");
const base = {
  url: "https://github.com/shop/app/pull/41",
  number: "41",
  atMs: 1_760_000_000_000,
  pushedOnto: false,
  checksAtMs: 1_760_000_100_000,
  checksCommit: "a1b2c3d",
  merged: null,
  closedAtMs: null,
  closedOut: null,
  conflictsWith: null,
  withheld: null,
  rerun: null,
  moved: null,
} as const;

export const ChecksRunning = () => (
  <ResultLine wording={ja} result={{ ...base, checks: { kind: "running" } }} />
);

export const Green = () => (
  <ResultLine
    wording={ja}
    result={{ ...base, checks: { kind: "green", counted: 12, passed: 12, skipped: 0 } }}
  />
);

export const Red = () => (
  <ResultLine
    wording={ja}
    result={{
      ...base,
      checks: { kind: "red", failed: ["typecheck", "test (ubuntu)"], cancelled: [], timedOut: [] },
    }}
  />
);

export const Landed = () => (
  <ResultLine
    wording={ja}
    result={{
      ...base,
      checks: { kind: "green", counted: 12, passed: 12, skipped: 0 },
      merged: { into: "main", method: "squash", outside: false, by: null, atMs: 1_760_000_200_000 },
    }}
  />
);
