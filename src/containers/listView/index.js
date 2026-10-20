import React, { Component } from "react";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import {
  Row,
  Col,
  Card,
  Statistic,
  Avatar,
  Space,
  Select,
  Form,
  Button,
  Empty,
  Pagination,
  Typography,
  Cascader,
  Flex,
  Divider,
  DatePicker,
  InputNumber,
  Slider,
  Collapse,
  Tag,
  Tabs,
  message,
} from "antd";
import * as d3 from "d3";
import dayjs from "dayjs";
import {
  snakeCaseToHumanReadable,
  orderListViewFilters,
} from "../../helpers/utility";
import { qcMetricsClasses } from "../../helpers/metadata";
import {
  generateCascaderOptions,
  cascaderOperators,
  cascaderSearchFilter,
} from "../../helpers/filters";
import { normalizeSpecimenDateRangeFilter } from "../../helpers/specimenDate";
import Wrapper from "./index.style";
import ContainerDimensions from "react-container-dimensions";
import InterpretationsAvatar from "../../components/interpretationsAvatar";
import AggregationsPanel from "./aggregationsPanel";
import CohortsPanel from "./cohortsPanel";
import CardinalityPanel from "./cardinalityPanel";
import HistogramPlot from "../../components/histogramPlot";
import ParallelCoordinatesPanel from "../../components/parallelCoordinatesPanel";
import SavedQueryButton from "../../components/savedQueryButton";
import SavedQueryEditModal from "../../components/savedQueryEditModal";
import caseReportsActions from "../../redux/caseReports/actions";
import {
  datasetHasField,
  getSourceScopedFieldValue,
  sourceCaseIdentityKey,
  sourceDatasetHasField,
} from "../../helpers/browseScope";
import { userAuthRepository } from "../../helpers/userAuth";

const {
  applyFavoriteSearch,
  deleteFavoriteSearch,
  fetchFavoriteSearches,
  saveFavoriteSearch,
} = caseReportsActions;

const { SHOW_CHILD } = Cascader;
const PATIENT_FILTER_OPTIONS_LIMIT = 100;

const { Meta } = Card;
const { Option } = Select;
const { Text, Paragraph } = Typography;
const { Compact } = Space;
const { Item } = Form;
const { RangePicker } = DatePicker;

export class ListView extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isChatOpen: false,
      activeTab: props.listViewTarget?.tab || "cases",
      favoriteModalOpen: false,
      favoriteName: "",
      editingFavoriteSearch: null,
      favoriteSavePending: false,
      selectSearchTextByFilter: {},
    };
  }

  formRef = React.createRef();
  cascaderOptionsCache = {};
  selectOptionsCache = {};

  recordHasField = (record, field) =>
    datasetHasField(this.props.dataset, field) &&
    sourceDatasetHasField(
      record,
      this.props.datasets,
      field,
      this.props.dataset,
    );

  recordFieldValue = (record, field) =>
    this.recordHasField(record, field)
      ? getSourceScopedFieldValue(
          record,
          this.props.datasets,
          field,
          this.props.dataset,
        )
      : undefined;

  componentDidMount() {
    this.handleSavedSearchUserChanged = () =>
      this.props.fetchFavoriteSearches();
    userAuthRepository.emitter.on(
      "userChanged",
      this.handleSavedSearchUserChanged,
    );
    this.props.fetchFavoriteSearches();
  }

  componentWillUnmount() {
    userAuthRepository.emitter.off(
      "userChanged",
      this.handleSavedSearchUserChanged,
    );
  }

  renderCascaderOption = (option) => {
    const { t } = this.props;
    const labelText =
      typeof option?.label === "string" || typeof option?.label === "number"
        ? option.label
        : undefined;
    return (
      <div className="filter-option-container">
        <span className="filter-option-text" title={labelText}>
          {option?.label}
        </span>
        {option?.count != null && option?.children == null && (
          <span className="filter-option-count">
            {t("containers.list-view.filters.case", {
              count: option?.count,
            })}
          </span>
        )}
      </div>
    );
  };

  renderSelectOption = (option) => {
    const { t } = this.props;
    const { label, count } = option.data || {};
    return (
      <div className="filter-option-container">
        <span className="filter-option-text" title={label}>
          {label}
        </span>
        {count != null && (
          <span className="filter-option-count">
            {t("containers.list-view.filters.case", {
              count,
            })}
          </span>
        )}
      </div>
    );
  };

  getCascaderOptions = (filterState) => {
    if (filterState.options) return filterState.options;

    const filterName = filterState.filter.name;
    const cache = this.cascaderOptionsCache[filterName];
    if (
      cache &&
      cache.records === filterState.records &&
      cache.frequencies === filterState.frequencies
    ) {
      return cache.options;
    }

    const options = generateCascaderOptions(
      filterState.records || [],
      filterState.frequencies || {},
    );
    this.cascaderOptionsCache[filterName] = {
      records: filterState.records,
      frequencies: filterState.frequencies,
      options,
    };
    return options;
  };

  filterSelectOption = (input, option = {}) =>
    this.selectOptionMatchesSearch(option, (input || "").toLowerCase());

  selectOptionMatchesSearch = (option = {}, searchText = "") =>
    (option.searchText || option.label || option.value || "")
      .toString()
      .toLowerCase()
      .includes(searchText);

  getSelectOptions = (filterState) => {
    const filterName = filterState.filter.name;
    const emptyLabel = this.props.t("containers.list-view.filters.empty");
    const cache = this.selectOptionsCache[filterName];
    if (
      cache &&
      cache.records === filterState.records &&
      cache.frequencies === filterState.frequencies &&
      cache.emptyLabel === emptyLabel
    ) {
      return cache.options;
    }

    const options = (filterState.records || []).map((value) => {
      const valueText = value == null ? "" : value.toString();
      const label = value
        ? filterName === "sourceDatasetTitle"
          ? valueText
          : snakeCaseToHumanReadable(value)
        : emptyLabel;
      return {
        label,
        value: value || "null",
        count: filterState.frequencies?.[value] || 0,
        searchText: `${label} ${valueText}`,
      };
    });
    this.selectOptionsCache[filterName] = {
      records: filterState.records,
      frequencies: filterState.frequencies,
      emptyLabel,
      options,
    };
    return options;
  };

  getSelectedSelectValues = (filterName) => {
    const selectedValue = this.props.searchFilters?.[filterName];
    if (Array.isArray(selectedValue)) return selectedValue;
    if (selectedValue == null || selectedValue === "") return [];
    return [selectedValue];
  };

  getVisibleSelectOptions = (filterState) => {
    const options = this.getSelectOptions(filterState);
    const filterName = filterState.filter.name;
    if (filterName !== "patient_id") return options;

    const searchText = (
      this.state.selectSearchTextByFilter[filterName] || ""
    ).trim().toLowerCase();
    let visibleOptions = searchText
      ? options
        .filter((option) => this.selectOptionMatchesSearch(option, searchText))
        .slice(0, PATIENT_FILTER_OPTIONS_LIMIT)
      : options.slice(0, PATIENT_FILTER_OPTIONS_LIMIT);

    const visibleValues = new Set(
      visibleOptions.map((option) => option.value?.toString()),
    );
    this.getSelectedSelectValues(filterName).forEach((selectedValue) => {
      const selectedKey = selectedValue?.toString();
      if (visibleValues.has(selectedKey)) return;
      const selectedOption = options.find(
        (option) => option.value?.toString() === selectedKey,
      );
      if (selectedOption) {
        visibleOptions = [selectedOption, ...visibleOptions];
        visibleValues.add(selectedKey);
      }
    });

    return visibleOptions;
  };

  handleSelectSearch = (filterName, value) => {
    this.setState((prevState) => ({
      selectSearchTextByFilter: {
        ...prevState.selectSearchTextByFilter,
        [filterName]: value || "",
      },
    }));
  };

  handleSelectOpenChange = (filterName, open) => {
    if (open || !this.state.selectSearchTextByFilter[filterName]) return;
    this.setState((prevState) => ({
      selectSearchTextByFilter: {
        ...prevState.selectSearchTextByFilter,
        [filterName]: "",
      },
    }));
  };

  handleTabChange = (key) => {
    this.setState({ activeTab: key });
  };

  handleChatClick = () => {
    this.setState((prevState) => ({
      isChatOpen: !prevState.isChatOpen,
    }));
  };

  onValuesChange = (values) => {
    this.props.onSearch({
      ...this.props.searchFilters,
      ...this.formRef.current.getFieldsValue(),
      page: 1,
      per_page: 10,
      orderId: 1,
    });
  };

  onReset = () => {
    const { filters, filtersExtents } = this.props;
    // Build reset values: sliders use their extent, date ranges clear their bounds, others empty array
    const resetValues = filters.reduce((acc, d) => {
      const name = d.filter.name;
      if (d.filter.renderer === "slider") {
        acc[name] = filtersExtents[name];
      } else if (d.filter.renderer === "date-range") {
        acc[name] = { from: undefined, to: undefined };
      } else {
        acc[name] = [];
      }
      // Set default operator for cascader filters
      if (d.filter.renderer === "cascader") {
        if (d.filter.external) {
          acc[`${name}-operator`] = cascaderOperators[0];
        } else {
          acc["operator"] = cascaderOperators[0];
        }
      }
      return acc;
    }, {});
    // Update form fields
    this.formRef.current.setFieldsValue(resetValues);
    // Trigger search with reset values and pagination defaults
    this.props.onSearch({
      ...resetValues,
      page: 1,
      per_page: 10,
      orderId: 1,
    });
  };

  componentDidUpdate(prevProps) {
    if (prevProps.searchFilters !== this.props.searchFilters) {
      this.formRef.current.setFieldsValue(this.props.searchFilters);
    }

    const saveFinished =
      this.state.favoriteSavePending &&
      !this.props.favoriteSearchesSaving &&
      (prevProps.favoriteSearchesSaving ||
        prevProps.favoriteSearches !== this.props.favoriteSearches ||
        Boolean(this.props.favoriteSearchesError));
    if (saveFinished) {
      if (this.props.favoriteSearchesError) {
        message.error(
          this.props.t("containers.list-view.favorites.operation-failed", {
            error:
              this.props.favoriteSearchesError?.message ||
              `${this.props.favoriteSearchesError}`,
          }),
        );
        this.setState({ favoriteSavePending: false });
      } else {
        this.setState(
          { favoriteSavePending: false },
          this.closeFavoriteModal,
        );
      }
    } else if (
      this.props.favoriteSearchesError &&
      prevProps.favoriteSearchesError !== this.props.favoriteSearchesError
    ) {
      message.error(
        this.props.t("containers.list-view.favorites.operation-failed", {
          error:
            this.props.favoriteSearchesError?.message ||
            `${this.props.favoriteSearchesError}`,
        }),
      );
    }
  }

  getCurrentSearchFiltersForFavorite = () => ({
    ...this.props.searchFilters,
    ...(this.formRef.current?.getFieldsValue?.() || {}),
    page: 1,
    per_page: this.props.searchFilters?.per_page || 10,
    orderId: this.props.searchFilters?.orderId || 1,
  });

  getOperatorLabel = (operator) => {
    const normalizedOperator = (operator || "OR").toUpperCase();
    return this.props.t(
      `containers.list-view.favorites.description.operators.${normalizedOperator}`,
    );
  };

  formatFavoriteFilterValue = (filter, value) => {
    if (value == null) return "";
    if (filter?.renderer === "slider" && !isNaN(value)) {
      return d3.format(filter.format || ",.2f")(value);
    }
    if (Array.isArray(value)) return value[value.length - 1];
    return `${value}`;
  };

  isFavoriteSliderApplied = (filterName, value) => {
    const extent = this.props.filtersExtents?.[filterName];
    return (
      Array.isArray(value) &&
      value.length >= 2 &&
      Array.isArray(extent) &&
      (Number(value[0]) !== Number(extent[0]) ||
        Number(value[1]) !== Number(extent[1]))
    );
  };

  openFavoriteModal = () => {
    this.setState({
      favoriteModalOpen: true,
      favoriteName: this.props.t(
        "containers.list-view.favorites.default-name",
        { timestamp: new Date().toLocaleString() },
      ),
      editingFavoriteSearch: null,
    });
  };

  openFavoriteEditModal = (event, favoriteSearch) => {
    event?.stopPropagation?.();
    this.setState({
      favoriteModalOpen: true,
      favoriteName: favoriteSearch.name,
      editingFavoriteSearch: favoriteSearch,
    });
  };

  closeFavoriteModal = () => {
    this.setState({
      favoriteModalOpen: false,
      favoriteName: "",
      editingFavoriteSearch: null,
    });
  };

  buildFavoriteDescription = (searchFilters = {}) => {
    const { dataset, filters, t } = this.props;
    const clauses = [];

    if (searchFilters.texts) {
      clauses.push(
        t("containers.list-view.favorites.description.text-contains", {
          text: searchFilters.texts,
        }),
      );
    }

    (filters || []).forEach(({ filter }) => {
      const value = searchFilters[filter.name];
      if (
        value == null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0) ||
        filter.name === "tags"
      ) {
        return;
      }

      const field = filter.title || snakeCaseToHumanReadable(filter.name);
      if (filter.renderer === "date-range") {
        const range = normalizeSpecimenDateRangeFilter(value);
        if (!range) return;
        if (range.from) {
          clauses.push(
            t("containers.list-view.favorites.description.range-min", {
              field,
              value: range.from,
            }),
          );
        }
        if (range.to) {
          clauses.push(
            t("containers.list-view.favorites.description.range-max", {
              field,
              value: range.to,
            }),
          );
        }
        return;
      }

      if (filter.renderer === "slider") {
        if (!this.isFavoriteSliderApplied(filter.name, value)) return;
        clauses.push(
          t("containers.list-view.favorites.description.range-min", {
            field,
            value: this.formatFavoriteFilterValue(filter, value[0]),
          }),
          t("containers.list-view.favorites.description.range-max", {
            field,
            value: this.formatFavoriteFilterValue(filter, value[1]),
          }),
        );
        return;
      }

      const values = (Array.isArray(value) ? value : [value])
        .map((item) => this.formatFavoriteFilterValue(filter, item))
        .filter(Boolean);
      if (values.length > 0) {
        clauses.push(
          t("containers.list-view.favorites.description.includes", {
            field,
            values: values.join(", "),
          }),
        );
      }
    });

    const tags = (searchFilters.tags || [])
      .map((tag) =>
        this.formatFavoriteFilterValue({ renderer: "cascader" }, tag),
      )
      .filter(Boolean);
    if (tags.length > 0) {
      clauses.push(
        t("containers.list-view.favorites.description.tags", {
          operator: this.getOperatorLabel(searchFilters.operator),
          tags: tags.join(", "),
        }),
      );
    }

    const prefix = t("containers.list-view.favorites.description.prefix", {
      dataset:
        dataset?.title ||
        dataset?.id ||
        t("containers.list-view.favorites.description.selected-dataset"),
    });
    return clauses.length > 0
      ? t("containers.list-view.favorites.description.with-filters", {
          prefix,
          clauses: clauses.join(", "),
        })
      : t("containers.list-view.favorites.description.without-filters", {
          prefix,
        });
  };

  saveFavoriteSearch = () => {
    const { editingFavoriteSearch, favoriteName } = this.state;
    if (!favoriteName.trim()) return;
    const searchFilters =
      editingFavoriteSearch?.searchFilters ||
      this.getCurrentSearchFiltersForFavorite();

    this.setState({ favoriteSavePending: true });
    this.props.saveFavoriteSearch({
      id: editingFavoriteSearch?.id,
      searchId: editingFavoriteSearch?.searchId,
      datasetId: editingFavoriteSearch?.datasetId,
      createdAt: editingFavoriteSearch?.createdAt,
      name: favoriteName.trim(),
      description:
        editingFavoriteSearch?.description ||
        this.buildFavoriteDescription(searchFilters),
      resultCount:
        editingFavoriteSearch?.resultCount ?? this.props.totalReportsCount,
      searchFilters,
    });
  };

  handleDeleteFavoriteSearch = (event, favoriteId) => {
    event?.stopPropagation?.();
    this.props.deleteFavoriteSearch(favoriteId);
  };

  renderFiltersTitle = () => (
    <div className="filters-card-title">
      <span>{this.props.t("containers.list-view.filters.title")}</span>
      <SavedQueryButton
        currentSearchId={this.props.currentSearchId}
        favoriteSearchDeletingId={this.props.favoriteSearchDeletingId}
        favoriteSearches={this.props.favoriteSearches}
        favoriteSearchesLoading={this.props.favoriteSearchesLoading}
        favoriteSearchesSaving={this.props.favoriteSearchesSaving}
        loading={this.props.searchPending}
        onApplyFavoriteSearch={this.props.applyFavoriteSearch}
        onDeleteFavoriteSearch={this.handleDeleteFavoriteSearch}
        onEditFavoriteSearch={this.openFavoriteEditModal}
        onOpenFavoriteModal={this.openFavoriteModal}
      />
    </div>
  );

  onPageChanged = (page, per_page) => {
    let fieldValues = this.formRef.current.getFieldsValue();
    let searchFilters = {
      ...this.props.searchFilters,
      ...fieldValues,
      ...{ page: page, per_page: per_page },
    };
    this.props.onSearch(searchFilters);
  };

  onOrderChanged = (orderId) => {
    let fieldValues = this.formRef.current.getFieldsValue();
    let searchFilters = {
      ...this.props.searchFilters,
      ...fieldValues,
      ...{ page: 1, per_page: 10, orderId },
    };
    this.props.onSearch(searchFilters);
  };

  tagsDisplayRender = (labels, selectedOptions = []) =>
    labels.map((label, i) => {
      const option = selectedOptions[i];
      if (i === labels.length - 1) {
        return <span key={option?.value}>{label}</span>;
      }
      return <span key={option?.value}>{label}: </span>;
    });

  render() {
    const {
      t,
      records,
      handleCardClick,
      filters,
      searchFilters,
      filtersExtents,
      totalRecords,
      casesWithInterpretations,
      interpretationsCounts,
      datafiles,
      dataset,
      plots,
      favoriteSearchesSaving,
    } = this.props;
    const {
      favoriteModalOpen,
      favoriteName,
      editingFavoriteSearch,
    } = this.state;
    const modalSearchFilters =
      editingFavoriteSearch?.searchFilters ||
      this.getCurrentSearchFiltersForFavorite();

    const initialValues = {
      ...searchFilters,
    };

    let filterFormItemRenderer = (d) => {
      if (d.filter.renderer === "cascader") {
        return (
          <Compact block className="tags-container">
            <Item
              key={`containers.list-view.filters.${d.filter.name}-operator`}
              className="tags-operator-item"
              name={
                d.filter.external ? `${d.filter.name}-operator` : `operator`
              }
              label={t(
                `containers.list-view.filters.${d.filter.name}-operator`,
              )}
              initialValue={cascaderOperators[0]}
              rules={[
                {
                  required: false,
                },
              ]}
            >
              <Select className="tags-operators-select">
                {cascaderOperators.map((e, i) => (
                  <Option key={i} value={e}>
                    {t(`containers.list-view.filters.operators.${e}`)}
                  </Option>
                ))}
              </Select>
            </Item>
            <Item
              key={`containers.list-view.filters.${d.filter.name}`}
              className="tags-cascader-item"
              name={d.filter.name}
              label={t(`containers.list-view.filters.${d.filter.name}`)}
              rules={[
                {
                  required: false,
                },
              ]}
            >
              <Cascader
                placeholder={t("containers.list-view.filters.placeholder")}
                className="tags-cascader"
                options={this.getCascaderOptions(d)}
                displayRender={this.tagsDisplayRender}
                optionRender={this.renderCascaderOption}
                multiple
                showSearch={{
                  // PERFORMANCE OPTIMIZATION 1: Limit search results to 50 items
                  // This prevents the UI from trying to render thousands of search results
                  // which would cause the browser to become unresponsive
                  limit: 50,
                  filter: cascaderSearchFilter,
                  matchInputWidth: false,
                }}
                maxTagCount="responsive"
                showCheckedStrategy={SHOW_CHILD}
                allowClear
              />
            </Item>
          </Compact>
        );
      }

      if (d.filter.renderer === "date-range") {
        const extent = filtersExtents[d.filter.name] || d.extent || [];
        const minDate = extent?.[0] ? dayjs(extent[0]) : null;
        const maxDate = extent?.[1] ? dayjs(extent[1]) : null;
        return (
          <Item
            key={`containers.list-view.filters.${d.filter.name}`}
            label={d.filter.title}
          >
            <Item
              name={d.filter.name}
              noStyle
              getValueFromEvent={(_, dateStrings) => ({
                from: dateStrings?.[0] || undefined,
                to: dateStrings?.[1] || undefined,
              })}
              getValueProps={(value) => {
                const normalizedRange =
                  normalizeSpecimenDateRangeFilter(value) || {};
                return {
                  value: [
                    normalizedRange.from ? dayjs(normalizedRange.from) : null,
                    normalizedRange.to ? dayjs(normalizedRange.to) : null,
                  ],
                };
              }}
            >
              <RangePicker
                size="small"
                style={{ width: "100%" }}
                format="YYYY-MM-DD"
                allowClear
                allowEmpty={[true, true]}
                placeholder={[
                  t("containers.list-view.filters.date-range.from"),
                  t("containers.list-view.filters.date-range.to"),
                ]}
                disabledDate={(current) => {
                  if (!current) return false;
                  if (minDate && current.isBefore(minDate, "day")) return true;
                  if (maxDate && current.isAfter(maxDate, "day")) return true;
                  return false;
                }}
              />
            </Item>
          </Item>
        );
      }

      if (
        d.filter.renderer === "select" &&
        d.records &&
        d.records.length > 0 &&
        !d.records.every((e) => e == null)
      ) {
        return (
          <Item
            key={d.filter.name}
            name={d.filter.name}
            label={d.filter.title}
            rules={[
              {
                required: false,
              },
            ]}
          >
            <Select
              placeholder={t("containers.list-view.filters.placeholder")}
              mode="multiple"
              allowClear
              style={{ width: "100%" }}
              maxTagCount="responsive"
              maxTagTextLength={8}
              options={this.getVisibleSelectOptions(d)}
              labelInValue={false}
              optionFilterProp="label"
              optionRender={this.renderSelectOption}
              filterOption={
                d.filter.name === "patient_id"
                  ? false
                  : this.filterSelectOption
              }
              onSearch={(value) => this.handleSelectSearch(d.filter.name, value)}
              onOpenChange={(open) =>
                this.handleSelectOpenChange(d.filter.name, open)
              }
              showSearch
              virtual
              listHeight={256}
            />
          </Item>
        );
      }

      if (
        d.filter.renderer === "slider" &&
        filtersExtents[d.filter.name] &&
        !isNaN(filtersExtents[d.filter.name]?.[0]) &&
        !isNaN(filtersExtents[d.filter.name]?.[1])
      ) {
        let plot = plots.find((p) => p.id === d.filter.name);
        return (
          <Item
            key={`containers.list-view.filters.${d.filter.name}`}
            label={t(
              `containers.list-view.filters.${d.filter.name}`,
              d.filter.title || d.filter.name,
            )}
          >
            <Space direction="vertical" className="filter-slider-space">
              <div style={{ width: "100%", height: 120 }}>
                <ContainerDimensions>
                  {({ width, height }) => {
                    return (
                      plot && (
                        <div style={{ width: width, height: 120 }}>
                          <HistogramPlot
                            {...{
                              id: plot.id,
                              data: plot.data,
                              dataset: plot.dataset,
                              q1: plot.q1,
                              q3: plot.q3,
                              q99: plot.q99,
                              scaleX: plot.scaleX,
                              bandwidth: plot.bandwidth,
                              format: plot.format,
                              niceX: false,
                              range: filtersExtents[d.filter.name],
                              width: width,
                              height: 100,
                              margins: {
                                gapX: 10,
                                gapY: 12,
                                gap: 0,
                                yTicksCount: 10,
                                xTicksCount: 5,
                              },
                            }}
                          />
                        </div>
                      )
                    );
                  }}
                </ContainerDimensions>
              </div>
              <Item
                name={d.filter.name}
                noStyle
                initialValue={[
                  +filtersExtents[d.filter.name]?.[0],
                  +filtersExtents[d.filter.name]?.[1],
                ]}
              >
                <Slider
                  range
                  min={+filtersExtents[d.filter.name]?.[0]}
                  max={+filtersExtents[d.filter.name]?.[1]}
                  step={
                    (filtersExtents[d.filter.name]?.[1] -
                      filtersExtents[d.filter.name]?.[0]) /
                    100
                  }
                  marks={{
                    [+filtersExtents[d.filter.name]?.[0]]: d3.format(d.format)(
                      filtersExtents[d.filter.name]?.[0],
                    ),
                    [+filtersExtents[d.filter.name]?.[1]]: d3.format(d.format)(
                      filtersExtents[d.filter.name]?.[1],
                    ),
                  }}
                  tooltip={{
                    formatter: (value) => d3.format(d.format)(value),
                  }}
                />
              </Item>
              <Item
                noStyle
                shouldUpdate={(prev, cur) =>
                  prev?.[d.filter.name]?.toString() !==
                  cur?.[d.filter.name]?.toString()
                }
              >
                {({ getFieldValue, setFieldsValue }) => {
                  const current = getFieldValue(d.filter.name) || [];
                  const [currentMin, currentMax] = current;
                  const updateValue = (nextMin, nextMax) => {
                    const minValue =
                      nextMin ?? filtersExtents[d.filter.name]?.[0];
                    const maxValue =
                      nextMax ?? filtersExtents[d.filter.name]?.[1];
                    setFieldsValue({
                      [d.filter.name]: [minValue, maxValue],
                    });
                    // Trigger search just like the slider change does
                    this.onValuesChange({
                      [d.filter.name]: [minValue, maxValue],
                    });
                  };
                  const step =
                    (filtersExtents[d.filter.name]?.[1] -
                      filtersExtents[d.filter.name]?.[0]) /
                    100;
                  return (
                    <div className="filter-slider-inputs">
                      <div className="filter-slider-input">
                        <Text className="filter-slider-input-label">
                          {t("containers.list-view.filters.slider.min")}
                        </Text>
                        <InputNumber
                          size="small"
                          value={currentMin}
                          min={+filtersExtents[d.filter.name]?.[0]}
                          max={currentMax}
                          step={step}
                          precision={2}
                          onChange={(value) => updateValue(value, currentMax)}
                        />
                      </div>
                      <div className="filter-slider-input">
                        <Text className="filter-slider-input-label align-right">
                          {t("containers.list-view.filters.slider.max")}
                        </Text>
                        <InputNumber
                          size="small"
                          value={currentMax}
                          min={currentMin}
                          max={+filtersExtents[d.filter.name]?.[1]}
                          step={step}
                          precision={2}
                          onChange={(value) => updateValue(currentMin, value)}
                        />
                      </div>
                    </div>
                  );
                }}
              </Item>
            </Space>
          </Item>
        );
      }
      return null; // nothing for unknown renderer
    };

    return (
      <Wrapper>
        <SavedQueryEditModal
          open={favoriteModalOpen}
          favoriteName={favoriteName}
          favoriteSearchesSaving={favoriteSearchesSaving}
          isEditing={Boolean(editingFavoriteSearch)}
          description={
            editingFavoriteSearch?.description ||
            this.buildFavoriteDescription(modalSearchFilters)
          }
          resultCount={
            editingFavoriteSearch?.resultCount ?? totalRecords
          }
          onFavoriteNameChange={(nextName) =>
            this.setState({ favoriteName: nextName })
          }
          onSave={this.saveFavoriteSearch}
          onCancel={this.closeFavoriteModal}
        />
        <Form
          layout="vertical"
          initialValues={initialValues}
          ref={this.formRef}
          onFinish={this.onValuesChange}
          onValuesChange={this.onValuesChange}
        >
          <div className="ant-panel-list-container">
            <Row gutter={[16, 16]} align="stretch">
              <Col className="gutter-row" span={4} style={{ display: "flex" }}>
                <Card
                  className="filters-box"
                  title={this.renderFiltersTitle()}
                  style={{ flex: 1, display: "flex", flexDirection: "column" }}
                >
                  <>
                    {filters
                      .filter((d) => d.filter.group == null)
                      .map((e) => filterFormItemRenderer(e))}
                  </>
                  <Collapse
                    className="filters-collapse"
                    ghost
                    defaultActiveKey={"general"}
                    items={d3
                      .groups(
                        filters.filter((d) => d.filter.group != null),
                        (d) => d.filter.group,
                      )
                      .filter(
                        ([group, groupedItems]) =>
                          !groupedItems
                            .map((d) => d.records || d.options)
                            .flat()
                            .every((e) => e == null),
                      )
                      .map(([group, filteredGroups]) => {
                        return {
                          key: group,
                          label: filteredGroups[0]?.filter?.groupTitle,
                          children: (
                            <>
                              {filteredGroups.map((e) =>
                                filterFormItemRenderer(e),
                              )}
                            </>
                          ),
                        };
                      })}
                  />
                  <Space>
                    <Item>
                      <Button type="primary" htmlType="submit">
                        {t("containers.list-view.filters.submit")}
                      </Button>
                    </Item>
                    <Item>
                      <Button htmlType="button" onClick={this.onReset}>
                        {t("containers.list-view.filters.reset")}
                      </Button>
                    </Item>
                  </Space>
                </Card>
              </Col>
              <Col className="gutter-row" span={20}>
                <Tabs
                  activeKey={this.state.activeTab}
                  onChange={this.handleTabChange}
                  items={[
                    {
                      key: "cases",
                      label: t("containers.list-view.tabs.cases"),
                      children: (
                        <>
                          {records.length > 0 && (
                            <Row className="results-top-box" gutter={[16, 16]}>
                              <Col className="gutter-row" span={12}>
                                <Pagination
                                  showSizeChanger
                                  total={totalRecords}
                                  showTotal={(total, range) =>
                                    `${range[0]}-${range[1]} of ${total} items`
                                  }
                                  defaultCurrent={1}
                                  current={searchFilters.page || 1}
                                  pageSize={searchFilters.per_page || 10}
                                  onChange={this.onPageChanged}
                                />
                              </Col>
                              <Col
                                className="gutter-row order-selector-container"
                                span={12}
                              >
                                <Select
                                  className="order-select"
                                  value={searchFilters.orderId}
                                  onSelect={this.onOrderChanged}
                                  variant="borderless"
                                >
                                  {orderListViewFilters
                                    .filter(
                                      ({ attribute }) =>
                                        attribute === "pair" ||
                                        datasetHasField(dataset, attribute),
                                    )
                                    .map((d) => (
                                    <Option key={d.id} value={d.id}>
                                      <span
                                        dangerouslySetInnerHTML={{
                                          __html: t(
                                            "containers.list-view.ordering",
                                            {
                                              attribute: t(
                                                `components.header-panel.metadata.${d.attribute}.short`,
                                              ),
                                              sort: d.sort,
                                            },
                                          ),
                                        }}
                                      />
                                    </Option>
                                  ))}
                                </Select>
                              </Col>
                            </Row>
                          )}

                          <Row gutter={[16, 16]}>
                            {records.map((d) => (
                              <Col
                                key={sourceCaseIdentityKey(d) || d.pair}
                                className="gutter-row"
                                span={6}
                                style={{ display: "flex" }}
                              >
                                <Card
                                  className="case-report-card"
                                  styles={{
                                    body: {
                                      flex: 1,
                                      display: "flex",
                                      flexDirection: "column",
                                    },
                                  }}
                                  style={{
                                    flex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                  }}
                                  onClick={(e) => handleCardClick(e, d)}
                                  hoverable
                                  title={
                                    <Space>
                                      <Text
                                        strong
                                        ellipsis={{ tooltip: d.pair }}
                                        className="case-report-ellipsis-text"
                                      >
                                        {d.pair}
                                      </Text>
                                      {this.recordHasField(
                                        d,
                                        "inferred_sex",
                                      ) && (
                                        <Text type="secondary">
                                          {this.recordFieldValue(
                                            d,
                                            "inferred_sex",
                                          )}
                                        </Text>
                                      )}
                                      {d.qcEvaluation && (
                                        <Tag
                                          color={
                                            qcMetricsClasses[
                                              d.qcEvaluation.toLowerCase()
                                            ]
                                          }
                                          className="qc-evaluation-tag"
                                        >
                                          {d.qcEvaluation}
                                        </Tag>
                                      )}
                                    </Space>
                                  }
                                  variant="borderless"
                                  extra={
                                    <Space>
                                      <InterpretationsAvatar
                                        pair={d.caseReportId || d.pair}
                                        casesWithInterpretations={
                                          casesWithInterpretations
                                        }
                                        interpretationsCounts={
                                          interpretationsCounts
                                        }
                                      />
                                      {this.recordFieldValue(
                                        d,
                                        "tumor_type",
                                      ) ? (
                                        <Avatar
                                          style={{
                                            backgroundColor: "#fde3cf",
                                            color: "#f56a00",
                                          }}
                                        >
                                          {this.recordFieldValue(
                                            d,
                                            "tumor_type",
                                          )}
                                        </Avatar>
                                      ) : null}
                                    </Space>
                                  }
                                  actions={[
                                    this.recordHasField(d, "sv_count") ? (
                                      <Statistic
                                        className="stats"
                                        title={t(
                                          `components.header-panel.metadata.sv_count.short`,
                                        )}
                                        value={
                                          this.recordFieldValue(
                                            d,
                                            "sv_count",
                                          ) != null
                                            ? d3.format(",")(
                                                this.recordFieldValue(
                                                  d,
                                                  "sv_count",
                                                ),
                                              )
                                            : t("general.not-applicable")
                                        }
                                      />
                                    ) : null,
                                    this.recordHasField(d, "tmb") ? (
                                      <Statistic
                                        className="stats"
                                        title={t(
                                          `components.header-panel.metadata.tmb.short`,
                                        )}
                                        value={
                                          this.recordFieldValue(d, "tmb") !=
                                          null
                                            ? d3.format(",")(
                                                this.recordFieldValue(
                                                  d,
                                                  "tmb",
                                                ),
                                              )
                                            : t("general.not-applicable")
                                        }
                                      />
                                    ) : null,
                                    this.recordHasField(
                                      d,
                                      "tumor_median_coverage",
                                    ) ? (
                                      <Statistic
                                        className="stats"
                                        title={t(
                                          `components.header-panel.metadata.tumor_median_coverage.shorter`,
                                        )}
                                        value={`${
                                          this.recordFieldValue(
                                            d,
                                            "tumor_median_coverage",
                                          ) != null
                                            ? `${this.recordFieldValue(
                                                d,
                                                "tumor_median_coverage",
                                              )}X`
                                            : t("general.not-applicable")
                                        } / ${
                                          d["normal_median_coverage"] != null
                                            ? `${d["normal_median_coverage"]}X`
                                            : t("general.not-applicable")
                                        }`}
                                      />
                                    ) : null,
                                    this.recordHasField(d, "purity") ||
                                    this.recordHasField(d, "ploidy") ? (
                                      <Statistic
                                        className="stats"
                                        title={t(
                                          "components.header-panel.purity-ploidy-title",
                                        )}
                                        value={
                                          this.recordFieldValue(d, "purity") !=
                                          null
                                            ? d3.format(".1%")(
                                                this.recordFieldValue(
                                                  d,
                                                  "purity",
                                                ),
                                              )
                                            : t("general.not-applicable")
                                        }
                                        suffix={`/ ${
                                          this.recordFieldValue(d, "ploidy") !=
                                          null
                                            ? d3.format(".2f")(
                                                this.recordFieldValue(
                                                  d,
                                                  "ploidy",
                                                ),
                                              )
                                            : t("general.not-applicable")
                                        }`}
                                      />
                                    ) : null,
                                  ].filter(Boolean)}
                                >
                                  <Meta
                                    title={
                                      [
                                        "disease",
                                        "primary_site",
                                        "tumor_details",
                                      ].some(
                                        (field) =>
                                          this.recordFieldValue(d, field) !=
                                          null,
                                      ) && (
                                        <Paragraph>
                                          {this.recordFieldValue(
                                            d,
                                            "disease",
                                          ) != null && (
                                            <Text type="primary">
                                              {this.recordFieldValue(
                                                d,
                                                "disease",
                                              )}
                                            </Text>
                                          )}
                                          {this.recordFieldValue(
                                            d,
                                            "primary_site",
                                          ) != null && (
                                            <Text type="secondary">
                                              <br />
                                              {snakeCaseToHumanReadable(
                                                this.recordFieldValue(
                                                  d,
                                                  "primary_site",
                                                ),
                                              )}
                                            </Text>
                                          )}
                                          {this.recordFieldValue(
                                            d,
                                            "tumor_details",
                                          ) != null && (
                                            <Text type="secondary">
                                              <br />
                                              {snakeCaseToHumanReadable(
                                                this.recordFieldValue(
                                                  d,
                                                  "tumor_details",
                                                ),
                                              )}
                                            </Text>
                                          )}
                                        </Paragraph>
                                      )
                                    }
                                    description={
                                      this.recordHasField(d, "tags") ? (
                                        <Space
                                          direction="vertical"
                                          size={0}
                                          style={{ display: "flex" }}
                                        >
                                          {generateCascaderOptions(
                                            d.visibleTags,
                                          ).map((tag, i) => (
                                            <div key={`tag-${tag.value}-${i}`}>
                                              <Divider
                                                plain
                                                orientation="left"
                                                size="small"
                                              >
                                                {tag.label}
                                              </Divider>
                                              <Flex gap="2px" wrap="wrap">
                                                {tag.children.map((child) => (
                                                  <Text key={child.value} code>
                                                    {child.label}
                                                  </Text>
                                                ))}
                                              </Flex>
                                            </div>
                                          ))}
                                        </Space>
                                      ) : null
                                    }
                                  />
                                </Card>
                              </Col>
                            ))}
                          </Row>
                          {records.length > 0 && (
                            <Row
                              className="results-bottom-box"
                              gutter={[16, 16]}
                            >
                              <Col className="gutter-row" span={24}>
                                <Pagination
                                  showSizeChanger
                                  total={totalRecords}
                                  showTotal={(total, range) =>
                                    `${range[0]}-${range[1]} of ${total} items`
                                  }
                                  defaultCurrent={1}
                                  current={searchFilters.page || 1}
                                  pageSize={searchFilters.per_page || 10}
                                  onChange={this.onPageChanged}
                                />
                              </Col>
                            </Row>
                          )}
                          {records.length < 1 && (
                            <Card>
                              <Empty
                                description={t("containers.list-view.no_data")}
                              />
                            </Card>
                          )}
                        </>
                      ),
                    },
                    {
                      key: "aggregations",
                      label: t("containers.list-view.tabs.aggregations"),
                      children: (
                        <AggregationsPanel
                          datafiles={datafiles}
                          searchFilters={searchFilters}
                          dataset={dataset}
                          initialActiveTab={
                            this.props.listViewTarget?.aggregationsTab
                          }
                          visualizationPreset={
                            this.props.listViewTarget?.visualizationPreset
                          }
                          focusVisualization={
                            this.props.listViewTarget?.focusVisualization === true
                          }
                        />
                      ),
                    },
                    {
                      key: "cohorts",
                      label: t("containers.list-view.tabs.cohorts"),
                      children: <CohortsPanel />,
                    },
                    {
                      key: "parallelCoordinates",
                      label: t(
                        "containers.list-view.tabs.parallel-coordinates",
                      ),
                      children: (
                        <ParallelCoordinatesPanel
                          data={plots}
                          handleCardClick={handleCardClick}
                        />
                      ),
                    },
                    ...(dataset?.cardinalityPath
                      ? [
                          {
                            key: "cardinality",
                            label: t("containers.list-view.tabs.cardinality"),
                            children: <CardinalityPanel dataset={dataset} />,
                          },
                        ]
                      : []),
                  ]}
                />
              </Col>
            </Row>
          </div>
        </Form>
      </Wrapper>
    );
  }
}
ListView.propTypes = {};
ListView.defaultProps = {
  searchFilters: { per_page: 10, page: 1, orderId: 1 },
  filtersExtents: {},
};
const mapDispatchToProps = (dispatch) => ({
  applyFavoriteSearch: (favoriteId) =>
    dispatch(applyFavoriteSearch(favoriteId)),
  deleteFavoriteSearch: (favoriteId) =>
    dispatch(deleteFavoriteSearch(favoriteId)),
  fetchFavoriteSearches: () => dispatch(fetchFavoriteSearches()),
  saveFavoriteSearch: (favoriteSearch) =>
    dispatch(saveFavoriteSearch(favoriteSearch)),
});
const mapStateToProps = (state) => ({
  currentSearchId: state.CaseReports.currentSearchId,
  favoriteSearchDeletingId: state.CaseReports.favoriteSearchDeletingId,
  favoriteSearches: state.CaseReports.favoriteSearches,
  favoriteSearchesError: state.CaseReports.favoriteSearchesError,
  favoriteSearchesLoading: state.CaseReports.favoriteSearchesLoading,
  favoriteSearchesSaving: state.CaseReports.favoriteSearchesSaving,
  searchPending: state.CaseReports.searchPending,
  totalReportsCount: state.CaseReports.totalReportsCount,
  casesWithInterpretations: state.CaseReports.casesWithInterpretations,
  interpretationsCounts: state.CaseReports.interpretationsCounts,
  plots: state.PopulationStatistics.cohort,
  datasets: state.Datasets.records,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(withTranslation("common")(ListView));
