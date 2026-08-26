import React, { useEffect, useState } from 'react';
import { Bot, CheckCircle2, Save } from 'lucide-react';
import {
  AIQuotaConfig,
  getAIQuotaConfig,
  updateAIQuotaConfig,
} from '../../lib/aiApi';

const MIN_LIMIT = 1_000;
const MAX_LIMIT = 10_000_000;

export function AdminAISettings() {
  const [config, setConfig] = useState<AIQuotaConfig | null>(null);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getAIQuotaConfig();
      setConfig(next);
      setValue(String(next.daily_token_limit));
    } catch (loadError) {
      setError((loadError as Error).message || 'AI 助手配置加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= MIN_LIMIT && parsed <= MAX_LIMIT;
  const changed = config !== null && parsed !== config.daily_token_limit;

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || !changed || saving) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateAIQuotaConfig(parsed);
      const refreshed = await getAIQuotaConfig();
      setConfig(refreshed);
      setValue(String(refreshed.daily_token_limit));
      setSaved(true);
    } catch (saveError) {
      setError((saveError as Error).message || '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-slate-900">AI 助手设置</h1>
        <p className="mt-1 text-sm text-slate-500">控制每名用户每天可使用的 Agent Token 额度。</p>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-start gap-3 border-b border-slate-100 px-6 py-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">每日 Token 额度</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              修改后立即对所有用户生效；用户之间独立计算，已使用量不会清零。
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="px-6 py-6">
          {error && (
            <div role="alert" className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {saved && (
            <div role="status" className="mb-5 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              配置已保存并立即生效
            </div>
          )}

          <label htmlFor="daily-token-limit" className="block text-sm font-medium text-slate-700">
            每名用户每日额度
          </label>
          <div className="mt-2 flex max-w-md items-center rounded-lg border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
            <input
              id="daily-token-limit"
              type="number"
              min={MIN_LIMIT}
              max={MAX_LIMIT}
              step={1}
              disabled={loading || saving}
              value={value}
              onChange={event => {
                setValue(event.target.value);
                setSaved(false);
              }}
              className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:text-slate-400"
            />
            <span className="border-l border-slate-200 px-3 text-sm text-slate-500">Token / 天</span>
          </div>
          <p className={`mt-2 text-xs ${value && !valid ? 'text-red-600' : 'text-slate-500'}`}>
            {value && !valid
              ? '请输入 1,000–10,000,000 范围内的整数'
              : '允许范围：1,000–10,000,000。紧急关闭请使用 AI 功能开关。'}
          </p>

          {config?.updated_at && (
            <p className="mt-5 text-xs text-slate-400">
              最近更新：{new Date(config.updated_at).toLocaleString('zh-CN')}
              {config.updated_by_user_id ? ` · 管理员 #${config.updated_by_user_id}` : ''}
            </p>
          )}

          <div className="mt-6 border-t border-slate-100 pt-5">
            <button
              type="submit"
              disabled={!valid || !changed || loading || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white outline-none transition-colors hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {saving ? '正在保存…' : '保存配置'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
