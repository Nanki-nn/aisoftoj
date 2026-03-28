import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  GraduationCap,
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  AlertCircle,
  BookOpen,
  Trophy,
  Target
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { LoginForm, RegisterForm } from '../types/user';

interface AuthPageProps {
  onLoginSuccess: () => void;
}

export function AuthPage({ onLoginSuccess }: AuthPageProps) {
  const { login, register, isLoading, error } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loginForm, setLoginForm] = useState<LoginForm>({
    email: '',
    password: '',
    rememberMe: false
  });

  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    nickname: '',
    phone: '',
    agreeToTerms: false
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(loginForm);
    if (success) {
      onLoginSuccess();
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (registerForm.password !== registerForm.confirmPassword) {
      return;
    }

    if (!registerForm.agreeToTerms) {
      return;
    }

    const success = await register(registerForm);
    if (success) {
      onLoginSuccess();
    }
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
                  <h1 className="text-3xl text-slate-800">知构软考刷题平台</h1>
                </div>
                <p className="text-lg text-slate-600">
                  专业的软考备考平台，助你轻松通过考试
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl">
                  <BookOpen className="w-8 h-8 text-blue-600" />
                  <div>
                    <h3 className="text-slate-800 mb-1">海量题库</h3>
                    <p className="text-slate-600 text-sm">精选历年真题，覆盖所有考试科目</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-xl">
                  <Trophy className="w-8 h-8 text-emerald-600" />
                  <div>
                    <h3 className="text-slate-800 mb-1">智能分析</h3>
                    <p className="text-slate-600 text-sm">个性化学习报告，精准定位薄弱环节</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-xl">
                  <Target className="w-8 h-8 text-amber-600" />
                  <div>
                    <h3 className="text-slate-800 mb-1">高效备考</h3>
                    <p className="text-slate-600 text-sm">科学的学习计划，提升备考效率</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧登录注册表单 */}
          <div className="w-full max-w-md mx-auto">
            <Card className="bg-white/90 backdrop-blur-sm shadow-xl border border-white/20">
              <CardHeader className="text-center pb-4">
                <div className="flex items-center justify-center gap-2 mb-2 lg:hidden">
                  <GraduationCap className="w-8 h-8 text-blue-600" />
                  <CardTitle className="text-xl">知构软考刷题平台</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="login">登录</TabsTrigger>
                    <TabsTrigger value="register">注册</TabsTrigger>
                  </TabsList>

                  {error && (
                      <Alert className="mb-4 border-red-200 bg-red-50">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800">
                          {error}
                        </AlertDescription>
                      </Alert>
                  )}

                  {/* 登录表单 */}
                  <TabsContent value="login">
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email" className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          邮箱地址
                        </Label>
                        <Input
                            id="login-email"
                            type="email"
                            placeholder="请输入邮箱地址"
                            value={loginForm.email}
                            onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                            required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="login-password" className="flex items-center gap-2">
                          <Lock className="w-4 h-4" />
                          密码
                        </Label>
                        <div className="relative">
                          <Input
                              id="login-password"
                              type={showPassword ? "text" : "password"}
                              placeholder="请输入密码"
                              value={loginForm.password}
                              onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                              required
                          />
                          <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1"
                              onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                              id="remember-me"
                              checked={loginForm.rememberMe}
                              onCheckedChange={(checked) =>
                                  setLoginForm(prev => ({ ...prev, rememberMe: checked as boolean }))
                              }
                          />
                          <Label htmlFor="remember-me" className="text-sm">记住我</Label>
                        </div>
                        <Button variant="link" className="text-sm p-0 h-auto">
                          忘记密码？
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
                  </TabsContent>

                  {/* 注册表单 */}
                  <TabsContent value="register">
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="username" className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            用户名
                          </Label>
                          <Input
                              id="username"
                              placeholder="用户名"
                              value={registerForm.username}
                              onChange={(e) => setRegisterForm(prev => ({ ...prev, username: e.target.value }))}
                              required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="nickname">昵称</Label>
                          <Input
                              id="nickname"
                              placeholder="昵称"
                              value={registerForm.nickname}
                              onChange={(e) => setRegisterForm(prev => ({ ...prev, nickname: e.target.value }))}
                              required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="register-email" className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          邮箱地址
                        </Label>
                        <Input
                            id="register-email"
                            type="email"
                            placeholder="请输入邮箱地址"
                            value={registerForm.email}
                            onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                            required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone" className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          手机号码（可选）
                        </Label>
                        <Input
                            id="phone"
                            placeholder="请输入手机号码"
                            value={registerForm.phone}
                            onChange={(e) => setRegisterForm(prev => ({ ...prev, phone: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="register-password" className="flex items-center gap-2">
                          <Lock className="w-4 h-4" />
                          密码
                        </Label>
                        <div className="relative">
                          <Input
                              id="register-password"
                              type={showPassword ? "text" : "password"}
                              placeholder="请输入密码"
                              value={registerForm.password}
                              onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                              required
                          />
                          <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1"
                              onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">确认密码</Label>
                        <div className="relative">
                          <Input
                              id="confirm-password"
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="请再次输入密码"
                              value={registerForm.confirmPassword}
                              onChange={(e) => setRegisterForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                              required
                          />
                          <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                        {registerForm.password && registerForm.confirmPassword &&
                            registerForm.password !== registerForm.confirmPassword && (
                                <p className="text-sm text-red-600">密码不一致</p>
                            )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                            id="agree-terms"
                            checked={registerForm.agreeToTerms}
                            onCheckedChange={(checked) =>
                                setRegisterForm(prev => ({ ...prev, agreeToTerms: checked as boolean }))
                            }
                        />
                        <Label htmlFor="agree-terms" className="text-sm">
                          我同意 <Button variant="link" className="text-sm p-0 h-auto">用户协议</Button> 和
                          <Button variant="link" className="text-sm p-0 h-auto">隐私政策</Button>
                        </Label>
                      </div>

                      <Button
                          type="submit"
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          disabled={isLoading || registerForm.password !== registerForm.confirmPassword || !registerForm.agreeToTerms}
                      >
                        {isLoading ? '注册中...' : '注册'}
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