import type { Basis } from "../../advisory/proposal.js";
import { mapModelTier, WORKER_PROVIDERS, type WorkerProvider } from "../../continuo/roles.js";
import type { IterationRecord } from "../../store/records.js";
import type { DraftedPlanShown } from "../drafted-view.js";
import { money, TONE } from "../page/vocabulary.js";
import type { Chrome } from "../wording.js";

/**
 * Which model one part runs on, and why it may (rondo#473, D-0167): drawn on
 * each part of the scope screen, the draft and the approval alike, **above the
 * fold and not in it**, because the tier is what the person approves the cost
 * of and the grounds are what they approve it on.
 *
 * - **The tier in the person's words**, with the model and worker it maps to on
 *   this host (`provider`, the host's default: a drafted part's start takes no
 *   choice). A `mechanical` part whose worker has no lighter model (the Codex
 *   table, D-0123) says so rather than promising a saving.
 * - **The grounds** (D-0122 rule 3), each condition in the person's words, the
 *   drafter's own text in its own language, and the messages it rests on.
 * - **Each lap's model, worker and cost**, read off its row: what the tier was
 *   worth when it ran, which is the comparison the person can make.
 */
export function tierBlock(
  wording: Chrome,
  plan: DraftedPlanShown,
  /** The host's default worker, or null where the host said nothing. */
  provider: string | null,
  laps: readonly IterationRecord[],
  chip: (basis: Basis) => unknown,
) {
  const tier = plan.modelTier;
  const known = WORKER_PROVIDERS.find((one) => one === provider);
  const row = tier === null || known === undefined ? null : mapModelTier(tier, known);
  const lighter =
    row?.kind === "selected" && known !== undefined ? row.model !== standardModel(known) : null;
  const grounds = plan.split.grounds ?? [];
  return (
    <section
      class={`tier rounded-md border px-3 py-2 space-y-1.5 ${tier === "standard" ? TONE.muted : TONE.wait}`}
      data-tier={tier ?? ""}
    >
      <p class="text-meta leading-5 font-medium text-muted-foreground">{wording.tierHeading}</p>
      <p class="text-body leading-5 font-semibold text-foreground">
        {wording.tierSaid(tier, lighter)}
      </p>
      {row?.kind === "selected" ? (
        <p class="font-mono text-id leading-5 text-muted-foreground">
          {wording.tierModel(row.model, row.provider)}
        </p>
      ) : null}
      {grounds.length === 0 ? null : (
        <div class="space-y-1">
          <p class="text-meta leading-5 text-muted-foreground">{wording.tierWhy}</p>
          <ul class="space-y-1">
            {grounds.map((ground) => (
              <li class="text-body leading-5 text-foreground">
                <span class="font-medium">{wording.tierCondition(ground.condition)}</span>
                {": "}
                <span lang="">{ground.text}</span>{" "}
                <span class="inline-flex flex-wrap gap-1 align-middle">
                  {ground.bases.map((basis) => chip(basis))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {laps.length === 0 ? null : (
        <div class="space-y-0.5">
          <p class="text-meta leading-5 text-muted-foreground">{wording.tierLapsHeading}</p>
          {laps.map((lap, n) => (
            <p class="font-mono text-id leading-5 text-foreground">
              {wording.tierLap(
                n + 1,
                lap.model,
                lap.workerProvider,
                lap.lapCostUsd === null ? null : money(lap.lapCostUsd),
              )}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

function standardModel(provider: WorkerProvider): string | null {
  const row = mapModelTier("standard", provider);
  return row.kind === "selected" ? row.model : null;
}
