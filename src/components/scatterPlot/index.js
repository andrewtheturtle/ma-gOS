import React, { Component } from "react";
import { PropTypes } from "prop-types";
import * as d3 from "d3";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import { throttle } from "lodash";
import { Button, Form, InputNumber, Modal, Space, Typography } from "antd";
import {
  computeQuantileThreshold,
  findMaxInRanges,
  findMinInRanges,
} from "../../helpers/utility";
import Grid from "../grid/index";
import Points from "./points";
import Wrapper from "./index.style";
import settingsActions from "../../redux/settings/actions";

const { updateDomains, updateHoveredLocation } = settingsActions;

const margins = {
  gapX: 50,
  gapY: 24,
};

class ScatterPlot extends Component {
  regl = null;
  container = null;
  plotContainer = null;
  zoom = null;
  extentDataPointsY1 = null;
  extentDataPointsY2 = null;
  _extentDataPointsY1Data = null;
  _extentDataPointsY2Data = null;
  minY1Values = null;
  maxY1Values = null;
  maxY2Values = null;

  _globalLowerOutlierThresholdY1 = null;
  _globalOutlierThresholdY1 = null;
  _globalOutlierThresholdY2 = null;
  _outlierThresholdDataY1 = null;
  _outlierThresholdDataY2 = null;
  yBoundsFormRef = React.createRef();

  constructor(props) {
    super(props);

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
    this.state = {
      manualYBounds: null,
      yBoundsModalVisible: false,
      yBoundsInitialValues: { lower: null, upper: null },
      yBoundsModalKey: 0,
    };
  }

  componentDidMount() {
    this.regl = require("regl")({
      extensions: [
        "ANGLE_instanced_arrays",
        "OES_texture_float",
        "OES_texture_float_linear",
      ],
      container: this.container,
      pixelRatio: 2.0,
      attributes: {
        antialias: true,
        depth: true,
        stencil: false,
        // keep the last frame so "Download as PNG" (html-to-image) can copy the canvas
        preserveDrawingBuffer: true,
      },
    });

    this.regl.on("lost", () => {
      console.log("lost webgl context");
    });

    this.regl.on("restore", () => {
      console.log("webgl context restored");
      this.points = new Points(this.regl, margins.gapX, 0);
      this.updateStage(true);
    });

    this.points = new Points(this.regl, margins.gapX, 0);

    const { domains, zoomedByCmd } = this.props;
    this.panels.forEach((panel, index) => {
      let domain = domains[index];
      var s = [
        panel.panelGenomeScale(domain[0]),
        panel.panelGenomeScale(domain[1]),
      ];
      d3.select(this.plotContainer)
        .select(`#panel-rect-${index}`)
        .attr("preserveAspectRatio", "xMinYMin meet")
        .call(
          panel.zoom.filter(
            (event) => !zoomedByCmd || (!event.button && event.metaKey)
          )
        );
      d3.select(this.plotContainer)
        .select(`#panel-rect-${index}`)
        .call(
          panel.zoom.filter(
            (event) => !zoomedByCmd || (!event.button && event.metaKey)
          ).transform,
          d3.zoomIdentity
            .scale(panel.panelWidth / (s[1] - s[0]))
            .translate(-s[0], 0)
        );
    });

    this.updateStage(true);
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (nextState !== this.state) return true;

    const dataPointsColorChanged =
      nextProps.dataPointsColor.length !== this.props.dataPointsColor.length;
    const dataPointsChanged =
      nextProps.dataPointsY1 !== this.props.dataPointsY1 ||
      nextProps.dataPointsY2 !== this.props.dataPointsY2 ||
      nextProps.dataPointsX !== this.props.dataPointsX ||
      nextProps.dataPointsXHigh !== this.props.dataPointsXHigh ||
      nextProps.dataPointsXLow !== this.props.dataPointsXLow ||
      nextProps.dataPointsColor !== this.props.dataPointsColor;
    const domainsChanged =
      nextProps.domains.toString() !== this.props.domains.toString();
    const widthChanged = nextProps.width !== this.props.width;
    const heightChanged = nextProps.height !== this.props.height;
    const commonRangeYChanged =
      nextProps.commonRangeY !== this.props.commonRangeY;

    return (
      dataPointsColorChanged ||
      dataPointsChanged ||
      domainsChanged ||
      widthChanged ||
      heightChanged ||
      commonRangeYChanged
    );
  }

  componentDidUpdate(prevProps, prevState) {
    const { domains, zoomedByCmd } = this.props;
    const dataPointsChanged =
      prevProps.dataPointsY1 !== this.props.dataPointsY1 ||
      prevProps.dataPointsY2 !== this.props.dataPointsY2 ||
      prevProps.dataPointsX !== this.props.dataPointsX ||
      prevProps.dataPointsXHigh !== this.props.dataPointsXHigh ||
      prevProps.dataPointsXLow !== this.props.dataPointsXLow ||
      prevProps.dataPointsColor !== this.props.dataPointsColor;

    if (dataPointsChanged && this.state.manualYBounds) {
      this.setState({ manualYBounds: null, yBoundsModalVisible: false });
    }

    const domainsChanged = prevProps.domains.toString() !== domains.toString();
    if (domainsChanged) {
      this.pendingDomains = null;
      this.panels.forEach((panel, index) => {
        let domain = domains[index];
        var s = [
          panel.panelGenomeScale(domain[0]),
          panel.panelGenomeScale(domain[1]),
        ];
        d3.select(this.plotContainer)
          .select(`#panel-rect-${index}`)
          .attr("preserveAspectRatio", "xMinYMin meet")
          .call(
            panel.zoom.filter(
              (event) => !zoomedByCmd || (!event.button && event.metaKey)
            )
          );
        d3.select(this.plotContainer)
          .select(`#panel-rect-${index}`)
          .call(
            panel.zoom.filter(
              (event) => !zoomedByCmd || (!event.button && event.metaKey)
            ).transform,
            d3.zoomIdentity
              .scale(panel.panelWidth / (s[1] - s[0]))
              .translate(-s[0], 0)
          );
      });
    }

    if (
      prevProps?.width !== this.props.width ||
      prevProps?.height !== this.props.height
    ) {
      this.componentWillUnmount();
      this.componentDidMount();
    } else {
      this.updateStage(
        dataPointsChanged ||
          (prevProps.commonRangeY === null &&
            this.props.commonRangeY !== null) ||
          (prevProps.commonRangeY !== null && this.props.commonRangeY === null)
      );
    }
  }

  componentWillUnmount() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }

    try {
      if (this.regl) {
        this.regl.destroy();
        this.regl._gl.clear(this.regl._gl.COLOR_BUFFER_BIT);
        this.regl._gl.clear(this.regl._gl.DEPTH_BUFFER_BIT);
        this.regl._gl.clear(this.regl._gl.STENCIL_BUFFER_BIT);
      }
    } catch (err) {
      console.log(`Scatterplot webgl failed with error: ${err}`);
    }
  }

  getActiveManualYBounds() {
    return this.props.commonRangeY ? null : this.state.manualYBounds;
  }

  getDefaultYExtent(index) {
    const lower = this.minY1Values?.[index];
    const upper = this.maxY1Values?.[index];

    if (Number.isFinite(lower) && Number.isFinite(upper)) {
      return [Math.floor(lower), Math.ceil(upper)];
    }

    return [0, 1];
  }

  getYDomains(domains) {
    const { commonRangeY } = this.props;
    const manualYBounds = this.getActiveManualYBounds();

    if (commonRangeY) {
      return domains.map(() => commonRangeY);
    }

    if (manualYBounds) {
      return domains.map(() => manualYBounds);
    }

    return domains.map((d, index) => this.getDefaultYExtent(index));
  }

  getPanelYExtent(index) {
    const { commonRangeY } = this.props;
    const manualYBounds = this.getActiveManualYBounds();

    if (commonRangeY) return commonRangeY;
    if (manualYBounds) return manualYBounds;

    return this.getDefaultYExtent(index);
  }

  getModalInitialYBounds(panelIndex) {
    const manualYBounds = this.state.manualYBounds;
    if (manualYBounds) return manualYBounds;

    const panelDomain = this.panels?.[panelIndex]?.yScale1?.domain?.();
    if (panelDomain?.every((d) => Number.isFinite(d))) {
      return panelDomain;
    }

    return this.getDefaultYExtent(panelIndex);
  }

  handleYAxisClick = (panelIndex) => {
    if (this.props.commonRangeY) return;

    const [lower, upper] = this.getModalInitialYBounds(panelIndex);

    this.setState({
      yBoundsModalVisible: true,
      yBoundsInitialValues: { lower, upper },
      yBoundsModalKey: Date.now(),
    });
  };

  handleYBoundsModalCancel = () => {
    this.setState({ yBoundsModalVisible: false });
  };

  handleYBoundsSubmit = ({ lower, upper }) => {
    this.setState({
      manualYBounds: [Number(lower), Number(upper)],
      yBoundsModalVisible: false,
    });
  };

  handleYBoundsReset = () => {
    this.setState({
      manualYBounds: null,
      yBoundsModalVisible: false,
    });
  };

  validateYBound = (fieldName, otherFieldName) => (_, value) => {
    const fieldLabel = fieldName === "lower" ? "Lower bound" : "Upper bound";

    if (value === null || value === undefined || value === "") {
      return Promise.reject(new Error(`${fieldLabel} is required.`));
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return Promise.reject(new Error(`${fieldLabel} must be a finite number.`));
    }

    const otherValue = this.yBoundsFormRef.current?.getFieldValue(otherFieldName);
    const hasOtherValue =
      otherValue !== null && otherValue !== undefined && otherValue !== "";

    if (hasOtherValue) {
      const numericOtherValue = Number(otherValue);
      if (Number.isFinite(numericOtherValue)) {
        if (fieldName === "lower" && numericValue >= numericOtherValue) {
          return Promise.reject(
            new Error("Lower bound must be less than upper bound.")
          );
        }

        if (fieldName === "upper" && numericValue <= numericOtherValue) {
          return Promise.reject(
            new Error("Upper bound must be greater than lower bound.")
          );
        }
      }
    }

    return Promise.resolve();
  };

  renderYBoundsModal() {
    const { yAxisTitle } = this.props;
    const { manualYBounds, yBoundsInitialValues, yBoundsModalKey } = this.state;

    return (
      <Modal
        title={`Set ${yAxisTitle || "Y-axis"} bounds`}
        open={this.state.yBoundsModalVisible}
        onCancel={this.handleYBoundsModalCancel}
        destroyOnClose
        width={360}
        footer={
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Button disabled={!manualYBounds} onClick={this.handleYBoundsReset}>
              Reset to default
            </Button>
            <Space>
              <Button onClick={this.handleYBoundsModalCancel}>Cancel</Button>
              <Button
                type="primary"
                onClick={() => this.yBoundsFormRef.current?.submit()}
              >
                Apply
              </Button>
            </Space>
          </div>
        }
      >
        <Typography.Paragraph type="secondary">
          Manual bounds apply to all visible panes for this track. Points outside
          the selected interval will be hidden.
        </Typography.Paragraph>
        <Form
          key={yBoundsModalKey}
          ref={this.yBoundsFormRef}
          layout="vertical"
          initialValues={yBoundsInitialValues}
          onFinish={this.handleYBoundsSubmit}
        >
          <Form.Item
            label="Lower bound"
            name="lower"
            dependencies={["upper"]}
            rules={[{ validator: this.validateYBound("lower", "upper") }]}
          >
            <InputNumber style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            label="Upper bound"
            name="upper"
            dependencies={["lower"]}
            rules={[{ validator: this.validateYBound("upper", "lower") }]}
          >
            <InputNumber style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    );
  }

  getPointsData() {
    const {
      dataPointsXHigh,
      dataPointsXLow,
      dataPointsY1,
      dataPointsColor,
    } = this.props;

    // Always use Y1 (Est. CN) data for consistent point rendering
    // The second Y-axis (Base Coverage) is just for reference
    return {
      xHigh: dataPointsXHigh,
      xLow: dataPointsXLow,
      y: dataPointsY1,
      color: dataPointsColor,
    };
  }

  updateStage(reloadData = false) {
    const { domains, width, height } = this.props;

    const stageWidth = width - 2 * margins.gapX;
    const stageHeight = height - 3 * margins.gapY;

    if (reloadData) {
      const pointsData = this.getPointsData();
      this.points.setData(
        pointsData.xHigh,
        pointsData.xLow,
        pointsData.y,
        pointsData.color
      );
    }

    this.points.updateDomains(
      stageWidth,
      stageHeight,
      domains,
      this.getYDomains(domains),
      !!this.getActiveManualYBounds()
    );

    this.points.render();
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
          (d, i) => selection && d[0] <= selection[0] && selection[0] <= d[1]
        )
        .map((d, i) => d[1])
    );

    let upperEdge = d3.min(
      otherSelections
        .filter(
          (d, i) => selection && d[1] >= selection[0] && selection[1] <= d[1]
        )
        .map((d, i) => d[0])
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

  handleMouseMove = throttle(
    (e, panelIndex) => {
      this.props.updateHoveredLocation(
        this.panels[panelIndex].xScale.invert(d3.pointer(e)[0]),
        panelIndex
      );
    },
    16,
    { leading: true, trailing: false }
  );

  handleMouseOut = (e, panelIndex) => {
    this.props.updateHoveredLocation(null, panelIndex);
  };

  render() {
    const {
      width,
      height,
      domains,
      chromoBins,
      defaultDomain,
      yAxisTitle,
      yAxis2Title,
      dataPointsY1,
      dataPointsY2,
      dataPointsX,
      commonRangeY,
    } = this.props;

    let stageWidth = width - 2 * margins.gapX;
    let stageHeight = height - 3 * margins.gapY;
    let panelWidth =
      (stageWidth - (domains.length - 1) * margins.gapX) / domains.length;
    let panelHeight = stageHeight;
    this.panels = [];

    if (this._extentDataPointsY1Data !== dataPointsY1) {
      this.extentDataPointsY1 = d3.extent(dataPointsY1);
      this._extentDataPointsY1Data = dataPointsY1;
    }
    if (this._extentDataPointsY2Data !== dataPointsY2) {
      this.extentDataPointsY2 = d3.extent(dataPointsY2);
      this._extentDataPointsY2Data = dataPointsY2;
    }

    // Always compute outlier thresholds and max values for both axes
    // Y2 (Base Coverage) axis is independent of common/individual mode
    if (this._outlierThresholdDataY1 !== dataPointsY1) {
      const sortedY1 = [...dataPointsY1].sort((a, b) => a - b);
      this._globalLowerOutlierThresholdY1 = computeQuantileThreshold(
        sortedY1,
        0
      );
      this._globalOutlierThresholdY1 = computeQuantileThreshold(
        sortedY1,
        1
      );
      this._outlierThresholdDataY1 = dataPointsY1;
    }
    if (this._outlierThresholdDataY2 !== dataPointsY2) {
      this._globalOutlierThresholdY2 = computeQuantileThreshold(
        [...dataPointsY2].sort((a, b) => a - b),
        1
      );
      this._outlierThresholdDataY2 = dataPointsY2;
    }

    const rawMinY1 = findMinInRanges(
      domains,
      dataPointsX,
      dataPointsY1,
      false
    );
    const rawMaxY1 = findMaxInRanges(
      domains,
      dataPointsX,
      dataPointsY1,
      false
    );
    const rawMaxY2 = findMaxInRanges(
      domains,
      dataPointsX,
      dataPointsY2,
      false
    );

    this.minY1Values = rawMinY1.map((v) =>
      Math.max(v, this._globalLowerOutlierThresholdY1)
    );
    this.maxY1Values = rawMaxY1.map((v) =>
      Math.min(v, this._globalOutlierThresholdY1)
    );
    this.maxY2Values = rawMaxY2.map((v) =>
      Math.min(v, this._globalOutlierThresholdY2)
    );

    // Derive Y2 (Base Coverage) axis from Y1 (Est. CN) axis using the
    // linear relationship between the two datasets. This ensures that at
    // every pixel position, the right axis shows the correct base coverage
    // value corresponding to the CN value on the left axis.
    // The relationship is: CN = count * slope + intercept, so we use the
    // data extents to reconstruct the mapping.
    let cnToCount = d3
      .scaleLinear()
      .domain(this.extentDataPointsY1)
      .range(this.extentDataPointsY2);

    domains.forEach((xDomain, index) => {
      let offset = index * (panelWidth + margins.gapX);
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

      let panelGenomeScale = d3
        .scaleLinear()
        .domain(defaultDomain)
        .range([0, panelWidth]);

      let yScale1, yScale2;
      let yExtent1 = this.getPanelYExtent(index);
      let yExtent2 = yExtent1.map((d) => cnToCount(d));

      yScale1 = d3.scaleLinear().domain(yExtent1).range([panelHeight, 0]);
      yScale2 = d3.scaleLinear().domain(yExtent2).range([panelHeight, 0]);

      let xScale = d3.scaleLinear().domain(xDomain).range([0, panelWidth]);

      this.panels.push({
        index,
        xScale,
        yScale1,
        yScale2,
        zoom,
        panelWidth,
        panelHeight,
        offset,
        panelGenomeScale,
      });
    });
    const result = (
      <Wrapper className="ant-wrapper" margins={margins} height={height}>
        <div
          className="scatterplot"
          style={{ width: stageWidth, height: stageHeight }}
          ref={(elem) => (this.container = elem)}
        />
        <svg
          width={width}
          height={height}
          className="plot-container"
          ref={(elem) => (this.plotContainer = elem)}
        >
          <text
            className="y-axis-title"
            transform={`translate(${[margins.gapX / 2, margins.gapY / 3]})`}
          >
            {yAxisTitle}
          </text>
          {!commonRangeY && (
            <rect
              className="y-axis-title-click-target"
              x={0}
              y={0}
              width={margins.gapX + 8}
              height={margins.gapY}
              onClick={() => this.handleYAxisClick(0)}
              style={{
                fill: "transparent",
                cursor: "pointer",
                pointerEvents: "all",
              }}
            >
              <title>Set y-axis bounds</title>
            </rect>
          )}
          <text
            className="y-axis-title"
            transform={`translate(${[width, margins.gapY / 3]})`}
            textAnchor="end"
          >
            {yAxis2Title}
          </text>
          <g transform={`translate(${[margins.gapX, margins.gapY]})`}>
            {this.panels.map((panel, i) => (
              <g
                key={`panel-${panel.index}`}
                id={`panel-${panel.index}`}
                transform={`translate(${[panel.offset, 0]})`}
              >
                <Grid
                  gap={0}
                  scaleX={panel.xScale}
                  scaleY={panel.yScale1}
                  scaleY2={panel.yScale2}
                  axisWidth={panelWidth}
                  axisHeight={panelHeight}
                  chromoBins={chromoBins}
                />
                <rect
                  className="zoom-background"
                  id={`panel-rect-${panel.index}`}
                  x={0.5}
                  width={panelWidth}
                  height={panelHeight}
                  onMouseMove={(e) => this.handleMouseMove(e, i)}
                  onMouseOut={(e) => this.handleMouseOut(e, i)}
                  style={{
                    stroke: "steelblue",
                    fill: "transparent",
                    strokeWidth: 0,
                    opacity: 0.375,
                    pointerEvents: "all",
                  }}
                />
                {!commonRangeY && (
                  <rect
                    className="y-axis-click-target"
                    x={-margins.gapX}
                    y={0}
                    width={margins.gapX + 8}
                    height={panelHeight}
                    onClick={() => this.handleYAxisClick(panel.index)}
                    style={{
                      fill: "transparent",
                      cursor: "pointer",
                      pointerEvents: "all",
                    }}
                  >
                    <title>Set y-axis bounds</title>
                  </rect>
                )}
              </g>
            ))}
          </g>
        </svg>
        {this.renderYBoundsModal()}
      </Wrapper>
    );
    return result;
  }
}
ScatterPlot.propTypes = {
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  data: PropTypes.object,
  chromoBins: PropTypes.object,
};
ScatterPlot.defaultProps = {
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
  zoomedByCmd: state.Settings.zoomedByCmd,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(ScatterPlot));
