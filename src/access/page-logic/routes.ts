/**
 * The page's addresses, and which of them keep themselves current
 * (DECISIONS.md D-0054 rule 1, D-0056 rule 11).
 *
 * **Lifted out of `src/access/web.tsx` by the page's rebuild.** A view's name,
 * its address, and whether it redraws, are decisions about the surface rather
 * than about the markup. Every address the page composes for itself carries
 * the language tag, because rule 11 makes the URL the only home of the
 * language in force -- an address that dropped it is a page that silently
 * re-resolves -- and keeping the composition in one module is what lets the
 * compiler assert that instead of a comment.
 */

/**
 * Which of the one page's three views is being read.
 *
 * **The whole of this surface's state is in the address**, which is what makes
 * it survivable: the view is a query the server reads, so every redraw --
 * the `<noscript>` refresh, or htmx's own `GET` -- asks for the view
 * being read and is answered with it. A view outlives every redraw because the
 * server is the one holding it, and not because a client remembered anything;
 * D-0054 added a script and D-0059 a library, and neither adds client state or
 * a router.
 *
 * `summary` is the page a person arrives on: the three faces, with the
 * request rule 3 selects in the centre.
 *
 * **`reading` and `answer` are gone with D-0083.** `answer` was one row's
 * whole framing beside its button, because **the press is the presentation**
 * (D-0042) -- and that is unchanged; what changed is where the framing is
 * drawn. Rule 3 says there is no separate decision screen, so the framing and
 * the button are in the thread, and the page that carries the button is still
 * the page that carried every claim. `reading` held rondo's own compositions
 * (`inbox`, `between`, `explain`); rule 4 puts the inbox in the empty centre
 * and rule 5 puts the material on the right face, and `between` has no place
 * on the new page and is read from the terminal.
 *
 * Queries on `/` rather than paths, because the router refuses every path but
 * `/` and a second URL is a second one to get wrong. All of them are `GET`s
 * and all of them write nothing (D-0041).
 */
export type PageView =
  | { readonly kind: "summary" }
  /**
   * The request threads (D-0061 rule 4, #220 S1): `requests` lists them and
   * carries the composer for a new one; `thread` is one of them, named by any
   * message in it -- so the address a send redirects to is the message it
   * sent -- with `to` the message the reply box answers, or null for the
   * default ({@link replyTarget}). Both are live: a drafter can write into a
   * thread while a person reads it.
   */
  | {
      readonly kind: "requests";
      /**
       * A candidate of a triage proposal the person took (D-0097 point 4.4):
       * the box is drawn holding its drafted request. In the address, so the
       * press works without script and the language switch keeps it.
       */
      readonly take?: { readonly proposalId: string; readonly candidate: string };
    }
  /** The goal a repository's triage is ranked against (D-0097 point 2.1 (a)). */
  | { readonly kind: "goal"; readonly repository: string }
  | {
      readonly kind: "thread";
      readonly messageId: string;
      readonly to: string | null;
    }
  /**
   * One request's scope (rondo#233 S3, D-0066 rule 1): the form rondo drafts
   * from the plan and this store's laps, and -- once a press has recorded and
   * approved one -- that approval with the scoped start beside it.
   *
   * **The rounds and the decision are in the address for the same reason the
   * view is** (D-0056 rule 11): the language switch calls {@link viewHref} with
   * the view it is on, so a member kept anywhere else is a switch that silently
   * re-drafts the budgets or loses the approval just recorded.
   */
  | {
      readonly kind: "scope";
      readonly messageId: string;
      /** Review rounds the person asked for, or null for D-0064 rule 3.1.4's default. */
      readonly rounds: number | null;
      /** The approval this screen is showing, or null while there is none. */
      readonly decisionId: string | null;
      /** The held plan the person chose, by digest, or null for the screen's own pick. */
      readonly plan: string | null;
      /**
       * The third state (D-0074 rule 4.2): raising the budget of the approval
       * the lap waiting at this gate spends. Absent everywhere else, so every
       * other way to this screen is unchanged.
       */
      readonly raise?: { readonly decisionId: string; readonly iterationId: string };
    }
  /**
   * One ended lap's publish (rondo#233 S5, D-0060): the dry-run, and the press
   * that runs it.
   *
   * **It is a view of its own and not a section of `answer`**, because D-0059
   * section 5a's Q1 makes the screen a precondition of the press: `publish` is
   * pressed only from a screen that already shows its dry-run result, and a
   * press whose screen is a fold inside another screen is a press whose
   * precondition nobody can point at. The gate's screen is about answering a
   * gate; this one is about what would leave this machine.
   */
  | { readonly kind: "publish"; readonly iterationId: string }
  /**
   * One running lap's log (rondo#248 item 3): the commands it has run and what
   * they returned, read through the same port the row's *log found* came from.
   * Named by the row and never by a path, so the address carries nothing the
   * server would open.
   */
  /**
   * The files one finished line keeps, and the press that releases them
   * (D-0073 rule 4.3, rondo#288). A view of its own for `publish`'s reason: the
   * press is made from a screen that says which work holds them, what it was
   * doing and why rondo has not released them itself, so that screen is the
   * press's precondition and not a fold inside another.
   */
  | { readonly kind: "release"; readonly iterationId: string };

/**
 * The most review rounds this screen will draft for.
 *
 * Not a policy: a bound, so a typed `?rounds=1000000` cannot ask
 * `computeScopeBudgets` for a lap count and a cost nobody would approve and a
 * screen could not draw. Past it the view falls to the default, which is what
 * every other unreadable query on this page does.
 */
export const MAX_REVIEW_ROUNDS = 20;

/** The round counts the screen offers as links. */
export const REVIEW_ROUND_CHOICES: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

/**
 * Whether this view keeps itself current, which is a property of the view and
 * never of the page (D-0054 rule 1).
 *
 * `summary` and `reading` are *what is running* and want to be current, so
 * they carry htmx's poll -- and, with scripting off, the meta refresh inside
 * `<noscript>`. **`answer` updates by nothing at all: no poll, no refresh.** (It
 * does load the key script, which moves focus and follows links and changes
 * nothing on the screen by itself.)
 * It is one row's framing beside its button, read by a person in order to
 * press, and rondo#160's complaint was exactly this screen being re-laid-out
 * under the reader while they read it. It costs no staleness risk, which is why
 * it is deletion rather than machinery: D-0042 re-composes the framing at press
 * time and refuses a press naming a row that is not there, so a page a minute
 * old cannot answer a gate that moved.
 *
 * **`scope` updates by nothing at all either**, for `answer`'s reason and one
 * more. It is a form a person is filling in: with script on a poll would swap
 * `#ledger` out from under half-typed budgets, and with script off the meta
 * refresh would throw the whole draft away every five seconds -- which is the
 * argument the composer views already make for themselves (`onThreads &&
 * forms`). It costs no staleness risk: nothing on it is a live row, and what
 * the press writes is re-tested at press time.
 *
 * **`publish` updates by nothing at all either** (rondo#233 S5), for `answer`'s
 * reason and a stricter one: it *is* the dry-run a person is reading in order
 * to press, so a redraw under them would be the screen quietly becoming about a
 * different act. It costs no staleness risk either, and for the same reason
 * turned into a mechanism: the press carries the digest of what was drawn and
 * the port re-reads the whole dry-run, so a screen that has gone stale publishes
 * nothing and says so.
 *
 * **`log` holds still too** (rondo#248 item 3). It is read to find something
 * in -- the one output a person opened -- and a poll swapping `#ledger` would
 * close every fold they opened and move the list under them. A reload reads it
 * again, and the page's foot already says the view holds still.
 */
export function isLive(view: PageView): boolean {
  // **`goal` holds still** for `scope`'s reason: it is a form being filled in.
  return (
    view.kind !== "scope" &&
    view.kind !== "publish" &&
    view.kind !== "release" &&
    view.kind !== "goal"
  );
}

/**
 * The address of one view, for the redraw and for the links between them.
 *
 * **Every address this page composes for itself carries the tag** (D-0056 rule
 * 11). The tag is not optional and there is no overload without it: rule 4
 * makes the URL the only home of the language in force, so an address that
 * dropped it is a page that silently re-resolves -- and with scripting on it
 * would *appear* to stick, because the poll asks for the address it was
 * rendered with. A switch the fold drops is D-0055's failure reproduced by the entry
 * that fixed it, so the parameter is required and the compiler is what asserts
 * rule 11 rather than a comment.
 *
 * `lang` is written last on the two views that already carry a query, so the
 * address reads as *the view, in this language* rather than the other way
 * round.
 */
export function viewHref(view: PageView, tag: string): string {
  const lang = `lang=${encodeURIComponent(tag)}`;
  switch (view.kind) {
    case "publish":
      return `/?publish=${encodeURIComponent(view.iterationId)}&${lang}`;
    case "release":
      return `/?release=${encodeURIComponent(view.iterationId)}&${lang}`;
    case "requests":
      return view.take === undefined
        ? `/?requests=open&${lang}`
        : `/?requests=open&take=${encodeURIComponent(view.take.proposalId)}` +
            `&candidate=${encodeURIComponent(view.take.candidate)}&${lang}`;
    case "goal":
      return `/?goal=${encodeURIComponent(view.repository)}&${lang}`;
    case "thread":
      return `/?thread=${encodeURIComponent(view.messageId)}${
        view.to === null ? "" : `&to=${encodeURIComponent(view.to)}`
      }&${lang}`;
    case "scope":
      return (
        `/?scope=${encodeURIComponent(view.messageId)}` +
        (view.decisionId === null ? "" : `&decision=${encodeURIComponent(view.decisionId)}`) +
        (view.rounds === null ? "" : `&rounds=${String(view.rounds)}`) +
        (view.plan === null ? "" : `&plan=${encodeURIComponent(view.plan)}`) +
        (view.raise === undefined
          ? ""
          : `&raise=${encodeURIComponent(view.raise.decisionId)}&gate=${encodeURIComponent(view.raise.iterationId)}`) +
        `&${lang}`
      );
    default:
      return `/?${lang}`;
  }
}
