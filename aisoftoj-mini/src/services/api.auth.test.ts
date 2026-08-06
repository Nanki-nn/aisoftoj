import { beforeEach, describe, expect, it, vi } from 'vitest'

const taro = vi.hoisted(() => {
  const data = new Map<string, string>()
  return {
    data,
    request: vi.fn(),
    getStorageSync: vi.fn((key: string) => data.get(key)),
    setStorageSync: vi.fn((key: string, value: string) => data.set(key, value)),
    removeStorageSync: vi.fn((key: string) => data.delete(key))
  }
})

vi.mock('@tarojs/taro', () => ({ default: taro }))

describe('password authentication', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('TARO_APP_API_BASE_URL', 'http://localhost:8080')
    taro.data.clear()
    taro.request.mockReset()
  })

  it('logs in through the existing API and saves the student session', async () => {
    taro.request.mockResolvedValue({
      statusCode: 200,
      header: {},
      data: {
        code: 200,
        message: 'ok',
        timestamp: 1,
        data: { token: 'jwt', user: { id: '7', role: 'USER', nickname: '演示同学' } }
      }
    })
    const { loginByPassword } = await import('./api')

    await expect(loginByPassword('demo@example.com', 'password-123')).resolves.toMatchObject({ token: 'jwt' })
    expect(taro.request).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://localhost:8080/auth/login',
      method: 'POST',
      data: { email: 'demo@example.com', password: 'password-123' }
    }))
    expect(taro.data.get('aisoftoj.auth.token')).toBe('jwt')
    expect(JSON.parse(taro.data.get('aisoftoj.auth.user') || '{}')).toMatchObject({ id: '7', role: 'USER' })
  })

  it('rejects non-student identities without saving them', async () => {
    taro.request.mockResolvedValue({
      statusCode: 200,
      header: {},
      data: {
        code: 200,
        message: 'ok',
        timestamp: 1,
        data: { token: 'admin-jwt', user: { id: '1', role: 'ADMIN' } }
      }
    })
    const { loginByPassword } = await import('./api')

    await expect(loginByPassword('admin@example.com', 'password-123')).rejects.toThrow('当前账号不可用于学生端')
    expect(taro.data.has('aisoftoj.auth.token')).toBe(false)
  })
})
