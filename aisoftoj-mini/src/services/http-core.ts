import type { ApiResult } from '../types/api'

export class ApiRequestError extends Error {
  readonly status: number
  readonly code?: number

  constructor(message: string, status: number, code?: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
  }
}

export function normalizeApiBaseUrl(value: string | undefined): string {
  return (value || '').trim().replace(/\/+$/, '')
}

export function buildRequestHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

export function unwrapApiResult<T>(payload: unknown, status: number): T {
  const result = payload as Partial<ApiResult<T>> | null
  if (status < 200 || status >= 300 || !result || result.code !== 200) {
    throw new ApiRequestError(
      result?.message || `请求失败: ${status}`,
      status,
      result?.code
    )
  }
  return result.data as T
}
