/**
 * The GitHub CLI for a computer that has none (rondo#676, D-0204): which `gh`
 * rondo runs, and fetching a pinned release into rondo's own place on the
 * person's press, so a missing CLI is not a trip to a terminal.
 *
 * **The person's own `gh` comes first.** A `gh` on the host's `PATH` is run as
 * it always was; rondo's copy is run only where there is none (D-0204 rule 2).
 *
 * **What is trusted is this file, not the network.** The version and each
 * archive's sha256 are written here and change only by a reviewed change; an
 * archive that does not match is dropped before anything is written (rule 3).
 * The one file taken out of it is `bin/gh`, by its exact name, so no path in
 * the archive decides where anything lands.
 *
 * **Per user, as `gh`'s own sign-in is.** The copy lives under the user's data
 * directory, not beside a store: every store and the command line find the same
 * one, and its credential is `gh`'s, in `gh`'s own configuration, as before.
 *
 * **Linux only** (the owner's call on rondo#676): elsewhere there is no asset,
 * and the page says to ask whoever installed rondo here.
 */
import { createHash } from "node:crypto";
import {
  accessSync,
  constants,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { get } from "node:https";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { gunzipSync } from "node:zlib";

/** The pinned release (cli/cli). A bump changes the version and both digests together. */
const GH_VERSION = "2.103.2";
const GH_SHA256: Readonly<Record<string, string>> = {
  amd64: "62ccf747115ddc61237efffdde66a3c8f70ba249433dc64f70801089b59c59c8",
  arm64: "4c3e99a50bd8b181a3fe9d69b25dd978bac768148d88f01507c6b4d1ef61a443",
};
/** Node's name for an architecture, to the release's. */
const RELEASE_ARCH: Readonly<Record<string, string>> = { x64: "amd64", arm64: "arm64" };

/** How long the archive may take to arrive without a byte. */
const FETCH_IDLE_MS = 60_000;

/** One release archive: where it is, what it must hash to, and the entry that is `gh`. */
export interface GhAsset {
  readonly url: string;
  readonly sha256: string;
  readonly entry: string;
}

/** This computer's archive, or null where rondo fetches none. */
export function ghAsset(platform: string = process.platform, arch: string = process.arch) {
  const named = platform === "linux" ? RELEASE_ARCH[arch] : undefined;
  const sha256 = named === undefined ? undefined : GH_SHA256[named];
  if (named === undefined || sha256 === undefined) {
    return null;
  }
  const stem = `gh_${GH_VERSION}_linux_${named}`;
  return {
    url: `https://github.com/cli/cli/releases/download/v${GH_VERSION}/${stem}.tar.gz`,
    sha256,
    entry: `${stem}/bin/gh`,
  } satisfies GhAsset;
}

/** Where rondo keeps the copies it fetched: the user's data directory. */
export function ghHome(env: NodeJS.ProcessEnv = process.env): string {
  const data = env["XDG_DATA_HOME"];
  return join(
    data === undefined || data === "" ? join(homedir(), ".local", "share") : data,
    "rondo",
    "gh",
  );
}

function runnable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * The `gh` to run: `"gh"` when the `PATH` has one, rondo's copy when it is
 * there instead, null when there is neither. Asked at each run, so a copy
 * fetched a moment ago is used without a restart.
 */
export function ghExecutable(
  env: NodeJS.ProcessEnv = process.env,
  home: string = ghHome(env),
): string | null {
  const names = process.platform === "win32" ? ["gh.exe", "gh"] : ["gh"];
  for (const dir of (env["PATH"] ?? "").split(delimiter)) {
    if (dir !== "" && names.some((name) => runnable(join(dir, name)))) {
      return "gh";
    }
  }
  const copy = join(home, GH_VERSION, "gh");
  return runnable(copy) ? copy : null;
}

/** The bytes at `url`, over HTTPS only, following at most five redirects. */
function download(url: string, redirects = 5): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const request = get(url, { timeout: FETCH_IDLE_MS }, (response) => {
      const status = response.statusCode ?? 0;
      const to = response.headers.location;
      if (status >= 300 && status < 400 && to !== undefined) {
        response.resume();
        const next = new URL(to, url);
        if (next.protocol !== "https:" || redirects === 0) {
          reject(new Error(`${url} redirected to ${next.href}, which rondo does not follow`));
          return;
        }
        resolve(download(next.href, redirects - 1));
        return;
      }
      if (status !== 200) {
        response.resume();
        reject(new Error(`${url} answered ${String(status)}`));
        return;
      }
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new Error(`${url} sent nothing for a minute`)));
    request.on("error", reject);
  });
}

/**
 * The bytes of the regular file `name` in an uncompressed tar, or null. Only
 * ustar headers are read: a name in a pax record is not looked for, and the
 * release's `bin/gh` is short enough to need none.
 */
export function tarEntry(tar: Buffer, name: string): Buffer | null {
  const field = (at: number, length: number) =>
    tar
      .subarray(at, at + length)
      .toString("utf8")
      .replace(/\0.*$/s, "");
  for (let at = 0; at + 512 <= tar.length; ) {
    const short = field(at, 100);
    if (short === "") {
      return null;
    }
    const prefix = field(at + 345, 155);
    const size = Number.parseInt(field(at + 124, 12).trim() || "0", 8);
    const type = field(at + 156, 1);
    const data = at + 512;
    if ((prefix === "" ? short : `${prefix}/${short}`) === name && (type === "" || type === "0")) {
      return data + size <= tar.length ? tar.subarray(data, data + size) : null;
    }
    at = data + Math.ceil(size / 512) * 512;
  }
  return null;
}

/**
 * Fetches the pinned `gh` into `home` and answers null, or answers why it did
 * not: nothing is left behind but a copy that is whole. The copy is written in
 * a directory of its own and renamed into place, so a half-written one is never
 * the one run.
 */
export async function installGh(
  fetchBytes: (url: string) => Promise<Buffer> = download,
  home: string = ghHome(),
  asset: GhAsset | null = ghAsset(),
): Promise<string | null> {
  if (asset === null) {
    return `rondo fetches the GitHub CLI only on Linux (amd64, arm64), not ${process.platform} ${process.arch}`;
  }
  const into = join(home, GH_VERSION);
  if (runnable(join(into, "gh"))) {
    return null;
  }
  let archive: Buffer;
  try {
    archive = await fetchBytes(asset.url);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  const digest = createHash("sha256").update(archive).digest("hex");
  if (digest !== asset.sha256) {
    return `${asset.url} hashed to ${digest}, not the pinned ${asset.sha256}; nothing was written`;
  }
  let staging: string | null = null;
  try {
    const gh = tarEntry(gunzipSync(archive), asset.entry);
    if (gh === null || gh.length === 0) {
      return `${asset.url} holds no ${asset.entry}`;
    }
    mkdirSync(home, { recursive: true });
    staging = mkdtempSync(join(home, ".fetching-"));
    writeFileSync(join(staging, "gh"), gh, { mode: 0o755 });
    renameSync(staging, into);
    staging = null;
    return null;
  } catch (error) {
    // Two presses at once: the other one's rename landed first, and its copy is whole.
    return runnable(join(into, "gh"))
      ? null
      : error instanceof Error
        ? error.message
        : String(error);
  } finally {
    if (staging !== null) {
      rmSync(staging, { recursive: true, force: true });
    }
  }
}
