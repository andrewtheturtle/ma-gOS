import axios from "axios";

// the cardinality json (export_cardinality_gos.R), cached per path so the Cardinality tab and the case
// header share one download
const dataCache = {};
export const fetchCardinalityData = (path) => {
  if (!dataCache[path]) {
    dataCache[path] = axios
      .get(path)
      .then(({ data }) => ({ ...data, rows: (data.rows || []).filter((row) => row.pair && row.event) }))
      .catch((error) => {
        delete dataCache[path];
        throw error;
      });
  }
  return dataCache[path];
};

// "19:100-200|9:5-6" or "11:1-2+,11:3-4+" -> [{ chr, start, end }]
const REGION = /([^:,|\s]+):(\d+)-(\d+)/g;
export const parseRegions = (text) =>
  [...(text || "").matchAll(REGION)].map((m) => ({
    chr: m[1].replace(/^chr/, ""),
    start: +m[2],
    end: +m[3],
  }));

const overlaps = (a, b) =>
  a.some((x) => b.some((y) => x.chr === y.chr && x.start <= y.end && y.start <= x.end));

// Chao1 (og hash) of fully phased / partially phased / unphased graph, "totph/partph/unph"
export const formatChao = (row) =>
  [row.chao_allelic, row.chao_fixed, row.chao_unphased]
    .map((v) => (Number.isFinite(v) ? Math.round(v) : "NA"))
    .join("/");

// the pair's events the case view is showing: those whose footprint overlaps the current genome location
// (the cardinality tab opens a case on the event window), else every chromothripsis event of the pair
export const eventsInView = (rows, pair, location) => {
  const own = (rows || []).filter((row) => row.pair === pair);
  const view = parseRegions(location);
  const inView = view.length ? own.filter((row) => overlaps(parseRegions(row.footprint), view)) : [];
  return inView.length ? inView : own.filter((row) => row.event === "chromothripsis");
};
