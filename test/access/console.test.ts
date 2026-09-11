/**
 * The escaping that stands between continuo's bytes and a cp932 console.
 *
 * D-0004 says everything rondo prints is ASCII; D-0015 rule 7 says continuo's
 * words are relayed unedited in content and escaped in encoding. This file is
 * where the pair is checked, because the Windows cell cannot check it: vitest
 * captures stdout through a UTF-8 path, so a character that would crash a real
 * cp932 writer prints perfectly under the suite. What can be tested is that
 * nothing outside printable ASCII survives this function, and that is what is
 * tested.
 */
import { describe, expect, test } from "vitest";

import {
  asciiEscape,
  consoleSeams,
  legibleAsciiEscape,
  relayUpstream,
} from "../../src/access/console.js";

describe("asciiEscape", () => {
  test("printable ASCII is left exactly as it was", () => {
    const line = "error: no gate 'nope' (db /tmp/cp.sqlite3) [1-2]{a}\\";
    expect(asciiEscape(line)).toBe(line);
  });

  test("a non-ASCII path becomes escapes, and stays readable as a path", () => {
    expect(asciiEscape("/tmp/日本.sqlite3")).toBe("/tmp/\\u65e5\\u672c.sqlite3");
  });

  test("an astral character becomes two escapes, as a surrogate pair is two units", () => {
    expect(asciiEscape("ok \u{1F600}")).toBe("ok \\ud83d\\ude00");
  });

  test("control characters are escaped, including the ones a console tolerates", () => {
    // A relayed message is embedded in a line rondo composes, so a raw newline
    // in the middle of it would let upstream bytes forge a line of rondo's own.
    expect(asciiEscape("a\nb\tc")).toBe("a\\u000ab\\u0009c");
    expect(asciiEscape("\u007f")).toBe("\\u007f");
  });

  test("nothing outside printable ASCII survives, whatever went in", () => {
    const hostile = "\u0000\u001b[31m\u00e9\u3042\u{1F4A9}\uffff";
    expect(asciiEscape(hostile)).toMatch(/^[\x20-\x7E]*$/);
  });

  test("the empty string is not a special case", () => {
    expect(asciiEscape("")).toBe("");
  });
});

describe("legibleAsciiEscape", () => {
  test("a real newline passes through instead of becoming \\u000a", () => {
    expect(legibleAsciiEscape("first paragraph\n\nsecond paragraph")).toBe(
      "first paragraph\n\nsecond paragraph",
    );
  });

  test("an em-dash is spelled with an ASCII lookalike, not an escape", () => {
    expect(legibleAsciiEscape("could not run it — every attempt was refused")).toBe(
      "could not run it -- every attempt was refused",
    );
  });

  test("a control character other than newline is still escaped", () => {
    expect(legibleAsciiEscape("a\tbc")).toBe("a\\u0009b\\u001bc");
  });

  test("a printable with no ASCII lookalike still becomes an escape", () => {
    expect(legibleAsciiEscape("/tmp/日本.sqlite3")).toBe("/tmp/\\u65e5\\u672c.sqlite3");
  });

  // rondo#68: the reported failure was a worker's multi-paragraph rationale,
  // with an em-dash, reaching the gate screen as one line of newline escapes.
  // Both halves of the fix are checked on the same input: the paragraphs read
  // as paragraphs, and -- because vitest captures stdout through a UTF-8 path,
  // which is exactly what let the original bug ship green -- the check for
  // non-ASCII runs against the output's bytes, not a string comparison.
  test("a multi-paragraph rationale with an em-dash reads as paragraphs and is all ASCII bytes", () => {
    const rationale =
      "The fix is committed, but I could not run the verification — every " +
      "npm invocation was refused.\n\nWhat changed:\n\n- src/access/console.ts\n" +
      "- src/access/cli.ts";
    const escaped = legibleAsciiEscape(rationale);
    expect(escaped.split("\n")).toEqual([
      "The fix is committed, but I could not run the verification -- every " +
        "npm invocation was refused.",
      "",
      "What changed:",
      "",
      "- src/access/console.ts",
      "- src/access/cli.ts",
    ]);
    expect(Buffer.from(escaped, "utf8").every((byte) => byte <= 0x7e)).toBe(true);
  });
});

describe("relayUpstream", () => {
  test("continuo's words reach stderr escaped, under rondo's prefix", () => {
    const written: string[] = [];
    const original = consoleSeams.writeError;
    consoleSeams.writeError = (text: string): void => {
      written.push(text);
    };
    try {
      relayUpstream("continuo gate show", "no such database '/tmp/日本.sqlite3'");
    } finally {
      consoleSeams.writeError = original;
    }
    expect(written).toEqual([
      "continuo gate show: no such database '/tmp/\\u65e5\\u672c.sqlite3'\n",
    ]);
  });
});
