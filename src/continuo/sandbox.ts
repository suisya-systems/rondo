/**
 * Whether a worker spawned from this process could bring its own sandbox up.
 *
 * Laps 6 and 7 (N-16, N-21) ran their worker with `Sandbox is enabled but
 * failed to initialize: EPERM ... listen '/tmp/claude-1000/srt-mux-*.sock'`,
 * and every Bash call after the first ran unsandboxed. The cause, measured: the
 * lap was started from inside another Claude Code sandbox, whose seccomp filter
 * refuses `socket(AF_UNIX)`. A seccomp filter is inherited by every child and
 * cannot be removed by one, so the worker's sandbox runtime could not create
 * the socket it needs, in any directory. Pointing TMPDIR elsewhere does not
 * help; the refusal comes before any path is looked at.
 *
 * rondo is the parent of that worker, so it can ask the same question of
 * itself before a paid lap starts: create a Unix socket and see whether the
 * kernel refuses. The socket is in Linux's abstract namespace, so the probe
 * touches no filesystem and a read-only directory cannot be mistaken for the
 * filter.
 *
 * **What this does not claim.** It is Linux-only, and it detects this one cause.
 * A worker sandbox that fails for any other reason (a bubblewrap bind error,
 * say) still prints exactly like a clean lap, which is D-0050's standing
 * sentence and is not changed here.
 */

import { createServer } from "node:net";

/**
 * Try to listen on an abstract Unix socket. Resolves to the error code the
 * kernel answered with, or `null` when the socket came up (or the platform is
 * not Linux, where the abstract namespace does not exist and this cause was
 * never observed).
 */
export function probeUnixSocket(
  platform: NodeJS.Platform = process.platform,
): Promise<string | null> {
  if (platform !== "linux") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", (error: NodeJS.ErrnoException) => {
      resolve(error.code ?? "UNKNOWN");
    });
    server.listen(`\0rondo-sandbox-probe-${String(process.pid)}`, () => {
      server.close(() => {
        resolve(null);
      });
    });
  });
}

/**
 * The refusal a lap-starting command gives for a probe result, or `null` when
 * there is nothing to refuse. Only `EPERM` is this cause; any other failure is
 * not evidence of the filter and does not stop a lap.
 */
export function workerSandboxRefusal(code: string | null): string | null {
  if (code !== "EPERM") {
    return null;
  }
  return (
    "rondo will not start a lap here: this process may not create a Unix socket (EPERM), " +
    "and the worker it spawns would inherit that block, so the worker's own sandbox would " +
    "fail to initialise and every Bash call after the first would run unsandboxed (N-16, " +
    "N-21). The usual cause is running rondo inside another Claude Code sandbox, whose " +
    "seccomp filter refuses AF_UNIX for itself and every child. Run this command outside " +
    "that sandbox. This check is Linux-only and detects only this cause: a worker sandbox " +
    "that fails for another reason still prints like a clean lap (D-0050)."
  );
}
