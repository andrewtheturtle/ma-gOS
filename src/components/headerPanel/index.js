import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import { PageHeader } from "@ant-design/pro-components";
import { BarChartOutlined } from "@ant-design/icons";
import {
  Space,
  Tag,
  Avatar,
  Tooltip,
  Divider,
  Popover,
  Typography,
  Button,
} from "antd";
import * as d3 from "d3";
import {
  legendColors,
  coverageQCFields,
  getColorMarker,
  orderListViewFilters,
} from "../../helpers/utility";
import { getNestedValue } from "../../helpers/metadata";
import { datasetHasField } from "../../helpers/browseScope";
import { fetchCardinalityData, eventsInView, formatChao } from "../../helpers/cardinality";
import { domainsToLocation } from "../../helpers/utility";
import { isMyeloSeqReportStyle } from "../../helpers/reportStyle";
import { getRawPrimarySite } from "../../helpers/primarySite";
import { buildPatientLevelViewUrl } from "../../helpers/patientLevelView";
import {
  valueFormat,
  hrdFields,
  sv_countFields,
  headerList,
  msiFields,
  hrdDividers,
  msiLabels,
  qcMetricsClasses,
} from "../../helpers/metadata";
import Wrapper from "./index.style";
import { CbioportalModal } from "../cbioportal";
import cbioportalIcon from "../../assets/images/cbioportal_icon.png";
import { ClinicalTrialsModal } from "../clinicalTrialsModal";
import PatientCaseSwitcher from "../patientCaseSwitcher";
import { normalizePatientId } from "../patientCaseSwitcher/helpers";
import CopyIconButton from "../copyIconButton";
import ReportButtonsPanel from "../reportButtonsPanel";
import PrimarySiteSelect from "../primarySiteSelect";
import ctgovLogo from "../../assets/images/ctgov_logo.png";

const { Text } = Typography;
const COPY_CASE_ID_TOOLTIP_KEY =
  "components.header-panel.copy-case-id-tooltip";
const COPY_TOOLTIP_SUCCESS_KEY = "components.header-panel.copy-tooltip-success";
const COPY_TOOLTIP_FAILURE_KEY = "components.header-panel.copy-tooltip-failure";
const COPY_CASE_ID_ARIA_LABEL_KEY =
  "components.header-panel.copy-case-id-aria-label";

export class HeaderPanel extends Component {
  constructor(props) {
    super(props);
    this.state = {
      cbioportalModalVisible: false,
      clinicalTrialsModalVisible: false,
      cardinalityRows: null,
    };
  }

  componentDidMount() {
    this.loadCardinality();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.dataset?.cardinalityPath !== this.props.dataset?.cardinalityPath) {
      this.loadCardinality();
    }
  }

  componentWillUnmount() {
    this.unmounted = true;
  }

  // Chao estimates of the cardinality json, for the header field
  loadCardinality = () => {
    const path = this.props.dataset?.cardinalityPath;
    if (!path) {
      this.setState({ cardinalityRows: null });
      return;
    }
    fetchCardinalityData(path)
      .then((data) => !this.unmounted && this.setState({ cardinalityRows: data.rows }))
      .catch(() => !this.unmounted && this.setState({ cardinalityRows: null }));
  };

  // "totph/partph/unph" Chao of the event(s) in view, e.g. "4/1024/1024"; one event: just the numbers,
  // several (view not event-specific): "event #id: ..." joined by "; "
  chaoSummary = () => {
    const { cardinalityRows } = this.state;
    const { metadata, domains, chromoBins } = this.props;
    if (!cardinalityRows || !metadata?.pair) return null;
    const location = domains?.length && chromoBins ? domainsToLocation(chromoBins, domains) : "";
    const events = eventsInView(cardinalityRows, metadata.pair, location);
    if (!events.length) return null;
    const shown = events
      .slice(0, 3)
      .map((row) => (events.length > 1 ? `${row.event} #${row.ev_id}: ` : "") + formatChao(row))
      .join("; ");
    return events.length > 3 ? `${shown}; +${events.length - 3} more` : shown;
  };

  handleCbioportalModalOpen = () => {
    this.setState({ cbioportalModalVisible: true });
  };

  handleCbioportalModalClose = () => {
    this.setState({ cbioportalModalVisible: false });
  };

  handleClinicalTrialsModalOpen = () => {
    this.setState({ clinicalTrialsModalVisible: true });
  };

  handleClinicalTrialsModalClose = () => {
    this.setState({ clinicalTrialsModalVisible: false });
  };

  renderPatientLevelViewButton = () => {
    const { metadata, t } = this.props;
    const patientId = normalizePatientId(metadata?.patient_id);
    const patientLevelViewUrl = patientId
      ? buildPatientLevelViewUrl(window.location.href, patientId)
      : null;
    if (!patientLevelViewUrl) return null;

    return (
      <Button
        type="link"
        size="small"
        className="patient-level-view-link"
        icon={<BarChartOutlined />}
        href={patientLevelViewUrl.toString()}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t(
          "components.patient-case-switcher.patient-level-aria-label",
          { patientId },
        )}
      >
        {t("components.patient-case-switcher.patient-level")}
      </Button>
    );
  };

  renderPairTitle = (pair) => (
    <PatientCaseSwitcher
      pair={pair}
      copyControl={
        <CopyIconButton
          value={pair}
          tooltipTitle={this.props.t(COPY_CASE_ID_TOOLTIP_KEY)}
          copiedTooltipTitle={this.props.t(COPY_TOOLTIP_SUCCESS_KEY)}
          failureTooltipTitle={this.props.t(COPY_TOOLTIP_FAILURE_KEY)}
          className="detail-title-copy-button"
          ariaLabel={this.props.t(COPY_CASE_ID_ARIA_LABEL_KEY)}
        />
      }
    />
  );

  renderTitle = () => {
    const { t, metadata, canReturnToResults, onBackToResults } = this.props;
    const pair = metadata?.pair;

    if (!pair) return null;

    if (!canReturnToResults) {
      return this.renderPairTitle(pair);
    }

    return (
      <span className="detail-title-breadcrumb">
        <button
          type="button"
          className="detail-title-breadcrumb-link"
          onClick={onBackToResults}
        >
          {t("containers.detail-view.breadcrumb.results")}
        </button>
        <span className="detail-title-breadcrumb-separator">/</span>
        <span className="detail-title-current">{this.renderPairTitle(pair)}</span>
      </span>
    );
  };

  render() {
    const { t, report, metadata, plots, dataset } = this.props;
    if (!report) return null;
    const fieldValue = (field, path = field) =>
      datasetHasField(dataset, field)
        ? getNestedValue(metadata, path)
        : undefined;
    const tumor_type = fieldValue("tumor_type");
    const purity = fieldValue("purity");
    const ploidy = fieldValue("ploidy");
    const inferred_sex = fieldValue("inferred_sex");
    const disease = fieldValue("disease");
    const primarySite = datasetHasField(dataset, "primary_site")
      ? getRawPrimarySite(metadata)
      : null;
    const tumor_details = fieldValue("tumor_details");
    const treatment = fieldValue("treatment");
    const treatment_type = fieldValue("treatment_type");
    const treatment_best_response = fieldValue("treatment_best_response");
    const treatment_duration = fieldValue("treatment_duration");
    const { qcMetrics, qcEvaluation } = metadata;

    const qcEvaluationTag = qcEvaluation ? (
      <Tag
        color={qcMetricsClasses[qcEvaluation.toLowerCase()]}
        className="qc-evaluation-tag"
      >
        {qcEvaluation}
      </Tag>
    ) : null;
    const canShowQcMetricDetails =
      !Array.isArray(dataset?.schema) ||
      datasetHasField(dataset, "qcMetrics");
    let qcMetricsComponent =
      qcEvaluation && canShowQcMetricDetails ? (
        <Popover
          placement="bottomLeft"
          title={
            <Space>
              <Text>{t(`components.header-panel.qcMetrics`)}:</Text>
              <Text type={qcMetricsClasses[qcEvaluation.toLowerCase()]}>
                <strong>{qcEvaluation}</strong>
              </Text>
            </Space>
          }
          content={
            <Space direction="vertical">
              {qcMetrics.map((d, i) => (
                <Text key={i} type={qcMetricsClasses[d.code.toLowerCase()]}>
                  {d.title}
                </Text>
              ))}
            </Space>
          }
        >
          {qcEvaluationTag}
        </Popover>
      ) : (
        qcEvaluationTag
      );

    let colorMarkers = { ...msiLabels };

    orderListViewFilters.forEach((d) => {
      let plot = plots.find((e) => e.id === d.attribute);
      let markValue = datasetHasField(dataset, d.attribute)
        ? getNestedValue(metadata, d.attribute)
        : null;
      colorMarkers[`${d.attribute}`] =
        markValue != null
          ? getColorMarker(markValue, plot?.q1, plot?.q3)
          : "gray";
    });

    const createTooltip = (translationKey, valueKey, formatString = "20") => {
      const value = valueKey
        .split(".")
        .reduce((acc, key) => acc?.[key], metadata);
      return value !== undefined ? (
        <span
          dangerouslySetInnerHTML={{
            __html: t(translationKey, {
              count: value,
              value: isNaN(value) ? value : d3.format(formatString)(value),
            }),
          }}
        />
      ) : null;
    };
    let tooltips = {
      tumor_median_coverage: (
        <Space direction="vertical" size="small">
          {createTooltip(
            "metadata.m_reads_mapped",
            "coverage_qc.m_reads_mapped"
          )}
          {createTooltip("metadata.m_reads", "coverage_qc.m_reads")}
          {createTooltip(
            "metadata.percent_duplication",
            "coverage_qc.percent_duplication",
            ".2%"
          )}
          {createTooltip(
            "metadata.percent_optical_dups_of_dups",
            "coverage_qc.percent_optical_dups_of_dups",
            ".2%"
          )}
          {coverageQCFields().map((field, index) => {
            const tooltip = createTooltip(
              `metadata.${field.variable}`,
              `coverage_qc.${field.variable}`,
              field.format
            );
            return tooltip ? <span key={field}>{tooltip}</span> : null;
          })}
        </Space>
      ),
      sv_count: (
        <Space direction="vertical" size="small">
          {createTooltip("metadata.junction_count", "junction_count")}
          {createTooltip("metadata.loose_count", "loose_count")}
          {sv_countFields.map((field, index) => {
            const tooltip = createTooltip(
              `metadata.${field}_count`,
              `sv_types_count.${field}`,
              valueFormat(field)
            );
            return tooltip ? <span key={field}>{tooltip}</span> : null;
          })}
        </Space>
      ),
      "hrd.b1_2_score": (
        <span>
          {hrdFields
            .filter(
              (field) =>
                (!Array.isArray(dataset?.schema) ||
                  datasetHasField(dataset, `hrd.${field}`)) &&
                getNestedValue(metadata, `hrd.${field}`) !== null
            )
            .map((field, index) => {
              const tooltip = createTooltip(
                `metadata.hrd.${field}`,
                `hrd.${field}`,
                valueFormat(`hrd.${field}`)
              );
              let divider = hrdDividers[`hrd.${field}`] ? (
                <Divider orientation="left" plain className="tooltip-divider">
                  <span
                    dangerouslySetInnerHTML={{
                      __html: t(`metadata.hrd.${hrdDividers[`hrd.${field}`]}`),
                    }}
                  />
                </Divider>
              ) : null;
              return tooltip ? (
                <span className="hrd-tooltip" key={field}>
                  {divider}
                  <span key={field}>{tooltip}</span>
                </span>
              ) : null;
            })}
        </span>
      ),
      "msisensor.label": (
        <Space direction="vertical" size="small">
          {msiFields
            .filter((field) => {
              const fieldId = ["score", "label"].includes(field)
                ? "msisensor.score"
                : `msisensor.${field}`;
              return (
                (!Array.isArray(dataset?.schema) ||
                  datasetHasField(dataset, fieldId)) &&
                getNestedValue(metadata, `msisensor.${field}`) !== null
              );
            })
            .map((field, index) => {
              const tooltip = createTooltip(
                `metadata.msisensor.${field}`,
                `msisensor.${field}`,
                valueFormat(`msisensor.${field}`)
              );
              return tooltip ? <span key={field}>{tooltip}</span> : null;
            })}
        </Space>
      ),
      snv_count: createTooltip(
        "metadata.snv_count_normal_vaf_greater0",
        "snv_count_normal_vaf_greater0"
      ),
    };

    tooltips = Object.entries(tooltips)
      .filter(
        ([key, value]) =>
          value?.props?.children
            ?.flat()
            .filter((item) => item !== null && item.type !== "br").length > 0
      )
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});

    const hasMetadataBadges =
      inferred_sex != null || Boolean(qcMetricsComponent);
    const summaryFields = headerList.filter((field) =>
      datasetHasField(dataset, field === "msisensor.label" ? "msisensor.score" : field),
    );
    const hasPurityPloidy = datasetHasField(dataset, "purity") || datasetHasField(dataset, "ploidy");
    const chaoSummary = this.chaoSummary();

    return (
      <Wrapper>
        <PageHeader
          className="site-page-header"
          title={
            <Space size="small" wrap>
              {this.renderTitle()}
            </Space>
          }
          subTitle={
            <Space
              size={hasMetadataBadges ? 24 : 0}
              className="metadata-header-toolbar"
            >
              {hasMetadataBadges ? (
                <Space size="small" className="metadata-header-badges">
                  {inferred_sex != null ? (
                    <Tooltip
                      title={t("components.header-panel.patient-sex-tooltip")}
                      placement="bottom"
                      color="#27496b"
                    >
                      <Tag
                        className="patient-sex-badge"
                        aria-label={`${t(
                          "components.header-panel.patient-sex-tooltip",
                        )}: ${inferred_sex}`}
                      >
                        {inferred_sex}
                      </Tag>
                    </Tooltip>
                  ) : null}
                  {qcMetricsComponent}
                </Space>
              ) : null}
              <Space size="small" className="metadata-header-actions">
                {this.renderPatientLevelViewButton()}
                <ReportButtonsPanel />
                <Tooltip
                  title={
                    t("components.header-panel.cbioportal-button") ||
                    "cBioPortal"
                  }
                  placement="bottom"
                  color="#27496b"
                >
                  <Button
                    type="text"
                    className="header-badge-button"
                    onClick={this.handleCbioportalModalOpen}
                    aria-label={
                      t("components.header-panel.cbioportal-button") || "cBioPortal"
                    }
                  >
                    <img
                      src={cbioportalIcon}
                      alt=""
                      className="header-badge-image"
                    />
                  </Button>
                </Tooltip>
                <Tooltip
                  title={
                    t("components.header-panel.clinical-trials-button") ||
                    "Clinical Trials"
                  }
                  placement="bottom"
                  color="#27496b"
                >
                  <Button
                    type="text"
                    className="header-badge-button"
                    onClick={this.handleClinicalTrialsModalOpen}
                    aria-label={
                      t("components.header-panel.clinical-trials-button") ||
                      "Clinical Trials"
                    }
                  >
                    <img
                      src={ctgovLogo}
                      alt=""
                      className="header-badge-image"
                    />
                  </Button>
                </Tooltip>
              </Space>
            </Space>
          }
          extra={
            <Space size={[0, 4]} wrap>
              <Tag color={legendColors()[0]}>{t("metadata.tags.tag1")}</Tag>
              <Tag color={legendColors()[1]}>{t("metadata.tags.tag2")}</Tag>
              <Tag color={legendColors()[2]}>{t("metadata.tags.tag3")}</Tag>
            </Space>
          }
        >
          <div className="ant-pro-page-container-detail">
            <div className="ant-pro-page-container-main">
              <div className="ant-pro-page-container-row">
                <div className="ant-pro-page-container-content">
                  <div className="page-header-content">
                    <div className="case-metadata-summary">
                      {tumor_type ? (
                        <Avatar
                          size="large"
                          style={{ backgroundColor: "#fde3cf", color: "#f56a00" }}
                        >
                          {tumor_type}
                        </Avatar>
                      ) : null}
                      <div className="case-metadata-fields">
                        <div className="case-metadata-line">
                          {disease != null && <span>{disease}</span>}
                          {isMyeloSeqReportStyle(dataset) ? (
                            <PrimarySiteSelect />
                          ) : primarySite && (
                            <span>{primarySite.label}</span>
                          )}
                          {tumor_details != null && <span>{tumor_details}</span>}
                        </div>
                        {[
                          treatment,
                          treatment_type,
                          treatment_best_response,
                          treatment_duration,
                        ].some((item) => item != null) && (
                          <Space wrap>
                            <Text type="secondary">{t("metadata.treatment")}: </Text>
                            {treatment}
                            <Text type="secondary">{t("metadata.treatment_type")}: </Text>
                            {treatment_type}
                            <Text type="secondary">{t("metadata.treatment_best_response")}: </Text>
                            {treatment_best_response}
                            <Text type="secondary">{t("metadata.treatment_duration")}: </Text>
                            {treatment_duration}
                          </Space>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {(summaryFields.length > 0 || hasPurityPloidy || chaoSummary) && (
                <div className="ant-pro-page-container-extraContent">
                  <div className="extra-content">
                    {summaryFields.map((d) => (
                        <Tooltip
                          key={`components.header-panel.metadata.${d}.short`}
                          title={tooltips[d]}
                        >
                          <div className="stat-item">
                            <div className="ant-statistic">
                              <div
                                className={`ant-statistic-title ${
                                  tooltips[d] ? "has-tooltip" : ""
                                }`}
                              >
                                {t(
                                  `components.header-panel.metadata.${d}.short`
                                )}
                              </div>
                              <div className="ant-statistic-content">
                                <span className="ant-statistic-content-value">
                                  <span
                                    className="ant-statistic-content-value-int"
                                    style={{
                                      color: isNaN(getNestedValue(metadata, d))
                                        ? colorMarkers[
                                            getNestedValue(metadata, d)
                                          ]
                                        : colorMarkers[d],
                                    }}
                                  >
                                    {d === "tumor_median_coverage"
                                      ? `${
                                          metadata["tumor_median_coverage"] !=
                                          null
                                            ? `${metadata["tumor_median_coverage"]}X`
                                            : t("general.not-applicable")
                                        } / ${
                                          metadata["normal_median_coverage"] !=
                                          null
                                            ? `${metadata["normal_median_coverage"]}X`
                                            : t("general.not-applicable")
                                        }`
                                      : getNestedValue(metadata, d) != null
                                      ? isNaN(getNestedValue(metadata, d))
                                        ? getNestedValue(metadata, d)
                                        : d3.format(valueFormat(d))(
                                            getNestedValue(metadata, d)
                                          )
                                      : t("general.not-applicable")}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </Tooltip>
                      ))}

                    {hasPurityPloidy && (
                      <div className="stat-item">
                        <div className="ant-statistic">
                          <div className="ant-statistic-title">
                            {t("components.header-panel.purity-ploidy-title")}
                          </div>
                          <div className="ant-statistic-content">
                            <span className="ant-statistic-content-value">
                              <span
                                className="ant-statistic-content-value-int"
                                style={{
                                  color: colorMarkers["purity"],
                                }}
                              >
                                {purity != null
                                  ? d3.format(valueFormat("purity"))(+purity)
                                  : t("general.not-applicable")}
                              </span>
                            </span>
                            <span className="ant-statistic-content-suffix">
                              {" "}
                              <span className="purity-ploidy-separator">
                                /
                              </span>{" "}
                              <span
                                style={{
                                  color: colorMarkers["ploidy"],
                                }}
                              >
                                {ploidy != null
                                  ? d3.format(valueFormat("ploidy"))(+ploidy)
                                  : t("general.not-applicable")}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {chaoSummary && (
                      <div className="stat-item">
                        <div className="ant-statistic">
                          <div className="ant-statistic-title">
                            {t("components.header-panel.chao-title")}
                          </div>
                          <div className="ant-statistic-content">
                            <span className="ant-statistic-content-value">
                              <span className="ant-statistic-content-value-int">
                                {chaoSummary}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                )}
              </div>
            </div>
          </div>
        </PageHeader>
        <CbioportalModal
          visible={this.state.cbioportalModalVisible}
          onCancel={this.handleCbioportalModalClose}
          loading={this.props.loading}
        />
        <ClinicalTrialsModal
          visible={this.state.clinicalTrialsModalVisible}
          onCancel={this.handleClinicalTrialsModalClose}
        />
      </Wrapper>
    );
  }
}
HeaderPanel.propTypes = {
  canReturnToResults: PropTypes.bool,
  onBackToResults: PropTypes.func,
  selectedCase: PropTypes.object,
};
HeaderPanel.defaultProps = {
  canReturnToResults: false,
  onBackToResults: null,
};
const mapStateToProps = (state) => ({
  report: state.CaseReport.id,
  dataset: state.Settings.dataset,
  domains: state.Settings.domains,
  chromoBins: state.Settings.chromoBins,
  metadata: state.CaseReport.metadata,
  plots: state.PopulationStatistics.general,
  loading: state.FilteredEvents?.loading || false,
});
export default connect(mapStateToProps)(
  withTranslation("common")(HeaderPanel),
);
