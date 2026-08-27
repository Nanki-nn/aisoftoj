import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Gauge, Search } from 'lucide-react';
import { AdminAIQuotaUsage, listAdminAIQuotaUsage } from '../../lib/aiApi';

const PAGE_SIZE = 10;

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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-14 text-center text-slate-400">正在汇总 Token 用量…</td></tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-14 text-center">
                  <Gauge className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                  <p className="text-sm text-slate-500">没有找到匹配用户</p>
                  <p className="mt-1 text-xs text-slate-400">调整日期或搜索条件后重试</p>
                </td>
              </tr>
            ) : records.map(item => {
              const percent = usagePercent(item);
              return (
                <tr key={item.user_id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-800">{item.login_name || `用户 #${item.user_id}`}</div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {[item.nick_name, item.email].filter(Boolean).join(' · ') || `ID ${item.user_id}`}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-slate-600">{formatTokens(item.limit)}</td>
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
                </tr>
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
