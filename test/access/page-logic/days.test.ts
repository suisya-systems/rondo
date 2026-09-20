/**
 * Where a request sits on the time axis (DECISIONS.md D-0083 rule 2).
 *
 * The cut is what replaces `D-0082` rule 1's status groups, so these cases are
 * about the one property that replacement rests on: a day heading stays true
 * of the row under it, whatever that row's work is doing.
 *
 * The moments are built with `new Date(y, m, d, ...)`, which is local time --
 * the same zone `dayCut` reads boundaries in -- so these cases say the same
 * thing wherever they run.
 */
import { expect, test } from "vitest";
import { byDay, dayCut } from "../../../src/access/page-logic/days.js";

/** A local moment, so the case and the cut agree about where a day starts. */
const at = (y: number, m: number, d: number, h = 12, min = 0): number =>
  new Date(y, m - 1, d, h, min).getTime();

const NOW = at(2026, 9, 20, 10, 0);

test("the cut is the calendar day and not the hours since", () => {
  expect(dayCut(at(2026, 9, 20, 9, 59), NOW)).toBe("today");
  // **Ten minutes earlier, and a day older**: 23:50 last night is yesterday at
  // 00:10, which is what a reader means and what elapsed hours would not say.
  expect(dayCut(at(2026, 9, 19, 23, 50), at(2026, 9, 20, 0, 10))).toBe("yesterday");
  expect(dayCut(at(2026, 9, 20, 0, 1), at(2026, 9, 20, 23, 59))).toBe("today");
});

test("the groups are today, yesterday, the rest of the week, the month, then older", () => {
  expect(dayCut(at(2026, 9, 20), NOW)).toBe("today");
  expect(dayCut(at(2026, 9, 19), NOW)).toBe("yesterday");
  expect(dayCut(at(2026, 9, 18), NOW)).toBe("lastWeek");
  expect(dayCut(at(2026, 9, 13), NOW)).toBe("lastWeek");
  // The seventh day back is still the week; the eighth is the month.
  expect(dayCut(at(2026, 9, 12), NOW)).toBe("month");
  expect(dayCut(at(2026, 8, 21), NOW)).toBe("month");
  expect(dayCut(at(2026, 8, 19), NOW)).toBe("older");
});

test("a request from the future reads as today rather than as a day that has not happened", () => {
  // A clock set back, or a row written a second ahead. It is the reader's
  // present either way.
  expect(dayCut(at(2026, 9, 21), NOW)).toBe("today");
  expect(dayCut(at(2027, 1, 1), NOW)).toBe("today");
});

test("the list is grouped newest first, and a heading over nothing is not drawn", () => {
  const rows = [
    { name: "older", ms: at(2026, 8, 1) },
    { name: "today-early", ms: at(2026, 9, 20, 8) },
    { name: "today-late", ms: at(2026, 9, 20, 9, 30) },
    { name: "yesterday", ms: at(2026, 9, 19) },
  ];
  const groups = byDay(rows, (row) => row.ms, NOW);
  expect(groups.map((group) => group.cut)).toEqual(["today", "yesterday", "older"]);
  // Newest first inside the group.
  expect(groups[0]?.rows.map((row) => row.name)).toEqual(["today-late", "today-early"]);
  // `lastWeek` and `month` hold nothing here, so neither is a heading.
  expect(groups.map((group) => group.cut)).not.toContain("lastWeek");
  expect(groups.map((group) => group.cut)).not.toContain("month");
});

test("an empty list is no groups at all", () => {
  expect(byDay([], () => 0, NOW)).toEqual([]);
});
