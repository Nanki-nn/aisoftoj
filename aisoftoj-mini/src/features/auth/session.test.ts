import { describe, expect, it } from 'vitest'
import type { StoragePort } from '../../adapters/storage'
import { clearAuthSession, loadAuthSession, saveAuthSession } from './session'

function memoryStorage(): StoragePort {
  const data = new Map<string, string>()
  return {
    get: (key) => data.get(key),
    set: (key, value) => { data.set(key, value) },
    remove: (key) => { data.delete(key) }
  }
}

describe('auth session', () => {
  it('round-trips a regular student session', () => {
    const storage = memoryStorage()
    saveAuthSession({ token: 'jwt', user: { id: '7', role: 'USER', nickname: '小知' } }, storage)
    expect(loadAuthSession(storage)).toEqual({
      token: 'jwt',
      user: { id: '7', role: 'USER', nickname: '小知' }
    })
  })

  it('rejects malformed or non-student cached identities', () => {
    const storage = memoryStorage()
    saveAuthSession({ token: 'jwt', user: { id: '1', role: 'ADMIN' } }, storage)
    expect(loadAuthSession(storage)).toBeNull()
    clearAuthSession(storage)
    expect(loadAuthSession(storage)).toBeNull()
  })
})
