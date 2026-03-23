import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Alert, AlertDescription } from './ui/alert';
import { 
  GraduationCap, 
  Mail, 
  Lock, 
  Phone,
  Eye,
  EyeOff,
  AlertCircle,
  Smartphone,
  QrCode,
  ArrowRight,
  BookOpen,
  Trophy,
  Target
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { LoginForm } from '../types/user';

interface AuthPageProps {
  onLoginSuccess: () => void;
}

export function AuthPage({ onLoginSuccess }: AuthPageProps) {
  const { login, isLoading, error } = useAuth();
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone' | 'wechat'>('phone');
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [wechatQRCode, setWechatQRCode] = useState('');
  
  const [emailLoginForm, setEmailLoginForm] = useState<LoginForm>({
    email: '',
    password: '',
    rememberMe: false
  });

  const [phoneLoginForm, setPhoneLoginForm] = useState({
    phone: '',
    code: ''
  });

  // 倒计时逻辑
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 模拟生成微信二维码
  useEffect(() => {
    const qrData = `weixin://login?uuid=${Date.now()}`;
    setWechatQRCode(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`);
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(emailLoginForm);
    if (success) {
      onLoginSuccess();
    }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneLoginForm.phone === '13800138000' && phoneLoginForm.code === '123456') {
      const success = await login({ email: 'student@example.com', password: '123456', rememberMe: false });
      if (success) {
        onLoginSuccess();
      }
    } else {
      alert('手机号或验证码错误');
    }
  };

  const handleSendCode = () => {
    if (!phoneLoginForm.phone) {
      alert('请输入手机号');
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phoneLoginForm.phone)) {
      alert('请输入正确的手机号');
      return;
    }
    setCountdown(60);
    alert('验证码已发送（演示：123456）');
  };

  const handleWechatScan = () => {
    setTimeout(async () => {
      const success = await login({ email: 'student@example.com', password: '123456', rememberMe: false });
      if (success) {
        onLoginSuccess();
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* 左侧展示区域 */}
        <div className="hidden lg:block">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/20">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <GraduationCap className="w-12 h-12 text-blue-600" />
                <h1 className="text-3xl font-bold text-slate-800">软考刷题平台</h1>
              </div>
              <p className="text-lg text-slate-600">
                专业的软考备考平台，助你轻松通过考试
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl">
                <BookOpen className="w-8 h-8 text-blue-600" />
                <div>
                  <h3 className="text-slate-800 font-semibold mb-1">海量题库</h3>
                  <p className="text-slate-600 text-sm">精选历年真题，覆盖所有考试科目</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-xl">
                <Trophy className="w-8 h-8 text-emerald-600" />
                <div>
                  <h3 className="text-slate-800 font-semibold mb-1">智能分析</h3>
                  <p className="text-slate-600 text-sm">个性化学习报告，精准定位薄弱环节</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-xl">
                <Target className="w-8 h-8 text-amber-600" />
                <div>
                  <h3 className="text-slate-800 font-semibold mb-1">高效备考</h3>
                  <p className="text-slate-600 text-sm">科学的学习计划，提升备考效率</p>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-slate-500 text-sm">
                已有 <span className="text-blue-600 font-semibold">10,000+</span> 用户通过平台成功备考
              </p>
            </div>
          </div>
        </div>

        {/* 右侧登录区域 */}
        <div className="w-full max-w-md mx-auto">
          {/* 移动端Logo */}
          <div className="text-center mb-6 lg:hidden">
            <div className="flex items-center justify-center gap-3 mb-2">
              <GraduationCap className="w-10 h-10 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-800">软考刷题平台</h1>
            </div>
            <p className="text-slate-600 text-sm">专业的软考备考平台</p>
          </div>

          {/* 登录卡片 */}
          <Card className="bg-white shadow-xl border-0">
            <CardContent className="p-8">
              {error && (
                <Alert className="mb-6 border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* 登录方式切换 */}
              <div className="flex items-center justify-center gap-4 mb-8">
                <button
                  onClick={() => setLoginMethod('wechat')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    loginMethod === 'wechat'
                      ? 'text-blue-600 font-semibold'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <QrCode className="w-5 h-5" />
                  微信
                </button>
                <div className="w-px h-6 bg-slate-200"></div>
                <button
                  onClick={() => setLoginMethod('phone')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    loginMethod === 'phone'
                      ? 'text-blue-600 font-semibold'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Smartphone className="w-5 h-5" />
                  手机号
                </button>
                <div className="w-px h-6 bg-slate-200"></div>
                <button
                  onClick={() => setLoginMethod('email')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    loginMethod === 'email'
                      ? 'text-blue-600 font-semibold'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Mail className="w-5 h-5" />
                  邮箱
                </button>
              </div>

              {/* 微信扫码登录 */}
              {loginMethod === 'wechat' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 text-blue-600 mb-6">
                    <span className="text-xl font-medium">通过微信登录</span>
                    <ArrowRight className="w-6 h-6" />
                  </div>

                  <div className="flex flex-col items-center justify-center py-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border-2 border-slate-100 mb-6">
                      <img 
                        src={wechatQRCode} 
                        alt="微信登录二维码" 
                        className="w-48 h-48"
                      />
                    </div>
                    <p className="text-sm text-slate-600 mb-4">请使用微信扫描二维码登录</p>
                    
                    <Button 
                      onClick={handleWechatScan}
                      className="w-full bg-green-600 hover:bg-green-700 text-white text-lg h-14 rounded-xl"
                      disabled={isLoading}
                    >
                      <QrCode className="w-5 h-5 mr-2" />
                      {isLoading ? '登录中...' : '模拟扫码登录'}
                    </Button>
                    
                    <p className="text-xs text-slate-400 mt-4">点击上方按钮模拟扫码登录</p>
                  </div>
                </div>
              )}

              {/* 手机号验证码登录 */}
              {loginMethod === 'phone' && (
                <form onSubmit={handlePhoneLogin} className="space-y-6">
                  <div className="flex items-center gap-3 text-blue-600 mb-6">
                    <span className="text-xl font-medium">通过手机号登录</span>
                    <ArrowRight className="w-6 h-6" />
                  </div>

                  <div className="space-y-4">
                    <Input
                      type="tel"
                      placeholder="请输入手机号码"
                      value={phoneLoginForm.phone}
                      onChange={(e) => setPhoneLoginForm(prev => ({ ...prev, phone: e.target.value }))}
                      maxLength={11}
                      className="h-14 text-base bg-slate-50 border-slate-200 rounded-xl"
                      required
                    />

                    <div className="flex gap-3">
                      <Input
                        type="text"
                        placeholder="请输入验证码"
                        value={phoneLoginForm.code}
                        onChange={(e) => setPhoneLoginForm(prev => ({ ...prev, code: e.target.value }))}
                        maxLength={6}
                        className="flex-1 h-14 text-base bg-slate-50 border-slate-200 rounded-xl"
                        required
                      />
                      <Button
                        type="button"
                        onClick={handleSendCode}
                        disabled={countdown > 0}
                        className="min-w-[140px] h-14 text-base rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                      >
                        {countdown > 0 ? `${countdown}秒后重试` : '发送验证码'}
                      </Button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg h-14 rounded-xl shadow-lg"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin">⏳</span>
                        登录中...
                      </span>
                    ) : (
                      '登录'
                    )}
                  </Button>

                  <p className="text-center text-sm text-slate-500">
                    演示手机号：13800138000 / 验证码：123456
                  </p>
                </form>
              )}

              {/* 邮箱登录 */}
              {loginMethod === 'email' && (
                <form onSubmit={handleEmailLogin} className="space-y-6">
                  <div className="flex items-center gap-3 text-blue-600 mb-6">
                    <span className="text-xl font-medium">通过邮箱登录</span>
                    <ArrowRight className="w-6 h-6" />
                  </div>

                  <div className="space-y-4">
                    <Input
                      type="email"
                      placeholder="请输入邮箱地址"
                      value={emailLoginForm.email}
                      onChange={(e) => setEmailLoginForm(prev => ({ ...prev, email: e.target.value }))}
                      className="h-14 text-base bg-slate-50 border-slate-200 rounded-xl"
                      required
                    />

                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="请输入密码"
                        value={emailLoginForm.password}
                        onChange={(e) => setEmailLoginForm(prev => ({ ...prev, password: e.target.value }))}
                        className="h-14 text-base bg-slate-50 border-slate-200 rounded-xl pr-12"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5 text-slate-400" /> : <Eye className="w-5 h-5 text-slate-400" />}
                      </Button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg h-14 rounded-xl shadow-lg"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin">⏳</span>
                        登录中...
                      </span>
                    ) : (
                      '登录'
                    )}
                  </Button>

                  <p className="text-center text-sm text-slate-500">
                    演示账号：student@example.com / 123456
                  </p>
                </form>
              )}
            </CardContent>
          </Card>

          {/* 底部提示 */}
          <div className="text-center mt-6 text-xs text-slate-500">
            <p>登录即表示同意 <a href="#" className="text-blue-600 hover:underline">用户协议</a> 和 <a href="#" className="text-blue-600 hover:underline">隐私政策</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}
