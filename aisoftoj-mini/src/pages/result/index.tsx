import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { toPlainQuestionText } from '../../features/session/model'
import { fetchPracticeResult } from '../../services/api'
import type { PracticeSessionDTO } from '../../types/api'
import './index.scss'

export default function ResultPage() {
  const { params } = useRouter()
  const sessionId = String(params.sessionId || '')
  const [result, setResult] = useState<PracticeSessionDTO | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!sessionId) {
      setError('会话标识缺失，请返回试卷页重试')
      return
    }
    try {
      setResult(await fetchPracticeResult(sessionId))
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '结果加载失败')
    }
  }, [sessionId])

  useDidShow(() => { void load() })

  if (!result) {
    return (
      <View className='page-shell result-page'>
        <Text className='eyebrow'>答题结果</Text>
        <Text className='page-title'>{error ? '暂时无法读取' : '正在生成复盘'}</Text>
        {error ? <Text className='result-error'>{error}</Text> : null}
        <Button className='result-link' onClick={() => { void load() }}>重新加载</Button>
      </View>
    )
  }

  const objective = result.questionList.filter((question) => question.isCorrect != null)
  const correct = objective.filter((question) => question.isCorrect).length
  const hasManual = result.questionList.some((question) => question.isCorrect == null)

  return (
    <View className='page-shell result-page'>
      <Text className='eyebrow'>本次完成</Text>
      <Text className='page-title'>{result.paperName}</Text>
      <View className='result-summary'>
        <Text className='result-summary__value'>{objective.length ? `${correct} / ${objective.length}` : '已提交'}</Text>
        <Text className='result-summary__label'>{objective.length ? '客观题正确数' : '本卷不自动判分'}</Text>
        {hasManual ? <Text className='result-summary__note'>案例题已保留答案，请结合解析自评。</Text> : null}
      </View>

      <View className='review-list'>
        {result.questionList.map((question, index) => (
          <View className='review-row' key={question.id}>
            <Text className='review-row__index'>{String(index + 1).padStart(2, '0')}</Text>
            <View>
              <Text className='review-row__state'>
                {question.isCorrect == null ? '案例自评' : question.isCorrect ? '正确' : '需回看'}
              </Text>
              <Text className='review-row__question'>{toPlainQuestionText(question.intro || question.name)}</Text>
              <Text className='review-row__answer'>你的答案：{question.userAnswer || '未作答'}</Text>
              {question.answer ? <Text className='review-row__answer'>参考答案：{question.answer}</Text> : null}
              {question.analysis ? <Text className='review-row__analysis'>{toPlainQuestionText(question.analysis)}</Text> : null}
            </View>
          </View>
        ))}
      </View>
      <Button className='result-link' onClick={() => Taro.switchTab({ url: '/pages/papers/index' })}>返回试卷目录</Button>
    </View>
  )
}
