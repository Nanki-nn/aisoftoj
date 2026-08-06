import type { StoragePort } from '../../adapters/storage'
import type { AuthResponse, AuthUser } from '../../types/api'

export const AUTH_TOKEN_KEY = 'aisoftoj.auth.token'
export const AUTH_USER_KEY = 'aisoftoj.auth.user'

export interface StoredAuthSession {
  token: string
  user: AuthUser
}

export function saveAuthSession(
  response: AuthResponse,
  storage: StoragePort
): StoredAuthSession {
  storage.set(AUTH_TOKEN_KEY, response.token)
  storage.set(AUTH_USER_KEY, JSON.stringify(response.user))
  return response
}

export function loadAuthSession(storage: StoragePort): StoredAuthSession | null {
  const token = storage.get(AUTH_TOKEN_KEY)
  const rawUser = storage.get(AUTH_USER_KEY)
  if (!token || !rawUser) {
    return null
  }
  try {
    const user = JSON.parse(rawUser) as AuthUser
    if (!user || typeof user.id !== 'string' || user.role !== 'USER') {
      clearAuthSession(storage)
      return null
    }
    return { token, user }
  } catch {
    clearAuthSession(storage)
    return null
  }
}

export function clearAuthSession(storage: StoragePort): void {
  storage.remove(AUTH_TOKEN_KEY)
  storage.remove(AUTH_USER_KEY)
}
