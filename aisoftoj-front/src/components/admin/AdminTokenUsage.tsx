import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Gauge,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  AdminAIQuotaUsage,
  listAdminAIQuotaUsage,
  restoreAdminAIUserQuota,
  updateAdminAIUserQuota,
} from '../../lib/aiApi';

const PAGE_SIZE = 10;
const MIN_LIMIT = 1_000;
const MAX_LIMIT = 10_000_000;

type QuotaEdit = {
  userId: number;
  value: string;
};

function beijingDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatTokens(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function usagePercent(item: AdminAIQuotaUsage): number {
  if (item.limit <= 0) return 0;
  return Math.min(100, Math.round(((item.consumed + item.reserved) / item.limit) * 100));
}

export function AdminTokenUsage() {
  const [records, setRecords] = useState<AdminAIQuotaUsage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [date, setDate] = useState(beijingDate);
  const [keyword, setKeyword] = useState('');
  const [inputKeyword, setInputKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<QuotaEdit | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminAIQuotaUsage({
        date,
        keyword: keyword || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setRecords(result.records);
      setTotal(result.total);
    } catch (loadError) {
      setError((loadError as Error).message || 'Token 用量加载失败');
    } finally {
      setLoading(false);
    }
  }, [date, keyword, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageConsumed = useMemo(
    () => records.reduce((sum, item) => sum + item.consumed, 0),
    [records],
  );
  const activeUsers = useMemo(
    () => records.filter(item => item.consumed > 0 || item.reserved > 0).length,
    [records],
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const search = () => {
    setPage(1);
    setKeyword(inputKeyword.trim());
  };

  const saveUserLimit = async () => {
    if (!edit) return;
    const limit = Number(edit.value);
    if (!Number.isInteger(limit) || limit < MIN_LIMIT || limit > MAX_LIMIT) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await updateAdminAIUserQuota(edit.userId, limit);
      setEdit(null);
      await load();
    } catch (saveError) {
      setEditError((saveError as Error).message || '专属额度保存失败');
    } finally {
      setEditSaving(false);
    }
  };

  const restoreGlobalLimit = async () => {
    if (!edit) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await restoreAdminAIUserQuota(edit.userId);
      setEdit(null);
      await load();
    } catch (restoreError) {
      setEditError((restoreError as Error).message || '恢复全局额度失败');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="min-w-[860px]">
      <header className="mb-6 flex items-end justify-between gap-6">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-blue-600">AI cost control</p>
          <h1 className="text-xl font-semibold text-slate-900">Token 用量</h1>
          <p className="mt-1 text-sm text-slate-500">按北京时间查看每名用户的每日 Agent Token 消耗。</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <CalendarDays className="h-4 w-4" /> 每日 00:00 重置
        </div>
      </header>

      <section className="mb-5 grid grid-cols-[1.2fr_1fr_1fr] overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-r border-slate-100 px-5 py-4">
          <div className="text-xs text-slate-500">当前页已消耗</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {formatTokens(pageConsumed)} <span className="text-xs font-normal text-slate-400">Token</span>
          </div>
        </div>
        <div className="border-r border-slate-100 px-5 py-4">
          <div className="text-xs text-slate-500">当前页活跃用户</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{activeUsers}</div>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs text-slate-500">匹配用户</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{total}</div>
        </div>
      </section>

      <div className="mb-4 flex items-center gap-3">
        <label className="relative">
          <CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            aria-label="用量日期"
            type="date"
            value={date}
            max={beijingDate()}
            onChange={event => {
              setPage(1);
              setDate(event.target.value);
            }}
            className="h-9 rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <div className="flex h-9 w-80 overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
          <input
            aria-label="搜索用户"
            value={inputKeyword}
            onChange={event => setInputKeyword(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && search()}
            placeholder="用户名 / 昵称 / 邮箱 / 手机"
            className="min-w-0 flex-1 border-0 px-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={search}
            className="flex items-center gap-1.5 border-l border-slate-200 px-3 text-sm font-medium text-blue-600 hover:bg-blue-50"
          >
            <Search className="h-4 w-4" /> 搜索
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
              <th className="px-5 py-3">用户</th>
              <th className="px-4 py-3">当日额度</th>
              <th className="px-4 py-3">已消耗</th>
              <th className="px-4 py-3">处理中</th>
              <th className="px-4 py-3">剩余</th>
              <th className="w-56 px-5 py-3">使用率</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-14 text-center text-slate-400">正在汇总 Token 用量…</td></tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 text-center">
                  <Gauge className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                  <p className="text-sm text-slate-500">没有找到匹配用户</p>
                  <p className="mt-1 text-xs text-slate-400">调整日期或搜索条件后重试</p>
                </td>
              </tr>
            ) : records.map(item => {
              const percent = usagePercent(item);
              const isEditing = edit?.userId === item.user_id;
              const editLimit = Number(edit?.value);
              const editValid = Number.isInteger(editLimit)
                && editLimit >= MIN_LIMIT
                && editLimit <= MAX_LIMIT;
              return (
                <React.Fragment key={item.user_id}>
                <tr className={`border-b border-slate-100 hover:bg-slate-50/70 ${isEditing ? 'bg-blue-50/40' : ''}`}>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-800">{item.login_name || `用户 #${item.user_id}`}</div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {[item.nick_name, item.email].filter(Boolean).join(' · ') || `ID ${item.user_id}`}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-slate-600">
                    <div>{formatTokens(item.limit)}</div>
                    <span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      item.limit_source === 'user'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {item.limit_source === 'user' ? '专属额度' : '全局额度'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 tabular-nums font-medium text-slate-900">{formatTokens(item.consumed)}</td>
                  <td className="px-4 py-3.5 tabular-nums text-amber-600">{formatTokens(item.reserved)}</td>
                  <td className="px-4 py-3.5 tabular-nums text-slate-600">{formatTokens(item.remaining)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="w-9 text-right text-xs tabular-nums text-slate-500">{percent}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      type="button"
                      aria-label={`调整 ${item.login_name || `用户 ${item.user_id}`} 的额度`}
                      onClick={() => {
                        setEdit({ userId: item.user_id, value: String(item.limit) });
                        setEditError(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" /> 调整
                    </button>
                  </td>
                </tr>
                {isEditing && (
                  <tr className="border-b border-blue-100 bg-blue-50/40">
                    <td colSpan={7} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-6">
                        <div>
                          <div className="text-sm font-medium text-slate-800">
                            设置 {item.login_name || `用户 #${item.user_id}`} 的专属每日额度
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            立即生效，不清空今日已消耗 Token；恢复全局后将使用系统统一额度。
                          </p>
                          {editError && <p role="alert" className="mt-2 text-xs text-red-600">{editError}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 items-center overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                            <input
                              autoFocus
                              aria-label="专属每日额度"
                              type="number"
                              min={MIN_LIMIT}
                              max={MAX_LIMIT}
                              value={edit.value}
                              disabled={editSaving}
                              onChange={event => setEdit({ ...edit, value: event.target.value })}
                              onKeyDown={event => event.key === 'Enter' && void saveUserLimit()}
                              className="w-36 border-0 px-3 text-sm tabular-nums outline-none"
                            />
                            <span className="border-l border-slate-200 px-2.5 text-xs text-slate-400">Token / 天</span>
                          </div>
                          <button
                            type="button"
                            disabled={!editValid || editSaving}
                            onClick={() => void saveUserLimit()}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                          ><Check className="h-3.5 w-3.5" /> 保存</button>
                          {item.limit_source === 'user' && (
                            <button
                              type="button"
                              disabled={editSaving}
                              onClick={() => void restoreGlobalLimit()}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                            ><RotateCcw className="h-3.5 w-3.5" /> 恢复全局</button>
                          )}
                          <button
                            type="button"
                            aria-label="取消调整额度"
                            disabled={editSaving}
                            onClick={() => setEdit(null)}
                            className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-600 disabled:opacity-50"
                          ><X className="h-4 w-4" /></button>
                        </div>
                      </div>
                      {!editValid && edit.value && (
                        <p className="mt-2 text-right text-xs text-red-600">请输入 1,000–10,000,000 范围内的整数</p>
                      )}
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </section>

      <footer className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>共 {total} 名用户</span>
        <div className="flex items-center gap-2">
          <button
            aria-label="上一页"
            disabled={page <= 1 || loading}
            onClick={() => setPage(current => current - 1)}
            className="rounded-lg border border-slate-300 p-2 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          ><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-16 text-center tabular-nums">{page} / {totalPages}</span>
          <button
            aria-label="下一页"
            disabled={page >= totalPages || loading}
            onClick={() => setPage(current => current + 1)}
            className="rounded-lg border border-slate-300 p-2 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          ><ChevronRight className="h-4 w-4" /></button>
        </div>
      </footer>
    </div>
  );
}
