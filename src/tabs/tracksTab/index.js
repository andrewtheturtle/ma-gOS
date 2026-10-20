import React, { Component } from "react";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import Wrapper from "./index.style";
import TracksModal from "../../components/tracksModal";

class TracksTab extends Component {
  render() {
    const {
      t,
      genome,
      mutations,
      chromoBins,
      genomeCoverage,
      methylationBetaCoverage,
      methylationIntensityCoverage,
      hetsnps,
      genes,
      igv,
      allelic,
      fixedAllelic,
      updateSelectedFilteredEvent,
    } = this.props;

    return (
      <Wrapper>
        <TracksModal
          {...{
            loading: genome.loading,
            genome,
            mutations,
            genomeCoverage,
            methylationBetaCoverage,
            methylationIntensityCoverage,
            hetsnps,
            genes,
            igv,
            chromoBins,
            allelic,
            fixedAllelic,
            modalTitle: "",
            genomePlotTitle: t("components.tracks-modal.genome-plot"),
            genomePlotYAxisTitle: t(
              "components.tracks-modal.genome-y-axis-title"
            ),
            coveragePlotTitle: t("components.tracks-modal.coverage-plot"),
            coverageYAxisTitle: t(
              "components.tracks-modal.coverage-copy-number"
            ),
            coverageYAxis2Title: t("components.tracks-modal.coverage-count"),
            methylationBetaCoveragePlotTitle: t(
              "components.tracks-modal.methylation-beta-coverage-plot"
            ),
            methylationBetaCoverageYAxisTitle: t(
              "components.tracks-modal.methylation-beta-coverage-y-axis-title"
            ),
            methylationBetaCoverageYAxis2Title: t(
              "components.tracks-modal.methylation-beta-coverage-y-axis2-title"
            ),
            methylationIntensityCoveragePlotTitle: t(
              "components.tracks-modal.methylation-intensity-coverage-plot"
            ),
            methylationIntensityCoverageYAxisTitle: t(
              "components.tracks-modal.methylation-intensity-coverage-y-axis-title"
            ),
            methylationIntensityCoverageYAxis2Title: t(
              "components.tracks-modal.methylation-intensity-coverage-y-axis2-title"
            ),
            hetsnpPlotTitle: t("components.tracks-modal.hetsnp-plot"),
            hetsnpPlotYAxisTitle: t(
              "components.tracks-modal.hetsnp-copy-number"
            ),
            hetsnpPlotYAxis2Title: t("components.tracks-modal.hetsnp-count"),
            mutationsPlotTitle: t("components.tracks-modal.mutations-plot"),
            mutationsPlotYAxisTitle: t(
              "components.tracks-modal.mutations-plot-y-axis-title"
            ),
            allelicPlotTitle: t("components.tracks-modal.allelic-plot"),
            allelicPlotYAxisTitle: t(
              "components.tracks-modal.allelic-plot-y-axis-title"
            ),
            fixedAllelicPlotTitle: t("components.tracks-modal.fixed-allelic-plot"),
            handleOkClicked: () => updateSelectedFilteredEvent(null),
            handleCancelClicked: () => updateSelectedFilteredEvent(null),
            open: true,
            viewType: "inline",
            legendPanelPinned: true,
          }}
        />
      </Wrapper>
    );
  }
}
TracksTab.propTypes = {};
TracksTab.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({});
const mapStateToProps = (state) => ({
  genome: state.Genome,
  mutations: state.Mutations,
  allelic: state.Allelic,
  fixedAllelic: state.FixedAllelic,
  chromoBins: state.Settings.chromoBins,
  genomeCoverage: state.GenomeCoverage,
  methylationBetaCoverage: state.MethylationBetaCoverage,
  methylationIntensityCoverage: state.MethylationIntensityCoverage,
  hetsnps: state.Hetsnps,
  genes: state.Genes,
  igv: state.Igv,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(TracksTab));
