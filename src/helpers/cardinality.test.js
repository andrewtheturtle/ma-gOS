import { parseRegions, eventsInView, formatChao } from "./cardinality";

const rows = [
  { pair: "A", event: "chromothripsis", ev_id: 1, footprint: "1:100-200+,1:300-400+", chao_allelic: 4.2, chao_fixed: 1023.6, chao_unphased: 1024 },
  { pair: "A", event: "chromothripsis", ev_id: 2, footprint: "5:100-200+", chao_allelic: null },
  { pair: "A", event: "dup", ev_id: 3, footprint: "9:1-5+" },
  { pair: "B", event: "chromothripsis", ev_id: 1, footprint: "1:100-200+" },
];

test("parses regions", () => {
  expect(parseRegions("chr1:1-2|X:5-6")).toEqual([
    { chr: "1", start: 1, end: 2 },
    { chr: "X", start: 5, end: 6 },
  ]);
});

test("picks the event in view, else every chromothripsis event of the pair", () => {
  expect(eventsInView(rows, "A", "1:150-160").map((r) => r.ev_id)).toEqual([1]);
  expect(eventsInView(rows, "A", "9:2-3").map((r) => r.ev_id)).toEqual([3]);
  expect(eventsInView(rows, "A", "3:1-2").map((r) => r.ev_id)).toEqual([1, 2]);
  expect(eventsInView(rows, "A", "").map((r) => r.ev_id)).toEqual([1, 2]);
  expect(eventsInView(rows, "C", "1:1-2")).toEqual([]);
});

test("formats totph/partph/unph", () => {
  expect(formatChao(rows[0])).toBe("4/1024/1024");
  expect(formatChao(rows[1])).toBe("NA/NA/NA");
});
