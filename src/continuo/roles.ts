/**
 * The one place a neutral role name becomes a continuo role.
 *
 * D-0019 rule 13 (`R-12`): no caller ever names a continuo role, so the
 * vocabulary of continuo's fence stops here. `src/continuo/invoker.ts`'s
 * {@link admitRun} is the only reader; everything upstream of it -- the
 * conductor, the operating surface, an agent type -- speaks cadenza's neutral
 * `executorPolicy.roleName` and nothing else. That is D-0014 rule 1, and this
 * module is where it is kept.
 *
 * **The roster below is a transcription of a bundled document at one
 * revision.** continuo's roster is `src/fencing/roles.json`, a document shipped
 * inside the build, and at the pinned revision
 * `44f62336108b86cab5da791111ffa0e5b73cd01a` its `roles` object has exactly the
 * four keys named in {@link CONTINUO_ROSTER}. rondo cannot ask a build for its
 * roster -- no verb prints one -- so this is an observation copied by hand, with
 * the revision it was observed at written beside it.
 *
 * **What falsifies it**, and both halves are already on record: continuo's
 * roster *changing*, or the roster *becoming a runtime input rather than a
 * bundled document*, which is D-0014's own first falsifier. A third is an agent
 * type whose role name is none of the four, and that one is not a falsifier at
 * all -- it is the refusal path below, working.
 *
 * **Pure on purpose**, like `pin.ts` beside it: a table and a lookup, no
 * capability of any kind, so every case is a unit case rather than something
 * only a built continuo can reach.
 *
 * **ASCII only** (D-0004): every string here can reach a cp932 console.
 */

/**
 * continuo's roles, at the pinned revision, in the document's own order.
 *
 * Read off `src/fencing/roles.json`'s `roles` keys at
 * `44f62336108b86cab5da791111ffa0e5b73cd01a`. Frozen because it is a
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
