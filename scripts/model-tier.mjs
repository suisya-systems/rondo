/**
 * The model-tier preflight `dogfood-lap.md` step 1 documents, as a command.
 *
 * It is a script rather than the `node -e` one-liner it used to be because a
 * fenced lap may run `npm run` and may not evaluate an expression (rondo#103).
 * The plan's `allowed_bash` is a list of whole commands, so the one-liner was a
 * step the handbook documented that a lap inside the fence could not run -- and
 * the spelling that would have made it runnable, `node -e:*`, is an entrance to
 * anything rather than a vocabulary. A named command needs neither.
 *
 * Exits 1 on a tier rondo cannot price, which is the answer worth having before
 * a run is admitted: `performLap` refuses that tier only after the row is
 * committed and continuo is holding an admitted run.
 */
import { readFileSync } from "node:fs";

const plan = process.argv[2];
if (plan === undefined) {
  process.stderr.write("usage: npm run preflight:model-tier -- /absolute/path/to/plan.json\n");
  process.exit(2);
}

// The tier is read out of the plan rather than typed on the command line on
// purpose: a preflight that checks a tier the run will not use is a preflight
// that passes and then lets the run fail.
const tier = JSON.parse(readFileSync(plan, "utf8"))?.agent_type_input?.executorPolicy?.modelTier;
if (typeof tier !== "string") {
  process.stderr.write(`${plan} has no agent_type_input.executorPolicy.modelTier to check.\n`);
  process.exit(1);
}

// Dynamic for `bin/rondo.mjs`'s reason: an unbuilt tree becomes the sentence
// naming the command that fixes it, rather than a module-resolution stack.
let mapModelTier;
try {
  ({ mapModelTier } = await import(new URL("../dist/continuo/roles.js", import.meta.url).href));
} catch {
  process.stderr.write("rondo is not built. Run: npm run build\n");
  process.exit(1);
}

const selection = mapModelTier(tier);
if (selection.kind === "unknown") {
  process.stderr.write(`${selection.reason}\n`);
  process.exit(1);
}
process.stdout.write(`model tier '${tier}' runs on ${selection.model}\n`);
