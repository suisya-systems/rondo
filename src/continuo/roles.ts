/**
 * The executor-policy adapter: the one place cadenza's `executorPolicy` becomes
 * continuo's executor vocabulary.
 *
 * Two independent tables live here, one per field of that policy, and they are
 * deliberately not one table:
 *
 *  - {@link mapNeutralRole} takes `executorPolicy.roleName` to a continuo role
 *    (D-0019 rule 13 / `R-12`);
 *  - {@link mapModelTier} takes `executorPolicy.modelTier` to a concrete model
 *    id (D-0021, over `continuo D-0099`).
 *
 * **A role says what the executor is for; a model says who executes.** That is
 * continuo D-0099's own distinction and D-0014 rule 3's: continuo's
 * `roles.json` carries no model key and is not going to, so a role -> model
 * table would be rondo inventing a join continuo refused to make. The two
 * fields arrive together on one policy and are mapped separately.
 *
 * No caller ever names a continuo role or a model id, so the vocabulary of
 * continuo's fence and of the worker CLI's command line stops here.
 * `src/continuo/invoker.ts` is the only reader of either table --
 * {@link admitRun} of the first, {@link performLap} of the second -- and
 * everything upstream of it -- the conductor, the operating surface, an agent
 * type -- speaks cadenza's neutral names and nothing else. That is D-0014
 * rule 1, and this module is where it is kept.
 *
 * **The roster below is a transcription of a bundled document at one
 * revision.** continuo's roster is `src/fencing/roles.json`, a document shipped
 * inside the build, and at the pinned revision
 * `603843b7c0e91136bc7f7e5c9f91640f7bb970c9` its `roles` object has exactly the
 * four keys named in {@link CONTINUO_ROSTER} -- read off `dist/fencing/roles.json`
 * of a build of that checkout on 2026-09-06, unchanged from the revision
 * D-0017 pinned. rondo cannot ask a build for its roster -- no verb prints one
 * -- so this is an observation copied by hand, with the revision it was
 * observed at written beside it.
 *
 * **What falsifies it**, and both halves are already on record: continuo's
 * roster *changing*, or the roster *becoming a runtime input rather than a
 * bundled document*, which is D-0014's own first falsifier. A third is an agent
 * type whose role name is none of the four, and that one is not a falsifier at
 * all -- it is the refusal path below, working. The model table has a falsifier
 * of its own, and it is written beside it.
 *
 * **Pure on purpose**, like `pin.ts` beside it: two tables and two lookups, no
 * capability of any kind, so every case is a unit case rather than something
 * only a built continuo can reach.
 *
 * **ASCII only** (D-0004): every string here can reach a cp932 console.
 */

/**
 * continuo's roles, at the pinned revision, in the document's own order.
 *
 * Read off `src/fencing/roles.json`'s `roles` keys at
 * `603843b7c0e91136bc7f7e5c9f91640f7bb970c9`. Frozen because it is a
 * measurement: a caller that could push a name onto it would be adding a role
 * to continuo by editing rondo's memory of continuo.
 */
export const CONTINUO_ROSTER = Object.freeze([
  "worker",
  "curator",
  "dispatcher",
  "secretary",
] as const);

/**
 * The mapping, written as a table even though it is the identity today.
 *
 * **The domain is open and the codomain is four.** cadenza validates
 * `executorPolicy.roleName` *structurally* only -- any identifier matching a
 * lowercase letter followed by up to 63 of `[a-z0-9_-]` -- and says in its own
 * words that it does not know which roles exist. continuo's roster is the four
 * above. So there is a gap between what cadenza will accept and what continuo
 * will run, and something has to be the place that gap is closed; this table is
 * it, and {@link mapNeutralRole} is the refusal for everything outside it.
 *
 * **Why a table and not `roster.includes(name)`.** The identity is the honest
 * lap-1 mapping because rondo has no agent types yet and will mint the first
 * ones itself, so today every neutral name rondo can produce happens to be
 * spelled the way continuo spells it. Writing the identity down as a table
 * anyway is what makes the *second* executor -- a neutral name that is not a
 * continuo role, or two neutral names onto one role -- a change to this one file
 * (D-0014 rule 3). A membership test would look identical today and would have
 * to be replaced rather than extended.
 */
const NEUTRAL_ROLE_TABLE: Readonly<Record<string, string>> = Object.freeze({
  worker: "worker",
  curator: "curator",
  dispatcher: "dispatcher",
  secretary: "secretary",
});

/**
 * What a neutral name mapped to, or rondo's reason it did not.
 *
 * `unknown` is **rondo's own vocabulary error** and not continuo's refusal:
 * nothing was spawned, no transaction was opened, and continuo was never asked.
 * The distinction matters at the seam, because continuo's `run admit` would
 * refuse an unknown role too -- as `UnknownRoleRefused`, before its transaction
 * opens -- and a reader who saw that refusal would reasonably think rondo had
 * asked continuo something. It had not.
 */
export type RoleMapping =
  | { readonly kind: "mapped"; readonly role: string }
  | { readonly kind: "unknown"; readonly reason: string };

/**
 * One neutral role name, mapped or refused.
 *
 * Total: an unmapped name is a value, not a throw, because the name arrives on
 * an agent type an operator wrote and refusing it is an ordinary answer.
 *
 * **The one error no test on either side catches, and it is worth naming here
 * rather than only in D-0014**: a *mis-mapping onto a valid role*. If this table
 * ever sends `curator` to `worker`, continuo admits the run without complaint,
 * because continuo's check is `roster.includes(role)` and nothing more -- the
 * fence rendered is a real fence, just the wrong one. Nothing downstream can
 * detect that; only reading this table against the roster can. That is the
 * reason `test/continuo/roles.test.ts` asserts the table in both directions
 * instead of asserting that the mapped role is *some* roster name.
 */
export function mapNeutralRole(neutralRoleName: string): RoleMapping {
  // `Object.hasOwn` rather than a bare index, so `constructor`, `toString` and
  // every other prototype name is an unknown role rather than a function
  // arriving where a string was expected.
  if (Object.hasOwn(NEUTRAL_ROLE_TABLE, neutralRoleName)) {
    const role = NEUTRAL_ROLE_TABLE[neutralRoleName];
    if (role !== undefined) {
      return { kind: "mapped", role };
    }
  }
  return {
    kind: "unknown",
    reason:
      `rondo has no continuo role for the neutral role name '${neutralRoleName}'. ` +
      `continuo's roster at the pinned revision is ${CONTINUO_ROSTER.join(", ")}, and rondo ` +
      "maps a name onto it rather than passing one through. Give the agent type one of those " +
      "names, or add the mapping to src/continuo/roles.ts.",
  };
}

/**
 * Every neutral name this table maps, for the both-directions table test.
 *
 * Exported so the test can assert the table rather than a sample of it: a test
 * that only exercised the names it thought of would pass over a fifth key
 * somebody added pointing at a role that is not on the roster.
 */
export function mappedNeutralRoleNames(): readonly string[] {
  return Object.keys(NEUTRAL_ROLE_TABLE);
}

/**
 * cadenza's model tiers, and the concrete model each one runs on.
 *
 * **The values are provisional (D-0021).** Which model a tier costs is a
 * quality-and-cost policy an operator owns, not something an implementation
 * diff may decide, so the pair below is recorded as the table in force *pending
 * an operator's ratification* rather than as a settled fact. What is not
 * provisional is the shape: the mapping exists, it lives here, and a tier
 * outside it is refused.
 *
 * **The domain is open and the table has one row**, which is the same gap
 * {@link NEUTRAL_ROLE_TABLE} closes for role names. cadenza validates
 * `executorPolicy.modelTier` structurally only -- `src/domain/agent-type.ts` at
 * the vendored revision checks the spelling of an identifier and says nothing
 * about which tiers exist -- and `standard` is the only tier any agent type in
 * this repository uses. continuo, on the other side, checks that `--model` is a
 * plain model id and states in its own words that it does not know which ids the
 * worker CLI knows. So neither side can answer "which model is `standard`", and
 * this table is the place that answer is written down.
 *
 * **Changing a pair is a new decision entry**, not an edit. The whole reason the
 * value is here rather than derived is that somebody decided it; a pair replaced
 * silently would be a lap costing something different with nothing on record
 * saying when it changed or who agreed.
 *
 * **What falsifies it**: cadenza growing a tier vocabulary of its own (the pairs
 * become cadenza's to state and rondo's to consume), continuo taking a tier
 * rather than a model id (the table moves down a layer), or the operator
 * ratifying different ids (the pairs change under a new entry). A tier outside
 * the table is none of these -- it is the refusal below, working.
 */
const MODEL_TIER_TABLE: Readonly<Record<string, string>> = Object.freeze({
  standard: "claude-opus-5",
});

/**
 * What a model tier selected, or rondo's reason it selected nothing.
 *
 * `unknown` is **rondo's own policy gap** and not continuo's refusal, exactly as
 * {@link RoleMapping}'s is: nothing was spawned and continuo was never asked.
 * The distinction is sharper here than for roles, because continuo would *not*
 * refuse the tier -- it would refuse, or silently accept, whatever token rondo
 * chose to append -- so there is no upstream check to fall back on.
 */
export type ModelSelection =
  | { readonly kind: "selected"; readonly model: string }
  | { readonly kind: "unknown"; readonly reason: string };

/**
 * One model tier, selected or refused.
 *
 * Total, like {@link mapNeutralRole}: an unmapped tier is a value rather than a
 * throw, because the tier arrives on an agent type an operator wrote.
 *
 * **The refusal is what makes the omission safe.** Passing no `--model` is a
 * supported continuo call, and it is the one thing this must not do with a tier
 * it does not recognise: continuo's own help says omitting the flag "is not a
 * neutral choice", because the child then runs on whatever the worker CLI
 * defaults to -- which is the model nobody chose and, as the lap-1 dogfood
 * measured (F-2), the most expensive one. A tier rondo cannot price is refused
 * before the spawn instead.
 */
export function mapModelTier(modelTier: string): ModelSelection {
  // `Object.hasOwn` rather than a bare index, for {@link mapNeutralRole}'s
  // reason: `constructor` and every other prototype name is an unknown tier
  // rather than a function arriving where a string was expected.
  if (Object.hasOwn(MODEL_TIER_TABLE, modelTier)) {
    const model = MODEL_TIER_TABLE[modelTier];
    if (model !== undefined) {
      return { kind: "selected", model };
    }
  }
  return {
    kind: "unknown",
    reason:
      `rondo has no model for the model tier '${modelTier}'. The tiers rondo prices are ` +
      `${mappedModelTiers().join(", ")}, and a lap runs on a model rondo chose rather than on ` +
      "the worker CLI's own default. Give the agent type one of those tiers, or add the pair to " +
      "src/continuo/roles.ts under a new decision entry.",
  };
}

/**
 * Every tier this table prices, for the both-directions table test and for the
 * refusal above.
 *
 * Exported for {@link mappedNeutralRoleNames}'s reason: a test that only
 * exercised the tiers it thought of would pass over a second key somebody added
 * pointing at something that is not a model id.
 */
export function mappedModelTiers(): readonly string[] {
  return Object.keys(MODEL_TIER_TABLE);
}
