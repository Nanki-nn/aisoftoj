import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { resetPasswordByEmail } from '../lib/api';
import { PasswordResetForm } from '../types/user';
import { EmailCodeField } from './EmailCodeField';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<PasswordResetForm>({
    email: '',
    code: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await resetPasswordByEmail(form);
      navigate('/login', {
        replace: true,
        state: { message: '密码已重置，请使用新密码登录' },
      });
    } catch (resetError) {
      setError((resetError as Error).message || '密码重置失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordsDiffer = Boolean(
    form.newPassword
    && form.confirmPassword
    && form.newPassword !== form.confirmPassword
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4">
      <div className="w-full max-w-md">
        <Link
          to="/login"
          className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 transition hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          返回登录
        </Link>

        <Card className="border-white/80 bg-white/90 shadow-xl backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
              <ShieldCheck className="h-6 w-6 text-blue-700" />
            </div>
            <CardTitle className="flex items-center justify-center gap-2 text-2xl text-slate-900">
              <GraduationCap className="h-7 w-7 text-blue-600" />
              重置密码
            </CardTitle>
            <CardDescription className="pt-1">
              验证注册邮箱后设置新密码，验证码 10 分钟内有效
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert className="mb-4 border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  注册邮箱
                </Label>
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  placeholder="请输入注册邮箱"
                  value={form.email}
                  onChange={(event) => setForm(previous => ({
                    ...previous,
                    email: event.target.value,
                  }))}
                  maxLength={254}
                  required
                />
              </div>

              <EmailCodeField
                id="reset-email-code"
                email={form.email}
                code={form.code}
                scene="PASSWORD_RESET"
                onCodeChange={(code) => setForm(previous => ({ ...previous, code }))}
                disabled={isSubmitting}
              />

              <div className="space-y-2">
                <Label htmlFor="new-password" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  新密码
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="8–64 位密码"
                    value={form.newPassword}
                    onChange={(event) => setForm(previous => ({
                      ...previous,
                      newPassword: event.target.value,
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
                    onClick={() => setShowPassword(value => !value)}
                    aria-label={showPassword ? '隐藏新密码' : '显示新密码'}
                  >
                    {showPassword
                      ? <EyeOff className="h-4 w-4" />
                      : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">确认新密码</Label>
                <div className="relative">
                  <Input
                    id="confirm-new-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="请再次输入新密码"
                    value={form.confirmPassword}
                    onChange={(event) => setForm(previous => ({
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
                {passwordsDiffer && (
                  <p className="text-sm text-red-600">两次输入的密码不一致</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={
                  isSubmitting
                  || form.code.length !== 6
                  || form.newPassword.length < 8
                  || passwordsDiffer
                }
              >
                {isSubmitting ? '重置中...' : '确认重置密码'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
