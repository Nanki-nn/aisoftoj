import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { miniStorage } from '../../adapters/storage'
import { clearAuthSession, loadAuthSession } from '../../features/auth/session'
import type { AuthUser } from '../../types/api'
import './index.scss'

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null)

  useDidShow(() => setUser(loadAuthSession(miniStorage)?.user || null))

  const logout = () => {
    clearAuthSession(miniStorage)
    Taro.reLaunch({ url: '/pages/login/index' })
  }

  return (
    <View className='page-shell profile-page'>
      <Text className='eyebrow'>学习账户</Text>
      <Text className='page-title'>{user?.nickname || user?.username || '备考同学'}</Text>
      <Text className='page-note'>{user?.email || '微信账号尚未绑定邮箱'}</Text>

      <View className='profile-stats'>
        <View><Text className='profile-stats__value'>{user?.totalExams || 0}</Text><Text>完成试卷</Text></View>
        <View><Text className='profile-stats__value'>{user?.totalQuestions || 0}</Text><Text>累计答题</Text></View>
        <View><Text className='profile-stats__value'>{user?.accuracy || 0}%</Text><Text>正确率</Text></View>
      </View>

      <Button className='logout-button' onClick={logout}>退出当前账号</Button>
    </View>
  )
}
