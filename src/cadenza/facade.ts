/**
 * The one module in rondo that imports cadenza.
 *
 * D-0018 makes cadenza a library rondo consumes, delivered as a vendored
 * tarball under cadenza's own artifact-delivery bridge (cadenza D-0035). This
 * module is rule 5 of that entry: a single facade, granted
 * `@suisya-systems/cadenza` by name in
 * `test/architecture/import-boundaries.test.ts`, with every binding it takes
 * enumerated there. A second module in this layer is not granted the package,
 * and no other layer is granted it at all -- so "what does rondo use cadenza
 * for" is answered by reading one file rather than by grepping the tree.
 *
 * **The layer is self-only for now.** `src/refrain` does not reach it, because
 * no conductor code consumes it yet; the arrow is added when one does, as its
 * own decision, and not in advance (D-0018 rule 5).
 *
 * Three things this facade deliberately does not do:
 *
 *  - **It does not re-implement anything.** Every value below comes out of
 *    cadenza; rondo's functions compose cadenza's and narrow its surface.
 *    Restating a rule of cadenza's here would be the drift D-0016 warned about,
 *    now on the inside of a dependency instead of across a boundary.
 *  - **It issues an initial contract and nothing else.** `contractInputForAgentType`
 *    renders a record into an input and `delegationContract()` is the only
 *    constructor, so those two travel together here and there is no route to a
 *    contract that did not come from an agent type. cadenza's `delegate` and
 *    `adopt` -- supersession, the widening successor -- are deliberately NOT
 *    imported: a successor is composed in answer to a human's decision at a
 *    gate, and rondo carries a human's answer and never composes one (D-0009).
 *    Importing them here would put the machinery for that one import away from
 *    a loop that must not have it.
 *  - **It does not enforce.** {@link classifyAction} returns cadenza's answer.
 *    `classify()` is pure and total: it says `allowed`, `needs_approval` or
 *    `refused`, and it stops nothing (cadenza D-0026 section 2). What rondo does
 *    with `needs_approval` is a gate, which is continuo's verb and the human's
 *    decision -- never something read out of this module's return value.
 *
 * **Nothing here reads a file, a clock or the network**, which is what lets the
 * smoke exercise the whole path with in-memory fixtures. cadenza's TOML catalog
 * source is not imported for that reason: rondo has no catalog on disk yet, and
 * the day it does, that import is a decision about where rondo's configuration
 * lives rather than a detail of this file.
 */
import {
  type AgentType,
  type AgentTypeInput,
  type Classification,
  type ClassificationContext,
  agentType as cadenzaAgentType,
  classify as cadenzaClassify,
  composeCatalog as cadenzaComposeCatalog,
  contractDigest as cadenzaContractDigest,
  contractInputForAgentType as cadenzaContractInputForAgentType,
  contractPayload as cadenzaContractPayload,
  delegationContract as cadenzaDelegationContract,
  layerDocument as cadenzaLayerDocument,
  nativePath as cadenzaNativePath,
  resolveProject as cadenzaResolveProject,
  type DelegationContract,
  type IntendedAction,
  type IssuanceParties,
  type RawTable,
  type ResolvedProject,
} from "@suisya-systems/cadenza";

export type {
  AgentType,
  AgentTypeInput,
  Classification,
  ClassificationContext,
  DelegationContract,
  IntendedAction,
  IssuanceParties,
  RawTable,
  ResolvedProject,
};

/**
 * One catalog layer, before cadenza has looked at it.
 *
 * The same four fields cadenza's `LayerDocument` carries, restated as rondo's
 * own interface so that a caller does not have to name a cadenza type to hand
 * one over -- `layerDocument()` is the validating constructor and it is called
 * below, once, rather than by every caller.
 *
 * `baseDir` is **absolute, in the platform's own spelling**, and cadenza refuses
 * anything else: a relative anchor would leave a relative `local_path` for the
 * caller to finish resolving against its own working directory, which is the
 * behaviour cadenza's catalog design forbids. On Windows "absolute" includes a
 * drive letter, so a POSIX-shaped literal is *drive-relative* there and is
 * refused -- a path from `node:path`'s `resolve`, or from a real directory, is
 * what to pass.
 */
export interface CatalogLayer {
  /** The layer's name, lowest precedence first when several are composed. */
  readonly layer: string;
  /** Where this layer came from, for provenance and for refusal messages. */
  readonly origin: string;
  /** Absolute directory a relative path in this layer is anchored to. */
  readonly baseDir: string;
  /** The layer's parsed table. */
  readonly data: RawTable;
}

/**
 * Compose the layers and resolve one project name against them.
 *
 * Composition and resolution are one step here because rondo has no use for a
 * `Catalog` on its own: what a run persists is the `ResolvedProject` snapshot,
 * with its `configDigest` and its per-field provenance. Keeping the catalog
 * out of the return type also keeps the cadenza value that would be most
 * tempting to cache out of rondo's hands -- a stale catalog is exactly what
 * `configDigest` exists to detect.
 *
 * Refusals are cadenza's and are not translated: an unknown name raises
 * `ProjectNotFoundError` with the close matches cadenza computed. A rondo
 * message wrapped around it would be a second vocabulary for the same fault.
 */
export function resolveProject(layers: readonly CatalogLayer[], name: string): ResolvedProject {
  const documents = layers.map((layer) =>
    cadenzaLayerDocument(layer.layer, layer.origin, layer.baseDir, layer.data),
  );
  return cadenzaResolveProject(cadenzaComposeCatalog(documents), name);
}

/**
 * One path, lexically normalised exactly as cadenza normalises its own.
 *
 * **The point is that it is the same function, not an equivalent one.** cadenza
 * runs every `local_path` source through `nativePath.normpath` on the way into
 * a `ResolvedProject`; anything comparing rondo's `repository` against that
 * value has to spell a path the same way cadenza does, and a second
 * implementation is a second thing that can disagree -- which is D-0016's drift
 * warning and D-0018 rule 7's rule, here on exactly the surface where a
 * disagreement is silent: a comparison that no longer holds just stops
 * catching the fault it was added for.
 *
 * A hand-written version of this was the alternative, and it was tried: the
 * conductor's layer may import nothing external, so it had no `node:path`. Three
 * rounds of review found three separate ways it differed from `normpath` -- a
 * `.` segment, a backslash that is a separator on one platform and a file-name
 * character on the other, and a UNC root that is a server and a share rather
 * than two leading slashes. cadenza exports the function; rondo uses it.
 *
 * Lexical, like cadenza's: no symlink resolved, nothing stat'd, so it answers
 * the same in CI on a machine that has none of these directories.
 */
export function normalisePath(value: string): string {
  return cadenzaNativePath.normpath(value);
}

/**
 * Build the agent-type record, or let cadenza refuse the input.
 *
 * The record is the value rondo's own entries lean on -- D-0014's neutral role
 * name lives in its `executorPolicy`, and D-0011 and D-0012 read the sets it
 * carries -- and its absence from cadenza's exported surface was half of
 * D-0016's reason for consuming nothing. cadenza D-0034 exports it, which is
 * what D-0018 acts on.
 *
 * A thin pass-through on purpose: `agentType()` validates, sorts, freezes and
 * digests, and a rondo-side default for any field would be rondo deciding
 * something the record's schema decides.
 */
export function agentTypeRecord(input: AgentTypeInput): AgentType {
  return cadenzaAgentType(input);
}

/**
 * The initial delegation contract an agent type and a resolved project issue.
 *
 * Initial: `contractInputForAgentType` sets `supersedes` to `null`, which opens
 * a lineage. There is no facade function for a successor, and that is rule 7 of
 * D-0018 rather than an omission -- a successor is what answers a human's
 * decision at a gate, and rondo carries such an answer without ever composing
 * one (D-0009).
 *
 * The two identities are the caller's because cadenza mints neither: `issuer`
 * and `grantee` name a run and a delegate that are rondo's records, not
 * cadenza's types. They are validated by `delegationContract()` on the way in,
 * so they are passed through unchecked here rather than checked twice against
 * two copies of the same rules.
 */
export function issueInitialContract(
  record: AgentType,
  project: ResolvedProject,
  parties: IssuanceParties,
): DelegationContract {
  return cadenzaDelegationContract(cadenzaContractInputForAgentType(record, project, parties));
}

/**
 * Classify one intended action against one contract: cadenza's answer, unaltered.
 *
 * `classify()` is total -- every input produces `allowed`, `needs_approval` or
 * `refused`, and none throws -- so this returns rather than refuses, and the
 * caller is what turns an answer into a decision. `context.configDigest` is the
 * subject's digest **now**, which is how a contract issued against a catalog
 * that has since moved comes back `stale_subject` instead of being honoured.
 */
export function classifyAction(
  contract: DelegationContract,
  action: IntendedAction,
  context: ClassificationContext,
): Classification {
  return cadenzaClassify(contract, action, context);
}

/**
 * cadenza's canonical rendering of a contract, as plain readable data.
 *
 * `unknown` rather than a JSON union because the union's home is the store, and
 * this layer may not name it (see {@link contractPayload}).
 */
export type ContractPayload = Readonly<Record<string, unknown>>;

/**
 * The contract's fields **as issued**, as plain data (D-0022 rule 18).
 *
 * A pass-through, and the reason it is here at all is that the `composition`
 * row holds the contract verbatim so that its digest can be **recomputed
 * rather than trusted** (`D-0020` rule 4 fact 1). The payload cadenza digests
 * and the payload rondo persists have to be the same bytes, so rondo takes
 * cadenza's rendering instead of writing a second one -- a second encoding is
 * a second thing that can drift, and it would drift silently, because a
 * recomputation over the wrong bytes fails the comparison it exists to make.
 *
 * The return type is stated structurally rather than as the store's
 * `JsonRecord`: this layer's internal allowance names only itself, so the one
 * module that may import cadenza may not import the store either, and a shape
 * both sides can read is what crosses. The caller in `src/access` is where the
 * two are stated to be the same document.
 */
export function contractPayload(contract: DelegationContract): ContractPayload {
  return cadenzaContractPayload(contract);
}

/**
 * cadenza's digest of one contract, which is the value a human approves.
 *
 * Taken from cadenza rather than computed here for {@link contractPayload}'s
 * reason and one more: `D-0022` rule 17 makes the approved digest the thing
 * admission compares its own classification against, so a digest rondo framed
 * differently would refuse every retry a person had actually approved.
 */
export function contractDigest(contract: DelegationContract): string {
  return cadenzaContractDigest(contract);
}
