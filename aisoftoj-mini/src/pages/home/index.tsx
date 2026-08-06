import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { miniStorage } from '../../adapters/storage'
import { loadAuthSession } from '../../features/auth/session'
import type { PaperSummary } from '../../types/api'
import { fetchPapers } from '../../services/api'
import './index.scss'

export default function HomePage() {
  const [paper, setPaper] = useState<PaperSummary | null>(null)
  const [nickname, setNickname] = useState('同学')

  useDidShow(() => {
    const session = loadAuthSession(miniStorage)
    if (!session) {
      Taro.reLaunch({ url: '/pages/login/index' })
      return
    }
    setNickname(session.user.nickname || session.user.username || '同学')
    fetchPapers().then((items) => {
      setPaper(items.find((item) => item.sessionId) || items[0] || null)
    }).catch(() => setPaper(null))
  })

  return (
    <View className='page-shell home-page'>
      <Text className='eyebrow'>今日备考</Text>
      <Text className='page-title'>{nickname}，稳步推进</Text>
      <Text className='page-note'>先完成一组题，再回看错题。保持节奏比一次做很多更重要。</Text>

      <View className='countdown-band'>
        <Text className='countdown-band__label'>距 11 月软考</Text>
        <Text className='countdown-band__value'>保持每日训练</Text>
        <Text className='countdown-band__accent'>进行中</Text>
      </View>

      <View className='section-heading'>
        <Text>下一步</Text>
        <Text className='section-heading__meta'>{paper ? paper.category : '等待同步'}</Text>
      </View>

      {paper ? (
        <View className='continue-panel'>
          <Text className='continue-panel__date'>{paper.dateLabel}</Text>
          <Text className='continue-panel__title'>{paper.title}</Text>
          <Text className='continue-panel__meta'>{paper.subject} · {paper.questionCount} 题</Text>
          <Button className='continue-link' onClick={() => Taro.switchTab({ url: '/pages/papers/index' })}>
            {paper.sessionId ? '继续作答' : '选择练题模式'}
          </Button>
        </View>
      ) : (
        <View className='empty-state'>
          <Text className='empty-state__mark'>SYNC</Text>
          <Text className='empty-state__title'>暂未读取到试卷</Text>
          <Text className='empty-state__body'>请确认网络和后端服务，稍后进入试卷页重试。</Text>
        </View>
      )}
    </View>
  )
}
