/**
 * One page, on localhost, that reads.
 *
 * **It is a second view of three commands and not a second system.** `inbox`,
 * `between` and `explain` already compose everything here out of rondo's own
 * rows; this module gathers what they gather and renders it as HTML, so a
 * person can read on a screen what they would otherwise read in a terminal.
 * Nothing new is stored, nothing new is named, and no state exists that a
 * command cannot also show.
 *
 * **What it is not is those three commands in the order they were written**
 * (rondo#145). An operator arrives with three questions -- *what needs me, what
 * is running, what just finished* -- and the page answers them in that order,
 * out of the rows `inbox`, `between` and `explain` already read. rondo's own
 * vocabulary -- bounds, adjacency, the last-look mark, a field-by-field reading
 * of every row -- is one `<details>` below, complete and unchanged. Folded is
 * not hidden: every claim that was on this page is still on it under the same
 * basis, and the lead cites the row each of its lines is read off so that a
 * number is checkable twice over rather than asserted once. The three terminal
 * commands are untouched; this is the web face and only the web face.
 *
 * **Reading is a type; the one write is a runtime fact** (D-0041). The two
 * ports are still `Pick`ed down to the methods that read ({@link WebPorts}), so
 * everything the renderer holds is unable to write and the compiler says so.
 * That is not a preference about web surfaces: the two rows a terminal `inbox`
 * writes -- the count of what was presented (D-0032 rule 10) and the last-look
 * mark (rule 9) -- are claims about a person having been shown something, and a
 * page redrawing every few seconds while nobody is at the desk would make both
 * of them lies. A redraw did not read the inbox, so it still writes neither.
 *
 * **A click, though, is a person answering a gate.** So the page carries one
 * button, and the whole of what it may write arrives as a *second* port holding
 * a single capability (`AnswerPort`, in `src/access/web-app.ts`) rather than a store: the page's
 * writing vocabulary is one sentence long, and widening it is a visible change
 * to a type. No type can tell an unattended redraw from a human's click -- they
 * differ in whether somebody was at the keyboard, which is not in the data -- so
 * two runtime facts do it instead. **D-0054 amended one of them, and narrowed
 * what the pair guarantees.** Two of the three views now carry a library that
 * `GET`s its own address every five seconds and swaps the ledger in place
 * ({@link isLive}; htmx since D-0059 R2), so *"nothing here can emit a `POST`"*
 * has stopped being true of this page -- and D-0059 section 5 moved the rest of
 * it into the write port, which mints a press only from a person's navigation. What still holds -- and what D-0042's invariant now rests
 * on alone -- is the server half of the same fact: a `GET` reaches this
 * renderer, this renderer holds only the read ports, and the compiler says so,
 * so an unattended redraw writes nothing because the code path it reaches
 * cannot write. The forged cross-site `POST` is left to the other two facts,
 * which are untouched: a token minted when this process began listening,
 * rendered into the form and checked on the way in, so a `POST` that carries
 * it came from a page this process served; and `frame-ancestors 'none'` on the
 * way out. That is two facts where there were three, and D-0054 rule 4 accepts
 * it knowingly rather than discovering it.
 *
 * **So the press, and not the render, is this surface's presentation**
 * (D-0042). The framing beside the button is written to the ledger before the
 * gate is answered, by the same `explain` writer the terminal uses -- and if it
 * cannot be written, nothing is answered and the person is told, which is
 * D-0022 rule 18's order applied to a page that had already drawn what it was
 * about to act on. It happens inside the answer port rather than here for
 * D-0041 rule 4's reason: one function is still the whole of what this surface
 * may write.
 *
 * **Two things the terminal got wrong are not repeated here** (rondo#90,
 * rondo#91). A request is shown with its paragraphs intact, because the page
 * has no cp932 console to protect and `white-space: pre-wrap` costs nothing;
 * and a basis is printed once above the claims that rest on it rather than
 * under each of them, because the terminal's repetition is what made a long
 * citation unreadable.
 *
 * **localhost, and no authentication instead of weak authentication.** The
 * server binds `127.0.0.1` and nothing else, so what protects the page is that
 * it is not reachable rather than a password rondo would have to store,
 * rotate and get right.
 *
 * **This module renders and negotiates; it does not serve** (D-0059 rule 2).
 * The server -- routing, the `Host` check, the security headers, the press and
 * the one write route -- is `src/access/web-app.ts`, on Hono. What stays here
 * is rondo's content and D-0056's five steps (D-0059 rule 4), both of which are
 * functions of values and not of a socket, which is also why none of this
 * module's tests needs one.
 *
 * **The markup is server JSX and the look is Tailwind** (D-0059 rules 1 and 2).
 * The strings are the ones this module always drew -- every claim, basis, lap
 * line, fence line and catalogue sentence -- in the elements section 1's bar
 * names: one row per lap with a leading glyph, a state pill and a muted
 * right-aligned column; groups labelled with their counts; a short filled call
 * to action; the press in a bar that stays in reach. `page/app.css` holds both
 * palettes, and the build compiles the classes named in this file.
 */

import { raw } from "hono/html";
import { readTriagePayload } from "../advisory/triage.js";
import { revisionInstruction } from "../refrain/revision.js";
import {
  type IterationRecord,
  isDeterministicReadingDrafter,
  isQuestion,
  isTerminal,
  latestReading,
  WORKER_QUESTION_AUTHOR,
} from "../store/records.js";
import { NOT_RETRIED } from "./checks-host.js";
import { flowStopAskedFacts } from "./flow-stop.js";
import { ago } from "./inbox.js";
import { scopedAuthority } from "./merge.js";
import { approveView, type GateStory } from "./page/approve.js";
import { answerBands, askLink, gatesOf } from "./page/ask.js";
import { type AnswerRevise, budgetRaises, composerView } from "./page/composer.js";
import type { MintIterationId, MintMessageId, MintScopeId, WebPorts } from "./page/contract.js";
import { pageDocument } from "./page/document.js";
import { EmptyCentre, type SinceView } from "./page/empty.js";
import { closingShown, materialView } from "./page/gate-material.js";
import { budgetClosing, reviseBox, shownBeforePress } from "./page/gate-shown.js";
import { GovernanceLine } from "./page/governance.js";
import { RequestsFace } from "./page/list.js";
import { facesMarkup, heldMarkup } from "./page/render.js";
import { ResultLine } from "./page/result.js";
import { Raw } from "./page/shell.js";
import { ThreadFace, type ThreadItem } from "./page/thread.js";
import { threadActs } from "./page/thread-acts.js";
import { PartsSide, partStepOf, ScopeSide, ThreadSide } from "./page/thread-side.js";
import {
  flowStopAsked,
  flowStopView,
  forgeView,
  heldMessage,
  lapReport,
  lapReportView,
  noDraft,
  noDraftView,
  redraftNote,
  scopeStop,
  scopeStopView,
} from "./page/thread-stops.js";
import {
  currentGoals,
  GoalScreen,
  type TriageReads,
  TriageSection,
  takenRequest,
  triageBlocks,
} from "./page/triage.js";
import { basisWord, note, publishedReport, whoWrote } from "./page/vocabulary.js";
import { folds } from "./page-logic/event-fold.js";
import { governanceOf } from "./page-logic/governance.js";
import { repositoryOf } from "./page-logic/list.js";
import { approvalOf, type PageModel, pageModel, triageModel } from "./page-logic/model.js";
import { holdsLap, partCounts, takeInFrom } from "./page-logic/parts.js";
import { askOverLine, resultOf } from "./page-logic/result.js";
import { isLive, type PageView, viewHref } from "./page-logic/routes.js";
import { selectRequest, walkPosition } from "./page-logic/selection.js";
import { sinceLooked } from "./page-logic/since.js";
import { lapStory } from "./page-logic/story.js";
import { lapEvents, resultLap, revisedIn } from "./page-logic/thread-events.js";
import { firstLine, lineOf, replyTarget } from "./page-logic/threads.js";
import { stepsBeforeLap, stepsOf } from "./page-logic/week.js";
import { answeredQuestion, readWorkerQuestion } from "./question.js";
import { approvalTip } from "./scope.js";
import { goalScopeView } from "./screens/goal-scope.js";
import { mergeView } from "./screens/merge.js";
import { publishView } from "./screens/publish.js";
import { releaseView } from "./screens/release.js";
import { scopeView } from "./screens/scope.js";
import { weekSide } from "./screens/week.js";
import { type Chrome, EN } from "./wording.js";

// Moved to `page/approve.tsx` (rondo#341); the server still reads it from the renderer.
export { APPROVE_BODY } from "./page/approve.js";

/**
 * **The thread view's read model** (rondo#341): which request the centre is
 * showing, the lap at its gate, and the one stream of messages and events the
 * thread draws. Read for every view, because the right face beside a screen
 * of its own still speaks for the request selected here.
 */
async function threadModel(
  ports: WebPorts,
  view: PageView,
  wording: Chrome,
  token: string | null,
  model: PageModel,
  triage: TriageReads,
) {
  const {
    nowMs,
    reads,
    forms,
    inbox,
    waiting,
    threads,
    requestsList,
    lapUnder,
    lapsUnder,
    placeOf,
    partsOfRequest,
  } = model;
  const latestTriage = triage.latest;
  const triagePayloads = triage.payloads;
  /*
   * **Which request the centre is showing** (D-0083 rule 3). There is no
   * separate decision screen: the address names a request or it does not, and
   * where it does not the oldest thing waiting is selected, because the
   * person came to answer.
   */
  /**
   * **An address naming a message nobody wrote is said, not answered with
   * another request.** Rule 3's fallback is for an address that names none;
   * one that names a message this store does not hold is a person who
   * followed a stale link, and showing them somebody else's thread would be
   * rondo answering a question it was not asked.
   */
  const namedThread = view.kind === "thread" ? threads.rootOf(view.messageId) : null;
  const noSuchThread = view.kind === "thread" && namedThread === null;
  const selection = selectRequest(namedThread, requestsList);
  /**
   * **`requests` is the way into a new one**, so its centre is rule 4's --
   * the question and the box -- whatever is waiting. Selecting a thread there
   * would answer a person who came to write with somebody else's question.
   */
  const selectedRoot =
    noSuchThread || view.kind === "requests" || view.kind === "goal" || selection.kind !== "request"
      ? null
      : selection.messageId;
  const selectedLap = selectedRoot === null ? null : lapUnder(selectedRoot);
  /*
   * The lap whose gate the centre draws a box for, which is what the framing
   * below is composed for -- one row, and only the one being answered.
   */
  // **Whichever lap of this request is at a gate**, which need not be the one
  // the list speaks with: `saysMore` orders by what a row should say, and a
  // gate is answered wherever it stands (Codex).
  // **The gate the address names, where several parts wait at one** (D-0129):
  // a part's step links its own gate, so one part's open question does not
  // stand between the person and another part's answer.
  const answeringLap = (() => {
    if (selectedRoot === null) {
      return null;
    }
    const gated = lapsUnder(selectedRoot).filter((lap) => lap.question === "waiting");
    const named = view.kind === "thread" ? view.gate : undefined;
    return (gated.find((lap) => lap.record.id === named) ?? gated[0])?.record.id ?? null;
  })();
  // The lap's line as the ledger holds it, which is how the conflict fix reads
  // a question over a line (D-0105); the verdict walks the lineage.
  const shown = await shownBeforePress(
    ports,
    wording,
    waiting,
    token,
    answeringLap,
    async (record) => {
      const id =
        record.requestMessageId === null
          ? null
          : askOverLine(
              threads,
              record.requestMessageId,
              (await ports.store.laneLedger()).find((line) => line.lapIds.includes(record.id))
                ?.lapIds ?? [record.id],
            );
      return id === null ? null : { id, stopped: threads.stopped.has(id) };
    },
    (record) => {
      const askId = `question-${record.id}`;
      const ask = threads.byId.get(askId);
      if (ask === undefined || !ask.asks) {
        return null;
      }
      const parts = partsOfRequest(record.requestMessageId);
      const mine = parts.find((part) => holdsLap(part, record.id));
      return {
        answered: answeredQuestion(threads.messages, record.id),
        waitedSaid: threads.waiting.has(askId) ? wording.age(ago(ask.atMs, nowMs)) : null,
        part: mine === undefined ? null : mine.index + 1,
        releases:
          mine === undefined
            ? []
            : parts.filter((part) => part.wait?.after === mine.index).map((part) => part.index + 1),
      };
    },
  );
  /*
   * **The lap everything about this confirmation is read from** (rule 6, and
   * Codex round 3): the one at the gate where there is one, and the one the
   * list speaks with otherwise. The line under the title, the right face's
   * agreement, its steps and the box in the thread all describe it -- two of
   * them reading different laps would put one lap's allowance and reach beside
   * another lap's question, which is exactly the misreading rule 6 exists
   * against.
   */
  // The lap the box is for, which is the one at the gate rather than the one
  // the list speaks with.
  const gatedLap =
    answeringLap === null || selectedRoot === null
      ? null
      : (lapsUnder(selectedRoot).find((lap) => lap.record.id === answeringLap)?.record ?? null);
  const governedLap = gatedLap ?? selectedLap?.record ?? null;

  /*
   * **The centre face** (D-0083 rule 5): the selected request's thread, or
   * rule 4's empty centre when nothing waits and nothing was named.
   *
   * The messages and the event lines are one stream in the order they
   * happened; the box to answer in and the box to add to the request are
   * composed by the parts that own them and placed here.
   */
  const selectedMessages =
    selectedRoot === null
      ? []
      : threads.messages
          .filter((message) => threads.rootOf(message.messageId) === selectedRoot)
          .toSorted((left, right) => left.atMs - right.atMs);
  /*
   * **Every lap of the request, each with its own readings** (Codex): the
   * thread is the request, so a retry arriving must not take the lap it
   * superseded out of the record. Read here, once, for the one request the
   * centre is drawing.
   */
  // Oldest first, so *try 1* is the first attempt and the walk down the
  // thread and the count agree.
  const selectedLaps =
    selectedRoot === null
      ? []
      : lapsUnder(selectedRoot).toSorted(
          (left, right) => left.record.createdAtMs - right.record.createdAtMs,
        );
  const readingsByLap = new Map(
    await Promise.all(
      selectedLaps.map(
        async (lap) => [lap.record.id, await ports.store.readingsFor(lap.record.id)] as const,
      ),
    ),
  );
  // **What became of the selected request's work** (rondo#376), read once for
  // the strip under the title, the line's clock and the steps: a request whose
  // pull request was merged or closed has ended (rondo#413).
  const selectedResult = (() => {
    const lap = resultLap(selectedLaps.map((each) => each.record));
    return lap === null ? null : resultOf(threads.byId, lap.id);
  })();
  // **A request run as parts has ended only once every part has landed**
  // (rondo#506): one merged part's pull request is not the request's, so
  // until then the line keeps its clock and counts every part instead.
  const selectedParts = selectedRoot === null ? [] : partsOfRequest(selectedRoot);
  const partsUnlanded = selectedParts.some((part) => part.standing !== "merged");
  const endedAtMs = partsUnlanded
    ? null
    : (selectedResult?.merged?.atMs ?? selectedResult?.closedAtMs ?? null);
  // **A later attempt of a request whose pull request conflicts is its fix**
  // (rondo#417, D-0105): the result stays the approved lap's until the fix is
  // approved, so the band says the fix is under way rather than asking the
  // person to resolve it by hand over the top of it. Only an attempt that
  // descends from that lap is its fix (rondo#500): another part of the same
  // request is later too, and reading it as the fix claimed work nobody did.
  // A red check's repair is one too (rondo#551).
  const fixRunning = (() => {
    const lap = resultLap(selectedLaps.map((each) => each.record));
    const kind = selectedResult?.checks.kind;
    if (lap === null || (kind !== "conflict" && kind !== "red")) {
      return false;
    }
    const line = new Set([lap.id]);
    return [...selectedLaps]
      .sort((a, b) => a.record.createdAtMs - b.record.createdAtMs)
      .some((each) => {
        const successor = each.record.supersedesIterationId;
        if (successor === null || !line.has(successor)) {
          return false;
        }
        line.add(each.record.id);
        return !isTerminal(each.record.status);
      });
  })();
  const governed =
    governedLap === null || selectedRoot === null
      ? null
      : governanceOf(
          governedLap,
          placeOf(governedLap),
          threads.byId.get(selectedRoot)?.atMs ?? nowMs,
          await approvalOf(ports, governedLap),
          // A proposal is done when rondo recorded one: the published report
          // it writes into the request's thread (rondo#245).
          publishedReport(threads, governedLap.id) !== null,
          /*
           * **Rule 6's fifth item, read for this request and for no window**
           * (rondo#350). The week's face counts withholdings over seven days
           * and cannot be narrowed; this is the request's own rows, so the
           * line may carry the count and the right face may name the rules.
           */
          await ports.record.withheldFor(selectedRoot),
          // Every try of the request, so its cost is read across all of them
          // and each try's stays as the detail (rondo#378).
          selectedLaps.map((lap) => lap.record),
        );
  // The merge is done where rondo has seen it made, by a press or on the
  // forge (rondo#413), and is no step at all once the pull request was closed
  // unmerged: nothing remains, and it was not merged. `governanceOf` reads no
  // thread, so it is said here.
  const selectedGovernance =
    governed === null
      ? null
      : {
          ...governed,
          chain: governed.chain.flatMap((link) =>
            link.step !== "merge"
              ? [link]
              : selectedResult?.merged != null
                ? [{ ...link, state: "done" as const }]
                : selectedResult?.closedAtMs != null
                  ? []
                  : [link],
          ),
        };
  /*
   * **A flow's stop, with the facts the host kept beside its ask** (rondo#549):
   * read only where the thread holds one, so an ordinary thread asks the store
   * nothing. The page says the stop again from these, in the language of
   * whoever is looking, instead of drawing the host's own (`flowStopView`).
   */
  const flowStopRows = selectedMessages.some(flowStopAsked) ? await ports.record.flowStops() : [];
  const flowStopSays = new Map(
    selectedMessages.flatMap((message) => {
      const stop = flowStopAsked(message)
        ? flowStopAskedFacts(flowStopRows, message.messageId)
        : null;
      return stop === null ? [] : [[message.messageId, stop] as const];
    }),
  );
  /*
   * **The messages whose body is not prose**, rendered here because this
   * renderer still owns them: what rondo read of a named issue (D-0078 section
   * 4), a drafter run that drafted nothing (rondo#238) and rondo's own report
   * on a lap (rondo#437). They cross the seam
   * as markup, like the boxes, and are awaited once rather than inside the
   * synchronous map below.
   */
  const drawnBodies = new Map(
    await Promise.all(
      selectedMessages
        .filter(
          (message) =>
            message.authorKind === "forge" ||
            noDraft(message) ||
            redraftNote(message) ||
            lapReport(message) ||
            scopeStop(message) ||
            flowStopSays.has(message.messageId) ||
            (reads !== null && heldMessage(message)),
        )
        .map(async (message) => {
          const stop = flowStopSays.get(message.messageId);
          return [
            message.messageId,
            await (message.authorKind === "forge"
              ? forgeView(wording, message)
              : lapReport(message)
                ? lapReportView(wording, message, reads)
                : scopeStop(message)
                  ? scopeStopView(wording, message, reads)
                  : stop !== undefined
                    ? flowStopView(wording, message, stop)
                    : noDraft(message) || redraftNote(message) || reads === null
                      ? noDraftView(wording, message, reads)
                      : raw(heldMarkup({ wording, reads, text: message.body, className: "" }))
            ).toString(),
          ] as const;
        }),
    ),
  );
  // rondo#401: an explainer answer's band and cost, and where a cited lap is answered.
  const bands = await answerBands(ports.record, selectedMessages, wording);
  const gates = gatesOf(selectedLaps.map((lap) => lap.record));
  /** Each message's moment, for rule 7's line: the items themselves do not carry it. */
  const messageTimes = new Map(selectedMessages.map((m) => [m.messageId, m.atMs]));
  /*
   * **The words a change was asked with, under the name of who asked**
   * (rondo#448). They are kept only in the prompt of the try they started, so
   * a change whose next try never started has none to show, and its line
   * says so on its own. Placed at the gate's answer, beside that line.
   */
  const askedChanges = selectedLaps.flatMap(({ record }) => {
    const next = selectedLaps.find((lap) => lap.record.supersedesIterationId === record.id);
    const words =
      record.gateAnswer !== "revise" || record.gateAnswerActor === null || next === undefined
        ? null
        : revisionInstruction(record, next.record);
    return words === null
      ? []
      : [
          {
            id: `revise-${record.id}`,
            actor: record.gateAnswerActor ?? "",
            atMs: record.updatedAtMs,
            words,
          },
        ];
  });
  for (const asked of askedChanges) messageTimes.set(asked.id, asked.atMs);
  const triageLine = (() => {
    const last = selectedLaps.at(-1)?.record;
    // Not while something is in the person's turn (point 4.1 (d)), as on the
    // empty centre: they came to answer.
    if (last === undefined || last.status !== "closed" || requestsList.yourTurn.length > 0) {
      return [];
    }
    const named = last.plan["forge_repository"];
    const row = latestTriage
      .filter(
        (one) =>
          one.createdAtMs > last.updatedAtMs &&
          (triagePayloads.get(one.proposalId)?.ranked.length ?? 0) > 0 &&
          (typeof named !== "string" || named === "" || named === one.repository),
      )
      .at(-1);
    return row === undefined
      ? []
      : [
          {
            kind: "event" as const,
            event: {
              id: `triage:${row.proposalId}`,
              kind: "other" as const,
              said: wording.evProposal,
              at: wording.age(ago(row.createdAtMs, nowMs)),
              atMs: row.createdAtMs,
              href: `${viewHref({ kind: "requests" }, wording.lang)}#triage-heading`,
              linkSaid: wording.evProposalLink,
            },
          },
        ];
  })();
  const threadItems: ThreadItem[] = [
    ...selectedMessages.map((message, at): ThreadItem => {
      const waits = threads.waiting.has(message.messageId);
      const parent = message.inReplyTo === null ? undefined : threads.byId.get(message.inReplyTo);
      const previous = selectedMessages[at - 1];
      return {
        kind: "message",
        message: {
          id: message.messageId,
          who: message.authorKind === "operator" ? "person" : "rondo",
          voice: message.authorKind,
          said: whoWrote(wording, message, ports.actorId),
          body: message.body,
          drawn: (() => {
            const markup = drawnBodies.get(message.messageId);
            return markup === undefined ? null : Raw({ html: markup });
          })(),
          at: wording.age(ago(message.atMs, nowMs)),
          atTitle: new Date(message.atMs).toISOString(),
          // **Which of the two reasons it still waits** (D-0072 rule 3):
          // nobody has been back to it, or the person has and said to stop.
          waiting: !waits
            ? null
            : threads.stopped.has(message.messageId)
              ? wording.askStoppedPill
              : wording.askWaitingPill,
          // **What this message answered, where it was said** (D-0072 rule 1):
          // the words are kept byte for byte either way, so with no mark here
          // two answers that read alike and did opposite things would be one
          // entry in the thread.
          answered:
            message.answerOutcome === undefined
              ? null
              : message.answerOutcome === "stop"
                ? wording.answerStoppedPill
                : message.answerOption === undefined
                  ? wording.answerCarriedOnPill
                  : wording.answerChosePill(message.answerOption + 1),
          pending: (threads.unread.get(message.messageId) ?? []).map((ref) => ref.named),
          pendingSaid: wording.issuePending,
          bases: message.bases.map((basis) =>
            basisWord(wording, basis, threads, selectedRoot, ports.actorId, gates),
          ),
          band: bands.get(message.messageId) ?? null,
          basesLabel: wording.basesLabel,
          // Said only where the reply is to neither the message above it nor
          // the request itself, which is what every reply is read as.
          inReplyTo:
            parent === undefined ||
            parent.messageId === previous?.messageId ||
            parent.messageId === selectedRoot
              ? null
              : {
                  said: wording.inReplyTo(whoWrote(wording, parent, ports.actorId), lineOf(parent)),
                  href: `#${encodeURIComponent(parent.messageId)}`,
                },
          reply:
            !forms || selectedRoot === null
              ? null
              : {
                  href: viewHref(
                    { kind: "thread", messageId: selectedRoot, to: message.messageId },
                    wording.lang,
                  ),
                  said: waits ? wording.answerAskAction : wording.replyAction,
                },
          ask:
            !forms || selectedRoot === null
              ? null
              : askLink(wording, selectedRoot, message.messageId, `message:${message.messageId}`),
        },
      };
    }),
    ...askedChanges.map(
      (asked): ThreadItem => ({
        kind: "message",
        message: {
          id: asked.id,
          who: "person",
          voice: "operator",
          said: asked.actor === ports.actorId ? wording.you : asked.actor,
          body: asked.words,
          drawn: null,
          at: wording.age(ago(asked.atMs, nowMs)),
          atTitle: new Date(asked.atMs).toISOString(),
          waiting: null,
          answered: wording.askedChangePill,
          bases: [],
          basesLabel: wording.basesLabel,
          pending: [],
          pendingSaid: wording.issuePending,
          inReplyTo: null,
          reply: null,
        },
      }),
    ),
    ...selectedLaps.flatMap((lap, tryAt) =>
      lapEvents(
        wording,
        lap.record,
        (readingsByLap.get(lap.record.id) ?? []).map((reading) => ({
          drafter: reading.drafter,
          verdict: reading.verdict,
          findings: reading.findings,
          atMs: reading.readAtMs,
        })),
        (status) => isTerminal(status as IterationRecord["status"]),
        (atMs) => wording.age(ago(atMs, nowMs)),
        // Said only where there is more than one to tell apart.
        selectedLaps.length > 1 ? tryAt + 1 : null,
        // What happened after its gate, which the row does not hold (rondo#376).
        {
          revised: revisedIn(
            lap.record,
            selectedLaps.map((each) => each.record),
          ),
          result: resultOf(threads.byId, lap.record.id),
        },
      ).map((event): ThreadItem => ({ kind: "event", event })),
    ),
    ...triageLine,
  ]
    /*
     * **One stream, in the order it happened** (D-0083 rule 2, and
     * `page/thread.tsx`'s own claim about itself). The two sources are
     * gathered apart and have to be put back in time order here, or a lap's
     * report is drawn before the line saying the lap started -- and rule 7's
     * line, which is placed by walking this array, lands in the wrong place.
     */
    .map((item, at) => ({
      item,
      at,
      atMs: item.kind === "message" ? (messageTimes.get(item.message.id) ?? 0) : item.event.atMs,
    }))
    // `at` breaks the tie, so two things at the same millisecond keep the
    // order their source gave them rather than one the sort invented.
    .toSorted((left, right) => left.atMs - right.atMs || left.at - right.at)
    .map((sorted) => sorted.item);
  /*
   * **One line, once in the thread** (D-0083 rule 7, D-0061 rule 2.5). The
   * items are already in the order they happened, so the line sits above the
   * first one that arrived after the person last looked. There is no line
   * where they have never looked, and none where everything is older than
   * the mark: both mean nothing is below it, and a line with nothing under
   * it says something false.
   *
   * **No row carries a *new* mark of its own** (rule 7): the list face draws
   * the other one, and between them that is two lines on the page.
   */
  const lastLookedMs = inbox?.sinceMs ?? null;
  const marks = threadItems.map((item) =>
    item.kind === "message"
      ? { id: item.message.id, atMs: messageTimes.get(item.message.id) ?? 0 }
      : { id: item.event.id, atMs: item.event.atMs },
  );
  const firstUnseen =
    lastLookedMs === null ? -1 : marks.findIndex((mark) => mark.atMs > lastLookedMs);
  const lastLookedAbove = firstUnseen <= 0 ? null : (marks[firstUnseen]?.id ?? null);
  return {
    noSuchThread,
    selectedRoot,
    selectedLap,
    answeringLap,
    shown,
    gatedLap,
    governedLap,
    selectedMessages,
    selectedLaps,
    readingsByLap,
    selectedResult,
    selectedParts,
    partsUnlanded,
    endedAtMs,
    fixRunning,
    selectedGovernance,
    threadItems,
    lastLookedMs,
    lastLookedAbove,
  };
}

type ThreadModel = Awaited<ReturnType<typeof threadModel>>;

/**
 * **The boxes the thread view holds** (rondo#341): the box to write a request
 * in, the box to add to one, the gate's own box and the thread's acts, each
 * composed by the part that owns it and handed over as markup.
 */
async function threadBoxes(
  ports: WebPorts,
  view: PageView,
  wording: Chrome,
  token: string | null,
  newId: MintMessageId | null,
  newIterationId: MintIterationId | null,
  { nowMs, ledger, threads, owes, partsOfRequest }: PageModel,
  { goals }: TriageReads,
  {
    selectedRoot,
    answeringLap,
    shown,
    gatedLap,
    selectedMessages,
    selectedLaps,
    readingsByLap,
  }: ThreadModel,
) {
  /*
   * The week's allowance is the right face's second slice; until it is read
   * from an approval, no figure is drawn -- rule 6 refuses a spent figure
   * without the one it was approved against, and that refusal is the honest
   * state rather than a zero.
   */
  /*
   * **The centre, as one of two things** (D-0083 rules 4 and 5): the selected
   * request's thread, or -- with nothing waiting and nothing named -- the
   * empty centre, which asks what the person wants rather than showing an
   * empty thread.
   */
  /*
   * The two boxes a person writes in are still this renderer's
   * (`composerView`), so they cross the seam as markup: the request box on the
   * empty centre, and the box to add to a request under every thread. They
   * are composed by the part that owns them and only placed here.
   */
  // **Composed whether or not there is a write port**: with none, the box's
  // own part says the threads can be read and not written to, and D-0020 rule
  // 2 wants that where a person is looking rather than on one screen.
  // **A candidate the person took** (D-0097 point 4.4): the box is drawn
  // holding its drafted request, by the server, so it works without script.
  // **Read by the id the address names, not among the latest rows**: a
  // reading written after the page was drawn must not empty a box a person
  // pressed for, nor a reload of it.
  const taken = await (async () => {
    if (view.kind !== "requests" || view.take === undefined) {
      return null;
    }
    const take = view.take;
    const read = await ports.record.readProposal(take.proposalId);
    const payload =
      read.kind === "read" && read.proposal.kind === "triage"
        ? readTriagePayload(read.proposal.payload)
        : null;
    if (payload === null) {
      return null;
    }
    const clauses = goals.find((goal) => goal.goalId === payload.goalId)?.clauses ?? [];
    const text = takenRequest(wording, payload, clauses, take.candidate);
    return text === null ? null : { key: `${take.proposalId}:${take.candidate}`, text };
  })();
  const askBox = await composerView(
    wording,
    { kind: "requests" },
    threads,
    token,
    newId,
    ports.actorId,
    nowMs,
    taken,
  )?.toString();
  // **Carry on, at a worker's question, is the gate's revise** (D-0142): for
  // the lap whose question the box answers, which need not be the gate the
  // centre frames when several wait (Codex); only where that gate would draw
  // its revise press, and holding what its box holds.
  const answerRevise = await (async (): Promise<AnswerRevise | null> => {
    const target =
      selectedRoot === null || newIterationId === null
        ? null
        : replyTarget(
            threads,
            { messageId: selectedRoot, to: view.kind === "thread" ? view.to : null },
            ports.actorId,
          );
    const lapId =
      target?.answers === true && target.target.authorId === WORKER_QUESTION_AUTHOR
        ? target.target.messageId.replace(/^question-/, "")
        : null;
    if (lapId === null || newIterationId === null || !threads.waiting.has(`question-${lapId}`)) {
      return null;
    }
    const found = await ports.store.read(lapId);
    if (
      found.kind !== "read" ||
      found.record.status !== "awaiting_human" ||
      found.record.gateId === null
    ) {
      return null;
    }
    const tip = await approvalTip(ports.record, lapId);
    if (
      tip.kind !== "tip" ||
      (await budgetClosing(ports, tip.scopeDecisionId, ports.now())) !== null
    ) {
      return null;
    }
    const box = await reviseBox(ports, wording, lapId, await ports.store.readingsFor(lapId));
    return {
      iterationId: lapId,
      scopeDecisionId: tip.scopeDecisionId,
      successor: newIterationId(),
      draft: box.kind === "drafted" ? box.text : "",
    };
  })();
  const addBox =
    selectedRoot === null
      ? null
      : await composerView(
          wording,
          // **The message the box answers is the one the address names**
          // (`replyTarget`): a person who followed a message's own *reply*
          // link asked for that message, and the box has to be aimed at it.
          view.kind === "thread"
            ? { ...view, messageId: selectedRoot }
            : { kind: "thread", messageId: selectedRoot, to: null },
          threads,
          token,
          newId,
          ports.actorId,
          nowMs,
          null,
          await budgetRaises(ports, threads, selectedRoot),
          answerRevise,
        )?.toString();
  /*
   * **The box to answer in** (D-0083 rule 9): the gate, whole, inside the
   * thread rather than on a screen of its own. `shown` holds the framing for
   * exactly this lap, and `approveView` composes every element the gate had
   * -- the free-text field, both despite sentences, the withheld plain
   * approve, the finding quoted -- which
   * `test/access/gate-elements.test.ts` is the net under.
   */
  /*
   * **What the next attempt takes in first** (D-0098 rules 2.1 and 8.5): the
   * gate's comparison says the lap reached files outside its own, and another
   * part of the request that claimed them was merged. Said on the part's step
   * and inside the revise box; the press decides it again with `git`.
   */
  const takeIn = (() => {
    const framed = answeringLap === null ? undefined : shown.get(answeringLap);
    const reach = framed?.material?.reach;
    if (gatedLap === null || reach?.kind !== "outside") {
      return null;
    }
    return (
      takeInFrom(partsOfRequest(gatedLap.requestMessageId), gatedLap.id, repositoryOf(gatedLap), [
        ...reach.collided,
        ...reach.unheld,
      ])?.pullRequest ?? null
    );
  })();
  const gateFraming = (() => {
    const framed = answeringLap === null ? undefined : shown.get(answeringLap);
    return framed === undefined ? undefined : { ...framed, takeIn };
  })();
  /*
   * **A worker's question, and what it stopped on** (D-0098 rule 8.3): one
   * event line directly above the box, while the question the lap put
   * (`question-<lap>`, `src/access/question.ts`) stands. The commit is the one
   * rondo measured, the reading's tip, as the question itself carries it; what
   * waits on the answer is the worker's own words, read from the block in its
   * report where the report was read. The link is the right face's card of what
   * changed: the commit is not on the forge until it is published.
   */
  const questionLead = (() => {
    if (gatedLap === null) {
      return null;
    }
    const askId = `question-${gatedLap.id}`;
    const ask = threads.byId.get(askId);
    if (ask === undefined || !threads.waiting.has(askId)) {
      return null;
    }
    const evidence = latestReading(
      readingsByLap.get(gatedLap.id) ?? [],
      isDeterministicReadingDrafter,
    )?.evidence;
    if (evidence == null) {
      return null;
    }
    // rondo#550: a lap that committed nothing still asked; it is said so, with no card to open.
    const built = evidence.tipCommit === evidence.baseCommit ? null : evidence.tipCommit;
    const why = gateFraming?.material?.why ?? null;
    const read = why === null ? null : readWorkerQuestion(why);
    return {
      id: `${askId}:built`,
      kind: "other" as const,
      said: wording.evQuestionBuilt(
        built?.slice(0, 7) ?? null,
        read?.kind === "question" ? read.question.waits : null,
      ),
      at: wording.age(ago(ask.atMs, nowMs)),
      atMs: ask.atMs,
      ...(gateFraming?.material == null || built === null
        ? {}
        : { href: "#changed", linkSaid: wording.evQuestionBuiltLink }),
    };
  })();
  /*
   * **What happened on the way to this gate** (rondo#497): the laps of the
   * gated lap's own line, which for a split is its part, and the parts beside
   * it by the words the right face gives them.
   */
  const gateStory = ((): GateStory | null => {
    if (gatedLap === null) {
      return null;
    }
    const lineIds = ledger.find((line) => line.lapIds.includes(gatedLap.id))?.lapIds ?? [
      gatedLap.id,
    ];
    const line = selectedLaps
      .map((lap) => lap.record)
      .filter((record) => lineIds.includes(record.id) || record.id === gatedLap.id);
    const laps = lapStory(line, (id) => readingsByLap.get(id) ?? []);
    const firstAtMs = laps[0]?.record.createdAtMs ?? gatedLap.createdAtMs;
    const parts = partsOfRequest(gatedLap.requestMessageId);
    const mine = parts.findIndex((part) => holdsLap(part, gatedLap.id));
    // The drafter's summary of the proposal the work was started from: its
    // last one before the line's first lap, written to the person (D-0022).
    const intended =
      selectedMessages.findLast(
        (message) =>
          message.authorKind === "drafter" &&
          !message.asks &&
          message.atMs <= firstAtMs &&
          message.bases.some((basis) => basis["form"] === "proposal"),
      )?.body ?? null;
    return {
      laps,
      part: mine === -1 ? null : { index: mine, count: parts.length },
      others: parts
        .filter((_, index) => index !== mine)
        .map((part) => {
          const atGate = part.laps.find((lap) => lap.status === "awaiting_human");
          return partStepOf(
            wording,
            part,
            null,
            atGate === undefined
              ? null
              : viewHref(
                  {
                    kind: "thread",
                    messageId: gatedLap.requestMessageId,
                    to: null,
                    gate: atGate.id,
                  },
                  wording.lang,
                ),
          );
        }),
      intended,
    };
  })();
  const answeringBox =
    gatedLap === null || gateFraming === undefined
      ? null
      : ((
          await approveView(wording, gatedLap, token, gateFraming, newIterationId, gateStory)
        )?.toString() ?? null);
  // A thread a question opened asks for no work, so it has no scope or next act (D-0189).
  const opener = selectedRoot === null ? undefined : threads.byId.get(selectedRoot);
  const acts =
    selectedRoot === null || (opener !== undefined && isQuestion(opener))
      ? null
      : await threadActs(
          wording,
          ports,
          token,
          selectedRoot,
          selectedLaps,
          threads,
          owes,
          newIterationId,
        );
  const actsMarkup = acts?.acts == null ? null : ((await acts.acts.toString()) ?? null);
  const nextMarkup = acts?.next == null ? null : ((await acts.next.toString()) ?? null);
  return {
    askBox,
    addBox,
    takeIn,
    gateFraming,
    questionLead,
    answeringBox,
    acts,
    actsMarkup,
    nextMarkup,
  };
}

type ThreadBoxes = Awaited<ReturnType<typeof threadBoxes>>;

/**
 * *Since you last looked* for the empty centre (D-0083 rule 4, rondo#631): the
 * inbox's own `changed` rows, sorted under their requests. Null with no actor,
 * since there is then no mark to have looked from.
 */
function sinceView(
  wording: Chrome,
  nowMs: number,
  actorId: string | null,
  inbox: PageModel["inbox"],
  threads: PageModel["threads"],
  allLapsByRequest: PageModel["allLapsByRequest"],
  placeOfRequest: (messageId: string) => string | null,
): SinceView | null {
  if (inbox === null || actorId === null) {
    return null;
  }
  if (inbox.sinceMs === null) {
    return { kind: "never" };
  }
  const laps = new Map(
    [...allLapsByRequest].flatMap(([requestId, under]) =>
      under.map((lap) => [
        lap.record.id,
        {
          requestId,
          ended: isTerminal(lap.record.status),
          updatedAtMs: lap.record.updatedAtMs,
        },
      ]),
    ),
  );
  return {
    kind: "looked",
    when: wording.age(ago(inbox.sinceMs, nowMs)),
    reading: sinceLooked(inbox.changed, inbox.sinceMs, {
      authorOf: (messageId) => {
        const message = threads.byId.get(messageId);
        if (message === undefined) {
          return undefined;
        }
        // Another person's message is theirs, not the one looking's (Codex).
        return message.authorKind !== "operator"
          ? "rondo"
          : message.authorId === actorId
            ? "you"
            : "other";
      },
      rootOf: threads.rootOf,
      lapOf: (iterationId) => laps.get(iterationId) ?? null,
    }),
    titleOf: (messageId) => firstLine(threads.byId.get(messageId)?.body ?? ""),
    placeOf: placeOfRequest,
    hrefOf: (messageId) => viewHref({ kind: "thread", messageId, to: null }, wording.lang),
    ageOf: (atMs) => wording.age(ago(atMs, nowMs)),
  };
}

/** **The centre face** (D-0083 rules 4 and 5), drawn off the thread view's model (rondo#341). */
async function threadCentre(
  ports: WebPorts,
  view: PageView,
  wording: Chrome,
  token: string | null,
  { nowMs, reads, threads, requestsList, inbox, allLapsByRequest, lapUnder, placeOf }: PageModel,
  triage: TriageReads,
  {
    noSuchThread,
    selectedRoot,
    governedLap,
    selectedLaps,
    selectedResult,
    selectedParts,
    partsUnlanded,
    endedAtMs,
    fixRunning,
    selectedGovernance,
    threadItems,
    lastLookedMs,
    lastLookedAbove,
  }: ThreadModel,
  { askBox, addBox, questionLead, answeringBox, acts, actsMarkup, nextMarkup }: ThreadBoxes,
) {
  const { goals } = triage;
  // Whether the result's merge is rondo's on green (D-0187, rondo#618), the
  // test `mergeOnGreen` asks: the strip says so rather than *merging is yours*.
  // Not over a head somebody else moved, a line released, or a merge withheld
  // for a reason it does not retry: the checks host reads none of them again.
  const resultRecord = resultLap(selectedLaps.map((each) => each.record));
  const withheldWhy = selectedResult?.withheld?.why;
  const mergesOnGreen =
    resultRecord !== null &&
    selectedResult?.merged == null &&
    selectedResult?.moved == null &&
    !NOT_RETRIED.some((token) => token === withheldWhy) &&
    (await ports.store.laneLedger()).some(
      (line) => line.releasedBy === null && line.lapIds.includes(resultRecord.id),
    ) &&
    (await scopedAuthority(ports, resultRecord.id, ["merge_default_branch"]).catch(() => null)) !==
      null;
  const centreContent = noSuchThread
    ? { rendered: await note(wording.noSuchThread).toString() }
    : view.kind === "goal"
      ? {
          react: GoalScreen({
            wording,
            repository: view.repository,
            goal: currentGoals(goals).get(view.repository) ?? null,
            nowMs,
            token: ports.triageWritable === true ? token : null,
          }),
        }
      : selectedRoot === null
        ? {
            react: EmptyCentre({
              wording,
              composer: askBox === null || askBox === undefined ? null : Raw({ html: askBox }),
              triage: TriageSection({
                wording,
                blocks: triageBlocks(wording, triage, nowMs).filter(
                  // **Not while something is in the person's turn** (D-0097
                  // point 4.1 (d)): they came to answer, and D-0083 rule 3
                  // opens that. A block whose goal flow waits on the person's
                  // answers is in their turn too, and the goal scope screen
                  // leads here to it (rondo#522).
                  (block) =>
                    requestsList.yourTurn.length === 0 ||
                    (block.kind !== "noGoal" && block.goalScope.ask !== null),
                ),
                token: ports.triageWritable === true ? token : null,
                // The ranking writes in the host's language when one is
                // set: nothing to read where the page is in it too.
                reads: ports.hostLanguage === wording.lang ? null : reads,
              }),
              since: sinceView(
                wording,
                nowMs,
                ports.actorId,
                inbox,
                threads,
                allLapsByRequest,
                (messageId) => placeOf(lapUnder(messageId)?.record ?? null),
              ),
            }),
          }
        : {
            react: ThreadFace({
              title: firstLine(threads.byId.get(selectedRoot)?.body ?? ""),
              walk: (() => {
                // **The walk is over what waits on the person** (D-0083 rule 3),
                // in the list's own order, so *next* is the next-oldest thing
                // waiting rather than the next row of anything.
                const at = walkPosition(selectedRoot, requestsList);
                if (at === null) {
                  return null;
                }
                const next = requestsList.yourTurn[at.at];
                return {
                  said: wording.walkAt(at.at, at.of),
                  nextHref:
                    next === undefined
                      ? null
                      : viewHref(
                          { kind: "thread", messageId: next.messageId, to: null },
                          wording.lang,
                        ),
                  nextSaid: wording.walkNext,
                };
              })(),
              governance:
                selectedGovernance === null
                  ? null
                  : GovernanceLine({
                      wording,
                      governance: selectedGovernance,
                      // **The clock stops where the request ended** (rondo#413):
                      // how long it took, and no longer how long ago it began.
                      askedSaid:
                        endedAtMs === null
                          ? wording.age(ago(selectedGovernance.askedAtMs, nowMs))
                          : wording.govEnded(
                              wording.age(ago(selectedGovernance.askedAtMs, endedAtMs)),
                              selectedResult?.merged == null ? "closed" : "merged",
                            ),
                      // **The other parts keep their state here** (D-0098
                      // rule 8.3): answering one part is not all there is.
                      others: (() => {
                        const parts = selectedParts;
                        // Where a part has landed and another has not, the
                        // line says every part, the landed one too (rondo#506).
                        if (partsUnlanded && parts.some((part) => part.standing === "merged")) {
                          return wording.partsSaid(partCounts(parts), false);
                        }
                        const others = parts.filter(
                          (part) => governedLap === null || !holdsLap(part, governedLap.id),
                        );
                        return parts.length === 0 || others.length === 0
                          ? null
                          : wording.partsSaid(partCounts(others), true);
                      })(),
                    }),
              // **What became of the work, as a state** (rondo#376): approved,
              // the pull request and its checks, and the merge that is the
              // person's -- said once, here, for the lap the result belongs to.
              result:
                resultRecord === null
                  ? null
                  : ResultLine({
                      wording,
                      result: selectedResult,
                      mergesOnGreen,
                      conflictFix:
                        acts?.fixOffered === true
                          ? "offered"
                          : fixRunning
                            ? "running"
                            : acts?.fixWaits === true
                              ? "waits"
                              : null,
                    }),
              items: folds(wording, threadItems, lastLookedAbove),
              foldOpen: wording.foldOpen,
              lastLookedAbove,
              lastLookedSaid:
                lastLookedMs === null
                  ? wording.lastLookedNever
                  : wording.lastLookedHere(wording.age(ago(lastLookedMs, nowMs))),
              acts: actsMarkup === null ? null : Raw({ html: actsMarkup }),
              next: nextMarkup === null ? null : Raw({ html: nextMarkup }),
              answering: answeringBox === null ? null : Raw({ html: answeringBox }),
              answeringLead: answeringBox === null ? null : questionLead,
              adding: addBox === null || addBox === undefined ? null : Raw({ html: addBox }),
            }),
          };
  return centreContent;
}

/** **The right face of a request** (D-0083 rules 5 and 6), drawn off the thread view's model (rondo#341). */
async function threadSideOf(
  ports: WebPorts,
  wording: Chrome,
  token: string | null,
  { reads, threads, partsOfRequest, forms }: PageModel,
  {
    selectedRoot,
    selectedLap,
    gatedLap,
    governedLap,
    selectedLaps,
    readingsByLap,
    selectedGovernance,
  }: ThreadModel,
  { takeIn, gateFraming, acts }: ThreadBoxes,
) {
  /*
   * **The right face of a request** (D-0083 rules 5 and 6, gate point 7's
   * second slice, rondo#350). Two tiers: the material for this confirmation,
   * and what was agreed for this request. `page/thread-side.tsx` decides which
   * is on top, because that is a fact about whether anything is being asked.
   *
   * **The material is the renderer's own markup**, crossing the seam as the
   * boxes do -- it is the same cards that used to stand inside the answering
   * box, moved and not redrawn.
   *
   * **With nothing being asked there is no material read** (`page/contract.ts`:
   * it is read where the press is), so what is known so far is the lap's
   * readings alone -- and nothing at all where no reading has been taken,
   * because two cards saying *not yet* are not a thing anybody came to read.
   */
  /*
   * **The lap this face is about is the one being answered** (Codex). A gate
   * is answered wherever it stands, so the lap at the gate need not be the one
   * the list speaks with: `saysMore` can put a newer running lap forward while
   * an older one waits. The material, the steps and the box all have to
   * describe the same lap, or the face would say *work, under way* beside a
   * confirmation that is waiting on the person. With nothing being asked there
   * is no gated lap and the selected one is the subject.
   */
  const sideLap = governedLap;
  // rondo#401 (D-0177): the "?" about a try, where the page can write.
  const asks = (lap: string | null) =>
    !forms || selectedRoot === null || lap === null
      ? null
      : { ...askLink(wording, selectedRoot, null, `iteration:${lap}`), ask: true as const };
  const sideAsking = gatedLap !== null && gateFraming !== undefined;
  const sideReadings =
    gateFraming?.readings ??
    (selectedLap === null ? [] : (readingsByLap.get(selectedLap.record.id) ?? []));
  const sideClosing =
    sideLap === null
      ? null
      : await closingShown(
          ports,
          sideLap,
          (await approvalOf(ports, sideLap))?.payload.budgets.review_rounds ?? null,
          resultOf(threads.byId, sideLap.id)?.url ?? null,
        );
  const sideMaterial =
    sideLap === null
      ? null
      : sideAsking && gateFraming !== undefined
        ? await materialView(
            wording,
            sideLap,
            gateFraming.material,
            sideReadings,
            sideClosing,
            ports.retakesReviews === true ? token : null,
            reads,
          ).toString()
        : sideReadings.length > 0 || sideClosing !== null
          ? await materialView(
              wording,
              sideLap,
              null,
              sideReadings,
              sideClosing,
              null,
              reads,
            ).toString()
          : null;
  const threadSide =
    selectedGovernance === null || sideLap === null
      ? // **An approved split with nothing started still has its parts' waits**
        // (D-0098 rule 8.2): no lap to read an agreement from, so the steps alone.
        selectedRoot === null || partsOfRequest(selectedRoot).length === 0
        ? // **Before any lap, the plan and its scope are what remains**
          // (rondo#495 item 3), read off the thread card's own standing.
          acts?.scopeStep == null || selectedLaps.length > 0
          ? null
          : { react: ScopeSide({ wording, steps: stepsBeforeLap(acts.scopeStep) }) }
        : {
            react: PartsSide({
              wording,
              parts: partsOfRequest(selectedRoot).map((part) => partStepOf(wording, part)),
            }),
          }
      : {
          react: ThreadSide({
            wording,
            governance: selectedGovernance,
            // **What remains before this ends** (rule 6), as the five steps
            // rule 4 draws under a running request: one reading of where the
            // work stands, drawn in two places by one component.
            steps: (() => {
              const sideResult = resultOf(threads.byId, sideLap.id);
              // Closed unmerged: the merge is no longer a step (rondo#413).
              return stepsOf(
                sideLap,
                sideReadings,
                publishedReport(threads, sideLap.id) !== null,
                sideResult?.merged != null,
              ).filter((step) => step.name !== "landing" || sideResult?.closedAtMs == null);
            })(),
            material: sideMaterial === null ? null : Raw({ html: sideMaterial }),
            asking: sideAsking,
            ask: asks(sideLap.id),
            parts:
              selectedRoot === null
                ? []
                : partsOfRequest(selectedRoot).map((part) => {
                    // A part at a gate the box is not showing: the way to it.
                    const atGate = part.laps.find(
                      (lap) => lap.status === "awaiting_human" && lap.id !== gatedLap?.id,
                    );
                    const step = partStepOf(
                      wording,
                      part,
                      gatedLap !== null && holdsLap(part, gatedLap.id) ? takeIn : null,
                      atGate === undefined
                        ? null
                        : viewHref(
                            { kind: "thread", messageId: selectedRoot, to: null, gate: atGate.id },
                            wording.lang,
                          ),
                    );
                    const ask = asks(part.laps.at(-1)?.id ?? null);
                    return ask === null ? step : { ...step, links: [...step.links, ask] };
                  }),
          }),
        };
  return threadSide;
}

/**
 * The whole page: the three questions an operator arrives with, and then the
 * reading the answers rest on (rondo#145).
 *
 * **The order is the argument, and it is the operator's rather than rondo's.**
 * What is on the screen first is what needs them, then what is running, then
 * what just ended -- which is `inbox`'s own order carried to the surface a
 * person actually looks at, and not the order `inbox`, `between` and `explain`
 * happen to be laid out in. rondo's own vocabulary -- bounds, adjacency,
 * last-look marks, a field-by-field reading of every row -- is at a second
 * address below, unchanged and complete.
 *
 * **Folded is not hidden** (D-0032). Every claim that was on this page before
 * is still on it, under the same basis, in the same words; what moved is which
 * of them an operator has to read past to answer *does anything need me*. The
 * lead cites the row each of its lines is read off, once, and the reading below
 * cites the field -- so a number in the lead is checkable twice over rather
 * than asserted once.
 *
 * **Nothing here writes** (D-0041). Every read above is a read, the refresh and
 * the key script issue nothing but `GET`s, and the only thing on the page that
 * can produce anything but a `GET` is still the one form.
 *
 * **Server JSX, rendered to one string** (D-0059 rule 2): `hono/jsx` escapes
 * every text child and attribute, which is what the hand-written `escapeHtml`
 * did, so a request's `<b>` is still text.
 *
 * **Each view reads and draws in a function of its own** (rondo#341), as
 * publish, merge and release already did: what every view reads
 * (`pageModel`), the thread's read model, its boxes, its centre and its right
 * face, the week (`weekSide`) and the document around the faces
 * (`pageDocument`). This function only decides which of them a view is drawn
 * from, in the order the reads and the minted ids have always been taken.
 */
export async function operatorPage(
  ports: WebPorts,
  token: string | null = null,
  view: PageView = { kind: "summary" },
  // **The set this request resolved to, and not a property of the process**
  // (D-0056 rule 2). It was `ports.wording` while a host had one language for
  // the life of the server; it is an argument now because five steps decide it
  // per request and the renderer is downstream of that decision, not part of
  // it. `EN` by default for the same reason `token` and `view` have defaults:
  // a caller that has said nothing gets the page this was before.
  wording: Chrome = EN,
  /**
   * Mints the id a composer form carries (D-0061 rule 2.1), or null where
   * there is no say port: no minter, no form. Handed down by
   * `src/access/web-app.ts` for the token's reason -- the renderer holds
   * nothing that writes, and is not granted `node:crypto` either.
   */
  newId: MintMessageId | null = null,
  /**
   * rondo#233 S3: the scope screen's two minted ids, minted where `newId` is
   * minted and null on the same condition -- no scope port, no forms. Here and
   * not in this module for `newId`'s reason: the renderer is not granted
   * `node:crypto`, and the server hands it ids.
   */
  newScopeId: MintScopeId | null = null,
  newIterationId: MintIterationId | null = null,
): Promise<string> {
  const model = await pageModel(ports, token, view, wording, newId);
  const {
    nowMs,
    threadRead,
    forms,
    reads,
    onThreads,
    inbox,
    ledger,
    threads,
    waits,
    waitingCount,
    requestsList,
  } = model;
  // **A way to the release press only where there is a port behind it**, which
  // is narrower than the token: an approver the allowlist refuses still gets a
  // token for the gate's press, and would get a release that refuses every time.
  const releaseToken = ports.releasable === true ? token : null;
  const keepsCurrent = isLive(view);
  // **The token arrives null exactly when there is no writer** (D-0041 rule 4,
  // D-0059 rule 3a): the renderer is handed the reading ports and nothing that
  // could write, so whether a button is drawn is decided by the one caller that
  // does hold the writer (`src/access/web-app.ts`) and handed down as a token.
  // **Awaited here** and not inside the tree: the scope screen reads the plan
  // and, in its second state, the approval and what a predecessor spent.
  const scoping =
    view.kind === "scope"
      ? await scopeView(ports, wording, view, threads, token, newScopeId, newIterationId, nowMs)
      : view.kind === "goalScope"
        ? await goalScopeView(ports, wording, view, token, newScopeId, nowMs)
        : null;
  const triage = await triageModel(ports, threads);
  const thread = await threadModel(ports, view, wording, token, model, triage);
  const boxes = await threadBoxes(
    ports,
    view,
    wording,
    token,
    newId,
    newIterationId,
    model,
    triage,
    thread,
  );
  const centreContent = await threadCentre(
    ports,
    view,
    wording,
    token,
    model,
    triage,
    thread,
    boxes,
  );
  /** The screens the page's rebuild does not touch, which keep their own centre. */
  const onOwnScreen =
    view.kind === "scope" ||
    view.kind === "goalScope" ||
    view.kind === "publish" ||
    view.kind === "merge" ||
    view.kind === "release";
  /*
   * **The right face** (D-0083 rule 4): the week where the centre is empty,
   * and otherwise the request's own.
   */
  const centreIsEmpty = !onOwnScreen && !thread.noSuchThread && thread.selectedRoot === null;
  const sideContent = centreIsEmpty
    ? await weekSide(ports, wording, model)
    : await threadSideOf(ports, wording, token, model, thread, boxes);
  const listContent = {
    react: RequestsFace({
      wording,
      list: { ...requestsList, paused: triage.paused, asking: triage.asking },
      hrefOf: (messageId) => viewHref({ kind: "thread", messageId, to: null }, wording.lang),
      agoOf: (atMs) => wording.age(ago(atMs, nowMs)),
      allowance: null,
      newRequestHref: forms ? viewHref({ kind: "requests" }, wording.lang) : null,
      lastLookedSaid:
        inbox?.sinceMs === null || inbox?.sinceMs === undefined
          ? wording.lastLookedNever
          : wording.lastLookedHere(wording.age(ago(inbox.sinceMs, nowMs))),
      openId: onOwnScreen ? null : thread.selectedRoot,
    }),
  };
  // **Awaited here** for `scoping`'s reason: the dry-run reads a workspace and
  // the forge's own configuration, and the tree is composed from what it read.
  const publishing =
    view.kind === "publish" ? await publishView(ports, wording, view, token, threads) : null;
  const merging =
    view.kind === "merge" ? await mergeView(ports, wording, view, token, threads) : null;
  const releasing =
    view.kind === "release"
      ? await releaseView(ports, wording, view, releaseToken, ledger, threads, nowMs)
      : null;
  /**
   * **Whether a person may be writing on this view.** With script off a reload
   * throws a half-written draft away, so a view with a box does not reload
   * itself and says so (#220 S1). The box to answer a gate counts as one:
   * since D-0083 rule 9 it holds the free-text field a press carries, and it
   * is drawn wherever a question is standing rather than on a screen of its
   * own that never reloaded.
   */
  const writingHere = onThreads && (forms || boxes.answeringBox !== null);
  return pageDocument({
    wording,
    view,
    actorId: ports.actorId,
    token,
    threads,
    threadRead,
    reads,
    waits,
    waitingCount,
    onThreads,
    forms,
    keepsCurrent,
    writingHere,
    faces: facesMarkup({
      list: listContent,
      side: sideContent,
      /*
       * **The screens this rebuild does not touch keep their own
       * centre**: the scope screen, publish, the log and release are
       * still this renderer's server JSX, and they are drawn in the
       * centre face as they were. Everything else -- the page a
       * person actually arrives on -- is the thread or the empty
       * centre.
       */
      thread: onOwnScreen
        ? {
            rendered: await (
              <div class="mx-auto max-w-5xl space-y-6 px-4 pt-6 pb-12 sm:px-6">
                {view.kind === "scope" || view.kind === "goalScope"
                  ? scoping
                  : view.kind === "publish"
                    ? publishing
                    : view.kind === "merge"
                      ? merging
                      : releasing}
              </div>
            ).toString(),
          }
        : centreContent,
    }),
  });
}
