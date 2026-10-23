import React, { Component } from "react";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import * as d3 from "d3";
import ContainerDimensions from "react-container-dimensions";
import { Card, Checkbox, Empty, InputNumber, Radio, Select, Space, Spin, Switch, Typography } from "antd";
import { buildCaseReportUrl } from "../../helpers/browseScope";
import { fetchCardinalityData } from "../../helpers/cardinality";

const { Text } = Typography;

// graph columns written by export_cardinality_gos.R; short labels as in the blog strip plot,
// full names on the per-event scatter
const PHASINGS = [
  { key: "chao_allelic", label: "tot ph", name: "Fully Phased", color: "#2ca02c" },
  { key: "chao_fixed", label: "part ph", name: "Partially Phased", color: "#1f77b4" },
  { key: "chao_unphased", label: "unph", name: "Unphased", color: "#ff7f0e" },
];
const AXIS_TITLES = Object.fromEntries(PHASINGS.map((p) => [p.key, `${p.name} Chao`]));
const EVENT_ORDER = [
  "del", "dup", "inv", "tra", "invdup", "qrppos", "qrpmin", "qrpmix", "tic",
  "rigma", "pyrgo", "chromoplexy", "chromothripsis", "bfb", "dm", "tyfonas", "cpxdm",
];
// the strip view pools the reciprocal dups, as in chao_estimate_violin
const stripGroup = (event) =>
  ["qrppos", "qrpmin", "qrpmix"].includes(event) ? "rec dup" : event;
const ALL_EVENTS = "__all__";
const MEAN_CN_VIEW = "__meancn__";    // Chao vs mean copy number, all three phasings
const MAX_CN_VIEW = "__maxcn__";      // Chao vs max copy number, all three phasings
const UNW_CN_VIEW = "__meancnunw__";  // Chao vs unweighted (per-node) mean copy number
// copy-number summaries per event (export_cardinality_gos_meancn.R)
const CN_KEYS = {
  mean_cn: { label: "Mean CN", axis: "Mean total copy number (width-weighted)" },
  mean_cn_unw: { label: "Mean CN (unweighted)", axis: "Mean total copy number (unweighted, per node)" },
  max_cn: { label: "Max CN", axis: "Max total copy number (highest node)" },
};
// allelic LP (CPLEX) status of the pair's allelic graph: 101 optimal, 102 within tolerance,
// 107 time limit (feasible, epgap = relative gap), 111 memory limit
const LP_FILTERS = [
  { value: "all", label: "All LP solves" },
  { value: "noweak", label: "Exclude time limit gap > 0.5 / memory limit" },
  { value: "optimal", label: "Optimal / within tolerance only" },
];
const lpLabel = (row) =>
  row.lp_status == null
    ? "NA"
    : `${row.lp_status}${row.lp_status === 107 && Number.isFinite(row.lp_epgap) ? ` (gap ${d3.format(".2f")(row.lp_epgap)})` : ""}`;
const CN_VIEWS = { [MEAN_CN_VIEW]: "mean_cn", [UNW_CN_VIEW]: "mean_cn_unw", [MAX_CN_VIEW]: "max_cn" };
const MARGIN = { top: 24, right: 24, bottom: 56, left: 72 };
const PLOT_HEIGHT = 520;

// log axes start at 1, as in the R plots (limits = c(1, max))
const isPositive = (v) => Number.isFinite(v) && v >= 1;
const rowKey = (row) => `${row.event}|${row.pair}`;
// stable jitter so dots do not move between renders
const jitter = (key) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000 - 0.5;
};
const fmt = (v) => (Number.isFinite(v) ? d3.format(",.0f")(v) : "NA");

class CardinalityPanel extends Component {
  state = {
    loading: false,
    error: null,
    rows: [],
    event: ALL_EVENTS,
    xKey: "chao_unphased",
    yKey: "chao_fixed",
    hovered: null,
    hidePlaceholder: false,
    cnEvent: ALL_EVENTS,    // event shown in the Chao vs mean CN view
    cnFilter: false,        // CN filter, applies to every plot
    cnFilterKey: "mean_cn", // which CN summary the filter uses
    lpFilter: "all",        // allelic LP solver-status QC filter, applies to every plot
    cnMin: 0,
    cnMax: 4,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.dataset?.cardinalityPath !== this.props.dataset?.cardinalityPath) {
      this.fetchData();
    }
  }

  componentWillUnmount() {
    this.fetchToken = null;
  }

  fetchData = async () => {
    const path = this.props.dataset?.cardinalityPath;
    const token = (this.fetchToken = {});
    if (!path) return;
    this.setState({ loading: true, error: null });
    try {
      const data = await fetchCardinalityData(path);
      if (this.fetchToken !== token) return;
      const rows = data.rows;
      const events = [...new Set(rows.map((row) => row.event))];
      this.setState({
        loading: false,
        rows,
        events: EVENT_ORDER.filter((e) => events.includes(e)).concat(
          events.filter((e) => !EVENT_ORDER.includes(e)).sort()
        ),
        cnEvent: events.includes("chromothripsis") ? "chromothripsis" : ALL_EVENTS,
        generated: data.generated,
      });
    } catch (error) {
      if (this.fetchToken !== token) return;
      this.setState({ loading: false, error: `Could not load ${path}` });
    }
  };

  openCase = (row, event) => {
    const { dataset, browseScope } = this.props;
    const url = buildCaseReportUrl(
      document.location,
      { datasetId: dataset.id, caseReportId: row.pair },
      browseScope
    );
    if (!url) return;
    if (row.location) url.searchParams.set("location", row.location);
    url.searchParams.set("tab", "2"); // Genome View
    // new tab (full load, so the bookmarked location is applied when the case opens)
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  hover = (row, point) => this.setState({ hovered: row ? { row, ...point } : null });

  // rows on pairs whose HMF het pileups are the shared placeholder file can be hidden
  placeholderRows = () =>
    this.state.hidePlaceholder
      ? this.state.rows.filter((row) => !row.het_placeholder)
      : this.state.rows;

  // CN filter on mean or max CN (events without that value drop out while it is on); feeds all plots
  inCnRange = (row) => {
    const { cnFilter, cnFilterKey, cnMin, cnMax } = this.state;
    if (!cnFilter) return true;
    const cn = row[cnFilterKey];
    return Number.isFinite(cn) && (cnMin == null || cn >= cnMin) && (cnMax == null || cn <= cnMax);
  };

  // solver-status QC (rows without a status drop out unless "all")
  passesLp = (row) => {
    const { lpFilter } = this.state;
    if (lpFilter === "all") return true;
    const st = row.lp_status;
    if (lpFilter === "optimal") return st === 101 || st === 102;
    return st === 101 || st === 102 || (st === 107 && Number.isFinite(row.lp_epgap) && row.lp_epgap <= 0.5);
  };

  visibleRows = () => this.placeholderRows().filter((row) => this.inCnRange(row) && this.passesLp(row));

  // placeholder-het pairs are drawn hollow
  renderDot = ({ row, cx, cy, color, highlighted, key }) => (
    <circle
      key={key}
      cx={cx}
      cy={cy}
      r={highlighted ? 5 : 3}
      fill={row.het_placeholder ? "none" : color}
      fillOpacity={highlighted ? 1 : 0.5}
      stroke={highlighted ? "#000" : row.het_placeholder ? color : "none"}
      strokeOpacity={highlighted ? 1 : 0.7}
      style={{ cursor: "pointer", pointerEvents: "all" }}
      onMouseEnter={() => this.hover(row, { cx, cy })}
      onMouseLeave={() => this.hover(null)}
      onClick={(e) => this.openCase(row, e)}
    />
  );

  renderLogAxis = (scale, orientation, width, height) => {
    const ticks = scale.ticks().filter((t) => Number.isInteger(Math.log10(t)));
    const isX = orientation === "x";
    return (
      <g>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={isX ? scale(t) : 0}
              x2={isX ? scale(t) : width}
              y1={isX ? 0 : scale(t)}
              y2={isX ? height : scale(t)}
              stroke="#ebebeb"
            />
            <text
              x={isX ? scale(t) : -8}
              y={isX ? height + 18 : scale(t)}
              textAnchor={isX ? "middle" : "end"}
              dominantBaseline={isX ? "auto" : "middle"}
              fontSize={11}
              fill="#4d4d4d"
            >
              {d3.format(".0e")(t)}
            </text>
          </g>
        ))}
      </g>
    );
  };

  renderScatter = (width) => {
    const { event, xKey, yKey, hovered } = this.state;
    const rows = this.visibleRows();
    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = PLOT_HEIGHT - MARGIN.top - MARGIN.bottom;
    const data = rows.filter(
      (row) => row.event === event && isPositive(row[xKey]) && isPositive(row[yKey])
    );
    const max = d3.max(data, (row) => Math.max(row[xKey], row[yKey])) || 10;
    const x = d3.scaleLog().domain([1, max]).range([0, innerW]).nice().clamp(true);
    const y = d3.scaleLog().domain([1, max]).range([innerH, 0]).nice().clamp(true);
    const [lo, hi] = x.domain();
    // red points above the diagonal on top, as in the per-event pngs
    const sorted = [...data].sort((a, b) => (a[yKey] > a[xKey]) - (b[yKey] > b[xKey]));
    return {
      dropped: rows.filter((row) => row.event === event).length - data.length,
      count: data.length,
      svg: (
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {this.renderLogAxis(x, "x", innerW, innerH)}
          {this.renderLogAxis(y, "y", innerW, innerH)}
          <rect width={innerW} height={innerH} fill="none" stroke="#333" />
          <line x1={x(lo)} y1={y(lo)} x2={x(hi)} y2={y(hi)} stroke="red" strokeDasharray="6 4" />
          {sorted.map((row) =>
            this.renderDot({
              row,
              key: rowKey(row),
              cx: x(row[xKey]),
              cy: y(row[yKey]),
              color: row[yKey] > row[xKey] ? "red" : "black",
              highlighted: hovered && rowKey(hovered.row) === rowKey(row),
            })
          )}
          <text x={innerW / 2} y={innerH + 44} textAnchor="middle" fontSize={13}>
            {AXIS_TITLES[xKey]}
          </text>
          <text
            transform={`translate(${-56},${innerH / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={13}
          >
            {AXIS_TITLES[yKey]}
          </text>
        </g>
      ),
    };
  };

  renderStrip = (width) => {
    const { hovered } = this.state;
    const rows = this.visibleRows();
    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = PLOT_HEIGHT - MARGIN.top - MARGIN.bottom;
    const present = new Set(rows.map((row) => stripGroup(row.event)));
    const groups = [...new Set(EVENT_ORDER.map(stripGroup).concat([...present].sort()))].filter((g) =>
      present.has(g)
    );
    const counts = d3.rollup(rows, (v) => v.length, (row) => stripGroup(row.event));
    const x = d3.scaleBand().domain(groups).range([0, innerW]).padding(0.15);
    const sub = d3
      .scaleBand()
      .domain(PHASINGS.map((p) => p.key))
      .range([0, x.bandwidth()])
      .padding(0.1);
    const max = d3.max(rows, (row) => d3.max(PHASINGS, (p) => (isPositive(row[p.key]) ? row[p.key] : 0))) || 10;
    const y = d3.scaleLog().domain([1, max]).range([innerH, 0]).nice().clamp(true);
    const hoveredKey = hovered && rowKey(hovered.row);
    const dots = [];
    const top = [];
    rows.forEach((row) => {
      PHASINGS.forEach((p) => {
        if (!isPositive(row[p.key])) return;
        const key = `${rowKey(row)}|${p.key}`;
        const dot = {
          row,
          key,
          cx: x(stripGroup(row.event)) + sub(p.key) + sub.bandwidth() * (0.5 + 0.8 * jitter(key)),
          cy: y(row[p.key]),
          color: p.color,
          highlighted: hoveredKey === rowKey(row),
        };
        (dot.highlighted ? top : dots).push(dot);
      });
    });
    return {
      count: rows.length,
      svg: (
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {this.renderLogAxis(y, "y", innerW, innerH)}
          <rect width={innerW} height={innerH} fill="none" stroke="#333" />
          {dots.concat(top).map((dot) => this.renderDot(dot))}
          {groups.map((g) => (
            <g key={g}>
              <text
                x={x(g) + x.bandwidth() / 2}
                y={12}
                textAnchor="middle"
                fontSize={10}
                fill="#4d4d4d"
              >
                n = {counts.get(g)}
              </text>
              <text
                transform={`translate(${x(g) + x.bandwidth() / 2},${innerH + 12}) rotate(-35)`}
                textAnchor="end"
                fontSize={11}
              >
                {g}
              </text>
            </g>
          ))}
          <text
            transform={`translate(${-56},${innerH / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={13}
          >
            Chao1 Estimate
          </text>
        </g>
      ),
    };
  };

  // Chao (log y) vs the event's mean or max total CN (linear x), one dot per phasing
  renderCn = (width, cnKey) => {
    const { cnEvent, hovered } = this.state;
    const rows = this.visibleRows().filter((row) => cnEvent === ALL_EVENTS || row.event === cnEvent);
    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = PLOT_HEIGHT - MARGIN.top - MARGIN.bottom;
    const withCn = rows.filter((row) => Number.isFinite(row[cnKey]));
    const maxCn = d3.max(withCn, (row) => row[cnKey]) || 10;
    const maxChao = d3.max(withCn, (row) => d3.max(PHASINGS, (p) => (isPositive(row[p.key]) ? row[p.key] : 0))) || 10;
    const x = d3.scaleLinear().domain([0, maxCn]).range([0, innerW]).nice();
    const y = d3.scaleLog().domain([1, maxChao]).range([innerH, 0]).nice().clamp(true);
    const hoveredKey = hovered && rowKey(hovered.row);
    const dots = [];
    const top = [];
    withCn.forEach((row) => {
      PHASINGS.forEach((p) => {
        if (!isPositive(row[p.key])) return;
        const dot = {
          row,
          key: `${rowKey(row)}|${p.key}`,
          cx: x(row[cnKey]),
          cy: y(row[p.key]),
          color: p.color,
          highlighted: hoveredKey === rowKey(row),
        };
        (dot.highlighted ? top : dots).push(dot);
      });
    });
    return {
      count: withCn.length,
      dropped: rows.length - withCn.length,
      svg: (
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {this.renderLogAxis(y, "y", innerW, innerH)}
          {x.ticks().map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={0} y2={innerH} stroke="#ebebeb" />
              <text x={x(t)} y={innerH + 18} textAnchor="middle" fontSize={11} fill="#4d4d4d">
                {t}
              </text>
            </g>
          ))}
          <rect width={innerW} height={innerH} fill="none" stroke="#333" />
          {dots.concat(top).map((dot) => this.renderDot(dot))}
          <text x={innerW / 2} y={innerH + 44} textAnchor="middle" fontSize={13}>
            {CN_KEYS[cnKey].axis}
          </text>
          <text
            transform={`translate(${-56},${innerH / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={13}
          >
            Chao1 Estimate
          </text>
        </g>
      ),
    };
  };

  renderTooltip = (width) => {
    const { hovered } = this.state;
    if (!hovered) return null;
    const { row, cx, cy } = hovered;
    const left = MARGIN.left + cx + 12;
    const flip = left + 280 > width;
    return (
      <div
        className="cardinality-tooltip"
        style={{
          position: "absolute",
          top: MARGIN.top + cy + 12,
          left: flip ? undefined : left,
          right: flip ? width - MARGIN.left - cx + 12 : undefined,
        }}
      >
        <div>
          <b>{row.pair}</b> · {row.event} · ev {row.ev_id}
        </div>
        {PHASINGS.map((p) => (
          <div key={p.key}>
            <span style={{ color: p.color }}>●</span> {p.name} Chao: {fmt(row[p.key])}
          </div>
        ))}
        <div>
          mean CN: {Number.isFinite(row.mean_cn) ? d3.format(".2f")(row.mean_cn) : "NA"} · unweighted:{" "}
          {Number.isFinite(row.mean_cn_unw) ? d3.format(".2f")(row.mean_cn_unw) : "NA"} · max CN:{" "}
          {Number.isFinite(row.max_cn) ? d3.format(".2~f")(row.max_cn) : "NA"} · nodes:{" "}
          {fmt(row.n_nodes)} · {row.flag}
        </div>
        <div>allelic LP status: {lpLabel(row)}</div>
        {row.het_placeholder && (
          <div className="cardinality-tooltip-warning">
            HMF het pileups for this pair are the shared placeholder file
          </div>
        )}
        {row.footprint && (
          <div className="cardinality-tooltip-location">footprint {row.footprint}</div>
        )}
        <div className="cardinality-tooltip-hint">
          {row.v2_graphs
            ? "graphs: v2 allelic + unphased subgraphs"
            : "graphs: dataset default (no v2 subgraphs uploaded)"}
        </div>
        <div className="cardinality-tooltip-hint">click to open in a new tab</div>
      </div>
    );
  };

  render() {
    const { dataset } = this.props;
    const { loading, error, rows, events = [], event, xKey, yKey, generated } = this.state;
    if (!dataset?.cardinalityPath) {
      return <Empty description="No cardinality results configured for this dataset" />;
    }
    const isAll = event === ALL_EVENTS;
    const cnView = CN_VIEWS[event];
    const isCn = Boolean(cnView);
    // events in the current plot scope, before / after the CN filter
    const scopeEvent = isCn ? this.state.cnEvent : event;
    const scope = this.placeholderRows().filter((row) => isAll || scopeEvent === ALL_EVENTS || row.event === scopeEvent);
    const shown = scope.filter((row) => this.inCnRange(row) && this.passesLp(row)).length;
    return (
      <Card
        className="cardinality-panel"
        title="Allelic cardinality (Chao1, og hash)"
        extra={generated && <Text type="secondary">generated {generated}</Text>}
      >
        <Space wrap style={{ marginBottom: 16 }}>
          <Select
            style={{ width: 290 }}
            value={event}
            onChange={(value) => this.setState({ event: value, hovered: null })}
            options={[
              { value: ALL_EVENTS, label: "All events (by phasing)" },
              { value: MEAN_CN_VIEW, label: "Chao vs mean CN (by phasing)" },
              { value: UNW_CN_VIEW, label: "Chao vs unweighted mean CN (by phasing)" },
              { value: MAX_CN_VIEW, label: "Chao vs max CN (by phasing)" },
            ].concat(events.map((e) => ({ value: e, label: e })))}
          />
          {isCn && (
            <Select
              style={{ width: 160 }}
              value={this.state.cnEvent}
              onChange={(value) => this.setState({ cnEvent: value, hovered: null })}
              options={[{ value: ALL_EVENTS, label: "All event types" }].concat(
                events.map((e) => ({ value: e, label: e }))
              )}
            />
          )}
          {!isAll && !isCn && (
            <>
              <Text>x</Text>
              <Radio.Group
                size="small"
                value={xKey}
                onChange={(e) => this.setState({ xKey: e.target.value })}
                options={PHASINGS.map((p) => ({ value: p.key, label: p.name }))}
                optionType="button"
              />
              <Text>y</Text>
              <Radio.Group
                size="small"
                value={yKey}
                onChange={(e) => this.setState({ yKey: e.target.value })}
                options={PHASINGS.map((p) => ({ value: p.key, label: p.name }))}
                optionType="button"
              />
            </>
          )}
          <Checkbox
            checked={this.state.hidePlaceholder}
            onChange={(e) => this.setState({ hidePlaceholder: e.target.checked, hovered: null })}
          >
            Hide placeholder-het pairs (
            {(isAll || scopeEvent === ALL_EVENTS ? rows : rows.filter((row) => row.event === scopeEvent)).filter((row) => row.het_placeholder).length}
            , hollow)
          </Checkbox>
          <Select
            size="small"
            style={{ width: 290 }}
            value={this.state.lpFilter}
            onChange={(value) => this.setState({ lpFilter: value, hovered: null })}
            options={LP_FILTERS}
          />
          <Space size="small">
            <Switch
              size="small"
              checked={this.state.cnFilter}
              onChange={(checked) => this.setState({ cnFilter: checked, hovered: null })}
            />
            <Select
              size="small"
              style={{ width: 172 }}
              value={this.state.cnFilterKey}
              onChange={(value) => this.setState({ cnFilterKey: value, hovered: null })}
              options={Object.entries(CN_KEYS).map(([value, k]) => ({ value, label: k.label }))}
            />
            <InputNumber
              size="small"
              style={{ width: 72 }}
              min={0}
              step={0.5}
              placeholder="min"
              value={this.state.cnMin}
              disabled={!this.state.cnFilter}
              onChange={(value) => this.setState({ cnMin: value, hovered: null })}
            />
            <Text>to</Text>
            <InputNumber
              size="small"
              style={{ width: 72 }}
              min={0}
              step={0.5}
              placeholder="max"
              value={this.state.cnMax}
              disabled={!this.state.cnFilter}
              onChange={(value) => this.setState({ cnMax: value, hovered: null })}
            />
            <Text type="secondary">
              {shown} of {scope.length} events shown
            </Text>
            {this.state.cnFilter &&
              this.state.cnMin != null &&
              this.state.cnMax != null &&
              this.state.cnMin > this.state.cnMax && (
                <Text type="danger">min is above max, no events can match</Text>
              )}
          </Space>
          {(isAll || isCn) && (
            <Space size="middle">
              {PHASINGS.map((p) => (
                <Text key={p.key}>
                  <span style={{ color: p.color }}>●</span> {p.label}
                </Text>
              ))}
            </Space>
          )}
        </Space>
        {error && <Empty description={error} />}
        <Spin spinning={loading}>
          {!error && rows.length > 0 && (
            <ContainerDimensions>
              {({ width }) => {
                const { svg, count, dropped } = isAll
                  ? this.renderStrip(width)
                  : isCn
                  ? this.renderCn(width, cnView)
                  : this.renderScatter(width);
                return (
                  <div style={{ position: "relative" }}>
                    <svg width={width} height={PLOT_HEIGHT}>
                      {svg}
                    </svg>
                    {this.renderTooltip(width)}
                    <Text type="secondary">
                      {count} {isAll || isCn ? "events" : "points"}
                      {dropped > 0 &&
                        (isCn
                          ? ` (${dropped} without ${CN_KEYS[cnView].label} not shown)`
                          : ` (${dropped} with NA or < 1 not shown)`)}
                    </Text>
                  </div>
                );
              }}
            </ContainerDimensions>
          )}
        </Spin>
      </Card>
    );
  }
}

const mapStateToProps = (state) => ({
  browseScope: state.Settings.browseScope,
});
export default connect(mapStateToProps)(withTranslation("common")(CardinalityPanel));
