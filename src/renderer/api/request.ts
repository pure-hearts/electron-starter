/**
 * @file request.ts
 * @description 统一 HTTP 请求层封装：
 * 1. 提供配置了环境变量 VITE_API_BASE_URL、超时控制与 normalizeRequestError 脱敏拦截器的 `request` (AxiosInstance)；
 * 2. 基于 `@vueuse/integrations/useAxios` 封装预绑定 `request` 实例的响应式请求函数 `useAxios`，
 *    在 Web 端与 Electron 端均可一行代码获取 `{ data, isLoading, isFinished, error, isCanceled, abort, execute }`。
 */

import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import {
  useAxios as useVueUseAxios,
  type StrictUseAxiosReturn,
  type UseAxiosOptionsBase,
} from "@vueuse/integrations/useAxios";
import { normalizeRequestError } from "./errors";

export const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || undefined,
  timeout: 10000,
});

// 统一响应拦截：自动将取消、超时、HTTP 状态码与未知异常标准化并脱敏
request.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normalizeRequestError(error)),
);

/**
 * 预绑定项目 `request` 实例的响应式 `useAxios` 组合式函数。
 *
 * @param url 请求地址
 * @param config Axios 请求配置（method, params, data, headers 等）
 * @param options VueUse 选项（如 `{ immediate: false, resetOnExecute: true, onSuccess, onError }`）
 */
export function useAxios<
  T = unknown,
  R = AxiosResponse<T>,
  D = unknown,
  O extends UseAxiosOptionsBase<T> = UseAxiosOptionsBase<T>,
>(
  url: string,
  config: AxiosRequestConfig<D> = {},
  options?: O,
): StrictUseAxiosReturn<T, R, D, O> & Promise<StrictUseAxiosReturn<T, R, D, O>> {
  return useVueUseAxios<T, R, D, O>(url, config, request, options);
}
