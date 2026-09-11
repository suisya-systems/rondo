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
 * The non-ASCII punctuation a worker's prose actually contains, spelled in
 * ASCII a person reads as the same mark rather than as an escape (rondo#68).
 *
 * Deliberately small. Whatever is not in this table still ends up ASCII --
 * {@link legibleAsciiEscape} falls back to the same `\uXXXX` escape
 * {@link asciiEscape} uses -- so growing this table is a readability
 * improvement, never a D-0004 requirement.
 */
const READABLE_SUBSTITUTES: Readonly<Record<string, string>> = {
  "–": "-", // en dash
  "—": "--", // em dash
  "‘": "'", // left single quote
  "’": "'", // right single quote
  "“": '"', // left double quote
  "”": '"', // right double quote
  "…": "...", // ellipsis
  "•": "-", // bullet
  " ": " ", // no-break space
};

/** Everything `asciiEscape` escapes, except a real newline. */
const PRINTABLE_ASCII_OR_NEWLINE = /[^\x20-\x7E\n]/g;

/**
 * `asciiEscape`, except a paragraph stays a paragraph (rondo#68).
 *
 * `asciiEscape` escapes `\n` along with everything else non-ASCII, which is
 * right for a value folded into one line of rondo's own composing (a joined
 * list, a prefix) but wrong for a value that *is* the whole of what is shown --
 * continuo's `rationale` on the gate screen, which D-0029 rule 2 asks a person
 * to actually read. There the embedded newlines are the worker's own paragraph
 * breaks, and escaping them turns several paragraphs into one unreadable line
 * of `
`.
 *
 * The two escaped classes stay separate rather than one shared "not ASCII"
 * bucket: a control character other than `\n` (a tab, an escape sequence) is
 * still spelled `\uXXXX`, because nothing about it is meant to be read; a
 * non-ASCII printable that a person would recognize is spelled with an ASCII
 * lookalike from {@link READABLE_SUBSTITUTES} where one exists, and with the
 * same `\uXXXX` escape otherwise. D-0004 -- no non-ASCII on a cp932 console --
 * holds either way, because the fallback is the same escape `asciiEscape` uses.
 */
export function legibleAsciiEscape(text: string): string {
  return text.replace(PRINTABLE_ASCII_OR_NEWLINE, (character) => {
    const substitute = READABLE_SUBSTITUTES[character];
    return substitute ?? `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
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
