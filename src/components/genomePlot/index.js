import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import { throttle } from "lodash";
import * as d3 from "d3";
import Wrapper from "./index.style";
import Connection from "../../helpers/connection";
import {
  measureText,
  guid,
  k_combinations,
  merge,
} from "../../helpers/utility";
import Grid from "../grid/index";
import settingsActions from "../../redux/settings/actions";

const { updateDomains, updateHoveredLocation } = settingsActions;

const margins = {
  gap: 24,
  gapX: 50,
  bar: 10,
  gapY: 24,
  yTicksCount: 10,
};

export const HAPLOTYPE_COLORS = {
  h1: "#1f77b480",
  h2: "#ff7f0e80",
  unphased: "#80808080",
};

class GenomePlot extends Component {
  constructor(props) {
    super(props);
    this.zoom = null;
    this.container = null;
    this.grid = null;
    let currentTransform = null;
    this.state = {
      currentTransform,
      showGrid: true,
      tooltip: {
        visible: false,
        shapeId: -1,
        x: -1000,
        y: -1000,
        text: "",
      },
    };
    this.rafId = null;
    this.updateDomains = (newDomains) => {
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
      }
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this.props.updateDomains(newDomains);
      });
    };
    this.pendingDomains = null;
  }

  updatePanels() {
    let {
      domains,
      width,
      height,
      commonYScale,
      defaultDomain,
      genome,
      commonRangeY,
    } = this.props;
    // allelic graphs can show one haplotype / allele copy: edges need one end on a shown copy, and
    // edges crossing to the hidden copy are drawn dashed (see crossesHiddenCopy)
    const shown = this.isCopyShown;
    const intervals = genome.intervals.filter(shown);
    const frameConnections = genome.frameConnections.filter(
      (e) =>
        (e.source && shown(e.source.interval)) ||
        (e.sink && shown(e.sink.interval)),
    );
    let stageWidth = width - 2 * margins.gapX;
    let stageHeight = height - 3 * margins.gap;
    let panelWidth =
      (stageWidth - (domains.length - 1) * margins.gapX) / domains.length;
    let panelHeight = stageHeight;
    this.connections = [];
    this.panels = domains.map((domain, index) => {
      let filteredIntervals = intervals.filter(
        (d) => d.startPlace <= domain[1] && d.endPlace >= domain[0],
      );
      const xScale = d3.scaleLinear().domain(domain).range([0, panelWidth]);
      let offset = index * (panelWidth + margins.gapX);

      let domainWidth = domain[1] - domain[0];
      let range = [
        index * (panelWidth + margins.gapX),
        (index + 1) * panelWidth + index * margins.gapX,
      ];
      let scale = d3.scaleLinear().domain(domain).range(range);
      let innerScale = d3.scaleLinear().domain(domain).range([0, panelWidth]);
      let panelGenomeScale = d3
        .scaleLinear()
        .domain(defaultDomain)
        .range([0, panelWidth]);
      let zoom = d3
        .zoom()
        .scaleExtent([1, Infinity])
        .translateExtent([
          [0, 0],
          [panelWidth, panelHeight],
        ])
        .extent([
          [0, 0],
          [panelWidth, panelHeight],
        ])
        .on("zoom", (event) => this.zooming(event, index))
        .on("end", (event) => this.zoomEnded(event, index));
      let intervalMax = d3.max(filteredIntervals, (d) => d.y);
      let offsetPerc = 2;
      let yScale = commonRangeY
        ? d3
            .scaleLinear()
            .domain(commonRangeY)
            .range([panelHeight, 0])
            .clamp(true)
        : d3
            .scaleLinear()
            .domain([0, intervalMax + offsetPerc])
            .range([panelHeight, 0])
            .nice();
      let panel = {
        index,
        zoom,
        domain,
        panelWidth,
        panelHeight,
        xScale,
        yScale,
        panelGenomeScale,
        offset,
        intervals: filteredIntervals.sort((a, b) =>
          d3.ascending(a.weight, b.weight),
        ),
        domainWidth,
        range,
        scale,
        innerScale,
      };
      return panel;
    });

    if (commonYScale) {
      let extent = d3.extent(this.panels.map((d) => d.yScale.domain()).flat());
      let commonYScale = d3
        .scaleLinear()
        .domain(extent)
        .range([panelHeight, 0])
        .clamp(true)
        .nice();
      this.panels.forEach((d) => {
        d.yScale = commonYScale;
      });
    }

    this.panels.forEach((panel, i) => {
      let { domain, scale } = panel;
      frameConnections
        .filter(
          (e, j) =>
            (!e.source ||
              (e.source.place <= domain[1] && e.source.place >= domain[0])) &&
            (!e.sink ||
              (e.sink.place <= domain[1] && e.sink.place >= domain[0])),
        )
        .forEach((conn, j) => {
          let connection = Object.create(
            Object.getPrototypeOf(conn),
            Object.getOwnPropertyDescriptors(conn),
          );
          if (connection.source) {
            connection.source = {
              ...connection.source,
              scale,
              fragment: panel,
            };
          }
          if (connection.sink) {
            connection.sink = { ...connection.sink, scale, fragment: panel };
          }
          connection.fragment = panel;
          connection.touchScale = scale;
          connection.identifier = guid();
          this.connections.push(connection);
        });
    });
    k_combinations(this.panels, 2).forEach((pair, i) => {
      frameConnections
        .filter(
          (e, j) =>
            e.type !== "LOOSE" &&
            ((e.source.place <= pair[0].domain[1] &&
              e.source.place >= pair[0].domain[0] &&
              e.sink.place <= pair[1].domain[1] &&
              e.sink.place >= pair[1].domain[0]) ||
              (e.source.place <= pair[1].domain[1] &&
                e.source.place >= pair[1].domain[0] &&
                e.sink.place <= pair[0].domain[1] &&
                e.sink.place >= pair[0].domain[0])),
        )
        .forEach((conn, j) => {
          let connection = Object.create(
            Object.getPrototypeOf(conn),
            Object.getOwnPropertyDescriptors(conn),
          );
          connection.source = { ...connection.source };
          connection.sink = { ...connection.sink };
          if (
            connection.source.place <= pair[0].domain[1] &&
            connection.source.place >= pair[0].domain[0]
          ) {
            connection.source.scale = pair[0].scale;
            connection.source.fragment = pair[0];
          } else {
            connection.source.scale = pair[1].scale;
            connection.source.fragment = pair[1];
          }
          if (
            connection.sink.place <= pair[0].domain[1] &&
            connection.sink.place >= pair[0].domain[0]
          ) {
            connection.sink.scale = pair[0].scale;
            connection.sink.fragment = pair[0];
          } else {
            connection.sink.scale = pair[1].scale;
            connection.sink.fragment = pair[1];
          }
          connection.identifier = guid();
          this.connections.push(connection);
        });
    });
    let visibleConnections = this.connections.map((d, i) => d.cid);
    this.panels.forEach((fragment, i) => {
      frameConnections
        .filter((e, j) => {
          return (
            e.type !== "LOOSE" &&
            !visibleConnections.includes(e.cid) &&
            ((e.source.place <= fragment.domain[1] &&
              e.source.place >= fragment.domain[0]) ||
              (e.sink.place <= fragment.domain[1] &&
                e.sink.place >= fragment.domain[0]))
          );
        })
        .forEach((con, j) => {
          let connection = Object.assign(new Connection(con), con);
          connection.locateAnchor(fragment);
          this.connections.push(connection);
        });
    });
  }

  // showCopy: "both", "h1" / "h2" (node Haplotype) or "major" / "minor" (node Allele); nodes without
  // that field and unphased (merged) nodes are always shown
  isCopyShown = (d) => {
    const { showCopy } = this.props;
    if (!showCopy || showCopy === "both" || !d) return true;
    const value =
      d.metadata?.[showCopy === "h1" || showCopy === "h2" ? "Haplotype" : "Allele"];
    if (!value || value === "unphased" || value === "NA") return true;
    return value === showCopy;
  };

  crossesHiddenCopy = (d) =>
    (d.source && !this.isCopyShown(d.source.interval)) ||
    (d.sink && !this.isCopyShown(d.sink.interval));

  // allelic graphs: color nodes by the LP's haplotype assignment instead of major / minor
  intervalFill = (d) => {
    if (this.props.colorBy === "haplotype") {
      return HAPLOTYPE_COLORS[d.metadata?.Haplotype] || HAPLOTYPE_COLORS.unphased;
    }
    return d.fill || d.color;
  };

  shouldComponentUpdate(nextProps, nextState) {
    const genomeChanged =
      nextProps.genome.toString() !== this.props.genome.toString();
    const domainsChanged =
      nextProps.domains.toString() !== this.props.domains.toString();
    const tooltipChanged =
      nextState.tooltip.shapeId !== this.state.tooltip.shapeId;
    const annotationChanged = nextProps.annotation !== this.props.annotation;
    const widthChanged = nextProps.width !== this.props.width;
    const heightChanged = nextProps.height !== this.props.height;
    const commonYScaleChanged =
      nextProps.commonYScale !== this.props.commonYScale;
    const commonRangeYChanged =
      nextProps.commonRangeY !== this.props.commonRangeY;
    const colorByChanged = nextProps.colorBy !== this.props.colorBy;
    const showCopyChanged = nextProps.showCopy !== this.props.showCopy;

    return (
      genomeChanged ||
      domainsChanged ||
      tooltipChanged ||
      annotationChanged ||
      widthChanged ||
      heightChanged ||
      commonYScaleChanged ||
      commonRangeYChanged ||
      colorByChanged ||
      showCopyChanged
    );
  }

  componentDidMount() {
    const { domains, zoomedByCmd } = this.props;
    this.panels.forEach((panel, index) => {
      let domain = domains[index];
      var s = [
        panel.panelGenomeScale(domain[0]),
        panel.panelGenomeScale(domain[1]),
      ];
      d3.select(this.container)
        .select(`#panel-rect-${index}`)
        .attr("preserveAspectRatio", "xMinYMin meet")
        .call(
          panel.zoom.filter(
            (event) => !zoomedByCmd || (!event.button && event.metaKey),
          ),
        );
      d3.select(this.container)
        .select(`#panel-rect-${index}`)
        .call(
          panel.zoom.filter(
            (event) => !zoomedByCmd || (!event.button && event.metaKey),
          ).transform,
          d3.zoomIdentity
            .scale(panel.panelWidth / (s[1] - s[0]))
            .translate(-s[0], 0),
        );
    });
  }

  componentDidUpdate(prevProps) {
    const { domains, zoomedByCmd } = this.props;

    const domainsChanged = prevProps.domains.toString() !== domains.toString();
    if (domainsChanged) {
      this.pendingDomains = null;
      this.panels.forEach((panel, index) => {
        let domain = domains[index];
        var s = [
          panel.panelGenomeScale(domain[0]),
          panel.panelGenomeScale(domain[1]),
        ];
        d3.select(this.container)
          .select(`#panel-rect-${index}`)
          .attr("preserveAspectRatio", "xMinYMin meet")
          .call(
            panel.zoom.filter(
              (event) => !zoomedByCmd || (!event.button && event.metaKey),
            ),
          );
        d3.select(this.container)
          .select(`#panel-rect-${index}`)
          .call(
            panel.zoom.filter(
              (event) => !zoomedByCmd || (!event.button && event.metaKey),
            ).transform,
            d3.zoomIdentity
              .scale(panel.panelWidth / (s[1] - s[0]))
              .translate(-s[0], 0),
          );
      });
    }
  }

  componentWillUnmount() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
  }

  zooming(event, index) {
    let panel = this.panels[index];
    let newDomain = event.transform
      .rescaleX(panel.panelGenomeScale)
      .domain()
      .map(Math.round);
    let newDomains = [...this.props.domains];
    let selection = Object.assign([], newDomain);

    let otherSelections = this.props.domains.filter((d, i) => i !== index);
    let lowerEdge = d3.max(
      otherSelections
        .filter(
          (d, i) => selection && d[0] <= selection[0] && selection[0] <= d[1],
        )
        .map((d, i) => d[1]),
    );

    let upperEdge = d3.min(
      otherSelections
        .filter(
          (d, i) => selection && d[1] >= selection[0] && selection[1] <= d[1],
        )
        .map((d, i) => d[0]),
    );

    if (upperEdge !== undefined && selection[1] >= upperEdge) {
      selection[1] = upperEdge;
      selection[0] = d3.min([selection[0], upperEdge - 1]);
    }

    if (lowerEdge !== undefined && selection[0] <= lowerEdge) {
      selection[0] = lowerEdge;
      selection[1] = d3.max([selection[1], lowerEdge + 1]);
    }

    newDomains[index] = selection;

    const newDomainsStr = newDomains.toString();
    const propsDomainsStr = this.props.domains.toString();
    const pendingDomainsStr = this.pendingDomains?.toString();

    if (
      newDomainsStr !== propsDomainsStr &&
      newDomainsStr !== pendingDomainsStr
    ) {
      this.pendingDomains = newDomains;
      this.updateDomains(newDomains);
    }
  }

  zoomEnded(event, index) {
    this.zooming(event, index);
  }

  handleMouseMove = (e) => {
    const { width, height, genome } = this.props;
    const { intervals } = genome;
    let primaryKey = d3.select(e.target) && d3.select(e.target).attr("id");
    let shapeClass = d3.select(e.target) && d3.select(e.target).attr("class");
    let shapeType = d3.select(e.target) && d3.select(e.target).attr("type");
    let shape = null;
    if (primaryKey && shapeClass !== "zoom-background") {
      if (shapeType === "interval") {
        shape = intervals.find((e) => e.primaryKey === primaryKey);
      } else if (shapeType === "connection") {
        shape = this.connections.find((e) => e.primaryKey === primaryKey);
      }
      if (shape) {
        let diffY = d3.min([
          0,
          height -
            e.nativeEvent.offsetY -
            shape.tooltipContent.length * 16 -
            12,
        ]);
        let diffX = d3.min([
          0,
          width -
            e.nativeEvent.offsetX -
            d3.max(shape.tooltipContent, (d) =>
              measureText(`${d.label}: ${d.value}`, 12),
            ) -
            30,
        ]);
        this.state.tooltip.shapeId !== shape.primaryKey &&
          this.setState({
            tooltip: {
              shapeId: shape.primaryKey,
              visible: true,
              x: e.nativeEvent.offsetX + diffX,
              y: e.nativeEvent.offsetY + diffY,
              text: shape.tooltipContent,
            },
          });
      }
    } else {
      this.state.tooltip.visible &&
        this.setState({ tooltip: { shapeId: null, visible: false } });
    }
  };

  handleConnectionClick(event, connection, padding = 100, padWidth = 5) {
    if (connection.kind === "ANCHOR") {
      let newDomain = [
        Math.floor(connection.otherEnd.place - padding),
        Math.floor(connection.otherEnd.place + padding),
      ];
      let newDomains = [...this.props.domains];
      newDomains.push(newDomain);
      let merged = merge(
        newDomains
          .map((d) => {
            return { startPlace: d[0], endPlace: d[1] };
          })
          .sort((a, b) => d3.ascending(a.startPlace, b.startPlace)),
      );
      this.updateDomains(merged.map((d) => [d.startPlace, d.endPlace]));
    } else if (connection.type !== "LOOSE") {
      let newDomains = [
        [connection.origin - padding, connection.origin + padding],
        [connection.target - padding, connection.target + padding],
      ];
      let merged = merge(
        newDomains
          .map((d) => {
            return { startPlace: d[0], endPlace: d[1] };
          })
          .sort((a, b) => d3.ascending(a.startPlace, b.startPlace)),
      );
      this.updateDomains(merged.map((d) => [d.startPlace, d.endPlace]));
    }
  }

  handleIntervalClick(panelIndex, shape, padding = 1000) {
    let newDomains = JSON.parse(JSON.stringify(this.props.domains));
    newDomains[panelIndex] = [
      shape.startPlace - padding,
      shape.endPlace + padding,
    ];
    this.updateDomains(newDomains);
  }

  handleMutationClick(panelIndex, shape, padding = 30) {
    let newDomains = JSON.parse(JSON.stringify(this.props.domains));
    let midPoint = Math.floor((shape.startPlace + shape.endPlace) / 2);
    newDomains[panelIndex] = [midPoint - padding - 2, midPoint + padding];
    this.updateDomains(newDomains);
  }

  handlePanelMouseMove = throttle(
    (e, panelIndex) => {
      if (panelIndex > -1) {
        this.props.updateHoveredLocation(
          this.panels[panelIndex].xScale.invert(d3.pointer(e)[0]),
          panelIndex,
        );
      }
    },
    16,
    { leading: true, trailing: false },
  );

  handlePanelMouseOut = (e, panelIndex) => {
    if (panelIndex > -1) {
      this.props.updateHoveredLocation(null, panelIndex);
    }
  };

  render() {
    const { width, height, annotation, yAxisTitle, yAxis2Title, chromoBins } =
      this.props;
    const { stageWidth, stageHeight, tooltip } = this.state;
    this.updatePanels();
    let randID = Math.random();

    const result = (
      <Wrapper className="ant-wrapper">
        <svg
          width={width}
          height={height}
          onMouseMove={(e) => this.handleMouseMove(e)}
          ref={(elem) => (this.container = elem)}
        >
          <defs>
            <clipPath
              key={`cuttOffViewPane-${randID}`}
              id={`cuttOffViewPane-${randID}`}
            >
              <rect x={0} y={0} width={stageWidth} height={stageHeight} />
            </clipPath>
            {this.panels.map((panel, i) => (
              <clipPath
                key={`cuttOffViewPane-${randID}-${panel.index}`}
                id={`cuttOffViewPane-${randID}-${panel.index}`}
              >
                <rect
                  x={0}
                  y={0}
                  width={panel.panelWidth}
                  height={2 * panel.panelHeight}
                />
              </clipPath>
            ))}
            <pattern
              id={`crossgrad-${randID}`}
              width="80"
              height="80"
              patternUnits="userSpaceOnUse"
            >
              <rect fill="#A020F0" x="0" y="0" width="40" height="80" />
              <rect fill="#79b321" x="40" y="0" width="40" height="80" />
            </pattern>
            <pattern
              id={`diagonalHatch-${randID}`}
              patternUnits="userSpaceOnUse"
              width="20"
              height="20"
              patternTransform="rotate(45)"
            >
              <line
                x1="5"
                y="0"
                x2="5"
                y2="20"
                stroke="#7F7FFF"
                strokeWidth="10"
              />
              <line
                x1="15"
                y="0"
                x2="15"
                y2="20"
                stroke="#FF938D"
                strokeWidth="10"
              />
            </pattern>
            <pattern
              id={`diagonalHatchHaplotype-${randID}`}
              patternUnits="userSpaceOnUse"
              width="20"
              height="20"
              patternTransform="rotate(45)"
            >
              <line
                x1="5"
                y="0"
                x2="5"
                y2="20"
                stroke="#8FBBDA"
                strokeWidth="10"
              />
              <line
                x1="15"
                y="0"
                x2="15"
                y2="20"
                stroke="#FFBF87"
                strokeWidth="10"
              />
            </pattern>
          </defs>
          <text
            className="y-axis-title"
            transform={`translate(${[margins.gapX / 2, margins.gapY / 3]})`}
          >
            {yAxisTitle}
          </text>
          <text
            className="y-axis-title"
            transform={`translate(${[width, margins.gapY / 3]})`}
            textAnchor="end"
          >
            {yAxis2Title}
          </text>
          <g transform={`translate(${[margins.gapX, margins.gap]})`}>
            {this.panels.map((panel, i) => (
              <g
                key={`panel-${panel.index}`}
                id={`panel-${panel.index}`}
                transform={`translate(${[panel.offset, 0]})`}
              >
                <g ref={(elem) => (this.grid = elem)}>
                  <Grid
                    scaleX={panel.xScale}
                    scaleY={panel.yScale}
                    axisWidth={panel.panelWidth}
                    axisHeight={panel.panelHeight}
                    chromoBins={chromoBins}
                  />
                </g>
                <rect
                  className="zoom-background"
                  id={`panel-rect-${panel.index}`}
                  x={0.5}
                  width={panel.panelWidth}
                  height={panel.panelHeight}
                  onMouseMove={(e) => this.handlePanelMouseMove(e, i)}
                  onMouseOut={(e) => this.handlePanelMouseOut(e, i)}
                  style={{
                    stroke: "steelblue",
                    fill: "transparent",
                    strokeWidth: 0,
                    opacity: 0.375,
                    pointerEvents: "all",
                  }}
                />
                <g clipPath={`url(#cuttOffViewPane-${randID}-${panel.index})`}>
                  {panel.intervals.map((d, i) => (
                    <rect
                      id={d.primaryKey}
                      type="interval"
                      key={i}
                      className={`shape ${
                        d.primaryKey === tooltip.shapeId ? "highlighted" : ""
                      } ${
                        annotation && d.annotationArray.includes(annotation)
                          ? "annotated"
                          : ""
                      }`}
                      transform={`translate(${[
                        d3.max([panel.xScale(d.startPlace), 0]),
                        panel.yScale(d.y) - 0.5 * margins.bar,
                      ]})`}
                      width={d3.min([
                        panel.xScale(d.endPlace) -
                          d3.max([panel.xScale(d.startPlace), 0]),
                        panel.panelWidth,
                      ])}
                      data-start-place={d.startPlace}
                      data-end-place={d.endPlace}
                      data-end-pos={panel.xScale(d.endPlace)}
                      data-x={Math.floor(panel.xScale(d.startPlace))}
                      data-width={Math.floor(
                        panel.xScale(d.endPlace) - panel.xScale(d.startPlace),
                      )}
                      height={margins.bar}
                      style={{
                        // with one copy shown, balanced nodes no longer overlap their partner
                        fill: d.overlapping && (this.props.showCopy || "both") === "both"
                          ? this.props.colorBy === "haplotype"
                            ? `url(#diagonalHatchHaplotype-${randID})`
                            : `url(#diagonalHatch-${randID})`
                          : this.intervalFill(d),
                        stroke: d.stroke,
                        strokeWidth: 1,
                      }}
                      onClick={(event) =>
                        this.handleIntervalClick(panel.index, d)
                      }
                    />
                  ))}
                </g>
              </g>
            ))}
            <g clipPath="url(#cuttOffViewPaneii)">
              {this.connections.map((d, i) => (
                <path
                  id={d.primaryKey}
                  type="connection"
                  key={d.identifier}
                  transform={d.transform}
                  className={`connection ${
                    d.primaryKey === tooltip.shapeId ? "highlighted" : ""
                  } ${
                    annotation &&
                    d.annotationArray.includes(annotation) &&
                    "annotated"
                  }`}
                  d={d.render}
                  onClick={(event) => this.handleConnectionClick(event, d)}
                  style={{
                    fill: d.fill,
                    stroke: d.color,
                    strokeWidth: d.strokeWidth,
                    strokeDasharray: this.crossesHiddenCopy(d) ? "6 4" : d.dash,
                    opacity: this.crossesHiddenCopy(d) ? 0.5 : d.opacity,
                    pointerEvents: "all",
                  }}
                />
              ))}
            </g>
          </g>
          {tooltip.visible && (
            <g
              className="tooltip"
              transform={`translate(${[tooltip.x, tooltip.y]})`}
              pointerEvents="none"
            >
              <rect
                x="0"
                y="0"
                width={d3.max(
                  tooltip.text,
                  (d) => measureText(`${d.label}: ${d.value}`, 12) + 30,
                )}
                height={tooltip.text.length * 16 + 12}
                rx="5"
                ry="5"
                fill="rgb(97, 97, 97)"
                fillOpacity="0.67"
              />
              <text x="10" y="28" fontSize="12" fill="#FFF">
                {tooltip.text.map((d, i) => (
                  <tspan key={i} x={10} y={18 + i * 16}>
                    <tspan fontWeight="bold">{d.label}</tspan>: {d.value}
                  </tspan>
                ))}
              </text>
            </g>
          )}
        </svg>
      </Wrapper>
    );
    return result;
  }
}
GenomePlot.propTypes = {
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  xDomain: PropTypes.array,
  defaultDomain: PropTypes.array,
  genome: PropTypes.object,
  title: PropTypes.string,
  chromoBins: PropTypes.object,
  updateDomain: PropTypes.func,
  annotation: PropTypes.string,
};
GenomePlot.defaultProps = {
  xDomain: [],
  defaultDomain: [],
  commonYScale: false,
  yAxisTitle: "",
  yAxis2Title: "",
  commonRangeY: null,
};
const mapDispatchToProps = (dispatch) => ({
  updateDomains: (domains) => dispatch(updateDomains(domains)),
  updateHoveredLocation: (hoveredLocation, panelIndex) =>
    dispatch(updateHoveredLocation(hoveredLocation, panelIndex)),
});
const mapStateToProps = (state) => ({
  chromoBins: state.Settings.chromoBins,
  defaultDomain: state.Settings.defaultDomain,
  domains: state.Settings.domains,
  zoomedByCmd: state.Settings.zoomedByCmd,
  hoveredLocation: state.Settings.hoveredLocation,
  hoveredLocationPanelIndex: state.Settings.hoveredLocationPanelIndex,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(withTranslation("common")(GenomePlot));
