import { describe, expect, it } from 'vitest'
import { validateReleaseConfig } from './check-release.mjs'

describe('release configuration gate', () => {
  it('accepts an HTTPS release configuration with domain checking', () => {
    expect(validateReleaseConfig({
      apiBaseUrl: 'https://api.example.com',
      appVersion: '1.0.0',
      projectConfig: { appid: 'wx1234567890abcdef', setting: { urlCheck: true } }
    })).toEqual([])
  })

  it('rejects development endpoints, placeholders and disabled domain checks', () => {
    expect(validateReleaseConfig({
      apiBaseUrl: 'http://172.16.1.2:8080',
      appVersion: 'next',
      projectConfig: { appid: 'touristappid', setting: { urlCheck: false } }
    })).toEqual(expect.arrayContaining([
      '正式 API 必须使用 HTTPS',
      '正式 API 不得指向本机或私有网段',
      'TARO_APP_VERSION 必须使用 x.y.z 格式',
      '正式项目配置必须提供非占位微信 AppID',
      '正式项目配置必须启用合法域名检查'
    ]))
  })
})
