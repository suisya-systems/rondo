/**
 * An ask's options as the store holds them (D-0190 rule 1): the one shape both
 * writers of an ask with options -- the model drafter and the worker-question
 * relay -- hand the store, and the one canonical JSON it is kept as.
 *
 * Its own module because `records.ts` is at its size cap; the type is
 * re-read through `ThreadMessageDraft.askOptions`.
 */

/** One option: what it is, and what choosing it gives up. */
export interface AskOption {
  readonly text: string;
  readonly givesUp: string;
}

/** The options an ask offers, in order, and the one it recommends. */
export interface AskOptions {
  /** At least one (rule 1.1). */
  readonly options: readonly AskOption[];
  /** A 0-based index into {@link options}. */
  readonly recommended: number;
  /** Why, in the writer's words, when it gave one. */
  readonly recommendation?: string;
}

const blank = (value: unknown): boolean => typeof value !== "string" || value.trim() === "";

/** Why `value` is not an ask's options, or null (rule 3.2). */
export function askOptionsFault(value: AskOptions): string | null {
  if (!Array.isArray(value.options) || value.options.length === 0) {
    return "an ask with options offers at least one";
  }
  const bad = value.options.findIndex((o) => blank(o?.text) || blank(o?.givesUp));
  if (bad !== -1) {
    return `option ${String(bad)} has no text or gives up nothing in words`;
  }
  if (
    !Number.isSafeInteger(value.recommended) ||
    value.recommended < 0 ||
    value.recommended >= value.options.length
  ) {
    return `the recommended option ${JSON.stringify(value.recommended)} is not one of its options`;
  }
  if (value.recommendation !== undefined && blank(value.recommendation)) {
    return "a recommendation, when given, is words";
  }
  return null;
}

/**
 * The canonical JSON of rule 1.1: keys in the order `options` (each `text`
 * then `gives_up`), `recommended`, then `recommendation` when given. Built in
 * that order rather than sorted, because the entry fixes the order.
 */
export function askOptionsJson(value: AskOptions): string {
  return JSON.stringify({
    options: value.options.map((o) => ({ text: o.text, gives_up: o.givesUp })),
    recommended: value.recommended,
    ...(value.recommendation === undefined ? {} : { recommendation: value.recommendation }),
  });
}

/**
 * The stored column read back, or null when it is not rule 1.1's canonical
 * form -- malformed, a key out of place or extra, or an index out of range.
 */
export function readAskOptions(text: string): AskOptions | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const row = parsed as Record<string, unknown>;
  if (!Array.isArray(row["options"])) {
    return null;
  }
  const value: AskOptions = {
    options: (row["options"] as unknown[]).map((one) => {
      const o = (typeof one === "object" && one !== null ? one : {}) as Record<string, unknown>;
      return { text: o["text"] as string, givesUp: o["gives_up"] as string };
    }),
    recommended: row["recommended"] as number,
    ...(row["recommendation"] === undefined
      ? {}
      : { recommendation: row["recommendation"] as string }),
  };
  return askOptionsFault(value) === null && askOptionsJson(value) === text ? value : null;
}
