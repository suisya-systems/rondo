/**
 * Reaching the person who is not looking at the screen (rondo#311).
 *
 * The page says what waits, and says it well, to whoever is looking at it. The
 * gap this closes is the other case: rondo has nothing to do until a person
 * answers, the person is somewhere else, and nothing on this machine says so.
 *
 * **What it is, in one sentence**: once a minute the resident host reads the
 * same *whose turn is it* the screen reads, and for anything it has not told
 * the person about yet it runs, once, the one program setup found for putting
 * a line in front of them.
 *
 * **The same reading as the screen, and not a second one of its own.** Both
 * sides come from one pass of `src/access/page-logic/waits.ts`, which the
 * screen reads as requests and this reads as waits. A notification derived from
 * its own idea of waiting would eventually send somebody to a screen showing
 * nothing waiting, which is #206's failure -- the page and the store
 * disagreeing about an open question -- with a person's attention spent on it.
 *
 * **Told once, and never told again** (`D-0068` section 2, rules 3.1 and 5).
 * Whether a thing has been sent is the `operator_attention` row and its
 * partial unique index, the table rondo already dedupes presentations with: no
 * table is added, nothing is held in memory, a host that restarts does not
 * start the morning by repeating itself, and two hosts over one store send one
 * line between them rather than one each. A reminder is an attention policy the
 * operator writes (`D-0033` rule 7), and rondo does not write one for them.
 *
 * **What is worth a person's attention, and what is not.** Two things: a
 * request whose next move is theirs, and a lap that has been in flight longer
 * than its own plan said to wait (`D-0068`'s F1). An ordinary ending is not
 * among them -- work finishing is what is supposed to happen, and a program
 * that says so out loud every time teaches the person to ignore it, which
 * costs them the two that matter.
 *
 * **Why not continuo's `external-notify`** (checked 2026-09-21, and the answer
 * is not "we forgot"). continuo's outbox has a notify recipient, and
 * `deliverGate` drains it -- under **the delivery lease of one run**, writing
 * into a destination directory. Three of the things this must carry have no
 * run at all: a question standing in a thread, a request no lap has been
 * started for, and a lap that has already ended. The one case that does have a
 * run is the worst of the four, because `lap perform` holds that same lease
 * for the length of the lap, so a tick reaching for it is refused `LeaseHeld`
 * as an ordinary answer. And its delivery is a file on this machine, which is
 * the problem restated rather than solved: the person is not looking at this
 * machine's files either.
 *
 * **The decision and the capability are split**, so the decision can be tested
 * without a subprocess: {@link reachThePerson} reads rows and decides, and
 * {@link notifierAt} is the one thing here that runs a program.
 */
import { spawn } from "node:child_process";
import type { IterationRecord } from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { threadsOf } from "./page-logic/threads.js";
import { lapsPastTheirCeiling, waitsOnYou } from "./page-logic/waits.js";
import type { Chrome } from "./wording.js";

/**
 * `operator_attention.subject_kind` for the things this tick has told somebody
 * about.
 *
 * **Its own kind, deliberately not `patrol`'s.** `D-0068` rule 3.1 gives the
 * patrol `patrol` with `<finding>:<episode>` under it, and the patrol's episode
 * is what gates the *message* it writes into a thread. Writing under that key
 * here would mean this tick's toast silently consumed the episode the patrol's
 * message is owed, and the finding would never be written down anywhere a
 * person could read it back. Two deliveries, two ledgers.
 */
export const REACH_SUBJECT = "reach";

/** Whether the program setup found actually ran, and what to say if it did not. */
export type NotifyOutcome =
  | { readonly kind: "reached" }
  | { readonly kind: "failed"; readonly reason: string };

/** Everything the tick reads, and the one thing it does. */
export interface ReachPorts {
  readonly store: Pick<IterationStore, "readLive">;
  readonly record: Pick<AdvisoryRecord, "threadMessages" | "claimAttention">;
  readonly now: () => number;
  /**
   * The person's own words, as the page resolved them for this host
   * (`D-0079`): what this writes is read by the person and by nobody else, so
   * it is composed in their language and never translated from the English.
   */
  readonly words: Chrome;
  /**
   * Run setup's notification program with one sentence, or `null` where setup
   * found none on this machine -- in which case this tick does nothing at all
   * rather than pretending to have reached anybody.
   *
   * **One sentence and one argument**, which is a measurement and not a taste
   * (2026-09-21, this machine): `notify-send SUMMARY` and
   * `wsl-notify-send.exe MESSAGE` both take the line as a single positional
   * argument, and handing `wsl-notify-send.exe` a second one makes it print
   * its usage, deliver nothing, **and exit 0**. A two-argument call shape
   * would therefore have failed silently on the one program this machine has.
   */
  readonly notify: ((sentence: string) => Promise<NotifyOutcome>) | null;
  /**
   * The host's own console, which is where a notification that did not go out
   * is reported.
   *
   * **Not the person** (`D-0076` rule 4.2). A program that could not be run is
   * something about this machine's setup, and the reader who can repair it is
   * whoever installed rondo. The person loses nothing they had: the screen
   * still says what waits, and the notification was only ever the thing that
   * would have saved them a look.
   */
  readonly say: (line: string) => void;
}

/**
 * One tick: tell the person about anything worth telling them about that they
 * have not been told about already.
 *
 * **Claimed before it is sent, and not after.** The `operator_attention` rows
 * go in first and the program runs second, so a host that dies between the two
 * loses one notification rather than sending the same one every minute for as
 * long as the thing stays true. That is the direction `D-0068` rule 3.1 takes
 * with the patrol's message for the same reason, and it is the side of the
 * trade the entry's "a finding that stays true is not re-sent" already names.
 *
 * **One run for the tick, however much is new.** Three requests turning over
 * in the same minute is one line in front of the person, because what they do
 * about it is the same act -- come and look -- and three of them is the noise
 * that makes the next one ignorable.
 *
 * Returns nothing: every outcome this has is either a row, a line on the
 * host's console, or a notification in front of somebody. Nothing upstream
 * decides anything from it.
 */
export async function reachThePerson(ports: ReachPorts): Promise<void> {
  if (ports.notify === null) {
    return;
  }
  const atMs = ports.now();
  const laps: IterationRecord[] = (await ports.store.readLive()).flatMap(
    (outcome): IterationRecord[] => (outcome.kind === "read" ? [outcome.record] : []),
  );
  const read = await ports.record.threadMessages();
  // **A thread that will not read says nothing waits in it, rather than taking
  // the tick down.** The laps are still read: half a reading is better than a
  // host whose minute tick throws, and the screen reports the unreadable rows
  // itself.
  const threads = threadsOf(read.kind === "read" ? read.messages : [], new Set(), new Map());
  // **Keyed by the wait and not by the request** (Codex, round 1). A request
  // outlives any one of its questions: keyed by the request, a thread's second
  // question -- and the gate a lap reaches once the first one is answered --
  // would be filtered out for ever as a repeat of a wait that had in fact been
  // settled, which is a person never told about the rest of their own request.
  const turns = waitsOnYou(threads, laps).map((wait) => wait.episode);
  const late = lapsPastTheirCeiling(laps, atMs).map((episode) => `late:${episode}`);

  // **The claim is the test, and there is no reading before it** (Codex,
  // round 2). Asking whether an episode has been sent and then writing that it
  // has would be two statements with a window between them, and two hosts over
  // one store -- which two `rondo web` processes on two ports are -- would
  // both find it unsent and both send. `claimAttention` is one statement, and
  // what it answers is *were you the writer who inserted*: the unique index
  // deduplicates rows, and being the one whose insert landed is what
  // deduplicates deliveries.
  let claimedTurn = false;
  let claimedLate = false;
  for (const subject of [...turns, ...late]) {
    const claim = await ports.record.claimAttention({
      atMs,
      subjectKind: REACH_SUBJECT,
      subjectId: subject,
      disposition: "presented",
      // Null because this withholds nothing: everything the reading found that
      // has not been sent is being sent. What rondo declines to send at all --
      // an ordinary ending -- is not withheld from this surface, it is not one
      // of the things this surface is about.
      ruleName: null,
    });
    if (claim.kind === "defect") {
      // A claim that did not land would be sent again next minute, so the
      // whole tick stops here: one unsent notification beats an unbounded
      // repeat of one that cannot be written down.
      ports.say(`rondo could not record that it reached you about '${subject}': ${claim.reason}`);
      return;
    }
    if (claim.kind === "claimed") {
      if (turns.includes(subject)) {
        claimedTurn = true;
      } else {
        claimedLate = true;
      }
    }
  }
  if (!claimedTurn && !claimedLate) {
    return;
  }
  // **Whichever of the two is more the person's to act on.** A turn is
  // theirs to take; a lap past its ceiling is rondo saying it does not know.
  // Both in one minute is still one line, and the one that can be acted on is
  // the one worth carrying.
  const sentence = claimedTurn ? ports.words.reachYourTurn : ports.words.reachLate;
  const outcome = await ports.notify(sentence);
  if (outcome.kind === "failed") {
    ports.say(
      `rondo could not run the program that puts a line in front of you: ${outcome.reason}. ` +
        "What was waiting is on the page; it was not sent anywhere else, and it will not be " +
        "sent again",
    );
  }
}

/**
 * How long the notification program is given before it is killed.
 *
 * It is generous for what these programs do -- both of the ones setup looks
 * for return at once -- and it is here because this runs inside the host's own
 * minute. A program that never returns would otherwise leave a child per
 * minute for as long as the host is up, which is the failure that gets noticed
 * last.
 */
const NOTIFY_TIMEOUT_MS = 10_000;

/**
 * The {@link ReachPorts.notify} that runs setup's program, or `null` where
 * setup found none on this machine.
 *
 * **One argument, measured** (2026-09-21, this machine). `notify-send SUMMARY`
 * and `wsl-notify-send.exe MESSAGE` both take the whole line as a single
 * positional argument, and `wsl-notify-send.exe` handed a second one prints
 * its usage, delivers nothing **and exits 0**. So the call shape is one
 * argument, and a program needing another shape is not supported here rather
 * than called wrongly.
 *
 * **What a non-zero exit does and does not prove.** It proves the program was
 * asked and said no -- a missing binary, an interop layer that is not up (a
 * WSL notifier inside a sandbox exits 1, measured), a refusal -- and that is
 * what is reported. It does not prove the *opposite*: `wsl-notify-send.exe`
 * exits 0 for a call it did not deliver, and no desktop notifier answers the
 * question "did a person see it". rondo can say it ran the program and what
 * the program said; it cannot say anybody was reached, and it does not.
 *
 * `stdout` is dropped and `stderr` is kept, because the usage text a wrong
 * call prints goes to `stdout` and what is worth putting in the host's journal
 * is the complaint.
 */
export function notifierAt(program: string | null): ReachPorts["notify"] {
  if (program === null || program === "") {
    return null;
  }
  return async (sentence) =>
    await new Promise<NotifyOutcome>((settle) => {
      let said = "";
      // **No shell, and the sentence is an argument and never part of a
      // command line.** It is composed by rondo rather than typed by anybody,
      // but the rule that keeps it safe should be the call shape and not the
      // contents: `spawn` with an argument array hands the bytes to the
      // program as one argument whatever is in them.
      const child = spawn(program, [sentence], {
        stdio: ["ignore", "ignore", "pipe"],
        timeout: NOTIFY_TIMEOUT_MS,
      });
      child.stderr?.setEncoding("utf8");
      child.stderr?.on("data", (chunk: string) => {
        said = `${said}${chunk}`.slice(0, 500);
      });
      // A program that could not be started at all -- the usual one is that it
      // is no longer where setup found it.
      child.once("error", (error: Error) => {
        settle({ kind: "failed", reason: error.message });
      });
      child.once("close", (code: number | null, signal: string | null) => {
        const complaint =
          said
            .split("\n")
            .find((line) => line.trim() !== "")
            ?.trim() ?? "";
        if (code === 0) {
          settle({ kind: "reached" });
        } else {
          settle({
            kind: "failed",
            reason:
              (signal === null
                ? `'${program}' ended with status ${String(code ?? "none")}`
                : `'${program}' was stopped by ${signal}, which is how it is ended when it ` +
                  `does not return within ${String(NOTIFY_TIMEOUT_MS)} ms`) +
              (complaint === "" ? "" : `: ${complaint}`),
          });
        }
      });
    });
}
