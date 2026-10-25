/**
 * The GitHub CLI for a computer without one (rondo#676, D-0204): which `gh` is
 * run, and the pinned fetch. Nothing here reaches the network: the download is
 * a stand-in that hands back an archive built in the test.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { expect, test } from "vitest";

import { ghAsset, ghExecutable, installGh, tarEntry } from "../../src/access/gh-install.js";

const posix = test.skipIf(process.platform === "win32");

/** One ustar entry: a 512-byte header, then the bytes padded to 512. */
function entry(name: string, bytes: Buffer, type = "0"): Buffer {
  const header = Buffer.alloc(512);
  header.write(name, 0, "utf8");
  header.write("0000755\0", 100);
  header.write(`${bytes.length.toString(8).padStart(11, "0")}\0`, 124);
  header.write(type, 156);
  header.write("ustar\0", 257);
  const padded = Buffer.alloc(Math.ceil(bytes.length / 512) * 512);
  bytes.copy(padded);
  return Buffer.concat([header, padded]);
}

const tar = (...entries: Buffer[]) => Buffer.concat([...entries, Buffer.alloc(1024)]);
const GH = Buffer.from("#!/bin/sh\necho gh\n");
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const scratch = () => mkdtempSync(join(tmpdir(), "rondo-gh-install-"));

test("the pinned archive is Linux's, amd64 or arm64, and there is none elsewhere", () => {
  const amd64 = ghAsset("linux", "x64");
  expect(amd64?.url).toMatch(
    /^https:\/\/github\.com\/cli\/cli\/releases\/download\/v[\d.]+\/gh_[\d.]+_linux_amd64\.tar\.gz$/,
  );
  expect(amd64?.sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(amd64?.entry).toMatch(/^gh_[\d.]+_linux_amd64\/bin\/gh$/);
  expect(ghAsset("linux", "arm64")?.entry).toMatch(/_linux_arm64\/bin\/gh$/);
  expect(ghAsset("linux", "ia32")).toBeNull();
  expect(ghAsset("darwin", "arm64")).toBeNull();
  expect(ghAsset("win32", "x64")).toBeNull();
});

test("only the named regular file comes out of the archive", () => {
  const archive = tar(
    entry("gh_1_linux_amd64/LICENSE", Buffer.from("MIT")),
    entry("gh_1_linux_amd64/bin/gh", Buffer.from("link"), "2"),
    entry("gh_1_linux_amd64/bin/gh", GH),
  );
  expect(tarEntry(archive, "gh_1_linux_amd64/bin/gh")).toEqual(GH);
  expect(tarEntry(archive, "bin/gh")).toBeNull();
  expect(tarEntry(tar(), "gh_1_linux_amd64/bin/gh")).toBeNull();
});

posix(
  "a matching archive is fetched once, and its gh is the one run where PATH has none",
  async () => {
    const home = scratch();
    const archive = gzipSync(tar(entry("gh_1/bin/gh", GH)));
    const asset = {
      url: "https://example.invalid/gh.tgz",
      sha256: sha256(archive),
      entry: "gh_1/bin/gh",
    };
    let fetches = 0;
    const fetchBytes = async () => {
      fetches += 1;
      return await Promise.resolve(archive);
    };
    expect(ghExecutable({ PATH: "" }, home)).toBeNull();
    expect(await installGh(fetchBytes, home, asset)).toBeNull();
    const copy = ghExecutable({ PATH: "" }, home);
    expect(copy).not.toBeNull();
    expect(copy?.startsWith(home)).toBe(true);
    // Nothing half-written is left beside it.
    expect(readdirSync(home).filter((name) => name.startsWith("."))).toEqual([]);
    expect(await installGh(fetchBytes, home, asset)).toBeNull();
    expect(fetches).toBe(1);

    // The person's own gh comes first.
    const own = scratch();
    writeFileSync(join(own, "gh"), GH, { mode: 0o755 });
    expect(ghExecutable({ PATH: own }, home)).toBe("gh");
  },
);

test("an archive that does not match its pin, or does not arrive, or holds no gh, writes nothing", async () => {
  const archive = gzipSync(tar(entry("gh_1/bin/gh", GH)));
  const asset = {
    url: "https://example.invalid/gh.tgz",
    sha256: sha256(archive),
    entry: "gh_1/bin/gh",
  };

  const tampered = scratch();
  const wrong = await installGh(
    async () => await Promise.resolve(Buffer.from("not it")),
    tampered,
    asset,
  );
  expect(wrong).toContain("not the pinned");
  expect(readdirSync(tampered)).toEqual([]);

  const offline = scratch();
  const lost = await installGh(
    async () => await Promise.reject(new Error("getaddrinfo ENOTFOUND github.com")),
    offline,
    asset,
  );
  expect(lost).toBe("getaddrinfo ENOTFOUND github.com");
  expect(readdirSync(offline)).toEqual([]);

  const empty = gzipSync(tar(entry("gh_1/LICENSE", Buffer.from("MIT"))));
  const without = join(scratch(), "home");
  const none = await installGh(async () => await Promise.resolve(empty), without, {
    ...asset,
    sha256: sha256(empty),
  });
  expect(none).toContain("holds no gh_1/bin/gh");
  expect(existsSync(without)).toBe(false);

  expect(await installGh(async () => await Promise.resolve(archive), scratch(), null)).toContain(
    "only on Linux",
  );
});

posix("a copy already whole when the rename is refused is taken as installed", async () => {
  const home = scratch();
  const archive = gzipSync(tar(entry("gh_1/bin/gh", GH)));
  const asset = {
    url: "https://example.invalid/gh.tgz",
    sha256: sha256(archive),
    entry: "gh_1/bin/gh",
  };
  // The other press lands its copy while this one is fetching.
  const racing = async () => {
    expect(await installGh(async () => await Promise.resolve(archive), home, asset)).toBeNull();
    return archive;
  };
  expect(await installGh(racing, home, asset)).toBeNull();
  expect(readdirSync(home).filter((name) => name.startsWith("."))).toEqual([]);
});
