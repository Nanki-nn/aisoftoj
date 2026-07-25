import React, { useEffect, useMemo, useState } from 'react';
import { MailCheck } from 'lucide-react';
import { requestEmailCode, EmailCodeScene } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailCodeFieldProps {
  id: string;
  email: string;
  code: string;
  scene: EmailCodeScene;
  onCodeChange: (code: string) => void;
  disabled?: boolean;
}

export function EmailCodeField({
  id,
  email,
  code,
  scene,
  onCodeChange,
  disabled = false,
}: EmailCodeFieldProps) {
  const [countdown, setCountdown] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const emailIsValid = useMemo(() => EMAIL_PATTERN.test(email.trim()), [email]);

  useEffect(() => {
    if (countdown <= 0) {
      return undefined;
    }
    const timer = window.setTimeout(() => setCountdown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const handleSend = async () => {
    if (!emailIsValid || isSending || countdown > 0) {
      return;
    }
    setIsSending(true);
    setError(null);
    setMessage(null);
    try {
      await requestEmailCode(email.trim(), scene);
      setCountdown(60);
      setMessage('验证码请求已受理，请检查邮箱');
    } catch (sendError) {
      setError((sendError as Error).message || '验证码发送失败，请稍后重试');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-2">
        <MailCheck className="h-4 w-4" aria-hidden="true" />
        邮箱验证码
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          name="email-code"
          value={code}
          onChange={(event) => onCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="6 位验证码"
          className="tracking-[0.25em]"
          disabled={disabled}
          required
        />
        <Button
          type="button"
          variant="outline"
          className="w-32 shrink-0"
          onClick={() => void handleSend()}
          disabled={disabled || !emailIsValid || isSending || countdown > 0}
        >
          {isSending ? '发送中...' : countdown > 0 ? `${countdown} 秒` : '获取验证码'}
        </Button>
      </div>
      <div className="min-h-5 text-xs" aria-live="polite">
        {error ? (
          <span className="text-red-600">{error}</span>
        ) : message ? (
          <span className="text-emerald-700">{message}</span>
        ) : (
          <span className="text-slate-500">验证码发送后 10 分钟内有效</span>
        )}
      </div>
    </div>
  );
}
