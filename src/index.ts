/**
 * rondo's public surface, as far as it exists.
 *
 * A barrel and nothing else. It belongs to no layer, so the boundary test
 * constrains it by an explicit exception rather than by a layer rule: it may
 * re-export across every layer -- that is what a barrel is for -- and it may
 * reach nothing that is not a layer, including anything outside `src/`.
 *
 * What is exported here is a statement about progress. Today that statement is
 * "there is a conductor, and it drives one lap": the planner, the interpreter's
 * four entry points, the plan a caller has to hand it, the durable store, and
 * the two seams underneath (README, "Status"). The web UI, the localhost MCP
 * surface and an allocator are still Issue-sized.
 *
 * **The composition root is what a host should reach for**, not the pieces:
 * `src/access/conductor.ts` wires the ports, translates continuo's outcomes into
 * the conductor's, and carries `resume` and `abandon` (D-0019 rule 2). The
 * pieces are exported beside it because the boundary test's rule for this file
 * is "may reach the layers", not "may reach one of them" -- and because a test
 * that could only reach the tree through the root would be a test of the root.
 */
export {
  abandon,
  admit,
  type ConductorReport,
  conductorPorts,
  openConductor,
  requestWithdrawal,
  resume,
  runContinuo,
} from "./access/conductor.js";
export { asciiEscape, relayUpstream } from "./access/console.js";
export { describeNextStep } from "./access/local.js";
export {
  type AgentType,
  type AgentTypeInput,
  agentTypeRecord,
  type CatalogLayer,
  type Classification,
  type ClassificationContext,
  classifyAction,
  type DelegationContract,
  type IntendedAction,
  type IssuanceParties,
  issueInitialContract,
  type RawTable,
  type ResolvedProject,
  resolveProject,
} from "./cadenza/facade.js";
export {
  type AdmitRunOutcome,
  type AdmitRunRequest,
  admitRun,
  type PerformLapRequest,
  performLap,
  SERVED_ENDPOINT_RECIPIENTS,
  type ShowGateRequest,
  type StartupResult,
  showGate,
  startContinuo,
  type VerifiedContinuo,
} from "./continuo/invoker.js";
export {
  CONTINUO_REPOSITORY,
  CONTINUO_REVISION,
  CONTINUO_VERSION_LINE,
} from "./continuo/pin.js";
export {
  type ContinuoResult,
  DB_CREATE,
  GATE_CLOSE,
  GATE_LIST,
  GATE_SHOW,
  LAP_PERFORM,
  type LapPerformed,
  RUN_ADMIT,
} from "./continuo/protocol.js";
export { CONTINUO_ROSTER, mapNeutralRole, mappedNeutralRoleNames } from "./continuo/roles.js";
export { classifyPlan } from "./refrain/classification.js";
export { nextStep, type Step } from "./refrain/loop.js";
export {
  type PlanOutcome,
  planPayload,
  type RunPlan,
  readPlan,
  runPlan,
  SERVED_RECIPIENTS,
} from "./refrain/plan.js";
export { type Autonomy, CONSERVATIVE_POLICY, type LoopPolicy } from "./refrain/policy.js";
export type {
  ClassificationRecord,
  ConductorPorts,
  ContinuoStarted,
  EffectOutcome,
  GateObservation,
  LapPerformance,
  RunAdmission,
  StorePort,
} from "./refrain/ports.js";
export { canonicalJson, planDigest } from "./store/plan.js";
export type {
  IterationFields,
  IterationRecord,
  IterationStatus,
  JsonRecord,
  JsonValue,
  NonTerminalStatus,
  TerminalStatus,
} from "./store/records.js";
export { isTerminal, RELEASED_BY, TERMINAL_STATUSES } from "./store/records.js";
export {
  type IterationStore,
  iterationStore,
  type ReadOutcome,
  type ReserveInput,
  type ReserveOutcome,
  type SettleOutcome,
  StoreDefect,
  type TransitionOutcome,
} from "./store/sqlite.js";
