import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import {
  Row,
  Col,
  Modal,
  message,
  Space,
  Spin,
  Button,
  Affix,
  Tabs,
  Select,
  Typography,
} from "antd";
import { withTranslation } from "react-i18next";
import GenomePanel from "../genomePanel";
import MutationsPanel from "../mutationsPanel";
import ScatterPlotPanel from "../scatterPlotPanel";
import IgvPanel from "../igvPanel/index";
import settingsActions from "../../redux/settings/actions";
import TracksLegendPanel from "../tracksLegendPanel";
import { AiOutlineDownload } from "react-icons/ai";
import DensityPlotPanel from "../densityPlotPanel";
import {
  densityPlotVariables,
  getDensityPlotVariableSelection,
} from "../../helpers/sageQc";
import { snakeCaseToHumanReadable } from "../../helpers/utility";
import * as htmlToImage from "html-to-image";
import { downloadCanvasAsPng, dataRanges } from "../../helpers/utility";
import Wrapper from "./index.style";

const { Option } = Select;
const ALLELIC_COLOR_BY_KEY = "gos.allelicColorBy";
const readAllelicColorBy = () => {
  try {
    return window.localStorage.getItem(ALLELIC_COLOR_BY_KEY) === "haplotype"
      ? "haplotype"
      : "allele";
  } catch (error) {
    return "allele";
  }
};
const { Text } = Typography;
const { updateHoveredLocation } = settingsActions;

export class TracksModal extends Component {
  container = null;

  state = {
    yScaleMode: "common",
    xVariable: null,
    yVariable: null,
    colorVariable: null,
    contentReady: false,
    allelicColorBy: readAllelicColorBy(),
    allelicShowCopy: "both",
  };

  // the copy filter follows the coloring (h1 / h2 or major / minor), so a mode switch resets it
  handleAllelicColorByChange = (allelicColorBy) => {
    this.setState({ allelicColorBy, allelicShowCopy: "both" });
    try {
      window.localStorage.setItem(ALLELIC_COLOR_BY_KEY, allelicColorBy);
    } catch (error) {
      // the toggle still works for this view without storage
    }
  };

  shouldComponentUpdate(nextProps, nextState) {
    // Check state changes
    if (nextState !== this.state) return true;

    // Check domain changes (zoom/pan)
    const domainsChanged =
      nextProps.domains?.toString() !== this.props.domains?.toString();
    if (domainsChanged) return true;

    // Check modal visibility and selected inline view
    if (
      nextProps.open !== this.props.open ||
      nextProps.contentView !== this.props.contentView ||
      nextProps.selectedVariantId !== this.props.selectedVariantId
    )
      return true;

    // Check loading states
    if (
      nextProps.genome?.loading !== this.props.genome?.loading ||
      nextProps.genomeCoverage?.loading !== this.props.genomeCoverage?.loading ||
      nextProps.mutations?.loading !== this.props.mutations?.loading ||
      nextProps.allelic?.loading !== this.props.allelic?.loading ||
      nextProps.fixedAllelic?.loading !== this.props.fixedAllelic?.loading
    )
      return true;

    // Check track availability
    if (
      nextProps.genome?.missing !== this.props.genome?.missing ||
      nextProps.genomeCoverage?.missing !== this.props.genomeCoverage?.missing ||
      nextProps.methylationBetaCoverage?.missing !==
        this.props.methylationBetaCoverage?.missing ||
      nextProps.methylationIntensityCoverage?.missing !==
        this.props.methylationIntensityCoverage?.missing ||
      nextProps.hetsnps?.missing !== this.props.hetsnps?.missing ||
      nextProps.mutations?.missing !== this.props.mutations?.missing ||
      nextProps.allelic?.missing !== this.props.allelic?.missing ||
      nextProps.fixedAllelic?.missing !== this.props.fixedAllelic?.missing ||
      nextProps.igv?.missing !== this.props.igv?.missing
    )
      return true;

    // Check data changes (reference equality - data objects change when reloaded)
    if (
      nextProps.genome?.data !== this.props.genome?.data ||
      nextProps.genomeCoverage?.dataPointsX !== this.props.genomeCoverage?.dataPointsX ||
      nextProps.mutations?.data !== this.props.mutations?.data ||
      nextProps.allelic?.data !== this.props.allelic?.data ||
      nextProps.fixedAllelic?.data !== this.props.fixedAllelic?.data ||
      nextProps.genes?.list !== this.props.genes?.list ||
      nextProps.genes?.loading !== this.props.genes?.loading
    )
      return true;

    // Check Variant QC data
    if (
      nextProps.loadingSageQc !== this.props.loadingSageQc ||
      nextProps.loadingPercentageSageQc !==
        this.props.loadingPercentageSageQc ||
      nextProps.dataPoints !== this.props.dataPoints ||
      nextProps.sageQcFields !== this.props.sageQcFields
    )
      return true;

    // Check viewport/visibility
    if (
      nextProps.inViewport !== this.props.inViewport ||
      nextProps.width !== this.props.width ||
      nextProps.height !== this.props.height
    )
      return true;

    return false;
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.open &&
      !this.props.open &&
      this.state.contentReady
    ) {
      this.setState({ contentReady: false });
    }
  }

  handleModalOpenChange = (presented) => {
    if (presented !== this.state.contentReady) {
      this.setState({ contentReady: presented });
    }
    if (this.props.afterOpenChange) {
      this.props.afterOpenChange(presented);
    }
  };

  onDownloadButtonClicked = () => {
    htmlToImage
      .toCanvas(this.container, { pixelRatio: 2 })
      .then((canvas) => {
        downloadCanvasAsPng(
          canvas,
          `${this.props.modalTitleText.replace(/\s+/g, "_").toLowerCase()}.png`
        );
      })
      .catch((error) => {
        message.error(this.props.t("general.error", { error }));
      });
  };

  handleYscaleSegmentedChange = (yScaleMode) => {
    this.setState({ yScaleMode });
  };

  render() {

    const {
      t,
      domains,
      genome,
      mutations,
      genomeCoverage,
      methylationBetaCoverage,
      methylationIntensityCoverage,
      hetsnps,
      coverageYAxisTitle,
      coverageYAxis2Title,
      methylationBetaCoveragePlotTitle,
      methylationBetaCoverageYAxisTitle,
      methylationBetaCoverageYAxis2Title,
      methylationIntensityCoveragePlotTitle,
      methylationIntensityCoverageYAxisTitle,
      methylationIntensityCoverageYAxis2Title,
      metadata,
      genes,
      allelic,
      fixedAllelic,
      igv,
      chromoBins,
      modalTitle,
      genomePlotTitle,
      genomePlotYAxisTitle,
      mutationsPlotTitle,
      mutationsPlotYAxisTitle,
      coveragePlotTitle,
      hetsnpPlotTitle,
      hetsnpPlotYAxisTitle,
      hetsnpPlotYAxis2Title,
      allelicPlotTitle,
      allelicPlotYAxisTitle,
      fixedAllelicPlotTitle,
      handleOkClicked,
      handleCancelClicked,
      showVariants,
      width,
      height,
      open,
      viewType,
      legendPanelPinned,
      dataPoints,
      sageQcFields,
      loadingSageQc,
      loadingPercentageSageQc,
      selectedVariantId,
      contentView,
    } = this.props;

    if (!open) return null;

    const renderModal = (modalContent) => (
      <Wrapper visible={open}>
        <Modal
          title={
            <Space>
              {modalTitle}
              <Button
                type="default"
                shape="circle"
                icon={<AiOutlineDownload />}
                size="small"
                disabled={!this.state.contentReady}
                onClick={() => this.onDownloadButtonClicked()}
              />
            </Space>
          }
          centered
          open={open}
          onOk={handleOkClicked}
          onCancel={handleCancelClicked}
          afterOpenChange={this.handleModalOpenChange}
          width={width}
          footer={null}
          forceRender={true}
        >
          <div ref={(elem) => (this.container = elem)}>{modalContent}</div>
        </Modal>
      </Wrapper>
    );

    if (viewType === "modal" && !this.state.contentReady) {
      return renderModal(
        <div
          style={{
            minHeight: "320px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Space direction="vertical" align="center" size="middle">
            <Spin size="large" />
            <Text>{t("components.tracks-modal.loading")}</Text>
          </Space>
        </div>,
      );
    }

    const inlineVariantQc =
      viewType !== "modal" && contentView === "variantQc";
    const buildTracksContent = viewType === "modal" || !inlineVariantQc;
    const buildVariantQcContent = viewType === "modal" || inlineVariantQc;

    const {
      cov_slope,
      cov_intercept,
      hets_slope,
      hets_intercept,
      methylation_intensity_cov_slope,
      methylation_intensity_cov_intercept,
      methylation_beta_cov_slope,
      methylation_beta_cov_intercept,
    } = metadata;

    const { yScaleMode } = this.state;

    let variables = {};
    let options = {};
    if (buildVariantQcContent) {
      ({ variables, options } = getDensityPlotVariableSelection(
        sageQcFields,
        this.state
      ));
    }

    let commonRangeY =
      buildTracksContent && yScaleMode === "common"
        ? dataRanges(domains, genome.data)
        : null;

    let tracksLegend = buildTracksContent ? (
      <TracksLegendPanel
        {...{
          loading: genes.loading,
          genesList: genes.list,
          error: genes.error,
          chromoBins,
          visible: true,
          height,
          handleYscaleModeChange: this.handleYscaleSegmentedChange,
          yScaleMode,
        }}
      />
    ) : null;
    let tracksContent = buildTracksContent ? (
      <Row
        className="ant-panel-container ant-home-plot-container"
        gutter={[16, 24]}
      >
        <Col className="gutter-row" span={24}>
          {legendPanelPinned ? (
            <Affix offsetTop={144}>{tracksLegend}</Affix>
          ) : (
            tracksLegend
          )}
        </Col>
        {!genome.missing && (
          <Col className="gutter-row" span={24}>
            <GenomePanel
              {...{
                loading: genome.loading,
                genome: genome.data,
                error: genome.error,
                filename: genome.filename,
                title: genomePlotTitle,
                yAxisTitle: genomePlotYAxisTitle,
                chromoBins,
                visible: true,
                index: 0,
                height,
                commonRangeY,
              }}
            />
          </Col>
        )}
        {genomeCoverage && !genomeCoverage.missing && (
          <Col className="gutter-row" span={24}>
            <ScatterPlotPanel
              {...{
                loading: genomeCoverage.loading,
                dataPointsY1: genomeCoverage.dataPointsCopyNumber,
                dataPointsY2: genomeCoverage.dataPointsCount,
                dataPointsX: genomeCoverage.dataPointsX,
                dataPointsXHigh: genomeCoverage.dataPointsXHigh,
                dataPointsXLow: genomeCoverage.dataPointsXLow,
                dataPointsColor: genomeCoverage.dataPointsColor,
                error: genomeCoverage.error,
                filename: genomeCoverage.filename,
                title: coveragePlotTitle,
                notification: {
                  status:
                    cov_slope == null || cov_intercept == null
                      ? "warning"
                      : null,
                  heading:
                    cov_slope == null || cov_intercept == null
                      ? t(`components.tracks-modal.missing-counts-axis`)
                      : null,
                  messages: [
                    ...(cov_slope == null
                      ? [
                          t(`general.attributes-missing.description`, {
                            attribute: "cov_slope",
                          }),
                        ]
                      : []),
                    ...(cov_intercept == null
                      ? [
                          t(`general.attributes-missing.description`, {
                            attribute: "cov_intercept",
                          }),
                        ]
                      : []),
                  ],
                },
                chromoBins,
                visible: true,
                height,
                yAxisTitle:
                  cov_slope == null || cov_intercept == null
                    ? coverageYAxis2Title
                    : coverageYAxisTitle,
                yAxis2Title: coverageYAxis2Title,
                commonRangeY,
              }}
            />
          </Col>
        )}
        {!methylationIntensityCoverage.missing && (
          <Col className="gutter-row" span={24}>
            <ScatterPlotPanel
              {...{
                loading: methylationIntensityCoverage.loading,
                dataPointsY1: methylationIntensityCoverage.dataPointsCopyNumber,
                dataPointsY2: methylationIntensityCoverage.dataPointsCount,
                dataPointsX: methylationIntensityCoverage.dataPointsX,
                dataPointsXHigh: methylationIntensityCoverage.dataPointsXHigh,
                dataPointsXLow: methylationIntensityCoverage.dataPointsXLow,
                dataPointsColor: methylationIntensityCoverage.dataPointsColor,
                error: methylationIntensityCoverage.error,
                filename: methylationIntensityCoverage.filename,
                title: methylationIntensityCoveragePlotTitle,
                notification: {
                  status:
                    methylation_intensity_cov_slope == null ||
                    methylation_intensity_cov_intercept == null
                      ? "warning"
                      : null,
                  heading:
                    methylation_intensity_cov_slope == null ||
                    methylation_intensity_cov_intercept == null
                      ? t(`components.tracks-modal.missing-counts-axis`)
                      : null,
                  messages: [
                    ...(methylation_intensity_cov_slope == null
                      ? [
                          t(`general.attributes-missing.description`, {
                            attribute: "methylation_intensity_cov_slope",
                          }),
                        ]
                      : []),
                    ...(methylation_intensity_cov_intercept == null
                      ? [
                          t(`general.attributes-missing.description`, {
                            attribute: "methylation_intensity_cov_intercept",
                          }),
                        ]
                      : []),
                  ],
                },
                chromoBins,
                visible: true,
                height,
                yAxisTitle:
                  methylation_intensity_cov_slope == null ||
                  methylation_intensity_cov_intercept == null
                    ? methylationIntensityCoverageYAxis2Title
                    : methylationIntensityCoverageYAxisTitle,
                yAxis2Title: methylationIntensityCoverageYAxis2Title,
                commonRangeY,
              }}
            />
          </Col>
        )}
        {!methylationBetaCoverage?.missing && (
          <Col className="gutter-row" span={24}>
            <ScatterPlotPanel
              {...{
                loading: methylationBetaCoverage.loading,
                dataPointsY1: methylationBetaCoverage.dataPointsCopyNumber,
                dataPointsY2: methylationBetaCoverage.dataPointsCount,
                dataPointsX: methylationBetaCoverage.dataPointsX,
                dataPointsXHigh: methylationBetaCoverage.dataPointsXHigh,
                dataPointsXLow: methylationBetaCoverage.dataPointsXLow,
                dataPointsColor: methylationBetaCoverage.dataPointsColor,
                error: methylationBetaCoverage.error,
                filename: methylationBetaCoverage.filename,
                title: methylationBetaCoveragePlotTitle,
                notification: {
                  status:
                    methylation_beta_cov_slope == null ||
                    methylation_beta_cov_intercept == null
                      ? "warning"
                      : null,
                  heading:
                    methylation_beta_cov_slope == null ||
                    methylation_beta_cov_intercept == null
                      ? t(`components.tracks-modal.missing-counts-axis`)
                      : null,
                  messages: [
                    ...(methylation_beta_cov_slope == null
                      ? [
                          t(`general.attributes-missing.description`, {
                            attribute: "methylation_beta_cov_slope",
                          }),
                        ]
                      : []),
                    ...(methylation_beta_cov_intercept == null
                      ? [
                          t(`general.attributes-missing.description`, {
                            attribute: "methylation_beta_cov_intercept",
                          }),
                        ]
                      : []),
                  ],
                },
                chromoBins,
                visible: true,
                height,
                yAxisTitle:
                  methylation_beta_cov_slope == null ||
                  methylation_beta_cov_intercept == null
                    ? methylationBetaCoverageYAxis2Title
                    : methylationBetaCoverageYAxisTitle,
                yAxis2Title: methylationBetaCoverageYAxis2Title,
                commonRangeY: [0, 1], // Beta values are always 0-1, skip findMaxInRanges
              }}
            />
          </Col>
        )}
        {hetsnps && !hetsnps.missing && (
          <Col className="gutter-row" span={24}>
            <ScatterPlotPanel
              {...{
                loading: hetsnps.loading,
                dataPointsY1: hetsnps.dataPointsCopyNumber,
                dataPointsY2: hetsnps.dataPointsCount,
                dataPointsX: hetsnps.dataPointsX,
                dataPointsXHigh: hetsnps.dataPointsXHigh,
                dataPointsXLow: hetsnps.dataPointsXLow,
                dataPointsColor: hetsnps.dataPointsColor,
                error: hetsnps.error,
                filename: hetsnps.filename,
                title: hetsnpPlotTitle,
                notification: {
                  status:
                    hets_slope == null || hets_intercept == null
                      ? "warning"
                      : null,
                  heading:
                    hets_slope == null || hets_intercept == null
                      ? t(`components.tracks-modal.missing-counts-axis`)
                      : null,
                  messages: [
                    ...(hets_slope == null
                      ? [
                          t(`general.attributes-missing.description`, {
                            attribute: "hets_slope",
                          }),
                        ]
                      : []),
                    ...(hets_intercept == null
                      ? [
                          t(`general.attributes-missing.description`, {
                            attribute: "hets_intercept",
                          }),
                        ]
                      : []),
                  ],
                },
                chromoBins,
                visible: true,
                height,
                yAxisTitle:
                  hets_slope == null || hets_intercept == null
                    ? hetsnpPlotYAxis2Title
                    : hetsnpPlotYAxisTitle,
                yAxis2Title: hetsnpPlotYAxis2Title,
                commonRangeY,
              }}
            />
          </Col>
        )}
        {fixedAllelic && !fixedAllelic.missing && (
          <Col className="gutter-row" span={24}>
            <GenomePanel
              {...{
                loading: fixedAllelic.loading,
                genome: fixedAllelic.data,
                error: fixedAllelic.error,
                filename: fixedAllelic.filename,
                title: fixedAllelicPlotTitle,
                yAxisTitle: allelicPlotYAxisTitle,
                colorBy: this.state.allelicColorBy,
                onColorByChange: this.handleAllelicColorByChange,
                showCopy: this.state.allelicShowCopy,
                onShowCopyChange: (allelicShowCopy) => this.setState({ allelicShowCopy }),
                chromoBins,
                visible: true,
                index: 0,
                height,
                commonRangeY,
              }}
            />
          </Col>
        )}
        {allelic && !allelic.missing && (
          <Col className="gutter-row" span={24}>
            <GenomePanel
              {...{
                loading: allelic.loading,
                genome: allelic.data,
                error: allelic.error,
                filename: allelic.filename,
                title: allelicPlotTitle,
                yAxisTitle: allelicPlotYAxisTitle,
                colorBy: this.state.allelicColorBy,
                onColorByChange: this.handleAllelicColorByChange,
                showCopy: this.state.allelicShowCopy,
                onShowCopyChange: (allelicShowCopy) => this.setState({ allelicShowCopy }),
                chromoBins,
                visible: true,
                index: 0,
                height,
                commonRangeY,
              }}
            />
          </Col>
        )}
        {mutations && !mutations?.missing && (
          <Col className="gutter-row" span={24}>
            <MutationsPanel
              {...{
                loading: mutations.loading,
                loadingPercentage: mutations.loadingPercentage,
                genome: mutations.data,
                error: mutations.error,
                filename: mutations.filename,
                title: mutationsPlotTitle,
                yAxisTitle: mutationsPlotYAxisTitle,
                chromoBins,
                visible: true,
                index: 0,
                height,
                commonRangeY,
              }}
            />
          </Col>
        )}
        {!igv.missing && (
          <Col className="gutter-row" span={24}>
            <IgvPanel
              {...{
                loading: igv.loading,
                error: igv.error,
                missingFiles: igv.missingFiles,
                filenameTumorPresent: igv.filenameTumorPresent,
                filenameNormalPresent: igv.filenameNormalPresent,
                filenameTumorRnaPresent: igv.filenameTumorRnaPresent,
                filenameNormalRnaPresent: igv.filenameNormalRnaPresent,
                filenameTumor: igv.filenameTumor,
                filenameTumorIndex: igv.filenameTumorIndex,
                filenameNormal: igv.filenameNormal,
                filenameNormalIndex: igv.filenameNormalIndex,
                filenameTumorRna: igv.filenameTumorRna,
                filenameTumorRnaIndex: igv.filenameTumorRnaIndex,
                filenameNormalRna: igv.filenameNormalRna,
                filenameNormalRnaIndex: igv.filenameNormalRnaIndex,
                format: igv.format,
                defaultVisible: true,
              }}
            />
          </Col>
        )}
      </Row>
    ) : null;

    let variantQcContent = buildVariantQcContent ? (
      <Row
        className="ant-panel-container ant-home-plot-container"
        gutter={[16, 16]}
      >
        <Col className="gutter-row" span={24}>
          <Space>
            {densityPlotVariables.map((variable) => (
              <React.Fragment key={variable.name}>
                {t(`components.sageQc-panel.${variable.name}`)}:
                <Select
                  className="variables-select"
                  value={variables[`${variable.name}`]}
                  size="small"
                  style={{ width: 250 }}
                  onSelect={(field) => {
                    this.setState({
                      [`${variable.name}`]: field,
                    });
                  }}
                >
                  {options[variable.name].map((d) => (
                    <Option key={d.name} value={d.name}>
                      {snakeCaseToHumanReadable(d.name)}
                    </Option>
                  ))}
                </Select>
              </React.Fragment>
            ))}
          </Space>
        </Col>
        <Col className="gutter-row" span={24}>
          <DensityPlotPanel
            loading={loadingSageQc}
            loadingPercentage={loadingPercentageSageQc}
            dataPoints={dataPoints}
            xTitle={snakeCaseToHumanReadable(variables.xVariable)}
            xVariable={variables.xVariable}
            xFormat={
              sageQcFields.find((d) => d.name === variables.xVariable)?.format
            }
            yTitle={snakeCaseToHumanReadable(variables.yVariable)}
            yVariable={variables.yVariable}
            yFormat={
              sageQcFields.find((d) => d.name === variables.yVariable)?.format
            }
            title={t("components.sageQc-panel.title")}
            colorVariable={variables.colorVariable}
            colorFormat={
              sageQcFields.find((d) => d.name === variables.colorVariable)
                ?.format
            }
            colorVariableType={
              sageQcFields.find((d) => d.name === variables.colorVariable)?.type
            }
            selectedId={selectedVariantId}
          />
        </Col>
      </Row>
    ) : null;
    let content = showVariants ? (
      <Tabs
        items={[
          {
            key: "tracks",
            label: t(`containers.detail-view.tabs.tab2`),
            children: tracksContent,
          },
          {
            key: "variantQc",
            label: t(`containers.detail-view.tabs.tab4`),
            children: variantQcContent,
          },
        ]}
      />
    ) : (
      tracksContent
    );
    if (viewType === "modal") {
      return renderModal(content);
    }

    const inlineContent =
      contentView === "variantQc" ? variantQcContent : tracksContent;

    return (
      <Wrapper visible={open}>
        <div style={{ height: `${height}px; width: ${width}px` }}>
          {inlineContent}
        </div>
      </Wrapper>
    );
  }
}
TracksModal.propTypes = {
  data: PropTypes.array,
};
TracksModal.defaultProps = {
  width: 1800,
  height: 200,
  viewType: "modal",
  legendPanelPinned: false,
  showVariants: false,
  contentView: "plots",
};
const mapDispatchToProps = (dispatch) => ({
  updateHoveredLocation: (hoveredLocation, panelIndex) =>
    dispatch(updateHoveredLocation(hoveredLocation, panelIndex)),
});
const mapStateToProps = (state) => ({
  loadingSageQc: state.SageQc.loading,
  loadingPercentageSageQc: state.SageQc.loadingPercentage,
  domains: state.Settings.domains,
  metadata: state.CaseReport.metadata,
  chromoBins: state.Settings.chromoBins,
  dataPoints: state.SageQc.records,
  sageQcFields: state.SageQc.properties,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(TracksModal));
