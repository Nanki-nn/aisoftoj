import type { UserConfigExport } from '@tarojs/cli'

export default {
  defineConstants: {
    'process.env.TARO_APP_API_BASE_URL': JSON.stringify(
      process.env.TARO_APP_API_BASE_URL || 'http://localhost:8080'
    )
  },
  mini: {}
} satisfies UserConfigExport
