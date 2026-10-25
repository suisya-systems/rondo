/**
 * A plan rondo already holds, as the setup plan it stands for (D-0203): what
 * a repository is added from, or a lap's repository named in, where setup
 * recorded no plan to build on. Pure, and apart from `setup-files.ts`, which
 * reads the disk through `cli.ts`, so the drafter can ask it without that.
 */
import { type AdmittedPlan, planPayload, readRunPlan } from "../refrain/plan.js";
import type { JsonRecord } from "../store/records.js";
import { agentTypeRecordOf } from "./scope.js";

/** What setup writes as a plan's prompt: the page runs the request's own words, never this. */
export const PLACEHOLDER_PROMPT =
  "Replace this with the request. The page runs the request's own words, never this.";

/**
 * **A plan rondo holds, as the setup plan it stands for** (D-0203 rule 1): a
 * lap's or a pasted one, where setup recorded none to build on. Its host facts
 * are kept byte for byte; what is not setup's is put back to what setup
 * writes -- the allocated run id, lease claimant, workspace and topic branch
 * dropped, the prompt the placeholder, the grantee setup's, no deadline and no
 * take-in -- and a revise lap's plan bases on the branch its pull request
 * goes to, not on the lap it revised. Null when the result would not be one
 * `rondo setup-plan` accepts.
 */
export function setupPlanOf(document: JsonRecord): JsonRecord | null {
  const read = readRunPlan(document);
  if (read.kind !== "planned") {
    return null;
  }
  const plan = read.plan;
  const admitted: AdmittedPlan = {
    ...plan,
    baseBranch: plan.pullRequestBaseBranch ?? plan.baseBranch,
    pullRequestBaseBranch: null,
    takeIn: null,
    gateDeadlineAtMs: null,
    prompt: PLACEHOLDER_PROMPT,
    runId: "",
    leaseClaimantId: "",
    workspace: "",
    topicBranch: "",
  };
  const {
    run_id: _run,
    lease_claimant_id: _lease,
    workspace: _workspace,
    topic_branch: _topic,
    ...rest
  } = planPayload(admitted);
  const setup: JsonRecord = {
    ...rest,
    parties: { ...plan.parties, grantee: "rondo-allocates-this" },
  };
  const again = readRunPlan(setup);
  return again.kind === "planned" && !("refusal" in agentTypeRecordOf(again.plan, setup))
    ? setup
    : null;
}
