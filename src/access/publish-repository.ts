/**
 * The repository a lap's pull request goes to, told on the publish screen
 * (rondo#676, D-0202): where neither the lap's plan nor the host's `--repo`
 * names one, the person names it, and rondo records it as setup would have.
 * Out of `web-app.ts`, which is at its size cap, as `discard.ts` is.
 *
 * **Told, never inferred** (D-0081 rule 3.3 stands): the slug is what the
 * person typed. The workspace's push remote is only what it is checked
 * against, by the same preflight a publish runs, so a name that is not where
 * the push goes is refused before it is recorded.
 *
 * **Recorded where every other repository fact is: a setup plan** (D-0081
 * rule 3.2). The row is the repository's newest setup plan with
 * `forge_repository` set; a lap whose own plan names none publishes by that
 * row (`recordedRepository`), and so does every lap after it. A repository
 * setup recorded no plan for has no row to copy, and is refused.
 */
import type { Context, Hono } from "hono";
import { readRunPlan } from "../refrain/plan.js";
import { type IterationRecord, type JsonRecord, planField } from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { approvedActor } from "./approver.js";
import type { PublishAsked } from "./cli.js";
import { inspectPushTarget } from "./forge.js";
import { forgeHost, parseForgeSlug, publishesTo, publishPreflight } from "./forge-preflight.js";
import { viewHref } from "./page-logic/routes.js";
import { refusedPage } from "./screens/refused.js";
import { mintPress, type PageEnv, type Press, spendPress } from "./web-app.js";
import type { Chrome } from "./wording.js";

export const PUBLISH_REPOSITORY_ROUTE = "/publish-repository";

/** The setup plans one local repository is recorded in, newest first. */
async function plansOf(
  record: Pick<AdvisoryRecord, "setupPlans">,
  repository: string,
): Promise<readonly { readonly plan: JsonRecord; readonly slug: string | null }[]> {
  return (await record.setupPlans()).toReversed().flatMap((setup) => {
    const planned = readRunPlan(setup.plan);
    return planned.kind === "planned" &&
      planned.plan.pullRequestBaseBranch === null &&
      planned.plan.repository === repository
      ? [{ plan: setup.plan, slug: planned.plan.forgeRepository }]
      : [];
  });
}

/**
 * The slug a setup plan records for a local repository, newest first: what a
 * lap whose own plan and host name none publishes to. Null where none does.
 */
export async function recordedRepository(
  record: Pick<AdvisoryRecord, "setupPlans">,
  repository: string,
): Promise<string | null> {
  return (await plansOf(record, repository)).find((one) => one.slug !== null)?.slug ?? null;
}

/** Why a press recorded nothing, as the wording key the page says it in. */
export type PublishRepositoryRefusal =
  | "publishRepoRefusedShape"
  | "publishRepoRefusedChanged"
  | "publishRepoRefusedMismatch"
  | "publishRepoRefusedNoPlan"
  | "publishRepoRefusedFailed";

export type PublishRepositoryTold =
  | { readonly ok: true }
  | { readonly ok: false; readonly why: PublishRepositoryRefusal; readonly note: string | null };

/** A write this surface may make (D-0202): one repository's slug, on one press. */
export class PublishRepositoryPort {
  readonly #store: Pick<IterationStore, "read">;
  readonly #record: Pick<AdvisoryRecord, "setupPlans" | "recordSetupPlan">;
  readonly #approver: string;
  readonly #environment: Readonly<Record<string, string | undefined>>;
  readonly #asked: PublishAsked;

  constructor(
    store: Pick<IterationStore, "read">,
    record: Pick<AdvisoryRecord, "setupPlans" | "recordSetupPlan">,
    approver: string,
    environment: Readonly<Record<string, string | undefined>>,
    asked: PublishAsked,
  ) {
    this.#store = store;
    this.#record = record;
    this.#approver = approver;
    this.#environment = environment;
    this.#asked = asked;
  }

  /** Null when this was not a person's press. */
  async tell(
    press: Press,
    input: { readonly iterationId: string; readonly repo: string },
  ): Promise<PublishRepositoryTold | null> {
    if (!spendPress(press)) {
      return null;
    }
    const repo = input.repo.trim();
    if (parseForgeSlug(repo) === null) {
      return refused("publishRepoRefusedShape");
    }
    const actor = approvedActor(this.#approver, this.#environment);
    if ("refusal" in actor) {
      return refused("publishRepoRefusedFailed", actor.refusal);
    }
    const found = await this.#store.read(input.iterationId);
    if (found.kind !== "read") {
      return refused("publishRepoRefusedChanged", found.kind === "absent" ? null : found.reason);
    }
    const lap = found.record;
    const repository = planField(lap, "repository");
    const plans = await plansOf(this.#record, repository);
    // Only while nothing names one: a stale screen records nothing over a name.
    const named = planField(lap, "forge_repository");
    if (
      publishesTo(named === "" ? null : named, this.#asked.repo).repo !== null ||
      plans.some((one) => one.slug !== null)
    ) {
      return refused("publishRepoRefusedChanged");
    }
    const template = plans[0]?.plan;
    if (template === undefined) {
      return refused("publishRepoRefusedNoPlan", `no setup plan records ${repository}`);
    }
    const mismatch = await pushesElsewhere(lap, repo, this.#asked, this.#environment);
    if (mismatch !== null) {
      return refused("publishRepoRefusedMismatch", mismatch);
    }
    const plan = { ...template, forge_repository: repo };
    const planned = readRunPlan(plan);
    if (planned.kind !== "planned") {
      return refused("publishRepoRefusedFailed", planned.reason);
    }
    const atMs = Date.now();
    const written = await this.#record.recordSetupPlan({
      setupId: `setup-${String(atMs)}`,
      plan,
      recordedBy: actor.actorId,
      recordedAtMs: atMs,
    });
    if (written.kind !== "recorded") {
      return refused("publishRepoRefusedFailed", written.reason);
    }
    return { ok: true };
  }
}

/** The preflight a publish would run, over the name typed: its refusal, or null. */
async function pushesElsewhere(
  lap: IterationRecord,
  repo: string,
  asked: PublishAsked,
  environment: Readonly<Record<string, string | undefined>>,
): Promise<string | null> {
  const workspace = planField(lap, "workspace");
  const topicBranch = planField(lap, "topic_branch");
  const checked = publishPreflight({
    repo,
    remote: asked.remote,
    workspace,
    topicBranch,
    forgeHost: forgeHost(environment),
    allowRemoteMismatch: asked.allowRemoteMismatch,
    inspection: await inspectPushTarget({ workspace, remote: asked.remote, topicBranch }),
  });
  return checked.kind === "refused" ? checked.reason : null;
}

function refused(why: PublishRepositoryRefusal, note: string | null = null): PublishRepositoryTold {
  return { ok: false, why, note };
}

/** The press, answered with the publish screen read again over the new name. */
export function publishRepositoryRoute(
  app: Hono<PageEnv>,
  port: PublishRepositoryPort | null,
  wordingOf: (c: Context<PageEnv>) => Chrome,
): void {
  app.post(PUBLISH_REPOSITORY_ROUTE, async (c) => {
    const wording = wordingOf(c);
    const form = await c.req.parseBody();
    const iterationId = typeof form["iteration"] === "string" ? form["iteration"] : "";
    const repo = typeof form["repository"] === "string" ? form["repository"] : "";
    const answer = async (
      status: 400 | 403 | 409,
      why:
        | PublishRepositoryRefusal
        | "publishRepoRefusedNoApprover"
        | "publishRepoRefusedPress"
        | "publishRepoRefusedForm",
      note: string | null = null,
    ) =>
      c.html(
        await refusedPage(wording, {
          title: wording.publishHeading,
          id: "publish-repository-refused",
          line: wording[why],
          href: viewHref(
            iterationId === "" ? { kind: "summary" } : { kind: "publish", iterationId },
            wording.lang,
          ),
          back: wording.discardBackToPublish,
          note,
          holders: [],
          releasable: false,
        }),
        status,
      );
    if (port === null) {
      return await answer(403, "publishRepoRefusedNoApprover");
    }
    const minting = mintPress(c, form["token"]);
    if (!("press" in minting)) {
      return await answer(minting.status, "publishRepoRefusedPress");
    }
    if (iterationId === "") {
      return await answer(400, "publishRepoRefusedForm");
    }
    const told = await port.tell(minting.press, { iterationId, repo });
    if (told === null) {
      return await answer(403, "publishRepoRefusedPress");
    }
    if (!told.ok) {
      return await answer(told.why === "publishRepoRefusedShape" ? 400 : 409, told.why, told.note);
    }
    return c.redirect(viewHref({ kind: "publish", iterationId }, wording.lang), 303);
  });
}
