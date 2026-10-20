import { all, takeEvery, put, call, select } from "redux-saga/effects";
import { loadArrowTable } from "../../helpers/utility";
import actions from "./actions";
import { getCurrentState } from "./selectors";
import { getCancelToken } from "../../helpers/cancelToken";
import { splitFloat64 } from "../../helpers/utility.js";
import axios from "axios";
import {
  isMissingDataError,
  isMissingDataResponse,
} from "../../helpers/dataAvailability";
import { resolveGraphPath } from "../../helpers/graphsPath";

function* fetchArrowData(plot) {
  yield loadArrowTable(plot.path, getCancelToken())
    .then((results) => (plot.data = results))
    .catch((error) => {
      console.log(plot.path, error);
      plot.data = null;
    });
}

function* fetchData(action) {
  try {
    const currentState = yield select(getCurrentState);
    const { dataset } = currentState.Settings;
    const { id, metadata } = currentState.CaseReport;
    const filePath = yield call(resolveGraphPath, dataset, id, "hetsnps.arrow");

    const availabilityResponse = yield call(axios.head, filePath, {
      cancelToken: getCancelToken(),
    });
    if (isMissingDataResponse(availabilityResponse)) {
      yield put({ type: actions.FETCH_HETSNPS_DATA_MISSING });
      return;
    }

    let hetsnpsPlot = {
      path: filePath,
      data: null,
    };

    yield call(fetchArrowData, hetsnpsPlot);

    let dataPointsCount = hetsnpsPlot.data.getChild("y").toArray();
    let dataPointsCopyNumber = dataPointsCount.map(
      (d) => d * (metadata?.hets_slope || 1) + (metadata?.hets_intercept || 0)
    );
    let dataPointsX = hetsnpsPlot.data.getChild("x").toArray();
    let dataPointsXHigh = [];
    let dataPointsXLow = [];
    dataPointsX.forEach((v) => {
      const [hi, lo] = splitFloat64(v);
      dataPointsXHigh.push(hi);
      dataPointsXLow.push(lo);
    });
    let dataPointsColor = hetsnpsPlot.data.getChild("color").toArray();

    yield put({
      type: actions.FETCH_HETSNPS_DATA_SUCCESS,
      dataPointsCount,
      dataPointsCopyNumber,
      dataPointsX,
      dataPointsXHigh,
      dataPointsXLow,
      dataPointsColor,
    });
  } catch (error) {
    if (isMissingDataError(error)) {
      yield put({
        type: actions.FETCH_HETSNPS_DATA_MISSING,
      });
    } else {
      yield put({
        type: actions.FETCH_HETSNPS_DATA_FAILED,
        error,
      });
    }
  }
}

function* actionWatcher() {
  yield takeEvery(actions.FETCH_HETSNPS_DATA_REQUEST, fetchData);
}
export default function* rootSaga() {
  yield all([actionWatcher()]);
}
