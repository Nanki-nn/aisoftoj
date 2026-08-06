import { Text, View } from '@tarojs/components'
import './index.scss'

export default function PrivacyPage() {
  return <View className='page-shell privacy-page'>
    <Text className='eyebrow'>数据与隐私</Text>
    <Text className='page-title'>隐私说明</Text>
    <Text className='page-note'>知构软考仅使用完成登录、刷题和学习记录同步所需的数据。</Text>
    <View className='privacy-section'>
      <Text className='privacy-section__number'>01</Text>
      <View><Text className='privacy-section__title'>账号信息</Text><Text className='privacy-section__body'>微信登录凭证仅用于换取平台账号；可选邮箱用于账号找回与跨端合并，不会在小程序本地保存登录密码。</Text></View>
    </View>
    <View className='privacy-section'>
      <Text className='privacy-section__number'>02</Text>
      <View><Text className='privacy-section__title'>学习记录</Text><Text className='privacy-section__body'>答案、练习进度、错题和统计用于恢复会话与生成复盘。断网草稿只保存题目编号和你的答案，不缓存题干、解析或参考答案。</Text></View>
    </View>
    <View className='privacy-section'>
      <Text className='privacy-section__number'>03</Text>
      <View><Text className='privacy-section__title'>本地数据</Text><Text className='privacy-section__body'>退出账号会移除本地登录凭证。已同步的学习记录由服务器账户保存；未同步草稿会在服务端确认接收后自动清除。</Text></View>
    </View>
    <Text className='privacy-footer'>正式发布前，本说明需与微信公众平台隐私保护指引及实际申请权限逐项核对。</Text>
  </View>
}
