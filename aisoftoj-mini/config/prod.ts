import type { UserConfigExport } from '@tarojs/cli'

export default {
  projectConfigName: process.env.TARO_APP_PROJECT_CONFIG || 'project.config.json',
  mini: {}
} satisfies UserConfigExport
