/**
 * What the page drafts a goal scope from, and where one stands (D-0128, rondo#471).
 *
 * **A goal scope is drafted from the goal and the plans rondo holds for its
 * repository**: the workspaces and agent types are those of the held plans
 * whose forge repository is the goal's, and the budgets are
 * `src/advisory/budget.ts`'s with one plan per clause of the goal. The page
 * and the press both read it here, so what the press records is what the
 * screen drew, compared by {@link GoalScopeMaterial.drawn}.
 *
 * **Where one stands is read off the approvals in force**: a goal scope whose
 * `from_goal` is the goal's id, and paused when its `laps` is 0 (rule 4).
 */

import { contentDigest } from "../store/plan.js";
import type {
  JsonRecord,
  JsonValue,
  ScopeWorkspace,
  StoredGoal,
  StoredScope,
} from "../store/records.js";
import { requestsGoal } from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { heldPlans } from "./model-draft/host.js";

/** The goal, and the lists a goal scope drafted from it holds. */
export interface GoalScopeMaterial {
  readonly goal: StoredGoal;
  readonly workspaces: readonly ScopeWorkspace[];
  readonly agentTypes: readonly {
    readonly agentTypeDigest: string;
    readonly agentTypeInput: JsonValue;
    readonly planDigest: string;
  }[];
  /** A digest over the two lists, which the press compares with its own re-read. */
  readonly drawn: string;
}

export type GoalScopeMaterialRead =
  | { readonly kind: "read"; readonly material: GoalScopeMaterial }
  | { readonly kind: "noGoal" }
  | { readonly kind: "noPlan"; readonly goal: StoredGoal };

/** The newest goal of `repository` (D-0097 point 2.1 (a)), or null. */
function goalOf(goals: readonly StoredGoal[], repository: string): StoredGoal | null {
  return goals.filter((goal) => goal.repository === repository).at(-1) ?? null;
}

export async function goalScopeMaterial(
  ports: {
    readonly store: Pick<IterationStore, "readLive" | "terminalIterations" | "readingsFor">;
    readonly record: Pick<
      AdvisoryRecord,
      "goals" | "threadMessages" | "heldAgentType" | "heldAgentTypeDigests" | "setupPlans"
    >;
    readonly now: () => number;
  },
  repository: string,
): Promise<GoalScopeMaterialRead> {
  const goal = goalOf(await ports.record.goals(), repository);
  if (goal === null) {
    return { kind: "noGoal" };
  }
  // No request yet: the plans offered are every one rondo holds, narrowed here
  // to the goal's repository.
  const plans = (await heldPlans(ports, "")).filter((plan) => plan.forgeRepository === repository);
  if (plans.length === 0) {
    return { kind: "noPlan", goal };
  }
  const workspaces = [
    ...new Map(
      plans.map((plan) => [
        `${plan.repository}\n${plan.workspaceRoot}`,
        { repository: plan.repository, workspace_root: plan.workspaceRoot },
      ]),
    ).values(),
  ];
  const agentTypes = [
    ...new Map(
      plans.map((plan) => [
        plan.agentTypeDigest,
        {
          agentTypeDigest: plan.agentTypeDigest,
          agentTypeInput: plan.agentTypeInput,
          planDigest: plan.planDigest,
        },
      ]),
    ).values(),
  ];
  const drawn = contentDigest({
    goal_id: goal.goalId,
    workspaces: workspaces as unknown as JsonValue,
    agent_types: agentTypes.map((one) => one.agentTypeDigest),
  } as JsonRecord);
  return { kind: "read", material: { goal, workspaces, agentTypes, drawn } };
}

/** The approval in force over a goal's requests, if any. */
export type GoalScopeStanding =
  | { readonly kind: "none" }
  | {
      readonly kind: "running" | "paused";
      readonly scopeDecisionId: string;
      readonly scope: StoredScope;
    };

export async function goalScopeStanding(
  record: Pick<AdvisoryRecord, "approvalsInForce" | "readScope">,
  goalId: string,
): Promise<GoalScopeStanding> {
  // Newest last, so the newest approval in force is the one said.
  for (const approval of (await record.approvalsInForce()).toReversed()) {
    const read = await record.readScope(approval.scopeId);
    if (read.kind === "read" && requestsGoal(read.scope.payload.requests) === goalId) {
      return {
        kind: read.scope.payload.budgets.laps === 0 ? "paused" : "running",
        scopeDecisionId: approval.scopeDecisionId,
        scope: read.scope,
      };
    }
  }
  return { kind: "none" };
}
