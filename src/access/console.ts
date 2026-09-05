/**
 * The last thing that happens to a string before a person reads it.
 *
 * rondo relays continuo's own words -- an argparse refusal, a refusal
 * envelope's `message`, a stack from a caller defect -- without interpreting
 * them (D-0015 rule 7, carried forward by D-0017). It does not relay them
 * without *encoding* them: everything rondo writes to a terminal is ASCII
 * (D-0004), because the Windows cell's console may be cp932, where a character
 * the console cannot encode crashes the writer rather than printing badly, and
 * vitest captures stdout through a UTF-8 path so no test of rondo's own would
 * catch it.
 *
 * **Why the escaping lives here and nowhere else.** continuo's `--json`
 * encoder already escapes the envelope, so a decoded `message` is ASCII
 * whenever it arrived inside a document -- but the prose paths carry no such
 * guarantee, and a decoder that escaped as it parsed would hold a value that no
 * longer matches the bytes continuo sent. So the layer below keeps continuo's
 * characters exactly as they arrived, and this module escapes once, at the
 * boundary where the characters stop being data and become output. Escaping is
 * a property of the transport; parsing is a property of the meaning. rondo does
 * the first and never the second.
 *
 * `src/access/` is the right layer for it because that is where rondo's
 * surfaces are: the terminal today, the web UI and the localhost MCP surface
 * when they exist. A future surface that writes somewhere with no encoding
 * problem may write the unescaped text -- what it may not do is invent a second
 * escaper.
 */

/**
 * The alphabet a cp932 console is guaranteed to render: printable US-ASCII.
 *
 * **No `u` flag, and that is not an oversight.** Under `u` the class matches a
 * whole codepoint, so an astral character arrives at the replacement as one
 * two-unit string and an escape built from its first unit silently drops the
 * second -- a lossy relay, which is the one thing rule 7 forbids. Without the
 * flag the match is per UTF-16 code unit, each surrogate is escaped on its own,
 * and the pair round-trips.
 */
const PRINTABLE_ASCII = /[^\x20-\x7E]/g;

/**
 * `text` with every character outside printable ASCII replaced by `\uXXXX`.
 *
 * Per UTF-16 code unit rather than per codepoint, which is what makes an astral
 * character two escapes rather than one unprintable pair -- the same choice
 * continuo's own encoder makes, and for the same reason: the escape is a
 * faithful spelling of what was sent rather than a rendering of what it meant.
 *
 * Tabs and newlines are escaped too. They are inside continuo's own output
 * policy, but a relayed message is embedded in a line rondo composes, and a raw
 * newline in the middle of it would let upstream bytes forge what looks like a
 * line of rondo's own.
 */
export function asciiEscape(text: string): string {
  return text.replace(
    PRINTABLE_ASCII,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

/**
 * Where a relayed line goes.
 *
 * A record rather than a direct `process.stderr.write`, for the reason
 * continuo's own CLI modules give for the same shape: ESM bindings cannot be
 * rebound from outside the module that holds them, so a test that wants to read
 * what was written replaces the entry here. Two streams, because "printed
 * nothing" and "printed a refusal" must not look alike to a test that reads one
 * of them.
 */
export const consoleSeams = {
  write: (text: string): void => {
    process.stdout.write(text);
  },
  writeError: (text: string): void => {
    process.stderr.write(text);
  },
};

/**
 * Relay one line of continuo's own words to the operator, escaped.
 *
 * The words are continuo's; the line is rondo's. `prefix` is what rondo adds to
 * say where the words came from, and it is written by rondo and therefore
 * already ASCII -- it is escaped anyway, because a prefix that is composed from
 * an operator-supplied value later would otherwise become the one unescaped
 * path on this surface.
 */
export function relayUpstream(prefix: string, message: string): void {
  consoleSeams.writeError(`${asciiEscape(prefix)}: ${asciiEscape(message)}\n`);
}
