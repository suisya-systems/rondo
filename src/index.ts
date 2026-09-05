/**
 * rondo's public surface, as far as it exists.
 *
 * A barrel and nothing else. It belongs to no layer, so the boundary test
 * constrains it by an explicit exception rather than by a layer rule: it may
 * re-export across every layer -- that is what a barrel is for -- and it may
 * reach nothing that is not a layer, including anything outside `src/`.
 *
 * What is exported here is a statement about progress. Today that statement is
 * "the skeleton exists and its boundaries hold"; the loop, the web UI, the MCP
 * surface and the store schema are all still Issue-sized (README, "Status").
 */
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
  run as runContinuo,
  type StartupResult,
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
  RUN_ADMIT,
} from "./continuo/protocol.js";
export { nextStep, type Step } from "./refrain/loop.js";
export { type Autonomy, CONSERVATIVE_POLICY, type LoopPolicy } from "./refrain/policy.js";
export type { IterationRecord, IterationStatus } from "./store/records.js";
export { type IterationStore, iterationStore } from "./store/sqlite.js";
