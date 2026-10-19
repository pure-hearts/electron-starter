import axios from 'axios'
export const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || undefined,
  timeout: 10000
})
request.interceptors.response.use(
  response => response,
  error => Promise.reject(error instanceof Error ? error : new Error(String(error)))
)
