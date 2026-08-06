import { describe, expect, it } from 'vitest'
import { ApiRequestError, buildRequestHeaders, normalizeApiBaseUrl, unwrapApiResult } from './http-core'

describe('http core', () => {
  it('normalizes the API base URL without inventing a production host', () => {
    expect(normalizeApiBaseUrl(' https://api.example.com/// ')).toBe('https://api.example.com')
    expect(normalizeApiBaseUrl(undefined)).toBe('')
  })

  it('injects the bearer token only when present', () => {
    expect(buildRequestHeaders()).toEqual({ 'Content-Type': 'application/json' })
    expect(buildRequestHeaders('jwt')).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer jwt'
    })
  })

  it('unwraps successful responses and preserves API failures', () => {
    expect(unwrapApiResult({ code: 200, message: 'ok', data: { id: 7 } }, 200)).toEqual({ id: 7 })
    expect(() => unwrapApiResult({ code: 409, message: '版本冲突', data: null }, 409))
      .toThrowError(ApiRequestError)
  })
})
