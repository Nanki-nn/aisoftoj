import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { formatRecordTime, historyProgress } from '../../features/records/model'
import { fetchPracticeHistory } from '../../services/api'
import type { PracticeHistoryDTO, PracticeHistorySummaryDTO } from '../../types/api'
import './index.scss'

export default function HistoryPage() {
  const [records, setRecords] = useState<PracticeHistoryDTO[]>([])
  const [summary, setSummary] = useState<PracticeHistorySummaryDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchPracticeHistory()
      setRecords(data.records || [])
      setSummary(data.summary)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '历史记录加载失败')
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }, [])

  useDidShow(() => { void load() })
  usePullDownRefresh(() => { void load() })

  const openRecord = (record: PracticeHistoryDTO) => {
    const target = record.status === 'completed' ? 'result' : 'session'
    Taro.navigateTo({ url: `/pages/${target}/index?sessionId=${record.sessionId}` })
  }

  return <View className='page-shell history-page'>
    <Text className='eyebrow'>学习轨迹</Text>
    <Text className='page-title'>刷题历史</Text>
    <Text className='page-note'>从未完成的会话继续作答，也可以回看已提交试卷的完整解析。</Text>
    {summary ? <View className='history-summary'>
      <View><Text className='history-summary__value'>{summary.totalCount}</Text><Text>全部会话</Text></View>
      <View><Text className='history-summary__value'>{summary.completedCount}</Text><Text>已完成</Text></View>
      <View><Text className='history-summary__value'>{summary.answeredCount}</Text><Text>累计答题</Text></View>
    </View> : null}
    {error ? <Text className='history-error'>{error}</Text> : null}
    <View className='history-list'>
      {records.map((record) => <View className='history-row' key={record.id}>
        <View className='history-row__body'>
          <View className='history-row__meta'><Text>{record.examType}</Text><Text>{record.status === 'completed' ? '已完成' : '进行中'}</Text></View>
          <Text className='history-row__title'>{record.examName}</Text>
          <Text className='history-row__progress'>{historyProgress(record)} · {formatRecordTime(record.createTime)}</Text>
        </View>
        <Button className='history-row__action' onClick={() => openRecord(record)}>{record.status === 'completed' ? '回看' : '继续'}</Button>
      </View>)}
    </View>
    {!loading && !error && records.length === 0 ? <View className='empty-state'>
      <Text className='empty-state__mark'>START</Text>
      <Text className='empty-state__title'>还没有刷题记录</Text>
      <Text className='empty-state__body'>去试卷目录选择一套真题，首次作答后会自动生成学习轨迹。</Text>
    </View> : null}
    {loading ? <Text className='history-loading'>正在同步学习轨迹…</Text> : null}
  </View>
}
