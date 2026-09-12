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
 *
 * Everything printed goes through `asciiEscape`, because every variable part of
 * it -- the tier, the path, a parse error -- comes out of a file an operator
 * wrote, and D-0004 holds for this command as for every other (AGENTS.md 6).
 */
import { readFileSync } from "node:fs";

const plan = process.argv[2];
if (plan === undefined) {
  process.stderr.write("usage: npm run preflight:model-tier -- /absolute/path/to/plan.json\n");
  process.exit(2);
}

// Dynamic for `bin/rondo.mjs`'s reason: an unbuilt tree becomes the sentence
// naming the command that fixes it, rather than a module-resolution stack. It
// comes before the plan is read because the escape below is in that tree too.
let mapModelTier;
let asciiEscape;
try {
  const built = new URL("../dist/", import.meta.url);
  ({ mapModelTier } = await import(new URL("continuo/roles.js", built).href));
  ({ asciiEscape } = await import(new URL("access/console.js", built).href));
} catch {
  process.stderr.write("rondo is not built. Run: npm run build\n");
  process.exit(1);
}

const refuse = (reason) => {
  process.stderr.write(`${asciiEscape(reason)}\n`);
  process.exit(1);
};

// The tier is read out of the plan rather than typed on the command line on
// purpose: a preflight that checks a tier the run will not use is a preflight
// that passes and then lets the run fail.
let tier;
try {
  tier = JSON.parse(readFileSync(plan, "utf8"))?.agent_type_input?.executorPolicy?.modelTier;
} catch (error) {
  refuse(`${plan} could not be read as a plan: ${error instanceof Error ? error.message : error}`);
}
if (typeof tier !== "string") {
  refuse(`${plan} has no agent_type_input.executorPolicy.modelTier to check.`);
}

const selection = mapModelTier(tier);
if (selection.kind === "unknown") {
  refuse(selection.reason);
}
process.stdout.write(`model tier '${asciiEscape(tier)}' runs on ${selection.model}\n`);
