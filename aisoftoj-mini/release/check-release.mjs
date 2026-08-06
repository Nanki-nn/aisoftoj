import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const PLACEHOLDER_APP_IDS = new Set(['touristappid', 'wx0000000000000000'])

function isLocalHostname(hostname) {
  return hostname === 'localhost' || hostname === '::1' || hostname.endsWith('.local') ||
    /^(127\.|0\.0\.0\.0$|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)
}

export function validateReleaseConfig({ apiBaseUrl, appVersion, projectConfig }) {
  const errors = []
  let apiUrl
  try {
    apiUrl = new URL(apiBaseUrl)
  } catch {
    errors.push('TARO_APP_API_BASE_URL 必须是有效 URL')
  }
  if (apiUrl) {
    if (apiUrl.protocol !== 'https:') errors.push('正式 API 必须使用 HTTPS')
    if (isLocalHostname(apiUrl.hostname)) errors.push('正式 API 不得指向本机或私有网段')
    if (apiUrl.username || apiUrl.password) errors.push('正式 API URL 不得内嵌凭据')
  }
  if (!/^\d+\.\d+\.\d+$/.test(appVersion || '')) {
    errors.push('TARO_APP_VERSION 必须使用 x.y.z 格式')
  }
  if (!projectConfig || typeof projectConfig !== 'object') {
    errors.push('正式项目配置不可读取')
    return errors
  }
  if (!/^wx[A-Za-z0-9]{16}$/.test(projectConfig.appid || '') || PLACEHOLDER_APP_IDS.has(projectConfig.appid)) {
    errors.push('正式项目配置必须提供非占位微信 AppID')
  }
  if (projectConfig.setting?.urlCheck !== true) {
    errors.push('正式项目配置必须启用合法域名检查')
  }
  return errors
}

export function checkEnvironment(env = process.env, cwd = process.cwd()) {
  const configName = env.TARO_APP_PROJECT_CONFIG || ''
  const errors = []
  if (!configName || configName === 'project.config.json') {
    errors.push('TARO_APP_PROJECT_CONFIG 必须指向独立的正式项目配置')
  }
  const configPath = configName ? path.resolve(cwd, configName) : ''
  let projectConfig
  if (configPath) {
    try {
      projectConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    } catch {
      errors.push('无法读取 TARO_APP_PROJECT_CONFIG 指定的 JSON 文件')
    }
  }
  return errors.concat(validateReleaseConfig({
    apiBaseUrl: env.TARO_APP_API_BASE_URL || '',
    appVersion: env.TARO_APP_VERSION || '',
    projectConfig
  }))
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (invokedDirectly) {
  const errors = checkEnvironment()
  if (errors.length) {
    console.error(`正式构建检查失败：\n- ${errors.join('\n- ')}`)
    process.exitCode = 1
  } else {
    console.log('正式构建配置检查通过')
  }
}
