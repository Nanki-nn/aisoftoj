import { Button, Text, Textarea, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { miniStorage } from '../../adapters/storage'
import {
  answeredCount,
  applyServerQuestion,
  createMutationId,
  isQuestionRecordUpdateResponse,
  toPlainQuestionText,
  toSubmitAnswers,
  updateQuestionAnswer
} from '../../features/session/model'
import {
  applyDrafts,
  clearRecovery,
  completeAnswer,
  loadRecovery,
  queueAnswer,
  recordSyncFailure,
  retryDelay,
  saveDraft,
  type PendingAnswer
} from '../../features/session/recovery'
import {
  fetchPracticeSession,
  submitPracticeSession,
  updateQuestionRecord
} from '../../services/api'
import { ApiRequestError } from '../../services/http-core'
import type { PracticeSessionDTO } from '../../types/api'
import './index.scss'

export default function SessionPage() {
  const { params } = useRouter()
  const sessionId = String(params.sessionId || '')
  const [session, setSession] = useState<PracticeSessionDTO | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [syncState, setSyncState] = useState('已同步')
  const sessionRef = useRef<PracticeSessionDTO | null>(null)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { sessionRef.current = session }, [session])

  const scheduleRetry = useCallback((attempt: number, retry: () => void) => {
    if (retryTimer.current) clearTimeout(retryTimer.current)
    retryTimer.current = setTimeout(retry, retryDelay(attempt))
  }, [])

  const retryPending = useCallback(async (baseSession: PracticeSessionDTO) => {
    const pending = loadRecovery(miniStorage, sessionId).pending
    if (!pending.length) return
    setSyncState('正在同步')
    let nextSession = baseSession
    for (const item of pending) {
      try {
        const server = await updateQuestionRecord(item.recordId, {
          userAnswer: item.userAnswer,
          spendTime: item.spendTime,
          expectedRevision: item.expectedRevision,
          mutationId: item.mutationId,
          confirm: item.confirm
        })
        completeAnswer(miniStorage, sessionId, item.recordId, item.questionId)
        nextSession = applyServerQuestion(nextSession, item.questionId, server)
      } catch (cause) {
        if (cause instanceof ApiRequestError && cause.status === 409 && isQuestionRecordUpdateResponse(cause.data)) {
          completeAnswer(miniStorage, sessionId, item.recordId, item.questionId)
          nextSession = applyServerQuestion(nextSession, item.questionId, cause.data)
          setError('检测到另一端更新，已加载服务器最新答案')
          continue
        }
        const attempt = recordSyncFailure(miniStorage, sessionId, item.recordId)
        setSession(nextSession)
        setSyncState('同步失败，已保存到本地')
        scheduleRetry(attempt, () => {
          if (sessionRef.current) void retryPending(sessionRef.current)
        })
        return
      }
    }
    setSession(nextSession)
    setSyncState('已同步')
  }, [scheduleRetry, sessionId])

  const load = useCallback(async () => {
    if (!sessionId) {
      setError('会话标识缺失，请返回试卷页重试')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const recovery = loadRecovery(miniStorage, sessionId)
      const restored = applyDrafts(miniStorage, sessionId, await fetchPracticeSession(sessionId))
      setSession(restored)
      if (recovery.pending.length) void retryPending(restored)
      else if (Object.keys(recovery.drafts).length) setSyncState('已保存到本地')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '恢复答题会话失败')
    } finally {
      setLoading(false)
    }
  }, [retryPending, sessionId])

  useDidShow(() => { void load() })

  useEffect(() => {
    const onNetwork = ({ isConnected }: { isConnected: boolean }) => {
      if (isConnected && sessionRef.current) void retryPending(sessionRef.current)
    }
    Taro.onNetworkStatusChange(onNetwork)
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current)
      Taro.offNetworkStatusChange(onNetwork)
    }
  }, [retryPending])

  if (loading) {
    return <View className='page-shell session-page'><Text className='session-status'>正在恢复加密会话…</Text></View>
  }
  if (!session || !session.questionList.length) {
    return (
      <View className='page-shell session-page'>
        <Text className='eyebrow'>会话不可用</Text>
        <Text className='page-title'>暂时无法进入答题</Text>
        <Text className='session-error'>{error || '试卷没有可作答题目'}</Text>
        <Button className='session-text-button' onClick={() => { void load() }}>重新加载</Button>
      </View>
    )
  }

  const question = session.questionList[currentIndex]
  const isCase = question.questionType === 2
  const isConfirmed = Boolean(question.confirmedAt)
  const isLast = currentIndex === session.questionList.length - 1

  const setAnswer = (answer: string) => {
    if (!isConfirmed) {
      saveDraft(miniStorage, sessionId, question.id, answer)
      setSession(updateQuestionAnswer(session, question.id, answer))
      setSyncState('已保存到本地')
    }
  }

  const saveAndAdvance = async () => {
    setSaving(true)
    setError('')
    try {
      const payload: PendingAnswer = {
        recordId: question.questionRecordId,
        questionId: question.id,
        userAnswer: question.userAnswer?.trim() || null,
        spendTime: question.spendTime || 0,
        expectedRevision: question.answerRevision || 0,
        mutationId: createMutationId(question.questionRecordId),
        confirm: session.examMode === 'practice',
        attempt: 0
      }
      queueAnswer(miniStorage, sessionId, payload)
      setSyncState('正在同步')
      const server = await updateQuestionRecord(question.questionRecordId, {
        userAnswer: payload.userAnswer,
        spendTime: payload.spendTime,
        expectedRevision: payload.expectedRevision,
        mutationId: payload.mutationId,
        confirm: payload.confirm
      })
      completeAnswer(miniStorage, sessionId, question.questionRecordId, question.id)
      const savedSession = applyServerQuestion(session, question.id, server)
      setSession(savedSession)
      setSyncState('已同步')
      if (session.examMode === 'practice') {
        try {
          setSession(applyDrafts(miniStorage, sessionId, await fetchPracticeSession(sessionId)))
        } catch {
          setError('答案已确认，解析暂时未加载，可重新进入会话恢复')
        }
      }
      if (currentIndex < session.questionList.length - 1) setCurrentIndex(currentIndex + 1)
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.status === 409 && isQuestionRecordUpdateResponse(cause.data)) {
        completeAnswer(miniStorage, sessionId, question.questionRecordId, question.id)
        setSession(applyServerQuestion(session, question.id, cause.data))
        setSyncState('已同步')
        setError('检测到另一端更新，已加载服务器最新答案')
      } else {
        const attempt = recordSyncFailure(miniStorage, sessionId, question.questionRecordId)
        setSyncState('同步失败，已保存到本地')
        scheduleRetry(attempt, () => {
          if (sessionRef.current) void retryPending(sessionRef.current)
        })
        setError(cause instanceof Error ? cause.message : '答案已保存在本地，联网后自动重试')
      }
    } finally {
      setSaving(false)
    }
  }

  const submit = async () => {
    const completed = answeredCount(session.questionList)
    const confirmation = await Taro.showModal({
      title: '确认提交整卷？',
      content: `已作答 ${completed} / ${session.questionList.length} 题。交卷后答案不可修改。`,
      confirmText: '确认交卷'
    })
    if (!confirmation.confirm) return
    setSaving(true)
    setError('')
    try {
      await submitPracticeSession(session, toSubmitAnswers(session.questionList))
      clearRecovery(miniStorage, sessionId)
      Taro.redirectTo({ url: `/pages/result/index?sessionId=${encodeURIComponent(sessionId)}` })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '交卷失败，请稍后重试')
      setSaving(false)
    }
  }

  return (
    <View className='page-shell session-page'>
      <View className='session-progress'>
        <Text>{currentIndex + 1} / {session.questionList.length}</Text>
        <View><Text>{answeredCount(session.questionList)} 题已作答</Text><Text className='session-sync'>{syncState}</Text></View>
      </View>
      <Text className='session-paper'>{session.paperName}</Text>
      <Text className='session-question'>{toPlainQuestionText(question.intro || question.name)}</Text>

      {isCase ? (
        <Textarea
          className='case-answer'
          disabled={isConfirmed}
          maxlength={10000}
          placeholder='输入你的分析与作答'
          value={question.userAnswer || ''}
          onInput={(event) => setAnswer(event.detail.value)}
        />
      ) : (
        <View className='answer-options'>
          {(question.options || []).map((option) => (
            <View
              className={`answer-option ${question.userAnswer === option.keyStr ? 'answer-option--active' : ''}`}
              key={option.keyStr}
              onClick={() => setAnswer(option.keyStr)}
            >
              <Text className='answer-option__key'>{option.keyStr}</Text>
              <Text className='answer-option__value'>{toPlainQuestionText(option.valueStr)}</Text>
            </View>
          ))}
        </View>
      )}

      {isConfirmed && session.examMode === 'practice' ? (
        <View className='practice-feedback'>
          <Text>{question.isCorrect == null ? '案例题等待自评' : question.isCorrect ? '回答正确' : '需要回看'}</Text>
          {question.analysis ? <Text>{toPlainQuestionText(question.analysis)}</Text> : null}
        </View>
      ) : null}
      {error ? <Text className='session-error'>{error}</Text> : null}

      <View className='session-actions'>
        <Button
          className='session-text-button'
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
        >上一题</Button>
        <Button
          className='session-save'
          disabled={saving || (isConfirmed && isLast)}
          onClick={() => {
            if (isConfirmed) setCurrentIndex(Math.min(currentIndex + 1, session.questionList.length - 1))
            else void saveAndAdvance()
          }}
        >
          {saving ? '同步中' : isConfirmed ? '下一题' : session.examMode === 'practice' ? '确认并继续' : '保存并继续'}
        </Button>
      </View>
      <Button className='session-submit' disabled={saving} onClick={submit}>提交整卷</Button>
    </View>
  )
}
