import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { formatRecordTime, importanceLabel } from '../../features/records/model'
import { fetchWrongQuestions } from '../../services/api'
import type { WrongQuestionDTO, WrongQuestionSummaryDTO } from '../../types/api'
import './index.scss'

export default function WrongPage() {
  const [records, setRecords] = useState<WrongQuestionDTO[]>([])
  const [summary, setSummary] = useState<WrongQuestionSummaryDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchWrongQuestions()
      setRecords(data.records || [])
      setSummary(data.summary)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '错题加载失败')
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }, [])

  useDidShow(() => { void load() })
  usePullDownRefresh(() => { void load() })

  return (
    <View className='page-shell wrong-page'>
      <Text className='eyebrow'>复盘</Text>
      <Text className='page-title'>错题本</Text>
      <Text className='page-note'>按错误次数和最近作答整理，帮助你把精力放在最薄弱的位置。</Text>

      {summary ? <View className='record-summary'>
        <View><Text className='record-summary__value'>{summary.totalCount}</Text><Text>累计错题</Text></View>
        <View><Text className='record-summary__value'>{summary.frequentCount}</Text><Text>重复出错</Text></View>
        <View><Text className='record-summary__value'>{summary.paperCount}</Text><Text>涉及试卷</Text></View>
      </View> : null}
      {error ? <Text className='record-error'>{error}</Text> : null}
      <View className='wrong-list'>
        {records.map((record, index) => <View className='wrong-row' key={record.id}>
          <Text className='wrong-row__index'>{String(index + 1).padStart(2, '0')}</Text>
          <View className='wrong-row__body'>
            <View className='wrong-row__meta'><Text>{record.topicType}</Text><Text>{importanceLabel(record.importance)}</Text></View>
            <Text className='wrong-row__title'>{record.topicName || `题目 ${record.questionId}`}</Text>
            <Text className='wrong-row__source'>{record.questionBank} · 错 {record.errorCount} 次</Text>
            <Text className='wrong-row__time'>{formatRecordTime(record.updateTime)}</Text>
          </View>
          <Button className='wrong-row__action' onClick={() => Taro.navigateTo({ url: `/pages/result/index?sessionId=${record.sessionId}` })}>回看</Button>
        </View>)}
      </View>
      {!loading && !error && records.length === 0 ? <View className='empty-state'>
        <Text className='empty-state__mark'>CLEAR</Text>
        <Text className='empty-state__title'>暂时没有错题</Text>
        <Text className='empty-state__body'>完成练习后，答错的题目会按错误次数沉淀在这里。</Text>
      </View> : null}
      {loading ? <Text className='record-loading'>正在同步错题…</Text> : null}
    </View>
  )
}
