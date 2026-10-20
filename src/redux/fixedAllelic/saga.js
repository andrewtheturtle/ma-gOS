import { all, takeEvery, put, call, select } from "redux-saga/effects";
import axios from "axios";
import { allelicToGenome } from "../../helpers/utility";
import { dataToGenome } from "../../helpers/utility";
import actions from "./actions";
import { getCurrentState } from "./selectors";
import { getCancelToken } from "../../helpers/cancelToken";
import {
  isMissingDataError,
  isMissingDataResponse,
} from "../../helpers/dataAvailability";
import { resolveGraphPath } from "../../helpers/graphsPath";

// partially phased (fix.phase) allelic graph: only served from a dataset's graphsPath
function* fetchData(action) {
  const currentState = yield select(getCurrentState);
  const { dataset, chromoBins } = currentState.Settings;
  const { id } = currentState.CaseReport;
  if (!dataset.graphsPath) {
    yield put({ type: actions.FETCH_FIXED_ALLELIC_DATA_MISSING });
    return;
  }
  let filePath = `${dataset.dataPath}${id}/fixed.json`;
  try {
    filePath = yield call(resolveGraphPath, dataset, id, "fixed.json");
    const availabilityResponse = yield call(axios.head, filePath, {
      cancelToken: getCancelToken(),
    });
    if (isMissingDataResponse(availabilityResponse)) {
      yield put({ type: actions.FETCH_FIXED_ALLELIC_DATA_MISSING });
      return;
    }

    let responseFixedData = yield call(axios.get, filePath, {
      cancelToken: getCancelToken(),
    });
    let data = allelicToGenome(
      responseFixedData.data || {
        settings: {},
        intervals: [],
        connections: [],
        intervalBins: {},
        frameConnections: [],
      }
    );

    yield put({
      type: actions.FETCH_FIXED_ALLELIC_DATA_SUCCESS,
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
        type: actions.FETCH_FIXED_ALLELIC_DATA_MISSING,
      });
    } else {
      yield put({
        type: actions.FETCH_FIXED_ALLELIC_DATA_FAILED,
        error,
      });
    }
  }
}

function* actionWatcher() {
  yield takeEvery(actions.FETCH_FIXED_ALLELIC_DATA_REQUEST, fetchData);
}
export default function* rootSaga() {
  yield all([actionWatcher()]);
}
