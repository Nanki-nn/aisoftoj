import { Button, Text, View } from '@tarojs/components'
import { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { fetchPapers } from '../../services/api'
import type { PaperSummary } from '../../types/api'
import './index.scss'

export default function PapersPage() {
  const [papers, setPapers] = useState<PaperSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setPapers(await fetchPapers())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '试卷加载失败')
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }, [])

  useDidShow(() => { void load() })
  usePullDownRefresh(() => { void load() })

  return (
    <View className='page-shell papers-page'>
      <Text className='eyebrow'>历年真题</Text>
      <Text className='page-title'>试卷目录</Text>
      <Text className='page-note'>综合知识与案例分析按时间排列。论文不进入小程序首版。</Text>

      {error ? <Text className='paper-error'>{error}</Text> : null}
      <View className='paper-list'>
        {papers.map((paper) => (
          <View className='paper-row' key={paper.id}>
            <View className='paper-row__date'>
              <Text>{paper.dateLabel}</Text>
              <Text className={`paper-row__dot paper-row__dot--${paper.status}`} />
            </View>
            <View className='paper-row__body'>
              <Text className='paper-row__category'>{paper.category}</Text>
              <Text className='paper-row__title'>{paper.title}</Text>
              <Text className='paper-row__meta'>{paper.questionCount} 题 · 已完成 {paper.completedCount}</Text>
            </View>
            <Button className='paper-row__action'>
              {paper.sessionId ? '继续' : '开始'}
            </Button>
          </View>
        ))}
      </View>

      {!loading && !error && papers.length === 0 ? (
        <View className='empty-state'>
          <Text className='empty-state__mark'>EMPTY</Text>
          <Text className='empty-state__title'>还没有可用试卷</Text>
          <Text className='empty-state__body'>下拉可重新同步已发布的综合知识与案例分析试卷。</Text>
        </View>
      ) : null}
      {loading ? <Text className='paper-loading'>正在同步试卷…</Text> : null}
    </View>
  )
}
