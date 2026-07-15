import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpenCheck,
  Clock3,
  Eye,
  Flame,
  LibraryBig,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Skeleton } from './ui/skeleton';
import {
  PapersWorkspaceHeader,
  WorkspaceStats,
  type WorkspaceStat,
} from './PapersWorkspaceHeader';
import { fetchPracticeHistory, fetchWrongQuestions } from '../lib/api';
import {
  importanceLevels,
  type PracticeRecord,
  type WrongQuestionSummary,
} from '../types/record';

interface WrongQuestionsProps {
  onViewQuestion: (record: PracticeRecord) => void;
}

function WrongRowsSkeleton() {
  return (
    <div className="divide-y divide-slate-100" aria-label="正在加载错题记录" aria-busy="true">
      {[0, 1, 2, 3, 4].map((item) => (
        <div key={item} className="flex flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-6 w-16 rounded-lg" />
              <Skeleton className="h-6 w-20 rounded-lg" />
            </div>
            <div className="mt-3 flex gap-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-12" />
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function WrongQuestions({ onViewQuestion }: WrongQuestionsProps) {
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [summary, setSummary] = useState<WrongQuestionSummary | null>(null);
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, total);

  useEffect(() => {
    let isMounted = true;
    fetchPracticeHistory({ pageSize: 1 })
      .then((data) => {
        if (isMounted) setHistoryCount(data.total);
      })
      .catch(() => {
        if (isMounted) setHistoryCount(null);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchWrongQuestions({ page, pageSize })
      .then((data) => {
        if (!isMounted) return;
        setRecords(data.records);
        setTotal(data.total);
        setSummary(data.summary ?? null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || '错题记录加载失败');
        setRecords([]);
        setSummary(null);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [page, pageSize]);

  const handleRemove = (id: string) => {
    if (confirm('确定要从当前视图移除这条错题记录吗？重新加载后仍会恢复。')) {
      setRecords((current) => current.filter((record) => record.id !== id));
    }
  };

  const handleView = (record: PracticeRecord) => {
    if (!record.sessionId || !record.questionId) {
      alert('这条错题缺少对应刷题会话，暂时无法查看原题');
      return;
    }
    onViewQuestion(record);
  };

  const handlePageSizeChange = (value: string) => {
    setPage(1);
    setPageSize(Number(value));
  };

  const stats: WorkspaceStat[] = [
    { label: '错题总数', value: summary?.totalCount ?? total, icon: BookOpenCheck, tone: 'red' },
    { label: '必须掌握', value: summary?.masterCount ?? '--', icon: ShieldAlert, tone: 'blue' },
    { label: '高频错题', value: summary?.frequentCount ?? '--', icon: Flame, tone: 'amber' },
    { label: '涉及题库', value: summary?.paperCount ?? '--', icon: LibraryBig, tone: 'violet' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-slate-50 text-slate-950">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <PapersWorkspaceHeader activeTab="wrong" historyCount={historyCount} wrongCount={total} />

        <section className="mt-10" aria-label="错题统计">
          <WorkspaceStats items={stats} isLoading={isLoading && records.length === 0} />
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">错题列表</h2>
              <p className="mt-1 text-sm text-slate-500">按错误次数优先排序，集中复习高频薄弱点。</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>每页</span>
              <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="h-9 w-20 rounded-lg bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <span>条</span>
            </div>
          </div>

          {isLoading && <WrongRowsSkeleton />}

          {!isLoading && error && (
            <div className="px-6 py-14 text-center">
              <p className="font-medium text-red-700">错题记录加载失败</p>
              <p className="mt-2 text-sm text-red-600">{error}</p>
            </div>
          )}

          {!isLoading && !error && records.length === 0 && (
            <div className="px-6 py-16 text-center text-slate-500">
              <AlertCircle className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
              <p className="mt-4 font-medium text-slate-700">暂无错题记录</p>
              <p className="mt-1 text-sm">继续刷题，答错的题目会自动沉淀在这里。</p>
            </div>
          )}

          {!isLoading && !error && records.length > 0 && (
            <>
              <div className="divide-y divide-slate-100">
                {records.map((record) => {
                  const importance = importanceLevels[record.importance];
                  return (
                    <article
                      key={record.id}
                      className="flex flex-col gap-5 px-5 py-5 transition-colors hover:bg-slate-50/80 sm:px-6 lg:flex-row lg:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-semibold text-slate-900">{record.topicName}</h3>
                          <Badge variant="outline" className="shrink-0 rounded-lg border-slate-200 bg-white text-xs text-slate-600">
                            {record.topicType}
                          </Badge>
                          <Badge variant="outline" className={'shrink-0 rounded-lg border-transparent text-xs ' + importance.color}>
                            {importance.label}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="truncate">{record.questionBank}</span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                            {record.updateTime}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 sm:justify-start lg:shrink-0">
                        <div className="min-w-14 text-center">
                          <div className="text-xl font-semibold tabular-nums text-red-500">{record.errorCount || 0}</div>
                          <div className="text-xs text-slate-400">次错误</div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleView(record)}
                          className="h-9 rounded-lg border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                          <Eye className="mr-1.5 h-4 w-4" aria-hidden="true" />
                          查看原题
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(record.id)}
                          className="h-9 w-9 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={'从当前视图移除' + record.topicName}
                          title="仅从当前视图移除，重新加载后恢复"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="text-sm text-slate-500">
                  共 {total} 条，当前显示 {startRecord}-{endRecord}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    上一页
                  </Button>
                  <span className="min-w-16 text-center text-sm tabular-nums text-slate-600">
                    {page} / {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    下一页
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
