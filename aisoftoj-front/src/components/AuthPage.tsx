import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Lock,
  Mail,
  Phone,
  Target,
  Trophy,
  User,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { LoginForm, RegisterForm } from '../types/user';
import { EmailCodeField } from './EmailCodeField';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface AuthPageProps {
  onLoginSuccess: () => void;
}

type LoginMode = 'password' | 'code';

export function AuthPage({ onLoginSuccess }: AuthPageProps) {
  const location = useLocation();
  const {
    login,
    loginWithEmailCode,
    register,
    isLoading,
    error,
    clearError,
  } = useAuth();
  const [loginMode, setLoginMode] = useState<LoginMode>('password');
  const [loginCode, setLoginCode] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loginForm, setLoginForm] = useState<LoginForm>({
    email: '',
    password: '',
    rememberMe: false,
  });

  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    username: '',
    email: '',
    emailCode: '',
    password: '',
    confirmPassword: '',
    phone: '',
    agreeToTerms: false,
  });

  const successMessage = (location.state as { message?: string } | null)?.message;

  const handlePasswordLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await login(loginForm)) {
      onLoginSuccess();
    }
  };

  const handleCodeLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await loginWithEmailCode({ email: loginForm.email, code: loginCode })) {
      onLoginSuccess();
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      registerForm.password !== registerForm.confirmPassword
      || !registerForm.agreeToTerms
    ) {
      return;
    }
    if (await register(registerForm)) {
      onLoginSuccess();
    }
  };

  const changeLoginMode = (mode: LoginMode) => {
    setLoginMode(mode);
    clearError();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-2">
        <div className="hidden lg:block">
          <div className="rounded-2xl border border-white/80 bg-white/80 p-8 shadow-lg backdrop-blur-sm">
            <div className="mb-8 text-center">
              <div className="mb-4 flex items-center justify-center gap-3">
                <GraduationCap className="h-12 w-12 text-blue-600" />
                <h1 className="text-3xl font-semibold text-slate-800">知构软考刷题平台</h1>
              </div>
              <p className="text-lg text-slate-600">专业的软考备考平台，助你轻松通过考试</p>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-4 rounded-xl bg-blue-50 p-4">
                <BookOpen className="h-8 w-8 text-blue-600" />
                <div>
                  <h3 className="mb-1 font-medium text-slate-800">海量题库</h3>
                  <p className="text-sm text-slate-600">精选历年真题，覆盖所有考试科目</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl bg-emerald-50 p-4">
                <Trophy className="h-8 w-8 text-emerald-600" />
                <div>
                  <h3 className="mb-1 font-medium text-slate-800">智能分析</h3>
                  <p className="text-sm text-slate-600">个性化学习报告，精准定位薄弱环节</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl bg-amber-50 p-4">
                <Target className="h-8 w-8 text-amber-600" />
                <div>
                  <h3 className="mb-1 font-medium text-slate-800">高效备考</h3>
                  <p className="text-sm text-slate-600">科学的学习计划，提升备考效率</p>
                </div>
              </div>
            </div>

            <p className="mt-8 text-center text-sm text-slate-500">
              已有 <span className="font-medium text-blue-600">10,000+</span> 用户通过平台成功备考
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <Card className="border-white/80 bg-white/90 shadow-xl backdrop-blur-sm">
            <CardHeader className="pb-4 text-center">
              <div className="mb-2 flex items-center justify-center gap-2 lg:hidden">
                <GraduationCap className="h-8 w-8 text-blue-600" />
                <CardTitle className="text-xl">知构软考刷题平台</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs
                defaultValue="login"
                className="w-full"
                onValueChange={() => clearError()}
              >
                <TabsList className="mb-6 grid w-full grid-cols-2">
                  <TabsTrigger value="login">登录</TabsTrigger>
                  <TabsTrigger value="register">注册</TabsTrigger>
                </TabsList>

                {successMessage && (
                  <Alert className="mb-4 border-emerald-200 bg-emerald-50">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <AlertDescription className="text-emerald-800">
                      {successMessage}
                    </AlertDescription>
                  </Alert>
                )}

                {error && (
                  <Alert className="mb-4 border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">{error}</AlertDescription>
                  </Alert>
                )}

                <TabsContent value="login">
                  <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
                    <button
                      type="button"
                      className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                        loginMode === 'password'
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      onClick={() => changeLoginMode('password')}
                      aria-pressed={loginMode === 'password'}
                    >
                      密码登录
                    </button>
                    <button
                      type="button"
                      className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                        loginMode === 'code'
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      onClick={() => changeLoginMode('code')}
                      aria-pressed={loginMode === 'code'}
                    >
                      验证码登录
                    </button>
                  </div>

                  {loginMode === 'password' ? (
                    <form onSubmit={handlePasswordLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email" className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          邮箱地址
                        </Label>
                        <Input
                          id="login-email"
                          type="email"
                          autoComplete="email"
                          placeholder="请输入邮箱地址"
                          value={loginForm.email}
                          onChange={(event) => setLoginForm(previous => ({
                            ...previous,
                            email: event.target.value,
                          }))}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="login-password" className="flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          密码
                        </Label>
                        <div className="relative">
                          <Input
                            id="login-password"
                            type={showLoginPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            placeholder="请输入密码"
                            value={loginForm.password}
                            onChange={(event) => setLoginForm(previous => ({
                              ...previous,
                              password: event.target.value,
                            }))}
                            className="pr-10"
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-1/2 h-auto -translate-y-1/2 p-1"
                            onClick={() => setShowLoginPassword(value => !value)}
                            aria-label={showLoginPassword ? '隐藏密码' : '显示密码'}
                          >
                            {showLoginPassword
                              ? <EyeOff className="h-4 w-4" />
                              : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="remember-me"
                            checked={loginForm.rememberMe}
                            onCheckedChange={(checked) => setLoginForm(previous => ({
                              ...previous,
                              rememberMe: checked === true,
                            }))}
                          />
                          <Label htmlFor="remember-me" className="text-sm">记住我</Label>
                        </div>
                        <Button asChild variant="link" className="h-auto p-0 text-sm">
                          <Link to="/forgot-password">忘记密码？</Link>
                        </Button>
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        disabled={isLoading}
                      >
                        {isLoading ? '登录中...' : '登录'}
                      </Button>
                    </form>
                  ) : (
                    <form onSubmit={handleCodeLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="code-login-email" className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          邮箱地址
                        </Label>
                        <Input
                          id="code-login-email"
                          type="email"
                          autoComplete="email"
                          placeholder="请输入已注册邮箱"
                          value={loginForm.email}
                          onChange={(event) => setLoginForm(previous => ({
                            ...previous,
                            email: event.target.value,
                          }))}
                          required
                        />
                      </div>

                      <EmailCodeField
                        id="login-email-code"
                        email={loginForm.email}
                        code={loginCode}
                        scene="LOGIN"
                        onCodeChange={setLoginCode}
                        disabled={isLoading}
                      />

                      <Button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        disabled={isLoading || loginCode.length !== 6}
                      >
                        <KeyRound className="mr-2 h-4 w-4" />
                        {isLoading ? '登录中...' : '验证码登录'}
                      </Button>
                    </form>
                  )}
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        用户名
                      </Label>
                      <Input
                        id="username"
                        autoComplete="username"
                        placeholder="请输入用户名"
                        value={registerForm.username}
                        onChange={(event) => setRegisterForm(previous => ({
                          ...previous,
                          username: event.target.value,
                        }))}
                        maxLength={64}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-email" className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        邮箱地址
                      </Label>
                      <Input
                        id="register-email"
                        type="email"
                        autoComplete="email"
                        placeholder="请输入邮箱地址"
                        value={registerForm.email}
                        onChange={(event) => setRegisterForm(previous => ({
                          ...previous,
                          email: event.target.value,
                        }))}
                        maxLength={254}
                        required
                      />
                    </div>

                    <EmailCodeField
                      id="register-email-code"
                      email={registerForm.email}
                      code={registerForm.emailCode}
                      scene="REGISTER"
                      onCodeChange={(emailCode) => setRegisterForm(previous => ({
                        ...previous,
                        emailCode,
                      }))}
                      disabled={isLoading}
                    />

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        手机号码（可选）
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        autoComplete="tel"
                        placeholder="请输入手机号码"
                        value={registerForm.phone}
                        onChange={(event) => setRegisterForm(previous => ({
                          ...previous,
                          phone: event.target.value,
                        }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-password" className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        密码
                      </Label>
                      <div className="relative">
                        <Input
                          id="register-password"
                          type={showRegisterPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="8–64 位密码"
                          value={registerForm.password}
                          onChange={(event) => setRegisterForm(previous => ({
                            ...previous,
                            password: event.target.value,
                          }))}
                          className="pr-10"
                          minLength={8}
                          maxLength={64}
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-1/2 h-auto -translate-y-1/2 p-1"
                          onClick={() => setShowRegisterPassword(value => !value)}
                          aria-label={showRegisterPassword ? '隐藏密码' : '显示密码'}
                        >
                          {showRegisterPassword
                            ? <EyeOff className="h-4 w-4" />
                            : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">确认密码</Label>
                      <div className="relative">
                        <Input
                          id="confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="请再次输入密码"
                          value={registerForm.confirmPassword}
                          onChange={(event) => setRegisterForm(previous => ({
                            ...previous,
                            confirmPassword: event.target.value,
                          }))}
                          className="pr-10"
                          minLength={8}
                          maxLength={64}
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-1/2 h-auto -translate-y-1/2 p-1"
                          onClick={() => setShowConfirmPassword(value => !value)}
                          aria-label={showConfirmPassword ? '隐藏确认密码' : '显示确认密码'}
                        >
                          {showConfirmPassword
                            ? <EyeOff className="h-4 w-4" />
                            : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      {registerForm.password
                        && registerForm.confirmPassword
                        && registerForm.password !== registerForm.confirmPassword && (
                          <p className="text-sm text-red-600">两次输入的密码不一致</p>
                        )}
                    </div>

                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id="agree-terms"
                        checked={registerForm.agreeToTerms}
                        onCheckedChange={(checked) => setRegisterForm(previous => ({
                          ...previous,
                          agreeToTerms: checked === true,
                        }))}
                        className="mt-0.5"
                      />
                      <Label htmlFor="agree-terms" className="text-sm leading-5">
                        我同意{' '}
                        <button type="button" className="text-blue-600 hover:underline">用户协议</button>
                        {' '}和{' '}
                        <button type="button" className="text-blue-600 hover:underline">隐私政策</button>
                      </Label>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      disabled={
                        isLoading
                        || registerForm.emailCode.length !== 6
                        || registerForm.password.length < 8
                        || registerForm.password !== registerForm.confirmPassword
                        || !registerForm.agreeToTerms
                      }
                    >
                      {isLoading ? '注册中...' : '注册并登录'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
