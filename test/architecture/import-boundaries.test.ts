/**
 * The dependency direction of rondo's `src/` tree, enforced here rather than in
 * review.
 *
 * Issue #1 states three claims about a repository that is otherwise empty:
 *
 *  1. `src/refrain/`, the directory that will hold the loop, must not import
 *     HTTP, browser, session-provider or continuo-internal modules.
 *  2. Access points (`src/access/*`) may import the loop; the loop may never
 *     import an access point.
 *  3. One durable store module owns SQLite.
 *
 * All three are stated below as **allowlists**, not as lists of forbidden
 * names. A denylist answers "no" only for what it was told about, so it admits
 * every hazard nobody has thought of yet -- and on a repository this young,
 * that is most of them. `src/refrain/`'s external allowance is empty, which
 * refuses `node:http`, a browser driver, an agent SDK and continuo's internals
 * in one line, together with the next thing that would have needed adding.
 *
 * **Modules are parsed, never imported.** An import inside a function body, in
 * type position, or through a re-export is still an import for the purpose of a
 * boundary, and importing the tree would see none of them -- and would run it.
 * `scripts/lib/ts-ast.mjs` is the parser; DECISIONS.md D-0006 records why the
 * check is a test over the syntax tree rather than a lint rule.
 *
 * **An allowlist over imports is not by itself enough**, and the reason is
 * worth stating because it is not obvious: `process.getBuiltinModule("node:http")`
 * needs no import at all. `process` is a global, so a module could take
 * `node:http`, `node:vm` or `node:child_process` while importing nothing, and
 * an allowlist consulted only on imports would never be consulted. So the sweep
 * also reads *calls* that hand back a module (`MODULE_RETURNING_CALLS`) and
 * calls that turn text into code (`CODE_FROM_TEXT_CALLS`), and puts both
 * through the same allowance -- and refuses a bare *read* of those names
 * (`CAPABILITY_NAMES`), because `const load = process.getBuiltinModule` moves
 * the call beyond the reach of any check on callees. A member name that is
 * computed rather than written (`process["get" + "BuiltinModule"]`) is refused
 * for the same reason: whether it was a capability is exactly the question, so
 * the answer is no. And the walk covers JavaScript spellings under `src/` in
 * order to **refuse** them: `allowJs` is off, so such a module is type-checked
 * by nothing, and a JSDoc `@type {import(...)}` in one is a dependency hanging
 * off a node `forEachChild` does not traverse. Refusing the file closes that
 * without teaching the sweep to read JSDoc.
 *
 * **And some capabilities are not modules at all.** `fetch("https://...")` is
 * HTTP, needs no import, and is not a module reference, so an allowlist over
 * module references has nothing to consult about it -- enforcing Issue #1's
 * "the loop must not import HTTP" against `import` alone would have enforced
 * its letter and missed the likeliest way a loop would really make a request.
 * `FORBIDDEN_GLOBALS` refuses that small, closed set of ambient names across
 * all of `src/`. It is an enumeration rather than an allowlist, which is a
 * weakness and is admitted as one: there is no "everything ambient" to invert.
 *
 * **What this sweep does not claim.** It is a check over syntax, so its
 * guarantee is over what a module *says*, not over what it could be made to do
 * at runtime. Two residuals are known and left open deliberately. Ambient
 * capability beyond the enumerated globals -- a Node API that reaches the world
 * without naming a module and is not in that list -- is not seen at all; the
 * list covers what Issue #1 named and is extended when something else earns a
 * place. And a capability reached through an identifier-keyed index --
 * `const k = "getBuiltinModule"; const load = process[k]` -- is invisible here,
 * because deciding what `k` holds is scope analysis, which is a type checker's
 * job. Closing it by refusing every computed index would refuse `rows[i + 1]`
 * along with it, which is a worse trade and was briefly made: the line drawn
 * instead is between a name that is *indexed* (`row[key]`, `rows[i + 1]`,
 * allowed) and a name *assembled from text* (`process["get" + "X"]`, refused).
 * Obfuscation is refused, arithmetic is not. What remains is a check that stops mistakes and
 * documents intent, not one that stops an author who is determined to get
 * around it -- and no syntax sweep is the latter.
 *
 * **What keeps this from passing vacuously.** The per-module cases are
 * generated from a directory walk, and a walk that found nothing would generate
 * nothing -- and a suite of zero assertions is green. Three things stop that:
 *
 *  - the walk has its own case, asserting it still finds every module in
 *    `EXPECTED_MODULES`, so deleting or renaming one is a red test rather than
 *    a quietly smaller sweep;
 *  - every discovered module must be classified into a layer or named in
 *    `UNLAYERED_MODULES`, so a new top-level directory is an offender until
 *    somebody decides what it is;
 *  - the detector is run against `PLANTED`, a corpus of hand-written violations
 *    attributed to module paths -- mostly ones that do not exist on disk, and
 *    a few real ones, where the case needs that module's actual allowance to be
 *    in play. Each one must be caught,
 *    and the clean controls beside them must not be, so a detector that had
 *    stopped detecting -- or started refusing everything -- fails here before
 *    it can report a clean tree.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript/unstable/ast";
import { afterAll, expect, test } from "vitest";

import { disposeParser, parseSourceFile } from "../../scripts/lib/ts-ast.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// The parser is a compiler child process shared by every case below. Vitest
// would otherwise sit waiting for it after the last assertion has passed.
afterAll(disposeParser);

/** The tree this file guards. */
const SRC_ROOT = "src";

/** Repo-relative paths are spelled with forward slashes on every platform. */
const slash = (path: string): string => path.split("\\").join("/");

const sourceOf = (module: string): string => readFileSync(join(ROOT, module), "utf8");

/**
 * What each layer may import from inside `src/`.
 *
 * Read the table as the arrows of Issue #1's item 2. `src/access` names
 * `src/refrain`; `src/refrain` does not name `src/access`, and that asymmetry
 * *is* claim 2 -- an access point may reach the loop, and the loop may never
 * reach back. `src/store` names only itself, so the durable layer cannot come
 * to depend on the loop it persists for.
 *
 * Stated as an allowlist for the reason the file header gives, and with one
 * consequence worth naming: a module that imports something in no layer at all
 * -- the barrel, a file under `test/`, a stray sibling directory -- matches no
 * entry and is an offender. A denylist would have let all three through.
 */
const ALLOWED_INTERNAL_BY_LAYER: Readonly<Record<string, readonly string[]>> = {
  // The durable layer. Depends on nothing else in the tree, so it can be
  // replaced without the loop noticing.
  "src/store": ["src/store"],
  // The loop. May persist, may not be reached into from an access point's side
  // of the boundary.
  "src/refrain": ["src/refrain", "src/store"],
  // The access points: the web UI and the localhost MCP surface, when they
  // exist. They compose the other two and are composed by nobody.
  "src/access": ["src/access", "src/refrain", "src/store"],
};

/**
 * Modules that belong to no layer, and are therefore constrained by nothing
 * except the entry below.
 *
 * Exactly one: the public barrel, whose whole job is to re-export across
 * layers. Naming it explicitly is what keeps "no layer" from being a way to opt
 * out -- a new top-level module under `src/` is an offender until somebody
 * classifies it.
 */
const UNLAYERED_MODULES: readonly string[] = ["src/index.ts"];

/**
 * What a module in no layer may reach: the layer roots, and nothing else.
 *
 * Re-exporting across layers is the barrel's job. What it may not do is reach
 * somewhere that is not a layer at all -- `../test/support.js` re-exported from
 * the barrel would be a package reaching out of itself, and it is the case this
 * entry exists to refuse.
 */
const ALLOWED_FOR_UNLAYERED: readonly string[] = Object.keys(ALLOWED_INTERNAL_BY_LAYER);

/**
 * Every external dependency each module may have, and under exactly which
 * named bindings.
 *
 * Keyed by **module**, not by layer, because Issue #1's claim 3 is about a
 * module: one durable store module owns SQLite. Granting `node:sqlite` to the
 * `src/store` layer would let a second file in that directory open its own
 * connection, which is the thing the claim forbids. Keying by module also makes
 * the future arrivals honest -- when the HTTP access point lands, `node:http`
 * is granted to that one file and to nothing else, including the rest of
 * `src/access`.
 *
 * A module absent from this table may import no external at all. That is the
 * state of every module in the tree but one, and it is what makes
 * `src/refrain/`'s boundary total rather than a list of names.
 *
 * Bindings are named one by one, and the sentinels defined below are
 * deliberately unspellable here: a namespace import, a default import, a
 * side-effect import, a whole-module re-export, a `require`, a dynamic
 * `import()` and a computed specifier all reduce to a sentinel, and no sentinel
 * can appear in an allowlist, so every one of them fails closed. The reason is
 * that none of them can be checked binding by binding -- `import * as fs from
 * "node:fs"` grants the whole module under a name this scan cannot follow.
 */
const ALLOWED_EXTERNALS_BY_MODULE: Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
> = {
  "src/store/sqlite.ts": { "node:sqlite": ["DatabaseSync"] },
};

/**
 * The specifiers that mean "this module is talking to SQLite".
 *
 * Both the standard-library driver rondo uses today and the native package the
 * sibling repositories use, because claim 3 is about the database, not about
 * which library reaches it: swapping drivers must not be a way to acquire a
 * second owner. Any addition here is a decision, and D-0005 is where it gets
 * taken.
 */
const SQLITE_DRIVERS: ReadonlySet<string> = new Set([
  "node:sqlite",
  "sqlite",
  "better-sqlite3",
  "node-sqlite3-wasm",
  "sqlite3",
  "@libsql/client",
]);

/** The one module allowed to name any of them. */
const SQLITE_OWNER = "src/store/sqlite.ts";

/**
 * The modules the sweep must still be finding.
 *
 * A floor, not an inventory: new modules are expected and are covered by the
 * classification case rather than by this list. What it catches is the
 * failure this whole file is most exposed to -- a walk that stops discovering
 * things and therefore stops asserting them. Deleting `src/refrain/loop.ts`
 * without deleting this entry is a red test; deleting both is a diff a reviewer
 * can see.
 */
const EXPECTED_MODULES: readonly string[] = [
  "src/access/local.ts",
  "src/index.ts",
  "src/refrain/loop.ts",
  "src/refrain/policy.ts",
  "src/store/records.ts",
  "src/store/sqlite.ts",
];

/**
 * Extensions the walk treats as modules.
 *
 * JavaScript spellings are here as well as TypeScript ones, and they are the
 * interesting half -- not because such modules are supported, but because they
 * are refused. `tsconfig.json` has `allowJs` off, so a hand-written
 * `src/refrain/helper.mjs` is type-checked by nothing; if the walk skipped it
 * too, it would be the one file in the tree checked by nothing at all, in the
 * layer whose whole point is that it cannot reach anything. So the walk finds
 * it, and `JS_EXTENSIONS` refuses it.
 */
const MODULE_EXTENSIONS = [".ts", ".mts", ".cts", ".tsx", ".js", ".mjs", ".cjs", ".jsx"];

/**
 * The spellings that make a discovered module a violation by existing.
 *
 * `src/` is TypeScript. A JavaScript module there sits outside the type checker
 * (`allowJs` is off), and it is also where a dependency can hide somewhere a
 * syntax walk does not go: `@type {import("node:http").Server}` in a JSDoc
 * comment is a real type dependency in a `.js` file, attached to a JSDoc node
 * that `forEachChild` does not traverse. Teaching the sweep to read JSDoc would
 * close that one route; refusing the file closes the route, the type-checking
 * gap, and whatever the next JavaScript-only affordance turns out to be.
 * Nothing is lost: the tree has no such module and no reason to grow one.
 */
const JS_EXTENSIONS = [".js", ".mjs", ".cjs", ".jsx"];

/**
 * How a discovered module is presented to the parser.
 *
 * The parser takes its grammar from the extension, and a `.mjs` file is ESM
 * TypeScript-superset source for the purpose of reading its imports, so it is
 * parsed as `.mts`. The mapping is only about which grammar to use; the module
 * keeps its real path everywhere else, including in every message.
 */
const PARSE_AS: Readonly<Record<string, string>> = {
  ".js": ".ts",
  ".jsx": ".tsx",
  ".mjs": ".mts",
  ".cjs": ".cts",
};

/** The name to parse `module` under, so the right grammar is chosen. */
function parseNameOf(module: string): string {
  for (const [actual, grammar] of Object.entries(PARSE_AS)) {
    if (module.endsWith(actual)) {
      return `${module.slice(0, -actual.length)}${grammar}`;
    }
  }
  return module;
}

/**
 * Relative specifiers must carry one of these; NodeNext requires the suffix.
 *
 * Each runtime suffix lists the TypeScript spellings that can satisfy it, and
 * only those: `JS_EXTENSIONS` makes a JavaScript module under `src/` a
 * violation in its own right, so an import that resolved to one would be an
 * import of a module this tree is not allowed to contain.
 */
const RUNTIME_SUFFIXES: ReadonlyArray<readonly [string, readonly string[]]> = [
  [".js", [".ts", ".tsx"]],
  [".mjs", [".mts"]],
  [".cjs", [".cts"]],
];

// --- the walk ---------------------------------------------------------------

/** Every module under `src/`, repo-relative, sorted. */
function walkModules(): string[] {
  const found: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(join(ROOT, directory)).sort()) {
      const child = `${directory}/${entry}`;
      if (statSync(join(ROOT, child)).isDirectory()) {
        visit(child);
      } else if (MODULE_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
        found.push(child);
      }
    }
  };
  visit(SRC_ROOT);
  return found.sort();
}

const MODULES = walkModules();

// --- reading the imports out of a module ------------------------------------

/**
 * The sentinels standing in for a binding this scan cannot check one name at a
 * time. None of them is spellable in `ALLOWED_EXTERNALS_BY_MODULE`, so each one
 * refuses the import it describes.
 */
const NAMESPACE = "<namespace import>";
const DEFAULT_BINDING = "<default import>";
const SIDE_EFFECT = "<side-effect import>";
const WHOLE_MODULE = "<whole module>";
const COMPUTED_SPECIFIER = "<computed specifier>";

/**
 * A member name that is computed rather than written.
 *
 * `process["get" + "BuiltinModule"]` names a capability without spelling it,
 * so the name cannot be compared against anything. It is distinct from "this
 * callee has no name at all", because the two deserve opposite answers: an
 * unnamed callee is ordinary code, and an unreadable member name on a call is
 * the shape of an evasion. Anything matched to this fails closed.
 */
const COMPUTED_MEMBER = "<computed member>";

/**
 * Calls that hand back a module, whatever they are spelled through.
 *
 * `require` is the obvious one. `getBuiltinModule` is the one that made this a
 * set rather than a string comparison: `process.getBuiltinModule("node:http")`
 * needs **no import at all** — `process` is a global — so a module under
 * `src/refrain/` could take `node:http`, `node:vm` or `node:child_process`
 * while importing nothing, and an allowlist over imports would have had nothing
 * to be consulted about. `createRequire` manufactures a `require` under any
 * name the caller likes, which is why it is here as well as being unimportable
 * (`node:module` is not in any allowance).
 *
 * The match is on the **last name segment** of the callee, so
 * `process.getBuiltinModule(...)` and `globalThis.process.getBuiltinModule(...)`
 * are the same answer.
 *
 * A call through a **local alias** — `const load = process.getBuiltinModule;
 * load("node:http")` — is a different problem: at the call site the callee is
 * just `load`, and following it back is scope analysis, which is a type
 * checker's job rather than a sweep's. It is closed from the other end
 * instead. The alias has to be written, so the *read* is refused as well as the
 * call: naming any of these capabilities anywhere in an expression is a
 * violation on its own (`capabilityReads` below), whether or not it is
 * immediately called. That costs nothing here, because nothing under `src/` has
 * any business naming them at all.
 */
const MODULE_RETURNING_CALLS: ReadonlySet<string> = new Set([
  "require",
  "getBuiltinModule",
  "createRequire",
]);

/**
 * Calls that turn text into code.
 *
 * They name no module, which is the point: whatever they evaluate can name any
 * module, and no scan over syntax can see it. They are recorded as a computed
 * specifier so they fail with the message that says so.
 */
const CODE_FROM_TEXT_CALLS: ReadonlySet<string> = new Set(["eval", "Function", "runInThisContext"]);

/**
 * Capability names that may not even be *read* through a property access.
 *
 * Reading one is how a call escapes the callee check: `const load =
 * process.getBuiltinModule` moves the loader to a local name, and the call
 * that follows is `load(...)`, which names nothing this sweep can follow.
 * Refusing the read closes that without scope analysis, and costs nothing —
 * no module under `src/` has any reason to name any of these.
 */
const CAPABILITY_NAMES: ReadonlySet<string> = new Set([
  ...MODULE_RETURNING_CALLS,
  ...CODE_FROM_TEXT_CALLS,
]);

/**
 * The same, for a bare identifier: `const e = eval`.
 *
 * A strict subset, and the exclusion is the point. `Function` is in
 * `CODE_FROM_TEXT_CALLS` but not here, because `Function` as a bare identifier
 * is an ordinary type annotation (`let handler: Function`) and refusing it
 * would be a false positive rather than a boundary. Reached through a property
 * access (`globalThis.Function`) it is still caught above, and `new Function`
 * is caught at the call.
 */
const BARE_CAPABILITY_NAMES: ReadonlySet<string> = new Set([
  "require",
  "getBuiltinModule",
  "createRequire",
  "eval",
  "runInThisContext",
  // `Function` is here, and the walk below is what makes that safe: the check
  // runs in **value position only**, so `let handler: Function` is ordinary and
  // `const compile = Function` is not. Exempting the name everywhere -- which
  // is what an earlier version did, on the true-but-too-wide ground that it is
  // an ordinary type annotation -- left `compile("return ...")()` as a plain
  // way through the code-from-text boundary.
  "Function",
]);

/**
 * Ambient globals that reach the network without naming a module.
 *
 * A different category from everything above, and the one the import allowlist
 * structurally cannot see: `fetch("https://...")` is HTTP, needs no import, and
 * is not a module reference at all, so a check over module references has
 * nothing to consult. Issue #1's first rule is that the loop cannot reach HTTP
 * or a browser; enforcing that only against `import` would have enforced the
 * letter of it and missed the single most likely way a loop would actually make
 * a request today.
 *
 * This one is an enumeration, unlike the allowlists elsewhere in this file, and
 * that is a real weakness rather than a preference -- there is no "everything
 * ambient" to invert. It is a closed, small, slow-moving set of standard names,
 * which is what makes enumerating them tolerable here and not for module
 * loaders. The file header says what that does and does not buy.
 *
 * Refused across all of `src/`, not only the loop: an access point that wants
 * `fetch` should say so, the way `src/store/sqlite.ts` says it wants
 * `node:sqlite`, and adding that grant is the decision D-0006 asks for.
 */
const FORBIDDEN_GLOBALS: ReadonlySet<string> = new Set([
  "fetch",
  "WebSocket",
  "EventSource",
  "XMLHttpRequest",
  "navigator",
]);

/**
 * Whether an expression builds a string out of parts.
 *
 * This is the line between an evasion and ordinary code. `"get" + "BuiltinModule"`
 * and a template with a hole in it are names written so as not to look like
 * names; `i + 1` is arithmetic. Deciding by *shape* -- concatenation involving
 * a string literal, or a template with substitutions -- keeps it a syntax
 * question and keeps `rows[i + 1]` out of it.
 */
function assemblesAString(expression: ts.Expression): boolean {
  if (ts.isTemplateExpression(expression)) {
    return true;
  }
  if (ts.isParenthesizedExpression(expression)) {
    return assemblesAString(expression.expression);
  }
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const stringy = (side: ts.Expression): boolean =>
      ts.isStringLiteral(side) ||
      ts.isNoSubstitutionTemplateLiteral(side) ||
      assemblesAString(side);
    return stringy(expression.left) || stringy(expression.right);
  }
  return false;
}

/** The last name segment of a callee expression, or null when there is none. */
function calleeName(expression: ts.Expression): string | null {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }
  if (ts.isElementAccessExpression(expression)) {
    const argument = expression.argumentExpression;
    if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
      return argument.text;
    }
    // Ordinary indexing -- `row[key]`, `items[i]`, `rows[i + 1]` -- is not a
    // member name at all, and reporting it would refuse every subscript in the
    // tree. A name *assembled* from text, though
    // (`process["get" + "BuiltinModule"]`), is a name deliberately written so
    // as not to look like one, and that is the only shape this refuses.
    return assemblesAString(argument) ? COMPUTED_MEMBER : null;
  }
  return null;
}

interface ImportRef {
  /** As written in the source. */
  readonly specifier: string;
  /** Repo-relative target, for a relative specifier; null for a bare one. */
  readonly resolved: string | null;
  /** The bindings taken, or one of the sentinels above. */
  readonly names: readonly string[];
}

/**
 * Every module `source` depends on, however it says so.
 *
 * The routes covered are the ones that reach a module without being written
 * `import x from "y"`: a re-export, an `import type`, an `import x = require()`,
 * an `import("...")` type node, a dynamic `import()`, a `require()` call, and a
 * triple-slash reference -- which TypeScript records on the SourceFile rather
 * than in the tree, so the walk below would never see it.
 */
/** What one module says it depends on, and which forbidden globals it names. */
interface ModuleScan {
  readonly refs: readonly ImportRef[];
  /** Names from `FORBIDDEN_GLOBALS`, in source order, with duplicates kept. */
  readonly globals: readonly string[];
}

/** Just the module references, for callers that only ask about those. */
function importsIn(source: string, from: string): readonly ImportRef[] {
  return scanModule(source, from).refs;
}

function scanModule(source: string, from: string): ModuleScan {
  const tree = parseSourceFile(parseNameOf(from), source);
  const found: ImportRef[] = [];
  const problemsFromGlobals: string[] = [];
  const directory = dirname(from);
  /**
   * Callee expressions already judged by the call branches.
   *
   * The walk reaches a callee twice -- once as part of its call, once on its
   * own as a child -- and the capability-read branches must not re-judge it.
   * Populated before `forEachChild` descends, so the child visit always sees
   * it.
   */
  const calleesJudged = new Set<ts.Node>();

  const record = (specifier: string, names: readonly string[]): void => {
    found.push({ specifier, resolved: resolveRelative(specifier, directory), names });
  };

  const clauseNames = (clause: ts.ImportClause | undefined): string[] => {
    if (clause === undefined) {
      return [SIDE_EFFECT];
    }
    const names: string[] = [];
    if (clause.name !== undefined) {
      names.push(DEFAULT_BINDING);
    }
    const bindings = clause.namedBindings;
    if (bindings !== undefined) {
      if (ts.isNamespaceImport(bindings)) {
        names.push(NAMESPACE);
      } else {
        for (const element of bindings.elements) {
          names.push(element.propertyName?.text ?? element.name.text);
        }
      }
    }
    return names.length === 0 ? [SIDE_EFFECT] : names;
  };

  const visit = (node: ts.Node, inTypePosition: boolean): void => {
    // A type annotation names something without reaching it: `let h: Function`
    // and `const h = Function` are the same identifier and opposite facts. The
    // flag is carried down rather than looked up, because the decoded tree has
    // no parent pointers to look up with.
    const inType = inTypePosition || ts.isTypeNode(node);

    // Checked before the chain below rather than inside it, and independently
    // of `calleesJudged`. A bare `fetch(...)` is a call whose callee is the
    // very identifier being looked for, so a check that ran only on callees
    // the call branch had *not* judged would skip the commonest spelling of
    // all. Duplicates are expected (`globalThis.fetch` matches twice) and the
    // reader dedupes.
    if (ts.isIdentifier(node) && FORBIDDEN_GLOBALS.has(node.text)) {
      problemsFromGlobals.push(node.text);
    } else if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      // Through `calleeName`, so both member syntaxes are one answer:
      // `globalThis.fetch` and `globalThis["fetch"]` are the same access, and
      // covering only the dotted one would be covering a spelling.
      const member = calleeName(node);
      if (member !== null && FORBIDDEN_GLOBALS.has(member)) {
        problemsFromGlobals.push(member);
      }
    }

    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      record(node.moduleSpecifier.text, clauseNames(node.importClause));
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      // `export * from` and `export * as ns from` take the whole module; a
      // named re-export takes exactly what it names.
      const clause = node.exportClause;
      const named =
        clause !== undefined && ts.isNamedExports(clause)
          ? clause.elements.map((element) => element.propertyName?.text ?? element.name.text)
          : [WHOLE_MODULE];
      // `export {} from "m"` binds nothing and still executes the module, the
      // same as `import {} from "m"`. Without this fallback an empty element
      // list produces an empty name list, the per-name loop below runs zero
      // times, and the import passes with no allowance consulted at all.
      record(node.moduleSpecifier.text, named.length === 0 ? [SIDE_EFFECT] : named);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      record(node.moduleReference.expression.text, [WHOLE_MODULE]);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      record(node.argument.literal.text, [WHOLE_MODULE]);
    } else if (ts.isCallExpression(node)) {
      const argument = node.arguments[0];
      const callee = calleeName(node.expression);
      // The callee is about to be judged here, so the capability-read branch
      // below must not judge it a second time when the walk reaches it as a
      // child. Without this, every direct `process.getBuiltinModule("x")` would
      // report twice: once naming the module, once as an unreadable specifier.
      calleesJudged.add(node.expression);
      if (callee === COMPUTED_MEMBER) {
        // The callee names something this scan cannot read. Whether it was a
        // capability is exactly the question, so the answer is no.
        record(COMPUTED_SPECIFIER, [WHOLE_MODULE]);
        node.forEachChild((child) => {
          visit(child, inType);
        });
        return;
      }
      const reachesAModule =
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (callee !== null && MODULE_RETURNING_CALLS.has(callee));
      if (reachesAModule) {
        // A no-substitution template is a literal with different quotes and is
        // read as one. Anything else -- a variable, a concatenation, a template
        // with a hole in it -- cannot be read at all and fails closed.
        const literal =
          argument !== undefined &&
          (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
            ? argument.text
            : COMPUTED_SPECIFIER;
        record(literal, [WHOLE_MODULE]);
      } else if (callee !== null && CODE_FROM_TEXT_CALLS.has(callee)) {
        // `eval` and friends do not name a module, which is exactly the
        // problem: they turn a string into code that can name anything.
        record(COMPUTED_SPECIFIER, [WHOLE_MODULE]);
      }
    } else if (ts.isNewExpression(node)) {
      const callee = calleeName(node.expression);
      calleesJudged.add(node.expression);
      // `COMPUTED_MEMBER` is handled here for the reason the call branch
      // handles it: `new g["Fun" + "ction"](...)` is the code-from-text route
      // with the constructor's name written so as not to be read. The callee is
      // marked judged either way, so if this branch stayed silent nothing else
      // would speak for it.
      if (callee === COMPUTED_MEMBER || (callee !== null && CODE_FROM_TEXT_CALLS.has(callee))) {
        record(COMPUTED_SPECIFIER, [WHOLE_MODULE]);
      }
    } else if (
      (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
      !calleesJudged.has(node)
    ) {
      // A capability that is READ rather than called. `const load =
      // process.getBuiltinModule` hands the whole loader to a local name, and
      // at the later call site the callee is only `load` -- which is why the
      // read, not the call, is where this one has to be caught.
      //
      // Both member syntaxes, because they are the same access:
      // `process["getBuiltinModule"]` is the dotted form with different
      // punctuation, and closing only the dotted one would be closing a
      // spelling rather than a route.
      const member = calleeName(node);
      if (member !== null && (member === COMPUTED_MEMBER || CAPABILITY_NAMES.has(member))) {
        // A member name assembled rather than written -- `obj["get" + "X"]` --
        // is refused too. `calleeName` reports it as COMPUTED_MEMBER only for a
        // name that is *built*; ordinary indexing (`row[key]`, `items[i]`) is
        // reported as null and passes, which is what keeps this from refusing
        // every array subscript in the tree.
        record(COMPUTED_SPECIFIER, [WHOLE_MODULE]);
      }
    } else if (ts.isIdentifier(node) && !calleesJudged.has(node)) {
      // The same thing one step plainer: `const e = eval`. Only the names that
      // cannot appear innocently are listed -- `Function` is deliberately not
      // among them, because it is a perfectly ordinary type annotation.
      if (!inType && BARE_CAPABILITY_NAMES.has(node.text)) {
        record(COMPUTED_SPECIFIER, [WHOLE_MODULE]);
      }
    }
    node.forEachChild((child) => {
      visit(child, inType);
    });
  };

  visit(tree, false);

  // Triple-slash directives are dependencies TypeScript records on the
  // SourceFile, not in the tree, so `forEachChild` never reaches them. A
  // `reference path=` naming a module in another layer crosses a boundary by
  // the one route a tree walk cannot see.
  //
  // Both directive kinds are spelled without their leading slashes in this
  // comment on purpose: written out in full, a comment about a directive is
  // read as one by tools that scan text rather than syntax.
  for (const directive of tree.typeReferenceDirectives) {
    record(directive.fileName, [WHOLE_MODULE]);
  }
  for (const reference of tree.referencedFiles) {
    record(reference.fileName, [WHOLE_MODULE]);
  }
  // The third of the three reference arrays, and the one that is easy to miss:
  // `reference lib="dom"` pulls the entire browser type surface into a module
  // without naming a package, which is precisely the hazard `src/refrain/`'s
  // empty allowance exists to refuse.
  for (const reference of tree.libReferenceDirectives) {
    record(reference.fileName, [WHOLE_MODULE]);
  }

  return { refs: found, globals: problemsFromGlobals };
}

/**
 * A relative specifier as a repo-relative path, or null when it is bare.
 *
 * `join`, not `resolve`. `resolve` makes the result absolute, and on Windows
 * "absolute" means a drive letter: `resolve("/", "src/refrain",
 * "../store/records.js")` is `C:\src\store\records.js` there and
 * `/src/store/records.js` here. Normalising slashes and stripping a leading
 * `/` cleans up the second and leaves the first as `C:/src/store/records.js`,
 * which starts with no layer prefix -- so **every relative import in the tree
 * would be reported as outside its allowance, and only on the Windows cell**.
 * `join` stays relative and gives the same string on both platforms.
 *
 * A specifier that climbs out of the tree lands in no layer and so matches no
 * allowance, which is the right answer. It does not necessarily keep a visible
 * `..`: `join` normalises, so from `src/refrain` the specifier
 * `../../elsewhere.js` is simply `elsewhere.js` -- at the repository root, in no
 * layer, refused. Only a climb past the root keeps one.
 */
function resolveRelative(specifier: string, directory: string): string | null {
  if (!specifier.startsWith(".")) {
    return null;
  }
  return slash(join(directory, specifier));
}

// --- the detector -----------------------------------------------------------

/** The layer a module is in, or null when it is in none. */
function layerOf(module: string): string | null {
  return (
    Object.keys(ALLOWED_INTERNAL_BY_LAYER).find((layer) => module.startsWith(`${layer}/`)) ?? null
  );
}

/** Whether `target` is inside one of `allowed`, as a directory prefix. */
const withinAny = (target: string, allowed: readonly string[]): boolean =>
  allowed.some((directory) => target.startsWith(`${directory}/`));

/**
 * Every way `module` breaks the boundary, as sentences.
 *
 * An empty array is the whole of "this module is fine". The messages are what a
 * reader sees when the gate goes red, so each one says which rule was broken
 * rather than only which line broke it.
 */
function violationsIn(module: string, source: string): string[] {
  const problems: string[] = [];
  const layer = layerOf(module);
  const unlayered = UNLAYERED_MODULES.includes(module);

  if (layer === null && !unlayered) {
    problems.push(
      `${module} is in no layer and is not named in UNLAYERED_MODULES. ` +
        "A new module under src/ has to be classified before it can be checked.",
    );
    // Still swept below, under the tightest allowance there is, so an
    // unclassified module cannot also smuggle an import through.
  }

  if (JS_EXTENSIONS.some((extension) => module.endsWith(extension))) {
    problems.push(
      `${module} is a JavaScript module under ${SRC_ROOT}/. This tree is TypeScript: ` +
        "`allowJs` is off, so nothing type-checks it, and a JSDoc `@type {import(...)}` " +
        "in it is a dependency no syntax walk can see. Write it as TypeScript.",
    );
  }

  const allowedInternal =
    layer !== null
      ? (ALLOWED_INTERNAL_BY_LAYER[layer] ?? [])
      : unlayered
        ? ALLOWED_FOR_UNLAYERED
        : [];
  const allowedExternal = ALLOWED_EXTERNALS_BY_MODULE[module] ?? {};

  const scan = scanModule(source, module);
  for (const name of new Set(scan.globals)) {
    problems.push(
      `${module} names the ambient global ${name}, which reaches the network without ` +
        "importing anything. No module under src/ is granted it; an access point that needs " +
        "it says so in FORBIDDEN_GLOBALS' exception, which is a decision (D-0006).",
    );
  }

  for (const ref of scan.refs) {
    if (ref.specifier === COMPUTED_SPECIFIER) {
      problems.push(
        `${module} loads a module through a specifier this scan cannot read. ` +
          "A boundary that can be stepped over by computing the name is not a boundary.",
      );
      continue;
    }

    if (ref.resolved !== null) {
      if (!withinAny(ref.resolved, allowedInternal)) {
        problems.push(
          `${module} imports ${ref.specifier} (-> ${ref.resolved}), which is outside its ` +
            `allowance [${allowedInternal.join(", ")}].`,
        );
        continue;
      }
      const suffix = RUNTIME_SUFFIXES.find(([runtime]) => ref.specifier.endsWith(runtime));
      if (suffix === undefined) {
        problems.push(
          `${module} imports ${ref.specifier} without a runtime extension. ` +
            "NodeNext resolution requires the emitted suffix on a relative specifier.",
        );
        continue;
      }
      const [runtime, sources] = suffix;
      const base = ref.resolved.slice(0, -runtime.length);
      if (!sources.some((extension) => existsSync(join(ROOT, base + extension)))) {
        problems.push(
          `${module} imports ${ref.specifier}, which resolves to ${ref.resolved} -- ` +
            "and no module of that name exists.",
        );
      }
      continue;
    }

    if (SQLITE_DRIVERS.has(ref.specifier) && module !== SQLITE_OWNER) {
      problems.push(
        `${module} imports the SQLite driver ${ref.specifier}. ` +
          `${SQLITE_OWNER} is the one module that owns durable state.`,
      );
      continue;
    }

    const granted = allowedExternal[ref.specifier];
    if (granted === undefined) {
      problems.push(
        `${module} imports the external module ${ref.specifier}, which it is not granted. ` +
          "Externals are allowed per module, by name, in ALLOWED_EXTERNALS_BY_MODULE.",
      );
      continue;
    }
    for (const name of ref.names) {
      if (!granted.includes(name)) {
        problems.push(
          `${module} takes ${name} from ${ref.specifier}; it is granted only ` +
            `[${granted.join(", ")}].`,
        );
      }
    }
  }

  return problems;
}

// --- what keeps the sweep honest --------------------------------------------

test("the walk still finds every module this file claims to guard", () => {
  expect(MODULES).toEqual(expect.arrayContaining([...EXPECTED_MODULES]));
  expect(MODULES.length).toBeGreaterThanOrEqual(EXPECTED_MODULES.length);
});

test("a resolved specifier is a repo-relative posix path on every platform", () => {
  // The regression this pins is invisible on Linux and fatal on Windows: an
  // absolute resolution there carries a drive letter, and a drive letter makes
  // every relative import in the tree fail its allowance check at once. The
  // Windows cell is required (D-0004's neighbours in ci.yml), so this case is
  // the local half of a guarantee only CI can finish.
  const resolved = resolveRelative("../store/records.js", "src/refrain");
  expect(resolved).toBe("src/store/records.js");
  expect(resolved).not.toMatch(/[\\:]/);
  // Bare specifiers are not paths and must stay null, or the external
  // allowlist below would never be consulted.
  expect(resolveRelative("node:sqlite", "src/store")).toBeNull();
  // Climbing out of the tree lands in no layer and so matches no allowance --
  // normalised to a bare name at the repository root, or to a real `..` beyond
  // it. Both are refused; neither is asserted to look like the other.
  expect(resolveRelative("../../elsewhere.js", "src/refrain")).toBe("elsewhere.js");
  expect(resolveRelative("../../../elsewhere.js", "src/refrain")).toBe("../elsewhere.js");
});

test("every module under src/ is in a layer or is named as unlayered", () => {
  const unclassified = MODULES.filter(
    (module) => layerOf(module) === null && !UNLAYERED_MODULES.includes(module),
  );
  expect(unclassified).toEqual([]);
});

test("exactly one module owns SQLite, and it is the durable store", () => {
  const owners = MODULES.filter((module) =>
    importsIn(sourceOf(module), module).some((ref) => SQLITE_DRIVERS.has(ref.specifier)),
  );
  // Equality, not `toContain`: a second owner is the failure this case exists
  // for, and it is also what makes the assertion non-vacuous -- the tree has a
  // real importer of `node:sqlite` today, so "no module imports a driver" would
  // fail here rather than pass quietly.
  expect(owners).toEqual([SQLITE_OWNER]);
});

// --- the sweep --------------------------------------------------------------

for (const module of MODULES) {
  test(`${module} stays inside its boundary`, () => {
    expect(violationsIn(module, sourceOf(module))).toEqual([]);
  });
}

// --- the detector's own cases (anti-vacuity) --------------------------------

/**
 * Hand-written modules, attributed to paths that mostly do not exist, each of
 * which the detector must judge correctly.
 *
 * `expected` is a substring of the message the detector has to produce, or
 * `null` for a control that must come back clean. The controls are half the
 * point: a detector that refuses everything would satisfy every violation case
 * here and report a tree in which nothing is allowed to import anything, and
 * these are what catch it.
 *
 * The paths are attributed rather than real (`src/refrain/probe.ts` has never
 * existed) so that adding a case costs no file on disk, and so that a case can
 * describe a module the tree must never contain.
 */
const PLANTED: ReadonlyArray<
  readonly [id: string, module: string, source: string, expected: string | null]
> = [
  [
    "loop-reaches-an-access-point",
    "src/refrain/probe.ts",
    'import { describeNextStep } from "../access/local.js";\nexport const x = describeNextStep;\n',
    "outside its allowance",
  ],
  [
    "loop-opens-an-http-server",
    "src/refrain/probe.ts",
    'import { createServer } from "node:http";\nexport const x = createServer;\n',
    "which it is not granted",
  ],
  [
    "loop-takes-a-browser",
    "src/refrain/probe.ts",
    'import { chromium } from "playwright";\nexport const x = chromium;\n',
    "which it is not granted",
  ],
  [
    "loop-takes-a-session-provider",
    "src/refrain/probe.ts",
    'import { query } from "@anthropic-ai/claude-agent-sdk";\nexport const x = query;\n',
    "which it is not granted",
  ],
  [
    "loop-reaches-continuo-internals",
    "src/refrain/probe.ts",
    'import { renewLease } from "@suisya-systems/continuo/dist/lap/lease.js";\nexport const x = renewLease;\n',
    "which it is not granted",
  ],
  [
    "loop-reaches-continuo-at-all",
    "src/refrain/probe.ts",
    'import { about } from "@suisya-systems/continuo";\nexport const x = about;\n',
    "which it is not granted",
  ],
  [
    "second-module-opens-sqlite",
    "src/store/journal.ts",
    'import { DatabaseSync } from "node:sqlite";\nexport const x = DatabaseSync;\n',
    "is the one module that owns durable state",
  ],
  [
    "an-access-point-opens-sqlite",
    "src/access/probe.ts",
    'import Database from "better-sqlite3";\nexport const x = Database;\n',
    "is the one module that owns durable state",
  ],
  [
    "the-owner-takes-a-binding-it-was-not-granted",
    "src/store/sqlite.ts",
    'import { DatabaseSync, StatementSync } from "node:sqlite";\nexport const x = [DatabaseSync, StatementSync];\n',
    "takes StatementSync from node:sqlite",
  ],
  [
    "a-namespace-import-of-an-allowed-module",
    "src/store/sqlite.ts",
    'import * as sqlite from "node:sqlite";\nexport const x = sqlite;\n',
    "takes <namespace import> from node:sqlite",
  ],
  [
    "a-default-import-of-an-allowed-module",
    "src/store/sqlite.ts",
    'import sqlite from "node:sqlite";\nexport const x = sqlite;\n',
    "takes <default import> from node:sqlite",
  ],
  [
    "a-side-effect-import-of-an-allowed-module",
    "src/store/sqlite.ts",
    'import "node:sqlite";\nexport const x = 1;\n',
    "takes <side-effect import> from node:sqlite",
  ],
  [
    "a-type-only-import-still-counts",
    "src/refrain/probe.ts",
    'import type { Server } from "node:http";\nexport type X = Server;\n',
    "which it is not granted",
  ],
  [
    "a-re-export-still-counts",
    "src/refrain/probe.ts",
    'export { createServer } from "node:http";\n',
    "which it is not granted",
  ],
  [
    "a-star-re-export-still-counts",
    "src/refrain/probe.ts",
    'export * from "../access/local.js";\n',
    "outside its allowance",
  ],
  [
    "an-import-inside-a-function-body-still-counts",
    "src/refrain/probe.ts",
    'export async function go(): Promise<unknown> {\n  return await import("node:http");\n}\n',
    "which it is not granted",
  ],
  [
    "a-require-still-counts",
    "src/refrain/probe.ts",
    'declare function require(id: string): unknown;\nexport const x = require("node:http");\n',
    "which it is not granted",
  ],
  [
    "an-import-equals-still-counts",
    "src/refrain/probe.ts",
    'import http = require("node:http");\nexport const x = http;\n',
    "which it is not granted",
  ],
  [
    "an-import-type-node-still-counts",
    "src/refrain/probe.ts",
    'export type X = import("node:http").Server;\n',
    "which it is not granted",
  ],
  [
    "a-triple-slash-reference-still-counts",
    "src/refrain/probe.ts",
    '/// <reference types="node:http" />\nexport const x = 1;\n',
    "which it is not granted",
  ],
  [
    // The route that needs no import at all: `process` is a global, so an
    // allowlist over imports has nothing to be consulted about. This is the
    // case `MODULE_RETURNING_CALLS` exists for.
    "process-getBuiltinModule-still-counts",
    "src/refrain/probe.ts",
    'export const server = process.getBuiltinModule("node:http");\n',
    "which it is not granted",
  ],
  [
    "process-getBuiltinModule-cannot-launder-sqlite",
    "src/access/probe.ts",
    'export const db = process.getBuiltinModule("node:sqlite");\n',
    "is the one module that owns durable state",
  ],
  [
    "a-require-through-a-member-expression-still-counts",
    "src/refrain/probe.ts",
    'export const x = globalThis.require("node:http");\n',
    "which it is not granted",
  ],
  [
    "createRequire-manufacturing-a-loader-fails-closed",
    "src/refrain/probe.ts",
    "declare const m: { createRequire(u: string): (id: string) => unknown };\nexport const load = m.createRequire(import.meta.url);\n",
    "cannot read",
  ],
  [
    "eval-fails-closed",
    "src/refrain/probe.ts",
    "export const x = eval(\"require('node:http')\");\n",
    "cannot read",
  ],
  [
    "the-Function-constructor-fails-closed",
    "src/refrain/probe.ts",
    "export const x = new Function(\"return process.getBuiltinModule('node:http')\");\n",
    "cannot read",
  ],
  [
    // The alias bypass: at the call site the callee is only `load`, so the
    // read is where this has to be caught.
    "an-aliased-loader-fails-closed",
    "src/refrain/probe.ts",
    'const load = process.getBuiltinModule;\nexport const x = load("node:http");\n',
    "cannot read",
  ],
  [
    "an-aliased-eval-fails-closed",
    "src/refrain/probe.ts",
    'const e = eval;\nexport const x = e("1 + 1");\n',
    "cannot read",
  ],
  [
    "an-aliased-createRequire-fails-closed",
    "src/refrain/probe.ts",
    "declare const m: { createRequire: (u: string) => (id: string) => unknown };\nconst make = m.createRequire;\nexport const load = make(import.meta.url);\n",
    "cannot read",
  ],
  [
    "a-lib-reference-still-counts",
    "src/refrain/probe.ts",
    '/// <reference lib="dom" />\nexport const x = 1;\n',
    "which it is not granted",
  ],
  [
    // Attributed to the SQLite owner on purpose: it is the one module with a
    // non-empty allowance, so the ungranted-external check does not fire first
    // and the empty binding list is what actually has to be caught. Pointed at
    // any other module this case would have passed for the wrong reason.
    "an-empty-named-re-export-still-counts",
    "src/store/sqlite.ts",
    'export {} from "node:sqlite";\n',
    "takes <side-effect import> from node:sqlite",
  ],
  [
    // A JavaScript module under src/ is refused for existing, and its imports
    // are still read: the file is parsed under a TypeScript grammar and
    // reported under its real path, so both problems are named at once.
    "a-javascript-module-under-src-is-refused",
    "src/refrain/helper.mjs",
    'import { createServer } from "node:http";\nexport const x = createServer;\n',
    "is a JavaScript module under src/",
  ],
  [
    "a-computed-specifier-fails-closed",
    "src/refrain/probe.ts",
    'const name = "node:" + "http";\nexport const x = await import(name);\n',
    "cannot read",
  ],
  ["an-unclassified-top-level-module", "src/rogue.ts", "export const x = 1;\n", "is in no layer"],
  [
    "a-relative-import-that-leaves-src",
    "src/index.ts",
    'export { support } from "../test/support.js";\n',
    "outside its allowance",
  ],
  [
    "a-relative-import-of-a-module-that-does-not-exist",
    "src/refrain/probe.ts",
    'export { gone } from "./gone.js";\n',
    "no module of that name exists",
  ],
  [
    "a-relative-import-without-its-runtime-suffix",
    "src/refrain/probe.ts",
    'export { nextStep } from "./loop";\n',
    "without a runtime extension",
  ],
  // --- controls: these must come back clean --------------------------------
  [
    "control-the-loop-may-persist",
    "src/refrain/probe.ts",
    'import type { IterationRecord } from "../store/records.js";\nexport type X = IterationRecord;\n',
    null,
  ],
  [
    "control-an-access-point-may-reach-the-loop",
    "src/access/probe.ts",
    'import { nextStep } from "../refrain/loop.js";\nexport const x = nextStep;\n',
    null,
  ],
  [
    "control-the-owner-may-open-sqlite",
    "src/store/sqlite.ts",
    'import type { DatabaseSync } from "node:sqlite";\nexport type X = DatabaseSync;\n',
    null,
  ],
  [
    "control-the-barrel-may-cross-layers",
    "src/index.ts",
    'export { nextStep } from "./refrain/loop.js";\nexport { iterationStore } from "./store/sqlite.js";\n',
    null,
  ],
  ["control-a-module-that-imports-nothing", "src/refrain/probe.ts", "export const x = 1;\n", null],
  [
    // Refused for its extension even when everything else about it is fine:
    // the rule is about the file existing, not about what it imports.
    "an-otherwise-clean-javascript-module-is-still-refused",
    "src/refrain/helper.mjs",
    'import type { IterationRecord } from "../store/records.js";\nexport const idOf = (r: IterationRecord): string => r.id;\n',
    "is a JavaScript module under src/",
  ],
  [
    // HTTP with no module at all. The whole import allowlist has nothing to say
    // about this line, which is why the globals check exists beside it.
    "the-loop-cannot-fetch",
    "src/refrain/probe.ts",
    'export const get = async (): Promise<Response> => fetch("https://example.com");\n',
    "names the ambient global fetch",
  ],
  [
    "the-loop-cannot-fetch-through-globalThis",
    "src/refrain/probe.ts",
    'export const get = async (): Promise<Response> => globalThis.fetch("https://example.com");\n',
    "names the ambient global fetch",
  ],
  [
    "the-loop-cannot-fetch-through-a-bracket",
    "src/refrain/probe.ts",
    'export const get = async (): Promise<Response> => globalThis["fetch"]("https://example.com");\n',
    "names the ambient global fetch",
  ],
  [
    "an-access-point-cannot-fetch-either-without-saying-so",
    "src/access/probe.ts",
    'export const socket = (): WebSocket => new WebSocket("wss://example.com");\n',
    "names the ambient global WebSocket",
  ],
  [
    // The evasion the computed-member sentinel exists for.
    "a-computed-capability-member-fails-closed",
    "src/refrain/probe.ts",
    'export const x = process["get" + "BuiltinModule"]("node:http");\n',
    "cannot read",
  ],
  [
    // The same capability read through brackets rather than a dot, and then
    // aliased -- so the call site shows only `load`. The read is where it has
    // to be caught, in both member syntaxes.
    "a-bracket-read-capability-fails-closed",
    "src/refrain/probe.ts",
    'const load = process["getBuiltinModule"];\nexport const x = load("node:http");\n',
    "cannot read",
  ],
  [
    "a-computed-member-read-then-aliased-fails-closed",
    "src/refrain/probe.ts",
    'const load = process["get" + "BuiltinModule"];\nexport const x = load("node:http");\n',
    "cannot read",
  ],
  [
    // Ordinary indexing must stay ordinary. An earlier version refused every
    // subscript whose argument was not an identifier or a number, which made
    // `rows[i + 1]` a boundary violation -- a false positive that contradicted
    // this file's own stated rule. The arithmetic shapes are here because that
    // is what regressed.
    "control-ordinary-indexing-is-not-a-capability-read",
    "src/refrain/probe.ts",
    "export const at = (rows: readonly (readonly string[])[], i: number, j: number, key: string): unknown =>\n  rows[i + 1]?.[j] ?? rows[i]?.[j - 1] ?? ({ a: 1 } as Record<string, unknown>)[key];\n",
    null,
  ],
  [
    "a-computed-constructor-name-fails-closed",
    "src/refrain/probe.ts",
    'declare const g: Record<string, new (body: string) => () => unknown>;\nexport const x = new g["Fun" + "ction"]("return 1")();\n',
    "cannot read",
  ],
  [
    // The value-position half of the `Function` rule.
    "an-aliased-Function-constructor-fails-closed",
    "src/refrain/probe.ts",
    'const compile = Function;\nexport const x = compile("return 1")();\n',
    "cannot read",
  ],
  [
    // And the type-position half: the same identifier, the opposite answer.
    // This pair is the whole reason the walk carries a type-position flag.
    "control-Function-as-a-type-annotation-is-not-a-capability",
    "src/refrain/probe.ts",
    "export function take(handler: Function): Function {\n  return handler;\n}\n",
    null,
  ],
];

test("the planted corpus exercises the detector in both directions", () => {
  const caught = PLANTED.filter(([, , , expected]) => expected !== null);
  const clean = PLANTED.filter(([, , , expected]) => expected === null);
  // A corpus that lost its controls, or lost its violations, would still pass
  // every case below by agreeing with itself.
  expect(caught.length).toBeGreaterThanOrEqual(44);
  expect(clean.length).toBeGreaterThanOrEqual(6);
  expect(new Set(PLANTED.map(([id]) => id)).size).toBe(PLANTED.length);
});

for (const [id, module, source, expected] of PLANTED) {
  test(`the detector judges ${id}`, () => {
    const problems = violationsIn(module, source);
    if (expected === null) {
      expect(problems).toEqual([]);
    } else {
      expect(problems.join("\n")).toContain(expected);
    }
  });
}
