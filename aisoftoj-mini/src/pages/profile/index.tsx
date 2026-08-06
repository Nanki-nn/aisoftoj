import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { miniStorage } from '../../adapters/storage'
import { clearAuthSession, loadAuthSession } from '../../features/auth/session'
import { restoreCurrentUser } from '../../services/api'
import type { AuthUser } from '../../types/api'
import './index.scss'

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [syncNote, setSyncNote] = useState('')

  useDidShow(() => {
    const auth = loadAuthSession(miniStorage)
    setUser(auth?.user || null)
    if (!auth?.token) return
    void restoreCurrentUser(auth.token)
      .then((freshUser) => { setUser(freshUser); setSyncNote('') })
      .catch((cause) => setSyncNote(cause instanceof Error ? cause.message : '账户数据同步失败'))
  })

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

      {syncNote ? <Text className='profile-sync-note'>{syncNote}</Text> : null}
      <View className='profile-menu' onClick={() => Taro.navigateTo({ url: '/pages/history/index' })}>
        <View>
          <Text className='profile-menu__title'>刷题历史</Text>
          <Text className='profile-menu__note'>继续未完成会话，回看已提交结果</Text>
        </View>
        <Text className='profile-menu__arrow'>→</Text>
      </View>

      <Button className='logout-button' onClick={logout}>退出当前账号</Button>
    </View>
  )
}
