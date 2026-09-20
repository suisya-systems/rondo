/**
 * The framing shared by rondo's three model documents (`./model-review/judgement.ts`,
 * `./model-draft/judgement.ts`, `./revise-draft/judgement.ts`): the fence mark none of the carried
 * material holds, and the `(none)` a section renders for a body handed to it
 * as the empty string (rondo#323).
 */

/**
 * A mark none of `carried`'s strings hold, then a `section` closure over it.
 *
 * `carried` must list every string the document embeds from outside rondo
 * (worker output, commit messages, thread bodies, and so on): choosing a mark
 * without checking one of those texts would let that text forge a fake
 * section boundary.
 */
export function sectionFramer(carried: readonly string[]): {
  readonly mark: string;
  readonly section: (name: string, body: string) => string;
} {
  let n = 0;
  while (carried.some((text) => text.includes(`@@RONDO-${String(n)}@@`))) {
    n += 1;
  }
  const mark = `@@RONDO-${String(n)}@@`;
  const section = (name: string, body: string): string =>
    `${mark} BEGIN ${name}\n${body === "" ? "(none)" : body}\n${mark} END ${name}`;
  return { mark, section };
}
