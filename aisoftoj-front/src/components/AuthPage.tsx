import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Alert, AlertDescription } from './ui/alert';
import {
  GraduationCap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  User,
  Phone,
  ArrowRight,
  BookOpen,
  Trophy,
  Target,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { LoginForm, RegisterForm } from '../types/user';

interface AuthPageProps {
  onLoginSuccess: () => void;
}

const defaultLoginForm: LoginForm = {
  email: '',
  password: '',
  rememberMe: false,
};

const defaultRegisterForm: RegisterForm = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  nickname: '',
  phone: '',
  agreeToTerms: true,
};

export function AuthPage({ onLoginSuccess }: AuthPageProps) {
  const { login, register, isLoading, error } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loginForm, setLoginForm] = useState<LoginForm>(defaultLoginForm);
  const [registerForm, setRegisterForm] = useState<RegisterForm>(defaultRegisterForm);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(loginForm);
    if (success) {
      onLoginSuccess();
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await register(registerForm);
    if (success) {
      onLoginSuccess();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-cyan-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="hidden lg:block">
          <div className="bg-white/85 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-white/50">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <GraduationCap className="w-12 h-12 text-blue-600" />
                <h1 className="text-3xl font-bold text-slate-800">知构软考刷题平台</h1>
              </div>
              <p className="text-lg text-slate-600">真实题库、错题沉淀和 AI 学习分析，围绕软考备考一站式展开。</p>
            </div>

            <div className="space-y-5">
              <div className="flex items-center gap-4 rounded-2xl bg-blue-50 p-4">
                <BookOpen className="w-8 h-8 text-blue-600" />
                <div>
                  <div className="font-semibold text-slate-800">题库持续沉淀</div>
                  <div className="text-sm text-slate-600">支持历年真题导入、结构化整理和刷题训练。</div>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl bg-emerald-50 p-4">
                <Trophy className="w-8 h-8 text-emerald-600" />
                <div>
                  <div className="font-semibold text-slate-800">学习记录可追踪</div>
                  <div className="text-sm text-slate-600">登录后保留做题历史、错题统计和个人资料。</div>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl bg-amber-50 p-4">
                <Target className="w-8 h-8 text-amber-600" />
                <div>
                  <div className="font-semibold text-slate-800">为后续 AI 能力留接口</div>
                  <div className="text-sm text-slate-600">后续可以继续接知识图谱、错因分析和学习建议。</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full max-w-xl mx-auto">
          <div className="text-center mb-8 lg:hidden">
            <div className="flex items-center justify-center gap-3 mb-2">
              <GraduationCap className="w-10 h-10 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-800">知构软考刷题平台</h1>
            </div>
          </div>

          <Card className="border-0 bg-white shadow-xl">
            <CardContent className="p-8 sm:p-10">
              <div className="mb-8 space-y-4">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {mode === 'login' ? '登录账号' : '创建账号'}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {mode === 'login'
                      ? '登录后可同步刷题记录、错题统计和个人学习进度。'
                      : '先完成基础注册，后续再逐步完善个人资料。'}
                  </p>
                </div>

                <div className="flex rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className={`flex-1 rounded-lg px-4 py-2.5 text-sm transition-colors ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    登录
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className={`flex-1 rounded-lg px-4 py-2.5 text-sm transition-colors ${mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    注册
                  </button>
                </div>
              </div>

              {error && (
                <Alert className="mb-8 border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}

              {mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-8">
                  <div className="flex items-center gap-3 text-blue-600">
                    <span className="text-xl font-medium">邮箱登录</span>
                    <ArrowRight className="w-5 h-5" />
                  </div>

                  <div className="space-y-5">
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        type="email"
                        placeholder="请输入邮箱地址"
                        value={loginForm.email}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                        className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-11"
                        required
                      />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="请输入密码"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                        className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-11 pr-12"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        onClick={() => setShowPassword(prev => !prev)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4 pt-1">
                    <Button type="submit" className="h-12 w-full rounded-xl bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                      {isLoading ? '登录中...' : '登录'}
                    </Button>
                    <div className="text-center text-sm text-slate-500">
                      还没有账号？可以直接切换到“注册”
                    </div>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-8">
                  <div className="flex items-center gap-3 text-blue-600">
                    <span className="text-xl font-medium">注册账号</span>
                    <ArrowRight className="w-5 h-5" />
                  </div>

                  <div className="space-y-6">
                    <div>
                      <div className="mb-3 text-sm font-medium text-slate-700">基础信息</div>
                      <div className="grid gap-4">
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            placeholder="用户名"
                            value={registerForm.username}
                            onChange={(e) => setRegisterForm(prev => ({ ...prev, username: e.target.value }))}
                            className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-11"
                            required
                          />
                        </div>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            placeholder="昵称"
                            value={registerForm.nickname}
                            onChange={(e) => setRegisterForm(prev => ({ ...prev, nickname: e.target.value }))}
                            className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-11"
                            required
                          />
                        </div>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            type="email"
                            placeholder="邮箱"
                            value={registerForm.email}
                            onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                            className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-11"
                            required
                          />
                        </div>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            placeholder="手机号（可选）"
                            value={registerForm.phone || ''}
                            onChange={(e) => setRegisterForm(prev => ({ ...prev, phone: e.target.value }))}
                            className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-11"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-3 text-sm font-medium text-slate-700">设置密码</div>
                      <div className="grid gap-4">
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="密码（至少 6 位）"
                            value={registerForm.password}
                            onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                            className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-11 pr-12"
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-1/2 -translate-y-1/2"
                            onClick={() => setShowPassword(prev => !prev)}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                          </Button>
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="确认密码"
                            value={registerForm.confirmPassword}
                            onChange={(e) => setRegisterForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-11 pr-12"
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-1/2 -translate-y-1/2"
                            onClick={() => setShowConfirmPassword(prev => !prev)}
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-1">
                    <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={registerForm.agreeToTerms}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, agreeToTerms: e.target.checked }))}
                        className="mt-0.5"
                      />
                      <span>我已阅读并同意用户协议与隐私政策</span>
                    </label>

                    <Button type="submit" className="h-12 w-full rounded-xl bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                      {isLoading ? '注册中...' : '注册并登录'}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
