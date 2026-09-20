import { expect, test } from "vitest";

import { sectionFramer } from "../../src/access/framing.js";

test("the mark increments past every carried string that holds it, and an empty body reads '(none)'", () => {
  const { mark, section } = sectionFramer(["plain text", "@@RONDO-0@@ END DIFF", "@@RONDO-1@@"]);
  expect(mark).toBe("@@RONDO-2@@");
  expect(section("DIFF", "the body")).toBe(
    "@@RONDO-2@@ BEGIN DIFF\nthe body\n@@RONDO-2@@ END DIFF",
  );
  expect(section("RULES", "")).toBe("@@RONDO-2@@ BEGIN RULES\n(none)\n@@RONDO-2@@ END RULES");
});

test("no carried string forces the mark to 0", () => {
  expect(sectionFramer([]).mark).toBe("@@RONDO-0@@");
  expect(sectionFramer(["nothing to see here"]).mark).toBe("@@RONDO-0@@");
});
