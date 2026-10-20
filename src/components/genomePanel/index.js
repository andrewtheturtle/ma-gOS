import React, { Component } from "react";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import { Resizable } from "react-resizable";
import * as d3 from "d3";
import handleViewport from "react-in-viewport";
import {
  Card,
  Space,
  Button,
  Tooltip,
  message,
  Typography,
  Progress,
  Skeleton,
  Segmented,
} from "antd";
import { GiDna2 } from "react-icons/gi";
import { AiOutlineDownload } from "react-icons/ai";
import { CgArrowsBreakeH } from "react-icons/cg";
import {
  downloadCanvasAsPng,
  transitionStyle,
  domainsToLocation,
} from "../../helpers/utility";
import * as htmlToImage from "html-to-image";
import ErrorPanel from "../errorPanel";
import Wrapper from "./index.style";
import GenomePlot, { HAPLOTYPE_COLORS } from "../genomePlot";
import HoverLine from "../hoverLine";

const { Text } = Typography;

const margins = {
  padding: 0,
  annotations: { minDistance: 10000000, padding: 1000, maxClusters: 6 },
  gap: 27,
  maxHeight: 500,
};

class GenomePanel extends Component {
  constructor(props) {
    super(props);
    this.container = null;
    this.state = {
      parentWidth: null,
      width: 0,
      height: this.props.height,
    };
  }

  shouldComponentUpdate(nextProps, nextState) {
    // Check state changes
    if (nextState !== this.state) return true;

    // Check domain changes (zoom/pan)
    const domainsChanged =
      nextProps.domains?.toString() !== this.props.domains?.toString();
    if (domainsChanged) return true;

    // Check commonRangeY by reference (memoized in utility.js)
    if (nextProps.commonRangeY !== this.props.commonRangeY) return true;

    // Check data changes
    if (nextProps.genome !== this.props.genome) return true;
    if (nextProps.colorBy !== this.props.colorBy) return true;
    if (nextProps.showCopy !== this.props.showCopy) return true;

    // Check visibility/loading state
    if (
      nextProps.loading !== this.props.loading ||
      nextProps.visible !== this.props.visible ||
      nextProps.inViewport !== this.props.inViewport ||
      nextProps.error !== this.props.error
    )
      return true;

    // Check dimension changes
    if (
      nextProps.height !== this.props.height ||
      nextProps.chromoBins !== this.props.chromoBins
    )
      return true;

    return false;
  }

  componentDidMount() {
    this.updateWidth();
    window.addEventListener("resize", this.updateWidth);
  }

  componentDidUpdate(prevProps, prevState) {
    // Check if the parent width has changed after the update
    if (prevState.parentWidth !== this.state.parentWidth) {
      this.updateWidth();
    }
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.updateWidth);
  }

  updateWidth = () => {
    if (this.container) {
      this.setState({
        parentWidth: this.container.getBoundingClientRect().width,
      });
    }
  };

  // On top layout
  onFirstBoxResize = (event, { element, size, handle }) => {
    this.setState({
      width: size.width,
      height: d3.min([
        d3.max([size.height, this.props.height]),
        margins.maxHeight,
      ]),
    });
  };

  onDownloadButtonClicked = () => {
    htmlToImage
      .toCanvas(this.container, { pixelRatio: 2 })
      .then((canvas) => {
        downloadCanvasAsPng(
          canvas,
          `${this.props.title.replace(/\s+/g, "_").toLowerCase()}.png`
        );
      })
      .catch((error) => {
        message.error(this.props.t("general.error", { error }));
      });
  };

  render() {
    const {
      t,
      error,
      loading,
      loadingPercentage,
      genome,
      filename,
      title,
      yAxisTitle,
      inViewport,
      visible,
      zoomedByCmd,
      chromoBins,
      domains,
      commonRangeY,
      colorBy,
      onColorByChange,
      showCopy,
      onShowCopyChange,
    } = this.props;
    if (!visible) return null;
    // allele / haplotype coloring switch, for allelic graphs whose nodes carry the LP haplotype
    const showColorBy =
      onColorByChange &&
      genome?.intervals?.some((d) => d.metadata?.Haplotype);
    const { parentWidth, height } = this.state;
    let { gap } = margins;

    let w = parentWidth || this.container?.getBoundingClientRect().width;

    return (
      <Wrapper visible={visible} ref={(elem) => (this.container = elem)}>
        {error ? (
          <ErrorPanel
            avatar={<CgArrowsBreakeH />}
            header={
              <Space>
                <span role="img" className="anticon anticon-dashboard">
                  <GiDna2 />
                </span>
                <span className="ant-pro-menu-item-title">{title}</span>
                <span>{domainsToLocation(chromoBins, domains)}</span>
              </Space>
            }
            title={t("components.genome-panel.error.title")}
            subtitle={t("components.genome-panel.error.subtitle", { filename })}
            explanationTitle={t(
              "components.genome-panel.error.explanation.title"
            )}
            explanationDescription={error.stack}
          />
        ) : (
          <Card
            style={transitionStyle(inViewport)}
            size="small"
            title={
              <Space>
                <span role="img" className="anticon anticon-dashboard">
                  <GiDna2 />
                </span>
                <span className="ant-pro-menu-item-title">{title}</span>
                {genome && (
                  <span
                    dangerouslySetInnerHTML={{
                      __html: t(`components.genome-panel.interval`, {
                        count: genome.intervals.length,
                        countText: d3.format(",")(genome.intervals.length),
                      }),
                    }}
                  />
                )}
                <span>{domainsToLocation(chromoBins, domains)}</span>
              </Space>
            }
            extra={
              <Space>
                {zoomedByCmd && (
                  <Text type="secondary">{t("components.zoom-help")}</Text>
                )}
                {showColorBy && (
                  <Segmented
                    size="small"
                    value={colorBy || "allele"}
                    onChange={onColorByChange}
                    options={[
                      {
                        value: "allele",
                        label: (
                          <span>
                            <span style={{ color: "#FF0000" }}>●</span> major{" "}
                            <span style={{ color: "#0000FF" }}>●</span> minor
                          </span>
                        ),
                      },
                      {
                        value: "haplotype",
                        label: (
                          <span>
                            <span style={{ color: HAPLOTYPE_COLORS.h1.slice(0, 7) }}>●</span> h1{" "}
                            <span style={{ color: HAPLOTYPE_COLORS.h2.slice(0, 7) }}>●</span> h2
                          </span>
                        ),
                      },
                    ]}
                  />
                )}
                {showColorBy && onShowCopyChange && (
                  <Segmented
                    size="small"
                    value={showCopy || "both"}
                    onChange={onShowCopyChange}
                    options={
                      colorBy === "haplotype"
                        ? [
                            { value: "both", label: "h1 + h2" },
                            { value: "h1", label: "h1" },
                            { value: "h2", label: "h2" },
                          ]
                        : [
                            { value: "both", label: "major + minor" },
                            { value: "major", label: "major" },
                            { value: "minor", label: "minor" },
                          ]
                    }
                  />
                )}
                <Tooltip title={t("components.download-as-png-tooltip")}>
                  <Button
                    type="default"
                    shape="circle"
                    disabled={!visible}
                    icon={<AiOutlineDownload style={{ marginTop: 4 }} />}
                    size="small"
                    onClick={() => this.onDownloadButtonClicked()}
                  />
                </Tooltip>
              </Space>
            }
          >
            {loading ? (
              loadingPercentage ? (
                <Progress percent={loadingPercentage} />
              ) : (
                <Skeleton loading={loading} active />
              )
            ) : (
              visible &&
              w > 0 && (
                <Resizable
                  className="box"
                  height={this.state.height}
                  width={w - gap}
                  onResize={this.onFirstBoxResize}
                  resizeHandles={["sw", "se", "s"]}
                  draggableOpts={{ grid: [25, 25] }}
                >
                  <div
                    className="ant-wrapper"
                    style={{
                      width: w - gap + "px",
                      height: this.state.height + "px",
                    }}
                  >
                    {inViewport && (
                      <>
                        <GenomePlot
                          {...{
                            width: w - gap - 2 * margins.padding,
                            height,
                            genome,
                            yAxisTitle,
                            commonRangeY,
                            colorBy,
                            showCopy,
                          }}
                        />
                        <HoverLine
                          width={w - gap - 2 * margins.padding}
                          height={height}
                        />
                      </>
                    )}
                  </div>
                </Resizable>
              )
            )}
          </Card>
        )}
      </Wrapper>
    );
  }
}
GenomePanel.propTypes = {};
GenomePanel.defaultProps = {
  error: false,
  height: 400,
  visible: true,
  commonRangeY: null,
};
const mapDispatchToProps = (dispatch) => ({});
const mapStateToProps = (state) => ({
  genomeLength: state.Settings.genomeLength,
  zoomedByCmd: state.Settings.zoomedByCmd,
  domains: state.Settings.domains,
  chromoBins: state.Settings.chromoBins,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(
  withTranslation("common")(
    handleViewport(GenomePanel, { rootMargin: "-1.0px" })
  )
);
