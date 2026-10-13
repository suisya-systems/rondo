/**
 * The approver named from the page (rondo#675, D-0196).
 *
 * **`RONDO_APPROVER` still decides when it is set**; this is where a host
 * started without it learns the name instead of refusing every press until a
 * restart. The page names one only while nobody is named, and the name is one
 * line in `<store>.approver`, beside the store as setup's plan files are, so
 * the next start and every command line read the same name.
 */

import { readFileSync, writeFileSync } from "node:fs";
import type { Press } from "./web-app.js";

export const APPROVER_ENV = "RONDO_APPROVER";

/**
 * The identity check both answering and publishing pass through.
 *
 * **An allowlist of size one, read from the environment, checked before any
 * verb runs.** It keeps the half of D-0020 rule 2 that a command line can keep
 * -- rondo acts for a named person and refuses to act for an unnamed one -- and
 * it cannot keep the other half: there is no OIDC subject here, so the identity
 * is asserted by whoever is typing. That is a stated reduction scoped to lap 1,
 * and the thing that ends it is the adapter D-0020 already specifies.
 *
 * Exported so it can be tested. The end-to-end walk cannot reach its refusals:
 * by the time an operator gets an actor wrong, the interesting states are gone.
 */
export function approvedActor(
  // **The identity and not the whole parse.** The web surface has no
  // `ParsedCommand` and takes its actor from `RONDO_APPROVER` directly
  // (D-0041 rule 5); passing the one field this function ever read is what
  // lets both surfaces reach the same allowlist rather than two copies of it.
  actorId: string | null,
  environment: Readonly<Record<string, string | undefined>>,
): { actorId: string } | { refusal: string } {
  if (actorId === null) {
    return { refusal: "This command needs --actor-id ID, naming who is acting." };
  }
  const approver = environment[APPROVER_ENV];
  if (approver === undefined || approver === "") {
    return {
      refusal:
        `${APPROVER_ENV} is not set. It names the one identity allowed to answer a gate or ` +
        "publish, and rondo will not act for an unnamed person.",
    };
  }
  if (actorId !== approver) {
    return {
      refusal:
        `--actor-id is '${actorId}' and ${APPROVER_ENV} is '${approver}'. They must be ` +
        "the same identity.",
    };
  }
  // The shape continuo requires of an identifier, checked **here** rather than
  // left to the verb that first carries it. An identity with whitespace in it
  // passes the allowlist and is then refused at the argument boundary -- after
  // `publish` has already pushed and opened a pull request, or after `answer`
  // has already presented and delivered. Rondo refuses before a process starts
  // when it can, and this is one of the places it can.
  if (/\s/.test(actorId) || actorId.startsWith("-")) {
    return {
      refusal:
        `--actor-id is '${actorId}', and continuo's identifiers carry no whitespace and ` +
        "do not begin with a dash. It would be refused partway through, after the effects before " +
        "it had already happened.",
    };
  }
  return { actorId: actorId };
}

/** What a refused naming says, as the page's word for it. */
export type NamingRefusal =
  | "approverRefusedPress"
  | "approverRefusedTaken"
  | "approverRefusedShape"
  | "approverRefusedUnwritten";

export type Named = { readonly ok: true } | { readonly ok: false; readonly why: NamingRefusal };

/** The page's one press that names the approver; spends its press like every port. */
export type NamingPort = (press: Press, name: string) => Promise<Named>;

function approverFile(storePath: string): string {
  return `${storePath}.approver`;
}

/** The environment with the recorded name filled in where `RONDO_APPROVER` is unset. */
export function withRecordedApprover(
  environment: Readonly<Record<string, string | undefined>>,
  storePath: string,
): Readonly<Record<string, string | undefined>> {
  const set = environment[APPROVER_ENV];
  if (set !== undefined && set !== "") {
    return environment;
  }
  let recorded: string;
  try {
    recorded = readFileSync(approverFile(storePath), "utf8").trim();
  } catch {
    return environment;
  }
  return recorded === "" ? environment : { ...environment, [APPROVER_ENV]: recorded };
}

/**
 * Record `name` as the approver and write it into `environment`, or say why
 * not: somebody is already named, the name is not one the allowlist accepts,
 * or the file could not be written. `wx` makes a second naming lose to the
 * first even across processes.
 */
export function recordApprover(
  environment: Record<string, string | undefined>,
  storePath: string,
  name: string,
): Named {
  const set = environment[APPROVER_ENV];
  if (set !== undefined && set !== "") {
    return { ok: false, why: "approverRefusedTaken" };
  }
  if (name === "" || "refusal" in approvedActor(name, { [APPROVER_ENV]: name })) {
    return { ok: false, why: "approverRefusedShape" };
  }
  try {
    writeFileSync(approverFile(storePath), `${name}\n`, { flag: "wx" });
  } catch (error) {
    return {
      ok: false,
      why:
        (error as NodeJS.ErrnoException).code === "EEXIST"
          ? "approverRefusedTaken"
          : "approverRefusedUnwritten",
    };
  }
  environment[APPROVER_ENV] = name;
  return { ok: true };
}
