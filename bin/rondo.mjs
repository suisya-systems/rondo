#!/usr/bin/env node
// The launcher, and nothing else.
//
// Every line of logic is in `src/access/cli.ts`, which is type-checked by
// `npm run typecheck` and exercised by `test/access/cli.test.ts`. This file
// exists only to name an entry point `npm` can link, and it is `.mjs` outside
// `src/` because a file inside `src/` that executed itself on import could not
// be imported by a test (DECISIONS.md D-0024 rule 3).
//
// **The import is dynamic for a measured reason.** knip reads `package.json`'s
// `bin` as an entry point regardless of its own globs, and a static
// `import { main } from "../dist/access/cli.js"` makes it report an unresolved
// import into a gitignored directory and exit 1 -- and `npm run knip` is a
// gate. A computed specifier is one knip does not follow. The `try` is the
// other half of the same choice: an unbuilt tree becomes a sentence naming the
// command that fixes it, rather than a module-resolution stack.
const target = new URL("../dist/access/cli.js", import.meta.url).href;

let main;
try {
  ({ main } = await import(target));
} catch {
  process.stderr.write("rondo is not built. Run: npm run build\n");
  process.exit(1);
}

process.exitCode = await main(process.argv.slice(2), process.env);
