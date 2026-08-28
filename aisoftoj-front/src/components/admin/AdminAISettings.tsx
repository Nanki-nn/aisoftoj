import React, { useEffect, useState } from 'react';
import { Bot, CheckCircle2, Power, Save, Search, ShieldCheck, UserMinus, UserPlus } from 'lucide-react';
import {
  AIAccessConfig,
  AIQuotaConfig,
  AdminAIRolloutUser,
  disableAdminAIRolloutUser,
  enableAdminAIRolloutUser,
  getAIAccessConfig,
  getAdminAIRolloutStatuses,
  getAIQuotaConfig,
  listAdminAIRolloutUsers,
  updateAIAccessConfig,
  updateAIQuotaConfig,
} from '../../lib/aiApi';
import { AdminUserDTO, listAdminUsers } from '../../lib/api';

const MIN_LIMIT = 1_000;
const MAX_LIMIT = 10_000_000;

function accountStatusLabel(status: AdminAIRolloutUser['account_status']): string {
  return {
    active: '账号正常',
    disabled: '账号已禁用',
    deleted: '账号已删除',
    missing: '账号不存在',
  }[status];
}

export function AdminAISettings() {
  const [config, setConfig] = useState<AIQuotaConfig | null>(null);
  const [access, setAccess] = useState<AIAccessConfig | null>(null);
  const [rolloutUsers, setRolloutUsers] = useState<AdminAIRolloutUser[]>([]);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const [rolloutBusyId, setRolloutBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<AdminUserDTO[]>([]);
  const [candidateStatuses, setCandidateStatuses] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextQuota, nextAccess, nextRollout] = await Promise.all([
        getAIQuotaConfig(),
        getAIAccessConfig(),
        listAdminAIRolloutUsers(1, 100),
      ]);
      setConfig(nextQuota);
      setValue(String(nextQuota.daily_token_limit));
      setAccess(nextAccess);
      setRolloutUsers(nextRollout.records);
    } catch (loadError) {
      setError((loadError as Error).message || 'AI 助手配置加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const refreshAccessAndRollout = async () => {
    const [nextAccess, nextRollout] = await Promise.all([
      getAIAccessConfig(),
      listAdminAIRolloutUsers(1, 100),
    ]);
    setAccess(nextAccess);
    setRolloutUsers(nextRollout.records);
  };

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

  const handleAccessToggle = async () => {
    if (!access || accessSaving) return;
    const nextEnabled = !access.globally_enabled;
    if (!nextEnabled && !window.confirm('关闭后所有用户（包括管理员）都无法发起新的 AI 请求，确认关闭吗？')) {
      return;
    }
    setAccessSaving(true);
    setError(null);
    try {
      setAccess(await updateAIAccessConfig(nextEnabled));
    } catch (toggleError) {
      setError((toggleError as Error).message || 'AI 功能开关保存失败');
      setAccess(await getAIAccessConfig().catch(() => access));
    } finally {
      setAccessSaving(false);
    }
  };

  const handleSearch = async () => {
    const keyword = searchInput.trim();
    if (!keyword || searching) return;
    setSearching(true);
    setError(null);
    try {
      const result = await listAdminUsers({ keyword, page: 1, pageSize: 10 });
      const statuses = result.records.length
        ? await getAdminAIRolloutStatuses(result.records.map(user => user.id))
        : { globally_enabled: access?.globally_enabled ?? false, statuses: {} };
      setCandidates(result.records);
      setCandidateStatuses(statuses.statuses);
    } catch (searchError) {
      setError((searchError as Error).message || '用户搜索失败');
    } finally {
      setSearching(false);
    }
  };

  const handleCandidateToggle = async (user: AdminUserDTO) => {
    if (rolloutBusyId !== null || user.role === 'ADMIN') return;
    const currentlyEnabled = Boolean(candidateStatuses[String(user.id)]);
    setRolloutBusyId(user.id);
    setError(null);
    try {
      if (currentlyEnabled) {
        await disableAdminAIRolloutUser(user.id);
      } else {
        await enableAdminAIRolloutUser(user.id);
      }
      setCandidateStatuses(previous => ({
        ...previous,
        [String(user.id)]: !currentlyEnabled,
      }));
      await refreshAccessAndRollout();
    } catch (toggleError) {
      setError((toggleError as Error).message || '内测权限修改失败');
    } finally {
      setRolloutBusyId(null);
    }
  };

  const handleRemove = async (userId: number) => {
    if (rolloutBusyId !== null) return;
    setRolloutBusyId(userId);
    setError(null);
    try {
      await disableAdminAIRolloutUser(userId);
      setCandidateStatuses(previous => ({ ...previous, [String(userId)]: false }));
      await refreshAccessAndRollout();
    } catch (removeError) {
      setError((removeError as Error).message || '移除内测人员失败');
    } finally {
      setRolloutBusyId(null);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">AI 助手设置</h1>
        <p className="mt-1 text-sm text-slate-500">控制 Agent 全局开放状态、内测人员和每日 Token 额度。</p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${access?.globally_enabled ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
              <Power className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">AI 功能总开关</h2>
              <p className="mt-1 text-sm text-slate-500">
                {access?.globally_enabled
                  ? '已开启，仅管理员和内测名单用户可用。'
                  : '已关闭，所有用户（包括管理员）均不可使用。'}
              </p>
              {access?.updated_at && (
                <p className="mt-1 text-xs text-slate-400">
                  最近更新：{new Date(access.updated_at).toLocaleString('zh-CN')}
                  {access.updated_by_user_id ? ` · 管理员 #${access.updated_by_user_id}` : ''}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={access?.globally_enabled ?? false}
            disabled={loading || accessSaving || !access}
            onClick={handleAccessToggle}
            className={`relative h-7 w-12 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 ${access?.globally_enabled ? 'bg-green-500' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${access?.globally_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            <span className="sr-only">{access?.globally_enabled ? '关闭 AI 助手' : '开启 AI 助手'}</span>
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">内测人员</h2>
              <p className="mt-1 text-sm text-slate-500">当前名单 {access?.rollout_user_count ?? 0} 人；管理员默认开放，无需加入名单。</p>
            </div>
          </div>
          {!access?.globally_enabled && (
            <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              总开关已关闭，名单仍可编辑，但暂不生效。
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <input
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              onKeyDown={event => event.key === 'Enter' && void handleSearch()}
              placeholder="搜索用户名 / 邮箱 / 用户 ID"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={!searchInput.trim() || searching}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300"
            >
              <Search className="h-4 w-4" />
              {searching ? '搜索中…' : '搜索'}
            </button>
          </div>
        </div>

        {candidates.length > 0 && (
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">搜索结果</h3>
            <div className="space-y-2">
              {candidates.map(user => {
                const enabled = Boolean(candidateStatuses[String(user.id)]);
                const admin = user.role === 'ADMIN';
                return (
                  <div key={user.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{user.nickName || user.loginName || `用户 #${user.id}`}</p>
                      <p className="mt-0.5 text-xs text-slate-500">#{user.id} · {user.email || '未绑定邮箱'}</p>
                    </div>
                    {admin ? (
                      <span className="text-xs font-medium text-blue-700">管理员默认开放</span>
                    ) : (
                      <button
                        type="button"
                        disabled={rolloutBusyId !== null || (!user.isEnabled && !enabled)}
                        onClick={() => void handleCandidateToggle(user)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium ${enabled ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:opacity-50`}
                      >
                        {enabled ? <UserMinus className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                        {enabled ? '移除内测' : '加入内测'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-6 py-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">已开通名单</h3>
          {loading ? (
            <p className="py-6 text-center text-sm text-slate-400">加载中…</p>
          ) : rolloutUsers.length === 0 ? (
            <p className="rounded-lg bg-slate-50 py-6 text-center text-sm text-slate-500">暂无普通用户内测人员</p>
          ) : (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {rolloutUsers.map(item => (
                <div key={item.user_id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{item.nick_name || item.login_name || `用户 #${item.user_id}`}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">#{item.user_id} · {item.email || '无邮箱'} · {accountStatusLabel(item.account_status)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={rolloutBusyId !== null}
                    onClick={() => void handleRemove(item.user_id)}
                    className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-start gap-3 border-b border-slate-100 px-6 py-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">每日 Token 额度</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">修改后立即对所有用户生效；用户之间独立计算，已使用量不会清零。</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="px-6 py-6">
          {saved && (
            <div role="status" className="mb-5 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              配置已保存并立即生效
            </div>
          )}
          <label htmlFor="daily-token-limit" className="block text-sm font-medium text-slate-700">每名用户每日额度</label>
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
              className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none disabled:text-slate-400"
            />
            <span className="border-l border-slate-200 px-3 text-sm text-slate-500">Token / 天</span>
          </div>
          <p className={`mt-2 text-xs ${value && !valid ? 'text-red-600' : 'text-slate-500'}`}>
            {value && !valid ? '请输入 1,000–10,000,000 范围内的整数' : '允许范围：1,000–10,000,000。'}
          </p>
          <div className="mt-6 border-t border-slate-100 pt-5">
            <button
              type="submit"
              disabled={!valid || !changed || loading || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500"
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
