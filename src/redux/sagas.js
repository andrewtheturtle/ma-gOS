import { all } from "redux-saga/effects";
import datasetsSagas from "./datasets/saga";
import caseReportsSagas from "./caseReports/saga";
import caseReportSagas from "./caseReport/saga";
import populationStatisticsSagas from "./populationStatistics/saga";
import filteredEventsSagas from "./filteredEvents/saga";
import SageQcSagas from "./sageQc/saga";
import PpfitSagas from "./ppfit/saga";
import SettingsSagas from "./settings/saga";
import GenesSagas from "./genes/saga";
import GenomeSagas from "./genome/saga";
import GenomeCoverageSagas from "./genomeCoverage/saga";
import MethylationBetaCoverageSagas from "./methylationBetaCoverage/saga";
import MethylationIntensityCoverageSagas from "./methylationIntensityCoverage/saga";
import HetsnpsSagas from "./hetsnps/saga";
import MutationsSagas from "./mutations/saga";
import AllelicSagas from "./allelic/saga";
import FixedAllelicSagas from "./fixedAllelic/saga";
import signatureStatisticsSagas from "./signatureStatistics/saga";
import signatureProfilesSagas from "./signatureProfiles/saga";
import biomarkersSagas from "./biomarkers/saga";
import curatedGenesSagas from "./curatedGenes/saga";
import igvSagas from "./igv/saga";
import highlightsSagas from "./highlights/saga";
import snvplicitySagas from "./snvplicity/saga";
import cytobandsSagas from "./cytobands/saga";
import interpretationsSagas from "./interpretations/saga";
import caseInterpretationImportSagas from "./caseInterpretationImport/saga";

export default function* rootSaga(getState) {
  yield all([
    datasetsSagas(),
    caseReportsSagas(),
    caseReportSagas(),
    populationStatisticsSagas(),
    filteredEventsSagas(),
    SageQcSagas(),
    PpfitSagas(),
    SettingsSagas(),
    GenesSagas(),
    GenomeSagas(),
    GenomeCoverageSagas(),
    MethylationBetaCoverageSagas(),
    MethylationIntensityCoverageSagas(),
    HetsnpsSagas(),
    MutationsSagas(),
    AllelicSagas(),
    FixedAllelicSagas(),
    signatureStatisticsSagas(),
    signatureProfilesSagas(),
    biomarkersSagas(),
    curatedGenesSagas(),
    igvSagas(),
    highlightsSagas(),
    snvplicitySagas(),
    cytobandsSagas(),
    interpretationsSagas(),
    caseInterpretationImportSagas(),
  ]);
}
