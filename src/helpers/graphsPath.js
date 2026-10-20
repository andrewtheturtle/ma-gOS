import { call } from "redux-saga/effects";
import axios from "axios";
import { getCancelToken } from "./cancelToken";
import { isMissingDataError, isMissingDataResponse } from "./dataAvailability";

/**
 * Saga helper: path of a case's graph file. A dataset may set `graphsPath`
 * to a directory of replacement files (`<graphsPath><case>/<filename>`),
 * used when present; otherwise the file comes from `dataPath` as usual. This
 * lets a dataset reuse another dataset's case files while serving its own
 * genome / allelic graphs and full-density hetsnps.
 */
export function* resolveGraphPath(dataset, id, filename) {
  const fallback = `${dataset.dataPath}${id}/${filename}`;
  if (!dataset.graphsPath) return fallback;
  const override = `${dataset.graphsPath}${id}/${filename}`;
  try {
    const response = yield call(axios.head, override, {
      cancelToken: getCancelToken(),
    });
    return isMissingDataResponse(response) ? fallback : override;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    if (isMissingDataError(error)) return fallback;
    throw error;
  }
}
