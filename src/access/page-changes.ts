/**
 * The bell the host rings when something a page may be showing has changed
 * (rondo#742, D-0054 as that issue leaves it).
 *
 * **Watched, not polled.** Everything the page draws is derived from the files
 * beside the store -- the iteration database, the advisory record, the thread
 * and the readings -- so what counts as a change is a write to one of them.
 * `node:fs`'s `watch` is the operating system telling this process that one
 * happened; while nothing is written, no callback runs, no view is drawn and
 * this module costs nothing. That is the half of rondo#742 the host owns: the
 * page's half is in `src/access/served.ts`, which decides whether a ring is
 * worth a word to any particular reader.
 *
 * **A directory, and not a list of files.** SQLite writes the database, its
 * journal and its temporaries under one directory, and a journal that is
 * created and deleted around every commit is not a path a watcher can hold
 * open. Watching the directory also catches a write by another process, which
 * is what the host's one-minute rescan exists for.
 *
 * **Coalesced.** One commit touches several files in a few milliseconds, and a
 * ring per file would draw the same view several times for one change. The
 * ring is therefore deferred by {@link SETTLE_MS}, which is far below what a
 * person reads as delay and far above what one commit takes.
 *
 * **Counted the moment a write is seen, and not when the bell rings.** The mark
 * this bell hands out is what a page says it was drawn at, so it has to move
 * ahead of the ring: a page served during the settle would otherwise carry a
 * mark the host still agreed with and be told nothing about the write that was
 * already in flight.
 */
import { watch } from "node:fs";
import { dirname } from "node:path";
import type { PageChanges } from "./served.js";

/** How long a burst of writes is given to finish before the bell rings. */
const SETTLE_MS = 50;

/** A bell, and the watch that rings it. */
export interface WatchedChanges extends PageChanges {
  /** Stops watching; the listeners are dropped with it. */
  readonly stop: () => void;
}

/**
 * The bell for the files beside the store at `storePath`.
 *
 * The path of the database, and not of a directory, because that is what the
 * host holds; the directory is derived here so no caller has to know that the
 * watch is of one.
 *
 * A directory that cannot be watched is not a failure a person can act on --
 * the page still redraws on a reload, and every press still answers -- so the
 * reason is handed to `say` and the bell is one that never rings.
 */
export function watchedChanges(storePath: string, say: (line: string) => void): WatchedChanges {
  const directory = dirname(storePath);
  const listeners = new Set<() => void>();
  /**
   * This process, named by the moment it started watching.
   *
   * **So that a restarted host never agrees with a page it did not draw.** The
   * count below starts at zero in every process, and a page drawn by the
   * previous one carries a mark of its own; a page that reconnects across a
   * restart is therefore behind by this half even where both counts read
   * `0`, which is exactly what it is -- the new process knows nothing of what
   * was written while it was down.
   */
  const born = Date.now().toString(36);
  /** How many writes this process has seen, which is all a mark says. */
  let seen = 0;
  let settling: ReturnType<typeof setTimeout> | null = null;
  const ring = (): void => {
    if (settling !== null) {
      return;
    }
    settling = setTimeout(() => {
      settling = null;
      for (const listener of listeners) {
        listener();
      }
    }, SETTLE_MS);
    settling.unref();
  };
  let watcher: ReturnType<typeof watch> | null = null;
  try {
    watcher = watch(directory, { persistent: false }, () => {
      seen += 1;
      ring();
    });
    watcher.on("error", (error: unknown) => {
      say(
        "rondo stopped watching for changes to tell the page about: " +
          (error instanceof Error ? error.message : String(error)),
      );
    });
  } catch (error: unknown) {
    say(
      "rondo cannot watch for changes to tell the page about, so a page redraws on a reload: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
  return {
    mark: () => `${born}.${String(seen)}`,
    listen: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    stop: () => {
      if (settling !== null) {
        clearTimeout(settling);
        settling = null;
      }
      listeners.clear();
      watcher?.close();
    },
  };
}
