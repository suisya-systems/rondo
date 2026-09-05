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

import { asciiEscape, consoleSeams, relayUpstream } from "../../src/access/console.js";

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
