/** @jsxImportSource react */
/**
 * What rondo would ask for next, on the empty centre, and the goal it is
 * ranked against (DECISIONS.md D-0097 points 2 and 4).
 *
 * **Under the request box, in ink** (points 4.2 and 4.3): one section headed
 * *What rondo would ask for next*, one block per repository, and in a block
 * one candidate in full with up to four runners-up folded under it. There is
 * no amber anywhere in it (`D-0082` rule 2), because nothing here waits on the
 * person: a proposal binds nothing until they send a request of their own.
 *
 * **Both presses work without script** (point 4.4): *put it in the box* is a
 * link whose address names the candidate, and the server draws the request
 * box holding the drafted request; *not now* is one plain form post.
 *
 * **The quiet states say what was read** (point 4.6): with no goal the block
 * leads to the goal, drafted; with nothing against the goal it is one muted
 * sentence and the line of what was read and when, which is what tells a quiet
 * triage from one that is not running.
 */
import type { Ranked, TriagePayload } from "../../advisory/triage.js";
import type { GoalClause, StoredFlowAsk, StoredGoal, StoredTriage } from "../../store/records.js";
import { ago } from "../inbox.js";
import { viewHref } from "../page-logic/routes.js";
import type { Chrome } from "../wording.js";
import { money, PRIMARY, SECONDARY } from "./vocabulary.js";

/** The presses' own sizing, as the gate's: stacked at phone width. */
const PRESS = "h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto";
const SMALL_PRESS = "h-8 w-full justify-center px-3 text-xs sm:w-auto";
/** The gate's own free-text field. */
const FIELD =
  "max-h-32 min-h-9 w-full resize-y rounded-md border border-border bg-background px-2.5 py-1.5 text-body leading-5 outline-none [field-sizing:content] placeholder:text-faint focus-visible:ring-2 focus-visible:ring-ring";

/** One candidate, ready to be drawn. */
export interface CandidateView {
  readonly proposalId: string;
  readonly key: string;
  readonly request: string;
  readonly clauseSaid: string;
  readonly clauseHref: string;
  readonly why: string;
  readonly from: { readonly said: string; readonly href: string };
  readonly openPoints: readonly { readonly point: string; readonly recommendation: string }[];
  readonly takeHref: string;
  /**
   * The thread of the request the flow already started from this candidate
   * (D-0128), or null: a started one is not offered for the box again.
   */
  readonly startedHref: string | null;
}

/**
 * Whether rondo works toward the goal on its own (D-0128): no goal scope, one
 * in force, or one paused -- and the way to the screen that approves, pauses
 * or resumes it.
 */
export interface GoalScopeLine {
  readonly state: "none" | "running" | "paused";
  readonly href: string;
  /** The flow's open ask over a candidate's open points (rondo#487), or null. */
  readonly ask: PointsAsk | null;
}

/** The open points the flow asks before it starts a candidate (rondo#487). */
export interface PointsAsk {
  readonly askId: string;
  readonly request: string;
  readonly points: readonly { readonly point: string; readonly recommendation: string }[];
}

/** One repository's block. */
export type TriageBlock =
  | { readonly kind: "noGoal"; readonly repository: string; readonly goalHref: string }
  | {
      readonly kind: "notRead";
      readonly repository: string;
      readonly goalHref: string;
      readonly goalScope: GoalScopeLine;
    }
  | {
      readonly kind: "unavailable";
      readonly repository: string;
      readonly goalHref: string;
      readonly goalScope: GoalScopeLine;
      readonly readSaid: string;
    }
  | {
      readonly kind: "nothing";
      readonly repository: string;
      readonly goalHref: string;
      readonly goalScope: GoalScopeLine;
      readonly readSaid: string;
    }
  | {
      readonly kind: "ranked";
      readonly repository: string;
      readonly goalHref: string;
      readonly goalScope: GoalScopeLine;
      readonly readSaid: string;
      readonly first: CandidateView;
      readonly rest: readonly CandidateView[];
    };

export interface TriageReads {
  readonly repositories: readonly string[];
  /** Every goal row, oldest first. */
  readonly goals: readonly StoredGoal[];
  readonly latest: readonly StoredTriage[];
  /** The payload of each latest row, read back; a row that will not read is absent. */
  readonly payloads: ReadonlyMap<string, TriagePayload>;
  /** The goal scope in force over each goal, by goal id (D-0128); absent where none is. */
  readonly goalScopes?: ReadonlyMap<string, "running" | "paused">;
  /** The request openers the flow wrote, each with the goal it names (D-0128). */
  readonly flowOpeners?: readonly { readonly messageId: string; readonly goalId: string }[];
  /** The flow's asks over open points (rondo#487), oldest first. */
  readonly flowAsks?: readonly StoredFlowAsk[];
}

/** The newest goal of each repository. */
export function currentGoals(goals: readonly StoredGoal[]): ReadonlyMap<string, StoredGoal> {
  return new Map(goals.map((goal) => [goal.repository, goal]));
}

/** The blocks, a repository with a candidate first (the card is the first thing under the box). */
export function triageBlocks(wording: Chrome, reads: TriageReads, nowMs: number): TriageBlock[] {
  const current = currentGoals(reads.goals);
  const byId = new Map(reads.goals.map((goal) => [goal.goalId, goal]));
  const latest = new Map(reads.latest.map((row) => [row.repository, row]));
  const blocks = reads.repositories.map((repository): TriageBlock => {
    const goalHref = viewHref({ kind: "goal", repository }, wording.lang);
    const goal = current.get(repository);
    if (goal === undefined) {
      return { kind: "noGoal", repository, goalHref };
    }
    const row = latest.get(repository);
    const payload = row === undefined ? undefined : reads.payloads.get(row.proposalId);
    const state = reads.goalScopes?.get(goal.goalId) ?? "none";
    // The ask the flow waits on: unanswered, of this goal, over a candidate
    // the ranking still holds -- the picker's own reading (`pickNext`).
    const asked =
      state === "none" || payload?.goalId !== goal.goalId
        ? undefined
        : reads.flowAsks?.find(
            (ask) =>
              ask.goalId === goal.goalId &&
              ask.answer === null &&
              payload.ranked.some((one) => one.key === ask.candidate),
          );
    const goalScope: GoalScopeLine = {
      state,
      href: viewHref({ kind: "goalScope", repository }, wording.lang),
      ask:
        asked === undefined
          ? null
          : {
              askId: asked.askId,
              request:
                payload?.ranked.find((one) => one.key === asked.candidate)?.request ??
                asked.candidate,
              points: asked.points,
            },
    };
    // A reading against a goal the person has since changed is not drawn: its
    // clause numbers name the old goal's clauses.
    if (row === undefined || payload === undefined || payload.goalId !== goal.goalId) {
      return { kind: "notRead", repository, goalHref, goalScope };
    }
    const readSaid = readLine(wording, payload, row, nowMs);
    if (payload.unavailable !== null) {
      // The reason stays on the row and in the host's log: it is rondo's
      // words about a model's answer, not a page sentence (D-0076).
      return { kind: "unavailable", repository, goalHref, goalScope, readSaid };
    }
    const clauses = byId.get(payload.goalId)?.clauses ?? [];
    // An opener the flow wrote names its candidate at the end of its id
    // (`flowMessageId`), under whichever approval it was started.
    const started = (key: string) =>
      reads.flowOpeners?.find(
        (opener) =>
          opener.goalId === goal.goalId &&
          opener.messageId.startsWith("flow-") &&
          opener.messageId.endsWith(`-${key}`),
      )?.messageId ?? null;
    const [first, ...rest] = payload.ranked.map((ranked) =>
      candidateView(wording, row.proposalId, repository, ranked, clauses, started(ranked.key)),
    );
    return first === undefined
      ? { kind: "nothing", repository, goalHref, goalScope, readSaid }
      : { kind: "ranked", repository, goalHref, goalScope, readSaid, first, rest };
  });
  return [
    ...blocks.filter((block) => block.kind === "ranked"),
    ...blocks.filter((block) => block.kind !== "ranked"),
  ];
}

function readLine(wording: Chrome, payload: TriagePayload, row: StoredTriage, nowMs: number) {
  const parts = [
    ...(payload.read.issues === 0 ? [] : [wording.triageReadIssues(payload.read.issues)]),
    ...(payload.read.stopped === 0 ? [] : [wording.triageReadStopped(payload.read.stopped)]),
  ];
  const cost = row.snapshot["cost_usd"];
  return wording.triageRead(
    parts,
    wording.age(ago(row.createdAtMs, nowMs)),
    typeof cost === "number" ? money(cost) : null,
  );
}

/** `3. You never open a terminal.`, the clause as the person wrote it. */
export function clauseSaid(wording: Chrome, clauses: readonly GoalClause[], clause: number) {
  return `${wording.goalNumber(clause)} ${clauses[clause - 1]?.said ?? ""}`.trim();
}

function candidateView(
  wording: Chrome,
  proposalId: string,
  repository: string,
  ranked: Ranked,
  clauses: readonly GoalClause[],
  started: string | null,
): CandidateView {
  return {
    proposalId,
    key: ranked.key,
    request: ranked.request,
    clauseSaid: clauseSaid(wording, clauses, ranked.clause),
    clauseHref: `${viewHref({ kind: "goal", repository }, wording.lang)}#clause-${String(ranked.clause)}`,
    why: ranked.why,
    from:
      ranked.source.form === "issue"
        ? {
            said: wording.triageIssue(ranked.source.repository, ranked.source.number),
            // ponytail: github.com only; the forge host when rondo triages a
            // repository on another one.
            href: `https://github.com/${ranked.source.repository}/issues/${String(ranked.source.number)}`,
          }
        : {
            said: wording.triageStopped,
            href: viewHref(
              { kind: "thread", messageId: ranked.source.requestMessageId, to: null },
              wording.lang,
            ),
          },
    openPoints: ranked.openPoints,
    takeHref: `${viewHref(
      { kind: "requests", take: { proposalId, candidate: ranked.key } },
      wording.lang,
    )}#composer`,
    startedHref:
      started === null
        ? null
        : viewHref({ kind: "thread", messageId: started, to: null }, wording.lang),
  };
}

/**
 * The request the box is filled with (point 4.4): the request line, the
 * repository, the clause it goes against, each open point written out as its
 * recommendation, and the issue it came from -- all text the person can edit
 * before they send it, and nothing sent until they do.
 */
export function takenRequest(
  wording: Chrome,
  payload: TriagePayload,
  clauses: readonly GoalClause[],
  key: string,
): string | null {
  const ranked = payload.ranked.find((one) => one.key === key);
  if (ranked === undefined) {
    return null;
  }
  return [
    ranked.request,
    "",
    wording.triageBoxRepository(payload.repository),
    wording.triageBoxAgainst(clauseSaid(wording, clauses, ranked.clause)),
    ...(ranked.openPoints.length === 0
      ? []
      : [
          "",
          wording.triageBoxPoints,
          ...ranked.openPoints.map((point) => `- ${point.point}: ${point.recommendation}`),
        ]),
    // The issue by its full name, so the issue reader reads it into the
    // thread (`D-0078`) and the drafter has what the proposal was made from.
    ...(ranked.source.form === "issue"
      ? ["", wording.triageBoxFrom(`${ranked.source.repository}#${String(ranked.source.number)}`)]
      : []),
  ].join("\n");
}

export interface TriageSectionProps {
  readonly wording: Chrome;
  readonly blocks: readonly TriageBlock[];
  /** The page's press token, or null where nothing can be written: no *not now* then. */
  readonly token: string | null;
}

export function TriageSection({ wording, blocks, token }: TriageSectionProps) {
  if (blocks.length === 0) {
    return null;
  }
  return (
    <section className="triage" aria-labelledby="triage-heading">
      <h2 id="triage-heading">{wording.triageHeading}</h2>
      {blocks.map((block) => (
        <div className="triage-repo" key={block.repository}>
          <span className="list-repo">{block.repository}</span>
          <Block wording={wording} block={block} token={token} />
          {block.kind === "noGoal" ? null : (
            <>
              {block.goalScope.ask === null ? null : (
                <PointsAskForm wording={wording} ask={block.goalScope.ask} token={token} />
              )}
              <GoalScopeRow wording={wording} line={block.goalScope} />
            </>
          )}
        </div>
      ))}
    </section>
  );
}

function Block({
  wording,
  block,
  token,
}: {
  readonly wording: Chrome;
  readonly block: TriageBlock;
  readonly token: string | null;
}) {
  switch (block.kind) {
    case "noGoal":
      return (
        <>
          <p className="triage-note">{wording.triageNoGoal}</p>
          <div className="triage-acts">
            <a className={`${PRIMARY} ${PRESS}`} href={block.goalHref}>
              {wording.triageWriteGoal}
            </a>
          </div>
        </>
      );
    case "notRead":
      return (
        <p className="triage-note">
          {wording.triageNotReadYet} <a href={block.goalHref}>{wording.triageEditGoal}</a>
        </p>
      );
    case "unavailable":
      return (
        <>
          <p className="triage-note">
            {wording.triageUnavailable} <a href={block.goalHref}>{wording.triageEditGoal}</a>
          </p>
          <p className="triage-read">{block.readSaid}</p>
        </>
      );
    case "nothing":
      return (
        <>
          <p className="triage-note">
            {wording.triageNothingAgainst} <a href={block.goalHref}>{wording.triageEditGoal}</a>
          </p>
          <p className="triage-read">{block.readSaid}</p>
        </>
      );
    case "ranked":
      return (
        <>
          <article className="triage-card">
            <p className="triage-ask" lang="">
              {block.first.request}
            </p>
            <dl className="triage-facts">
              <dt>{wording.triageGoesAgainst}</dt>
              <dd>
                <a className="triage-clause" href={block.first.clauseHref}>
                  {block.first.clauseSaid}
                </a>
              </dd>
              <dt>{wording.triageWhy}</dt>
              <dd>
                <p lang="">{block.first.why}</p>
                <p className="msg-bases">
                  <span className="msg-bases-label">{wording.triageFrom}</span>
                  <a className="basis" href={block.first.from.href}>
                    {block.first.from.said}
                  </a>
                </p>
              </dd>
              {block.first.openPoints.length === 0 ? null : (
                <>
                  <dt>{wording.triageOpenPoints}</dt>
                  <dd>
                    <ul className="triage-points">
                      {block.first.openPoints.map((point) => (
                        <li key={point.point} lang="">
                          <b>{point.point}</b>
                          <span>{point.recommendation}</span>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </>
              )}
            </dl>
            <p className="triage-read">{block.readSaid}</p>
            <Acts wording={wording} candidate={block.first} token={token} size={PRESS} />
          </article>
          {block.rest.length === 0 ? null : (
            <details className="triage-fold">
              <summary>
                <span>{wording.triageMoreBelow(block.rest.length)}</span>
                <span className="triage-fold-open">{wording.foldOpen}</span>
              </summary>
              <ol className="triage-runners">
                {block.rest.map((candidate) => (
                  <li key={candidate.key}>
                    <p className="triage-ask" lang="">
                      {candidate.request}
                    </p>
                    <a className="triage-clause" href={candidate.clauseHref}>
                      {candidate.clauseSaid}
                    </a>
                    <Acts
                      wording={wording}
                      candidate={candidate}
                      token={token}
                      size={SMALL_PRESS}
                    />
                  </li>
                ))}
              </ol>
            </details>
          )}
        </>
      );
  }
}

/**
 * The goal scope under a repository's block (D-0128): the way to let rondo
 * work toward the goal, or that it is doing so, or that it is paused. A link
 * to the screen where the approval is read and pressed, never a press itself:
 * approving is the person's P1, and it is made over what the screen shows.
 */
function GoalScopeRow({
  wording,
  line,
}: {
  readonly wording: Chrome;
  readonly line: GoalScopeLine;
}) {
  if (line.state === "none") {
    return (
      <div className="triage-goal-scope">
        <p>{wording.triageGoalScopeOffer}</p>
        <a className="triage-goal-link" href={line.href}>
          {wording.triageGoalScopeAction}
        </a>
      </div>
    );
  }
  return (
    <div className="triage-goal-scope" data-state={line.state}>
      <p>
        <span className="triage-goal-dot" aria-hidden="true" />
        {line.state === "running" ? wording.triageGoalScopeRunning : wording.triageGoalScopePaused}
      </p>
      <a className="triage-goal-link" href={line.href}>
        {line.state === "running" ? wording.triageGoalScopePause : wording.triageGoalScopeResume}
      </a>
    </div>
  );
}

/**
 * The flow's ask over a candidate's open points (rondo#487): each point with
 * a field that starts as rondo's suggestion, and one press that sends them.
 * Beside the goal scope, because it is the flow under that approval that asks.
 */
function PointsAskForm({
  wording,
  ask,
  token,
}: {
  readonly wording: Chrome;
  readonly ask: PointsAsk;
  readonly token: string | null;
}) {
  return (
    <form
      className="triage-flow-ask"
      method="post"
      action={`/flow-answer?lang=${encodeURIComponent(wording.lang)}`}
    >
      {token === null ? null : <input type="hidden" name="token" value={token} />}
      <input type="hidden" name="ask" value={ask.askId} />
      <p className="triage-flow-ask-lead">{wording.flowAskLead}</p>
      <p className="triage-ask" lang="">
        {ask.request}
      </p>
      <ol className="triage-flow-ask-points">
        {ask.points.map((point, at) => (
          <li key={String(at)}>
            <label>
              <span lang="">{point.point}</span>
              <textarea
                name={`answer-${String(at + 1)}`}
                rows={1}
                required
                className={FIELD}
                defaultValue={point.recommendation}
              />
            </label>
          </li>
        ))}
      </ol>
      <p className="triage-read">{wording.flowAskHint}</p>
      {token === null ? null : (
        <div className="triage-acts">
          <button type="submit" className={`${PRIMARY} ${PRESS}`}>
            {wording.flowAskAction}
          </button>
        </div>
      )}
    </form>
  );
}

/** The answers a flow ask's form posted, in the order of its points. */
export function postedAnswers(form: Readonly<Record<string, unknown>>): string[] {
  const answers: string[] = [];
  for (let at = 1; ; at++) {
    const key = `answer-${String(at)}`;
    const answer = form[key];
    if (typeof answer !== "string") {
      return answers;
    }
    answers.push(answer);
  }
}

function Acts({
  wording,
  candidate,
  token,
  size,
}: {
  readonly wording: Chrome;
  readonly candidate: CandidateView;
  readonly token: string | null;
  readonly size: string;
}) {
  // **Started is said, and nothing is offered for the box** (D-0128): the
  // flow already sent it, and a second request would be the same work twice.
  if (candidate.startedHref !== null) {
    return (
      <div className="triage-acts">
        <span className="triage-started">{wording.triageStarted}</span>
        <a className="triage-goal-link" href={candidate.startedHref}>
          {wording.triageStartedLink}
        </a>
      </div>
    );
  }
  return (
    <div className="triage-acts">
      <a className={`${PRIMARY} ${size}`} href={candidate.takeHref}>
        {wording.triagePutInBox}
      </a>
      {token === null ? null : (
        <form method="post" action={`/not-now?lang=${encodeURIComponent(wording.lang)}`}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="proposal" value={candidate.proposalId} />
          <input type="hidden" name="candidate" value={candidate.key} />
          <button type="submit" className={`${SECONDARY} ${size}`}>
            {wording.triageNotNow}
          </button>
        </form>
      )}
    </div>
  );
}

/** How many empty rows the goal form carries past the kept clauses. */
const EMPTY_ROWS = 2;

/** The largest goal the form carries: a goal is a few clauses, not a backlog. */
export const MAX_GOAL_CLAUSES = 12;

export interface GoalScreenProps {
  readonly wording: Chrome;
  readonly repository: string;
  readonly goal: StoredGoal | null;
  readonly nowMs: number;
  /** Null where nothing can be written: the form is drawn, and its press is not. */
  readonly token: string | null;
}

/**
 * The goal page (point 2): numbered clauses in the person's words, each saying
 * when it is unmet. With none kept it holds a draft (point 2.4 (a)): rondo's
 * own completion definition for rondo itself, and empty rows elsewhere.
 */
export function GoalScreen({ wording, repository, goal, nowMs, token }: GoalScreenProps) {
  const kept: readonly GoalClause[] =
    goal?.clauses ??
    (isRondo(repository)
      ? wording.goalDraftClauses.map((said, at) => ({
          said,
          unmetIf: wording.goalDraftUnmet[at] ?? "",
        }))
      : []);
  const rows = [
    ...kept,
    ...Array.from({ length: EMPTY_ROWS }, () => ({ said: "", unmetIf: "" })),
  ].slice(0, MAX_GOAL_CLAUSES);
  const keep =
    token === null ? null : (
      <button type="submit" className={`${PRIMARY} ${PRESS}`}>
        {wording.goalKeep}
      </button>
    );
  return (
    <div className="thread goal">
      <header className="thread-head">
        <h1>{wording.goalHeading(repository)}</h1>
        <p className="goal-lead">{wording.goalLead}</p>
      </header>
      <form
        method="post"
        action={`/goal?lang=${encodeURIComponent(wording.lang)}`}
        className="goal-form"
      >
        {token === null ? null : <input type="hidden" name="token" value={token} />}
        <input type="hidden" name="repository" value={repository} />
        {/* **The press is above the clauses** (rondo#408: what a person has to
            do sits at the top of the screen), with the line saying whether
            this goal is kept; repeated under the last row for whoever has just
            filled it in. */}
        <p className="goal-kept">
          {goal === null
            ? kept.length === 0
              ? wording.goalNotKept
              : wording.goalDraft
            : wording.goalKeptAt(wording.age(ago(goal.writtenAtMs, nowMs)))}
        </p>
        <div className="triage-acts">
          {keep}
          <a className="goal-back" href={viewHref({ kind: "requests" }, wording.lang)}>
            {wording.goalBack}
          </a>
        </div>
        <ol className="goal-clauses">
          {rows.map((row, at) => (
            <li className="goal-clause" id={`clause-${String(at + 1)}`} key={String(at)}>
              <span className="goal-n">{wording.goalNumber(at + 1)}</span>
              <label>
                <span>{wording.goalClauseLabel}</span>
                <textarea
                  name={`clause-${String(at + 1)}`}
                  rows={1}
                  placeholder={wording.goalClausePlaceholder}
                  className={FIELD}
                  defaultValue={row.said}
                />
              </label>
              <label>
                <span>{wording.goalUnmetLabel}</span>
                <textarea
                  name={`unmet-${String(at + 1)}`}
                  rows={1}
                  placeholder={wording.goalUnmetPlaceholder}
                  className={FIELD}
                  defaultValue={row.unmetIf}
                />
              </label>
            </li>
          ))}
        </ol>
        {keep === null ? null : <div className="triage-acts goal-acts-end">{keep}</div>}
      </form>
    </div>
  );
}

/**
 * Whether the draft is rondo's own completion definition: the repository is
 * rondo itself (point 2.4 (a), "for rondo itself, K1-K4 as the draft").
 *
 * ponytail: a name match; a drafted goal read from the repository's own
 * record when a second repository wants a draft that is not empty rows.
 */
function isRondo(repository: string): boolean {
  return repository.split("/")[1]?.toLowerCase() === "rondo";
}

/**
 * The clauses a goal form posted, in order: a row with both halves empty is
 * dropped, and a row with only one half is refused (a clause without its
 * *unmet if* cannot be ranked against, point 2.2 (a)).
 */
export function postedClauses(
  form: Readonly<Record<string, unknown>>,
): { readonly clauses: GoalClause[] } | { readonly refused: "incomplete" | "empty" } {
  const clauses: GoalClause[] = [];
  for (let at = 1; at <= MAX_GOAL_CLAUSES; at++) {
    const saidKey = `clause-${String(at)}`;
    const unmetKey = `unmet-${String(at)}`;
    const said = form[saidKey];
    const unmet = form[unmetKey];
    const saidText = typeof said === "string" ? said.trim() : "";
    const unmetText = typeof unmet === "string" ? unmet.trim() : "";
    if (saidText === "" && unmetText === "") {
      continue;
    }
    if (saidText === "" || unmetText === "") {
      return { refused: "incomplete" };
    }
    clauses.push({ said: saidText, unmetIf: unmetText });
  }
  return clauses.length === 0 ? { refused: "empty" } : { clauses };
}
