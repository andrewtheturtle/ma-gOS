import { all, takeEvery, put, call, select } from "redux-saga/effects";
import axios from "axios";
import actions from "./actions";
import { dataToGenome } from "../../helpers/utility";
import { getCurrentState } from "./selectors";
import { getCancelToken } from "../../helpers/cancelToken";
import {
  isMissingDataError,
  isMissingDataResponse,
} from "../../helpers/dataAvailability";
import { resolveGraphPath } from "../../helpers/graphsPath";

function* fetchData(action) {
  const currentState = yield select(getCurrentState);
  const { dataset, chromoBins } = currentState.Settings;
  const { id } = currentState.CaseReport;
  let filePath = `${dataset.dataPath}${id}/complex.json`;
  try {
    filePath = yield call(resolveGraphPath, dataset, id, "complex.json");
    const availabilityResponse = yield call(axios.head, filePath, {
      cancelToken: getCancelToken(),
    });
    if (isMissingDataResponse(availabilityResponse)) {
      yield put({ type: actions.FETCH_GENOME_DATA_MISSING });
      return;
    }

    let responseGenomeData = yield call(axios.get, filePath, {
      cancelToken: getCancelToken(),
    });

    let data = responseGenomeData.data || {
      settings: {},
      intervals: [],
      connections: [],
      intervalBins: {},
      frameConnections: [],
    };

    yield put({
      type: actions.FETCH_GENOME_DATA_SUCCESS,
      data: dataToGenome(data, chromoBins),
    });
  } catch (error) {
    if (axios.isCancel(error)) {
      console.log(
        `fetch ${filePath} request canceled`,
        error.message
      );
    } else if (isMissingDataError(error)) {
      yield put({
        type: actions.FETCH_GENOME_DATA_MISSING,
      });
    } else {
      yield put({
        type: actions.FETCH_GENOME_DATA_FAILED,
        error,
      });
    }
  }
}

function* actionWatcher() {
  yield takeEvery(actions.FETCH_GENOME_DATA_REQUEST, fetchData);
}
export default function* rootSaga() {
  yield all([actionWatcher()]);
}
