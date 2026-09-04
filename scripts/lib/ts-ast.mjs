/**
 * The repository's one way to get a TypeScript syntax tree.
 *
 * `test/architecture/import-boundaries.test.ts` reads modules and asks what
 * they import. It must ask a parser, not the module loader: an import that
 * happens inside a function body, or in type position, or through a re-export
 * is still an import for the purpose of a boundary, and importing the tree
 * would see none of them -- and would also run it.
 *
 * TypeScript 7 is a Go program. The `typescript` package's main export is
 * `{ version, versionMajorMinor }`; `ts.createSourceFile` is gone. The syntax
 * tree is still reachable, but only as data a running compiler sends back:
 * `typescript/unstable/sync` asks for it and `typescript/unstable/ast` decodes
 * it. Parsing is therefore no longer a pure function over a string, and this
 * module is where that difference is absorbed.
 *
 * The signature is the one the caller wants: `parseSourceFile(fileName, text)`
 * parses the text it is given, as if it lived at that path. Asking the compiler
 * for the file on disk reads better right up until the detector's own tests,
 * which parse hand-written snippets attributed to modules that have never
 * existed. Those snippets are how the sweep is kept from passing vacuously, so
 * a parser that could only see real files would have cost the sweep its own
 * test.
 *
 * The text is therefore mounted in a virtual filesystem holding one file and a
 * `tsconfig.json` that turns everything off: `noLib` and `noResolve`, because a
 * syntax tree is the whole product and resolving the rest would drag the real
 * tree in behind a snippet that is not part of it. Nothing here touches disk.
 *
 * The extension carried over from `fileName` is load-bearing. `.tsx` is a
 * different grammar, not TypeScript with extra tokens; parsing one as `.ts`
 * gives a tree that is wrong in both directions. The compiler takes script kind
 * from the extension, so naming the virtual file with the caller's own
 * extension is what asks for the right grammar.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { API } from "typescript/unstable/sync";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Where the virtual file is mounted.
 *
 * Under the repository root rather than at `/parse`, so the path has the shape
 * the host platform uses. A bare `/`-rooted path is not what an absolute path
 * looks like on the Windows cell this suite is required to pass on. Nothing is
 * created here: the directory exists only inside the virtual filesystem.
 */
const PARSE_DIR = resolve(ROOT, ".ts-ast-parse").split("\\").join("/");
const TSCONFIG = `${PARSE_DIR}/tsconfig.json`;

const TSCONFIG_TEXT = JSON.stringify({
  compilerOptions: {
    target: "ES2023",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    // A syntax tree is the whole product. Loading the default library or
    // following an import would cost real work for an answer nobody reads.
    noLib: true,
    noResolve: true,
  },
  include: ["**/*"],
});

/** The extensions a caller may ask for; anything else is a caller bug. */
const PARSEABLE = [".tsx", ".mts", ".cts", ".ts"];

/**
 * The compiler is spawned on first use and kept for the life of the process.
 *
 * Starting it costs a process launch, so doing it per file would turn a sweep
 * over a few dozen modules into a few dozen compiler launches.
 */
let session = null;

function sessionOf() {
  if (session === null) {
    const fs = createVirtualFileSystem({ [TSCONFIG]: TSCONFIG_TEXT });
    session = { api: new API({ cwd: PARSE_DIR, fs }), fs, mounted: null, snapshot: null };
  }
  return session;
}

/**
 * The syntax tree for `source`, parsed as though it were the file at
 * `fileName` (a repo-relative path, used for its extension and in errors).
 */
export function parseSourceFile(fileName, source) {
  const state = sessionOf();

  const extension = PARSEABLE.find((candidate) => fileName.endsWith(candidate));
  if (extension === undefined) {
    throw new Error(
      `ts-ast: ${fileName} has no TypeScript extension, so there is no grammar to parse it with`,
    );
  }

  // One file at a time. Leaving previous parses mounted would grow the program
  // by one file per call, and `include` would have the compiler re-read all of
  // them on every snapshot.
  const path = `${PARSE_DIR}/source${extension}`;
  const previousPath = state.mounted;
  if (previousPath !== null && previousPath !== path) {
    state.fs.removeFile(previousPath);
  }
  state.fs.writeFile(path, source);
  state.mounted = path;

  // Rewriting one file is a change; switching grammars is a different file
  // appearing and the old one going away, and the compiler has to be told which
  // it was. Reporting a new path as merely `changed` leaves the project holding
  // a root that no longer exists, and `getSourceFile` then returns nothing.
  const fileChanges =
    previousPath === path
      ? { changed: [path] }
      : previousPath === null
        ? { created: [path] }
        : { created: [path], deleted: [previousPath] };

  // The previous snapshot holds the compiler's program and every tree decoded
  // from it, so keeping them all would grow memory with the number of files
  // swept. It is released only once its successor exists: releasing it first
  // looks tidier and silently breaks invalidation, after which every parse
  // hands back the first file's tree and the sweep passes by examining one
  // module a few dozen times. The assertion below is what catches that, and is
  // the reason it is an assertion rather than a comment saying to be careful.
  const previous = state.snapshot;

  const snapshot = state.api.updateSnapshot({ openProjects: [TSCONFIG], fileChanges });
  state.snapshot = snapshot;

  if (previous !== null) {
    previous.dispose();
  }

  const project = snapshot.getProject(TSCONFIG);
  const tree = project?.program.getSourceFile(path);
  if (tree === undefined) {
    throw new Error(`ts-ast: the compiler did not return a tree for ${fileName}`);
  }
  if (tree.text !== source) {
    throw new Error(
      `ts-ast: the tree returned for ${fileName} is not the text that was asked about. ` +
        "A stale tree makes every sweep over it pass by finding nothing.",
    );
  }
  return tree;
}

/**
 * Shut the compiler down.
 *
 * It is a child process, so leaving it running keeps the host alive: a test run
 * that forgets this hangs after the last assertion has passed.
 */
export function disposeParser() {
  if (session !== null) {
    if (session.snapshot !== null) {
      session.snapshot.dispose();
    }
    session.api.close();
    session = null;
  }
}
