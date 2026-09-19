/**
 * What setup writes when it writes the start command (D-0080 section 2).
 *
 * The two files are shell and unit text rather than TypeScript, so they are
 * tested the way they are used: `scripts/start-command.sh` is run over a
 * temporary directory and what it left there is read back. Three properties
 * are worth a test and the rest is prose:
 *
 *  1. **The facts survive being written.** A path holding a space or a quote is
 *     legal on this machine, and the program is read back by whatever shell the
 *     person has. The fact block is sourced here in a real `sh` and the values
 *     are compared against what was passed in -- a quoting bug that pointed the
 *     host at somewhere else would otherwise be found by a person whose home
 *     directory has a space in it.
 *  2. **The sentences the person reads name nothing of rondo's** (D-0076 rule
 *     4.2): no path, no unit, no variable, no command.
 *  3. **The service is given the PATH setup resolved** (D-0080 rule 2.1 and the
 *     measurement under it): the service manager's own holds only system
 *     directories, and a page whose drafter cannot find its program is that
 *     rule not having been written.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

/**
 * Every case here runs `bash`, reads a POSIX mode bit or asks `sh` what the
 * program says, and the suite runs on a Windows cell as well (AGENTS.md). The
 * writer is a program for the machine rondo is resident on, which is that
 * machine's shell; on Windows these would be testing the runner.
 */
const posix = test.skipIf(process.platform === "win32");

const writer = join(dirname(fileURLToPath(import.meta.url)), "../../scripts/start-command.sh");

interface Written {
  /** The program the person types the name of. */
  readonly command: string;
  /** The unit it hands the host to. */
  readonly unit: string;
  /** Where the program was written. */
  readonly commandPath: string;
}

/** Run the writer with `args` on top of a complete, ordinary set of facts. */
function write(args: readonly string[]): Written {
  const root = mkdtempSync(join(tmpdir(), "rondo-start-"));
  const binDir = join(root, "bin");
  const unitDir = join(root, "units");
  execFileSync(
    "bash",
    [
      writer,
      "--node",
      "/opt/node/bin/node",
      "--checkout",
      "/home/p/rondo host",
      "--port",
      "7333",
      "--store",
      "/home/p/it's.sqlite3",
      "--approver",
      "happy_ryo",
      "--continuo-cli",
      "/home/p/continuo/dist/cli.js",
      "--path",
      "/home/p/.local/bin:/opt/node/bin:/usr/bin",
      "--bin-dir",
      binDir,
      "--unit-dir",
      unitDir,
      ...args,
    ],
    { stdio: "pipe" },
  );
  const commandPath = join(binDir, "rondo");
  return {
    command: readFileSync(commandPath, "utf8"),
    unit: readFileSync(join(unitDir, "rondo.service"), "utf8"),
    commandPath,
  };
}

/** The lines of the program between one pair of its markers. */
function between(command: string, marker: string): string {
  const lines = command.split("\n");
  const first = lines.findIndex((line) => line.startsWith(`# --- ${marker}`));
  const last = lines.findIndex((line) => line === `# --- end ${marker}`);
  expect(first).toBeGreaterThan(-1);
  expect(last).toBeGreaterThan(first);
  return lines.slice(first + 1, last).join("\n");
}

/**
 * What one of the program's two sentence functions prints, from a real `sh`.
 *
 * Read rather than pattern-matched, because what the person sees is the
 * output and not the source: a quote escaped into the program is a backslash
 * on the page and no backslash on the screen.
 */
function says(command: string, name: string): string {
  const definitions = `${between(command, "facts")}\n${between(command, "sentences")}`;
  return execFileSync("sh", ["-c", `${definitions}\n${name}`], { encoding: "utf8" });
}

posix("the program is a shell program the person can run, and it parses", () => {
  const { command, commandPath } = write([]);

  expect(command.startsWith("#!/bin/sh\n")).toBe(true);
  // 0o111: executable by somebody. The word is typed, not sourced.
  expect(statSync(commandPath).mode & 0o111).not.toBe(0);
  execFileSync("sh", ["-n", commandPath], { stdio: "pipe" });
});

posix("a path holding a space and a quote is read back as itself", () => {
  const { command } = write([
    "--path",
    "/home/p/o'brien bin:/usr/bin",
    "--node",
    "/home/p/node build/bin/node",
    "--opener",
    "/mnt/c/WINDOWS/explorer.exe",
  ]);

  const read = execFileSync(
    "sh",
    ["-c", `${between(command, "facts")}\nprintf '%s\\n' "$PATH" "$NODE" "$URL"`],
    { encoding: "utf8" },
  );

  expect(read).toBe(
    "/home/p/o'brien bin:/usr/bin\n/home/p/node build/bin/node\nhttp://127.0.0.1:7333/\n",
  );
});

posix("the sentences for a break name no path, no unit and no variable", () => {
  for (const language of ["ja", "en"]) {
    const broken = says(write(["--language", language]).command, "broken");

    // Everything rondo would say about itself here is a path, a unit name, a
    // variable or a command, and each of these characters is in one of them.
    expect(broken).not.toMatch(/[/\\$_]/);
    expect(broken).not.toMatch(/rondo\.service|systemctl|journal/);
    // Three sentences, in D-0076 rule 4.1's order: what cannot happen now,
    // what was spent, and what happens next.
    expect(broken.trimEnd().split("\n")).toHaveLength(3);
  }
});

posix("the person's language decides the sentences, and each set is whole", () => {
  const japanese = write(["--language", "ja-JP"]).command;
  expect(says(japanese, "broken")).toContain("開けません");
  expect(says(japanese, "opened")).toContain("開きました");
  // Composed in the language, not English wearing Japanese words (D-0079):
  // the only Latin letters left in it are rondo's own name.
  expect(says(japanese, "broken").replaceAll("rondo", "")).not.toMatch(/[A-Za-z]/);

  const english = write([]).command;
  expect(says(english, "broken")).toContain("cannot be opened on this computer");
  expect(says(english, "opened")).toContain("it is here");
  // The address, so the person does not hold it either (D-0080 rule 4.4).
  expect(says(english, "opened")).toContain("http://127.0.0.1:7333/");
});

posix("the unit carries every host fact, and the PATH setup resolved", () => {
  const { unit } = write(["--language", "ja", "--max-live", "3"]);

  // No forge repository on the line: one host serves several, each named by
  // the plan a request was drafted from (D-0081's annotation on rule 2.1).
  expect(unit).toContain(
    'ExecStart="/opt/node/bin/node" "/home/p/rondo host/bin/rondo.mjs" web --port 7333\n',
  );
  expect(unit).toContain('Environment="PATH=/home/p/.local/bin:/opt/node/bin:/usr/bin"');
  expect(unit).toContain('Environment="RONDO_STORE=/home/p/it\'s.sqlite3"');
  expect(unit).toContain('Environment="RONDO_APPROVER=happy_ryo"');
  expect(unit).toContain('Environment="RONDO_CONTINUO_CLI=/home/p/continuo/dist/cli.js"');
  expect(unit).toContain('Environment="RONDO_OPERATOR_LANGUAGE=ja"');
  expect(unit).toContain('Environment="RONDO_MAX_LIVE=3"');
  // A crash restarts the host, which is what makes the terminal free to close
  // (D-0080 rule 2.6).
  expect(unit).toContain("Restart=always");
});

posix("a fact that was not given is not written as an empty one", () => {
  const { unit } = write([]);

  // An empty `RONDO_OPERATOR_LANGUAGE` is not the same as an unset one, and a
  // bound of nothing is not a bound.
  expect(unit).not.toContain("--remote");
  expect(unit).not.toContain("RONDO_OPERATOR_LANGUAGE");
  expect(unit).not.toContain("RONDO_MAX_LIVE");
  expect(unit).not.toContain("RONDO_MAX_OCCUPYING");
});

posix("a port that is not a number is refused rather than written", () => {
  expect(() => write(["--port", "7333; rm -rf /"])).toThrow();
});

posix("what systemd would expand is written as itself", () => {
  // Both characters are legal in a directory name, and systemd rewrites a unit
  // line twice: `%` followed by a letter is a specifier in every setting, and
  // `$name` is a variable inside `ExecStart=` even between double quotes.
  // Measured on this machine (2026-09-20): `systemctl --user show` reads
  // `%%` back as one `%` in `Environment=` and `WorkingDirectory=`, and a unit
  // whose `ExecStart=` holds `$$HOME` runs a program that is handed the five
  // characters `$HOME`.
  const { unit } = write([
    "--checkout",
    "/home/p/100%$HOME rondo",
    "--path",
    "/home/p/100% bin:/usr/bin",
  ]);

  expect(unit).toContain("WorkingDirectory=/home/p/100%%$HOME rondo");
  expect(unit).toContain(
    'ExecStart="/opt/node/bin/node" "/home/p/100%%$$HOME rondo/bin/rondo.mjs"',
  );
  // A `$` in an environment value is already literal, so escaping it there
  // would write the escape into the value.
  expect(unit).toContain('Environment="PATH=/home/p/100%% bin:/usr/bin"');
});
