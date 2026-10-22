import axios from "axios";
import { normalizeRequestError } from "./errors";

export const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || undefined,
  timeout: 10000,
});
// Pass AbortSignal in ordinary Axios request options when cancellation is needed.
request.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normalizeRequestError(error)),
);
