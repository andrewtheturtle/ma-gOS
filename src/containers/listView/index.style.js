import styled from "styled-components";

const Wrapper = styled.div`
  .ant-home-header-container {
    margin: 0px;
    background: white;
    border: 1px solid rgb(235, 237, 240);
    padding-bottom: 0px;
  }
  .chat-float-button {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 100;
    width: 60px;
    height: 60px;
    font-size: 24px;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

    &:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
  }
  .ant-home-content-container {
    margin: 24px;
    margin-top: -45.5px;
  }
  .ant-panel-container {
    margin-top: 24px;
    margin-botton: 24px;
  }
  .ant-panel-list-container {
    margin: 24px;
  }

  .cardinality-tooltip {
    pointer-events: none;
    z-index: 10;
    max-width: 280px;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    font-size: 12px;
    line-height: 1.5;
  }
  .cardinality-tooltip-location {
    font-family: monospace;
    font-size: 11px;
    word-break: break-all;
    color: #595959;
  }
  .cardinality-tooltip-warning {
    color: #cf1322;
    font-size: 11px;
  }
  .cardinality-tooltip-hint {
    color: #8c8c8c;
    font-size: 11px;
  }
  .filters-box .ant-form-item {
    margin-bottom: 10px;
  }
  .filters-box .ant-form-item-label {
    padding: 0px !important;
  }
  .filters-box .ant-card-head-title {
    min-width: 0;
    white-space: normal;
  }
  .filters-card-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .results-top-box,
  .results-bottom-box {
    margin: 24px 0px;
  }
  .results-top-box .order-selector-container {
    text-align: right;
  }

  .cohort-comparison-toolbar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }
  .cohort-comparison-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }
  .cohort-comparison-select-wrap {
    flex: 0 1 640px;
    min-width: 0;
  }
  .cohort-comparison-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .cohort-comparison-legend-swatch {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
    background: #4e79a7;
  }
  .cohort-comparison-legend-swatch.current {
    background: #999999;
  }

  .order-select {
    width: 340px;
  }

  .stats .ant-statistic-content-value,
  .stats .ant-statistic-content-suffix {
    font-size: 16px;
  }
  .case-report-card .ant-card-body {
    min-height: 120px;
  }
  .filters-collapse {
    margin-left: -12px;
  }
  .tags-container {
    width: 100%;
    align-items: stretch;
    margin-bottom: 10px;
  }
  .tags-container .ant-form-item {
    margin-bottom: 0;
  }
  .tags-container > .tags-operator-item.ant-form-item {
    flex: 0 0 22px;
  }
  .tags-container > .tags-cascader-item.ant-form-item {
    flex: 1 1 auto;
    min-width: 0;
  }
  .tags-operators-select {
    width: 100%;
    height: auto;
  }
  .tags-cascader {
    width: 100%;
  }
  .case-report-ellipsis-text {
    max-width: 150px;
    font-size: 16px;
  }

  /* Aggregations Panel Styles */
  .aggregation-panel-card {
    margin-top: 16px;
  }
  .aggregation-panel-header {
    margin-bottom: 16px;
  }
  .aggregation-field-selector {
    margin-bottom: 16px;
    display: flex;
    align-items: center;
  }
  .aggregation-loading {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 200px;
  }
  .aggregation-table-container {
    margin-top: 16px;
  }
  .aggregation-table-header {
    margin-bottom: 12px;
  }
  .aggregation-total-row {
    background-color: #fafafa;
  }

  /* Aggregations Visualization Styles */
  .aggregation-visualization-container {
    padding: 16px 0;
    min-height: 450px;
  }
  .aggregation-visualization-container .plot-container {
    overflow: visible;
  }
  .aggregation-visualization-container .ant-select {
    font-size: 12px;
  }
  .filter-slider-space {
    width: 100%;
  }
  .filter-slider-inputs {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 8px;
  }
  .filter-slider-input {
    display: flex;
    flex-direction: column;
    flex: 1;
  }
  .filter-slider-input-label {
    font-size: 12px;
    color: #666;
    margin-bottom: 4px;
    text-align: left;
  }
  .filter-slider-input .align-right {
    text-align: right;
  }
  .filter-slider-input:first-child {
    align-items: flex-start;
  }
  .filter-slider-input:last-child {
    align-items: flex-end;
    text-align: right;
  }
`;

export default Wrapper;
