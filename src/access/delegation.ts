/**
 * The one module that writes a run's delegation record (D-0040).
 *
 * `continuo D-1107` made `run admit --delegation-record PATH
 * --delegation-record-schema NAME` required and both of them without a default,
 * because an optional record is a supported way to admit a run whose
 * authorisation nothing recorded. So every run rondo admits carries an envelope
 * of the values it is permitted to act under, and this is the module that
 * composes and writes one.
 *
 * **Why a module of its own rather than three lines in the composition root.**
 * The capability is the reason, and `./forge.ts` is the worked precedent: a
 * grant is per module, `src/access/` holds the whole operator surface, and a
 * layer-wide filesystem *write* would put one in reach of every command rather
 * than of the one step that has to have it. `src/continuo/` was the other
 * candidate and is refused by D-0040 rule 8: it is the one place under `src/`
 * that starts a process (D-0017) and its modules are otherwise pure, so a
 * record written from inside it would add a second capability to the layer whose
 * narrowness is the point.
 *
 * **The envelope is transport and the durable copy is continuo's.** The file
 * exists to be read by the `run admit` it is passed to, and {@link discard}
 * removes it afterwards; what survives is continuo's own immutable row, keyed
 * by run id, readable through `run show --json`. rondo records nothing new for
 * it -- no column, no table, no record kind (D-0040 rule 7).
 *
 * **What is in it, and what is deliberately not** (D-0040 rules 5 and 6). The
 * facts that exist today: the contract as cadenza rendered it, its digest, the
 * agent-type record's identity and the two policy bags it applied, and the
 * identity of the catalog the grant was issued against. The catalog's layer
 * documents are **not** carried whole, and that is the secret rule rather than
 * brevity: `continuo D-1107` rule 6 puts "identifiers and versions, never
 * values" on the producer and says continuo cannot enforce it, and a layer's
 * `source` of kind `git_url` is the one value in reach whose userinfo can hold
 * a token. continuo's row is immutable and is never backfilled, so a credential
 * written there could not be removed afterwards.
 *
 * **cadenza's rendering, not a second encoding.** `contractPayload` is what
 * `src/access/advisory.ts` already persists in the `composition` row for
 * `D-0022` rule 18's reason, which is this one: the digest has to be
 * recomputable over the same bytes, and a second encoding is a second thing
 * that can drift -- silently, because a recomputation over the wrong bytes
 * fails the comparison it exists to make.
 *
 * **ASCII only** (D-0004): every string here can reach a cp932 console.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  agentTypeRecord,
  contractDigest,
  contractPayload,
  issueInitialContract,
  resolveProject,
} from "../cadenza/facade.js";
import type { AdmittedPlan } from "../refrain/plan.js";

/**
 * The name of the format this module writes, which is rondo's because the
 * format is (D-0040 rule 4).
 *
 * continuo stores it, prints it back and never recognises it -- it keeps no
 * list of the names it knows -- so the name is a claim rondo makes about its
 * own document and the version is rondo's to move. It is **not** cadenza's
 * schema: cadenza has published no serialisation for a contract, and one
 * arriving later replaces this format under a new version rather than being
 * retrofitted into it.
 */
export const DELEGATION_RECORD_SCHEMA = "rondo.delegation-record/1";

/** A written envelope: the path `run admit` is given, and its format name. */
export interface DelegationRecord {
  readonly path: string;
  readonly recordSchema: string;
  /** The directory {@link discard} removes; the file is the only thing in it. */
  readonly directory: string;
}

/** An envelope written, or rondo's reason there is none to pass. */
export type DelegationRecordOutcome =
  | { readonly kind: "written"; readonly record: DelegationRecord }
  | { readonly kind: "defect"; readonly reason: string };

/**
 * Compose and write the envelope for one admitted plan.
 *
 * **`defect` rather than `refused`, and the distinction is the caller's to
 * keep.** Every input here has already been through `classifyPlan` in the same
 * arc: the project resolved, the agent-type record minted and the contract
 * issued, all from this same plan and all pure. So a throw at this point is not
 * an operator's plan being wrong -- that was answered a step earlier, as a
 * refusal, before a row was spent -- it is rondo having reached admission with
 * a plan it had already accepted, which is rondo's fault and not a person's.
 *
 * The three cadenza calls are made in cadenza's own order, which is the order
 * `classifyPlan` and `advisory.ts`'s `issueFor` make them in: resolve the
 * project, build the record, issue the contract. Re-issuing rather than
 * carrying the value forward is deliberate -- the calls are pure and the
 * alternative is a contract threaded through the store and the port vocabulary
 * so that admission could re-use an object it can rebuild exactly.
 */
export function writeDelegationRecord(plan: AdmittedPlan): DelegationRecordOutcome {
  let envelope: string;
  try {
    const project = resolveProject(plan.catalogLayers, plan.projectName);
    const record = agentTypeRecord(plan.agentTypeInput);
    const contract = issueInitialContract(record, project, plan.parties);
    envelope = `${JSON.stringify(
      {
        record_schema: DELEGATION_RECORD_SCHEMA,
        run_id: plan.runId,
        // cadenza's own rendering, carried as it came.
        contract: contractPayload(contract),
        contract_digest: contractDigest(contract),
        // The policy that was *applied*, which is what makes "under what policy
        // did it do that" answerable at all. `granted` and `askable` are not
        // repeated here: they are fields of the contract above, and one value
        // written twice is two values that can disagree.
        agent_type: {
          agent_type_id: record.agentTypeId,
          vocabulary_version: record.vocabularyVersion,
          agent_type_digest: record.agentTypeDigest,
          loop_policy: record.loopPolicy,
          executor_policy: record.executorPolicy,
        },
        // The catalog reduced to what identifies it, never its layer documents:
        // see this module's header, and D-0040 rule 6.
        project: {
          project_name: plan.projectName,
          config_digest: project.configDigest,
          base_branch: project.baseBranch,
        },
        // What the lap was declared able to run (`continuo D-1110`). It is on
        // the run's own record at continuo either way -- `allowed_bash` in the
        // `run_delegation_recorded` payload -- and it is here as well because
        // the envelope is the document that answers "what was this run
        // permitted to do" in one read.
        allowed_bash: [...plan.allowedBash],
      },
      null,
      2,
    )}\n`;
  } catch (error) {
    return {
      kind: "defect",
      reason:
        "rondo could not compose the delegation record for run " +
        `'${plan.runId}': ${error instanceof Error ? error.message : String(error)}. ` +
        "Nothing was spawned and no run was admitted. The same plan classified, so this is " +
        "rondo's fault rather than the plan's.",
    };
  }
  try {
    // A directory of rondo's own per admission, so that two laps admitted at
    // once cannot name one file -- and `mkdtemp` rather than a name derived
    // from the run id, because the run id is an operator-facing identifier and
    // a path derived from one is a path an identifier can collide in.
    const directory = mkdtempSync(join(tmpdir(), "rondo-delegation-"));
    const path = join(directory, "delegation-record.json");
    writeFileSync(path, envelope, { encoding: "utf8" });
    return {
      kind: "written",
      record: { path, recordSchema: DELEGATION_RECORD_SCHEMA, directory },
    };
  } catch (error) {
    return {
      kind: "defect",
      reason:
        "rondo could not write the delegation record for run " +
        `'${plan.runId}': ${error instanceof Error ? error.message : String(error)}. ` +
        "Nothing was spawned and no run was admitted; continuo requires the record and rondo " +
        "does not admit a run without one.",
    };
  }
}

/**
 * Remove a written envelope, having admitted the run or having failed to.
 *
 * **Silent on failure, and that is the honest behaviour rather than a
 * shortcut.** The durable copy is continuo's row; this file is transport that
 * has already been read. A run successfully admitted must not be reported as a
 * defect because a temporary directory would not delete, and a run that was not
 * admitted has a reason of its own that this one would displace.
 */
export function discard(record: DelegationRecord): void {
  try {
    // The directory rather than the file: `mkdtemp` made it for this one
    // admission, so leaving it behind would leave an empty directory per run.
    rmSync(record.directory, { recursive: true, force: true });
  } catch {
    // Deliberately nothing: see above.
  }
}
