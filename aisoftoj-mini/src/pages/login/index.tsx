import { Button, Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { miniStorage } from '../../adapters/storage'
import { loadAuthSession } from '../../features/auth/session'
import { loginByPassword, loginByWechat, restoreCurrentUser } from '../../services/api'
import './index.scss'

export default function LoginPage() {
  const isH5 = process.env.TARO_ENV === 'h5'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const enterApp = useCallback(() => {
    Taro.switchTab({ url: '/pages/home/index' })
  }, [])

  useDidShow(() => {
    const session = loadAuthSession(miniStorage)
    if (!session) {
      setLoading(false)
      return
    }
    restoreCurrentUser(session.token)
      .then(enterApp)
      .catch(() => setLoading(false))
  })

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      await loginByWechat()
      enterApp()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败，请稍后重试')
      setLoading(false)
    }
  }

  const handlePasswordLogin = async () => {
    const normalizedEmail = email.trim()
    if (!normalizedEmail || !password) {
      setError('请输入邮箱和密码')
      return
    }
    setLoading(true)
    setError('')
    try {
      await loginByPassword(normalizedEmail, password)
      enterApp()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败，请稍后重试')
      setLoading(false)
    }
  }

  return (
    <View className={`login-page${isH5 ? ' login-page--h5' : ''}`}>
      <View className='login-page__masthead'>
        <View className='brand-seal'><Text>知构</Text></View>
        <View className='brand-lockup'>
          <Text className='brand-name'>知构软考</Text>
          <Text className='brand-subtitle'>把每次作答，变成可复用的知识结构</Text>
        </View>
      </View>

      <View className='login-page__content'>
        <Text className='login-kicker'>学生端 · 微信小程序</Text>
        <Text className='login-title'>继续你的备考进度</Text>
        <Text className='login-copy'>登录后同步试卷、答题记录与错题。首次使用会自动创建学生账号。</Text>

        <View className='trust-row'>
          <View className='trust-item'><Text className='trust-index'>01</Text><Text>学习记录同步</Text></View>
          <View className='trust-item'><Text className='trust-index'>02</Text><Text>考试答案保护</Text></View>
          <View className='trust-item'><Text className='trust-index'>03</Text><Text>弱网草稿恢复</Text></View>
        </View>
      </View>

      <View className='login-page__action'>
        {error ? <Text className='login-error'>{error}</Text> : null}
        {isH5 ? (
          <View className='login-form'>
            <Input
              className='login-input'
              type='text'
              value={email}
              placeholder='邮箱'
              onInput={(event) => setEmail(event.detail.value)}
            />
            <Input
              className='login-input'
              type='text'
              password
              value={password}
              placeholder='密码'
              onInput={(event) => setPassword(event.detail.value)}
            />
            <Button className='primary-button login-button' disabled={loading} onClick={handlePasswordLogin}>
              <Text>{loading ? '正在恢复登录' : '登录并进入'}</Text>
            </Button>
          </View>
        ) : (
          <Button className='primary-button login-button' disabled={loading} onClick={handleLogin}>
            <Text className='wechat-mark'>微</Text>
            <Text>{loading ? '正在恢复登录' : '微信一键登录'}</Text>
          </Button>
        )}
        <Text className='legal-copy'>登录即表示你同意服务条款与隐私政策</Text>
      </View>
    </View>
  )
}
