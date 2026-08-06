import { Button, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState } from 'react'
import { getSessionId } from '../../features/session/model'
import { startPracticeSession } from '../../services/api'
import './index.scss'

type ExamMode = 'practice' | 'exam'

export default function ExamConfigPage() {
  const { params } = useRouter()
  const paperId = String(params.paperId || '')
  const paperName = String(params.paperName || '软考真题')
  const [mode, setMode] = useState<ExamMode>('practice')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const start = async () => {
    if (!paperId) {
      setError('试卷标识缺失，请返回重试')
      return
    }
    setLoading(true)
    setError('')
    try {
      const session = await startPracticeSession(paperId, mode)
      Taro.redirectTo({
        url: `/pages/session/index?sessionId=${encodeURIComponent(getSessionId(session))}`
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '创建刷题会话失败')
      setLoading(false)
    }
  }

  return (
    <View className='page-shell config-page'>
      <Text className='eyebrow'>开始之前</Text>
      <Text className='page-title'>{paperName}</Text>
      <Text className='page-note'>模式会决定答案何时显示。同一试卷的两种模式分别保留进度。</Text>

      <View className='mode-list'>
        <View
          className={`mode-option ${mode === 'practice' ? 'mode-option--active' : ''}`}
          onClick={() => setMode('practice')}
        >
          <Text className='mode-option__index'>01</Text>
          <View>
            <Text className='mode-option__title'>练题模式</Text>
            <Text className='mode-option__copy'>逐题保存，可在确认后查看判分。</Text>
          </View>
        </View>
        <View
          className={`mode-option ${mode === 'exam' ? 'mode-option--active' : ''}`}
          onClick={() => setMode('exam')}
        >
          <Text className='mode-option__index'>02</Text>
          <View>
            <Text className='mode-option__title'>考试模式</Text>
            <Text className='mode-option__copy'>交卷前不显示答案，按整卷完成。</Text>
          </View>
        </View>
      </View>

      {error ? <Text className='config-error'>{error}</Text> : null}
      <Button className='primary-button config-start' disabled={loading} onClick={start}>
        {loading ? '正在建立安全会话' : '进入答题'}
      </Button>
    </View>
  )
}
