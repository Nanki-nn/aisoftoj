import Taro from '@tarojs/taro'
import { miniStorage } from '../adapters/storage'
import { AUTH_TOKEN_KEY, clearAuthSession, saveAuthSession } from '../features/auth/session'
import { mapPaper } from '../features/papers/mapper'
import type { ApiResult, AuthResponse, AuthUser, PaperDTO, PaperSummary } from '../types/api'
import { ApiRequestError, buildRequestHeaders, normalizeApiBaseUrl, unwrapApiResult } from './http-core'

const API_BASE_URL = normalizeApiBaseUrl(process.env.TARO_APP_API_BASE_URL)

async function request<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PATCH'; data?: unknown; token?: string } = {}
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('未配置小程序后端服务地址')
  }
  const token = options.token || miniStorage.get(AUTH_TOKEN_KEY)
  const response = await Taro.request<ApiResult<T>>({
    url: `${API_BASE_URL}${path}`,
    method: options.method || 'GET',
    data: options.data,
    header: buildRequestHeaders(token)
  })
  try {
    return unwrapApiResult<T>(response.data, response.statusCode)
  } catch (error) {
    if (
      response.statusCode === 401 ||
      (error instanceof ApiRequestError && error.code === 401)
    ) {
      clearAuthSession(miniStorage)
    }
    throw error
  }
}

export async function loginByWechat(): Promise<AuthResponse> {
  const loginResult = await Taro.login()
  if (!loginResult.code) {
    throw new Error('微信登录未返回有效凭证')
  }
  const auth = await request<AuthResponse>('/auth/wechat/login', {
    method: 'POST',
    data: { code: loginResult.code }
  })
  if (auth.user.role !== 'USER') {
    throw new Error('当前微信账号不可用于学生端')
  }
  saveAuthSession(auth, miniStorage)
  return auth
}

export async function restoreCurrentUser(token: string): Promise<AuthUser> {
  const user = await request<AuthUser>('/auth/me', { token })
  if (user.role !== 'USER') {
    clearAuthSession(miniStorage)
    throw new Error('当前账号不可用于学生端')
  }
  saveAuthSession({ token, user }, miniStorage)
  return user
}

export async function fetchPapers(): Promise<PaperSummary[]> {
  const papers = await request<PaperDTO[]>('/paper/list')
  return papers.filter((paper) => paper.paperCateId !== 3).map(mapPaper)
}
