import Taro from '@tarojs/taro'
import {
  getMiniProgramContentCrypto,
  requireEncryptedResponse,
  type EncryptedContentEnvelope
} from '../adapters/content-crypto'
import { miniStorage } from '../adapters/storage'
import { AUTH_TOKEN_KEY, clearAuthSession, saveAuthSession } from '../features/auth/session'
import { mapPaper } from '../features/papers/mapper'
import type {
  ApiResult,
  AuthResponse,
  AuthUser,
  PaperDTO,
  PaperSummary,
  PracticeSessionDTO,
  QuestionDTO
} from '../types/api'
import { ApiRequestError, buildRequestHeaders, normalizeApiBaseUrl, unwrapApiResult } from './http-core'

const API_BASE_URL = normalizeApiBaseUrl(process.env.TARO_APP_API_BASE_URL)

async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH'
    data?: unknown
    token?: string
    encrypted?: boolean
  } = {}
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('未配置小程序后端服务地址')
  }
  const token = options.token || miniStorage.get(AUTH_TOKEN_KEY)
  const header = buildRequestHeaders(token)
  if (options.encrypted) {
    Object.assign(header, await getMiniProgramContentCrypto().requestHeaders())
  }
  const response = await Taro.request<ApiResult<T> | EncryptedContentEnvelope>({
    url: `${API_BASE_URL}${path}`,
    method: options.method || 'GET',
    data: options.data,
    header
  })
  try {
    let payload: unknown = response.data
    if (options.encrypted && response.statusCode >= 200 && response.statusCode < 300) {
      requireEncryptedResponse(response.header)
      payload = await getMiniProgramContentCrypto().decrypt<ApiResult<T>>(response.data)
    }
    return unwrapApiResult<T>(payload, response.statusCode)
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

export async function fetchPaperQuestions(paperId: string): Promise<QuestionDTO[]> {
  return request<QuestionDTO[]>(`/paper/detail/${encodeURIComponent(paperId)}`, { encrypted: true })
}

export async function startPracticeSession(
  paperId: string,
  mode: 'practice' | 'exam'
): Promise<PracticeSessionDTO> {
  return request<PracticeSessionDTO>('/session/start', {
    method: 'POST',
    data: { paperId: Number(paperId), mode: mode === 'exam' ? 2 : 1 },
    encrypted: true
  })
}

export async function fetchPracticeSession(sessionId: string): Promise<PracticeSessionDTO> {
  return request<PracticeSessionDTO>(`/session/${encodeURIComponent(sessionId)}`, { encrypted: true })
}

export async function fetchPracticeResult(sessionId: string): Promise<PracticeSessionDTO> {
  return request<PracticeSessionDTO>(
    `/session/${encodeURIComponent(sessionId)}/result`,
    { encrypted: true }
  )
}
