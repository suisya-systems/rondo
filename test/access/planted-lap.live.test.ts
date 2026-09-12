/**
 * D-0065 5.6.2, live: the real reviewer (`runReviewer(reviewerRow(), ...)`,
 * the operator's own codex login) reads the planted lap and its control.
 *
 * Skipped unless `RONDO_MODEL_REVIEW_LIVE=1`, so CI never runs it (D-0029
 * `V-12`). A planted variant passes when the reviewer records a finding at or
 * above `major` whose bases resolved; the control passes when it records none.
 * Every reading's printable lines are logged, for pasting as the measurement.
 */
import { expect, test } from "vitest";

import { runReviewer } from "../../src/access/forge.js";
import { modelReadingLines, modelReadingOf, prepareReview } from "../../src/access/model-review.js";
import { reviewerRow } from "../../src/continuo/roles.js";
import { severityAtOrAbove } from "../../src/store/records.js";
import { CRITERION, LAP_MODEL, plantedMaterial, VARIANTS } from "./planted-lap.js";

const LIVE = process.env.RONDO_MODEL_REVIEW_LIVE === "1";

for (const { name, variant } of VARIANTS) {
  test.skipIf(!LIVE)(
    `live reviewer on the planted lap: ${name}`,
    async () => {
      const reviewer = reviewerRow();
      const material = plantedMaterial(variant);
      const prepared = prepareReview({
        reviewer,
        lapModel: LAP_MODEL,
        criterion: CRITERION,
        material,
      });
      if (prepared.kind !== "ready") {
        throw new Error(`expected ready, got ${JSON.stringify(prepared)}`);
      }
      const run = await runReviewer(reviewer, prepared.document);
      const reading = modelReadingOf({ reviewer, prepared, material, run });
      console.log(
        [
          `=== planted lap: ${name} (p1=${String(variant.p1)}, p2=${String(variant.p2)})`,
          ...modelReadingLines({ ...reading, iterationId: "planted-lap", readAtMs: Date.now() }),
          ...(run.kind === "answered" ? ["--- raw answer", run.finalMessage] : []),
        ].join("\n"),
      );

      expect(reading.verdict).not.toBe("unavailable");
      const atOrAboveMajor = (reading.graded ?? []).filter(
        (g) => severityAtOrAbove(g.severity, "major") && g.basisResolved,
      );
      if (variant.p1 || variant.p2) {
        expect(atOrAboveMajor.length).toBeGreaterThan(0);
      } else {
        expect(
          (reading.graded ?? []).filter((g) => severityAtOrAbove(g.severity, "major")),
        ).toEqual([]);
      }
    },
    20 * 60 * 1000,
  );
}
