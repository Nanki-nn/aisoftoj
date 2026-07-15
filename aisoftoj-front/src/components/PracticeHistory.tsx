import React, { useEffect, useState } from 'react';
import { BarChart3, Clock3, Eye, Play } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Skeleton } from './ui/skeleton';
import {
  PapersWorkspaceHeader,
  WorkspaceStats,
  historyStatIcons,
  type WorkspaceStat,
} from './PapersWorkspaceHeader';
import { fetchPracticeHistory, fetchWrongQuestions } from '../lib/api';
import type { PracticeHistorySummary, PracticeSessionRecord } from '../types/record';

interface PracticeHistoryProps {
  onContinue: (recordId: string, status: PracticeSessionRecord['status']) => void;
  onViewResult: (recordId: string) => void;
}

function getProgress(record: PracticeSessionRecord) {
  const total = Math.max(0, record.totalCount || 0);
  const answered = Math.min(total, Math.max(0, record.answeredCount || 0));
  return {
    answered,
    total,
    percentage: total > 0 ? (answered / total) * 100 : 0,
  };
}

function HistoryRowsSkeleton() {
  return (
    <div className="divide-y divide-slate-100" aria-label="正在加载刷题记录" aria-busy="true">
      {[0, 1, 2, 3, 4].map((item) => (
        <div key={item} className="flex flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-6 w-16 rounded-lg" />
            </div>
            <div className="mt-3 flex gap-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-2 w-24 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-lg" />
            <Skeleton className="h-9 w-20 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PracticeHistory({ onContinue, onViewResult }: PracticeHistoryProps) {
  const [records, setRecords] = useState<PracticeSessionRecord[]>([]);
  const [summary, setSummary] = useState<PracticeHistorySummary | null>(null);
  const [wrongCount, setWrongCount] = useState<number | null>(null);
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
    fetchWrongQuestions({ pageSize: 1 })
      .then((data) => {
        if (isMounted) setWrongCount(data.total);
      })
      .catch(() => {
        if (isMounted) setWrongCount(null);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchPracticeHistory({ page, pageSize })
      .then((data) => {
        if (!isMounted) return;
        setRecords(data.records);
        setTotal(data.total);
        setSummary(data.summary ?? null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || '刷题记录加载失败');
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

  const handlePageSizeChange = (value: string) => {
    setPage(1);
    setPageSize(Number(value));
  };

  const stats: WorkspaceStat[] = [
    { label: '总练习次数', value: summary?.totalCount ?? total, icon: historyStatIcons.total, tone: 'blue' },
    { label: '进行中', value: summary?.inProgressCount ?? '--', icon: historyStatIcons.inProgress, tone: 'amber' },
    { label: '已完成', value: summary?.completedCount ?? '--', icon: historyStatIcons.completed, tone: 'emerald' },
    { label: '累计答题', value: summary?.answeredCount ?? '--', icon: historyStatIcons.answered, tone: 'violet' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-slate-50 text-slate-950">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <PapersWorkspaceHeader activeTab="history" historyCount={total} wrongCount={wrongCount} />

        <section className="mt-10" aria-label="刷题统计">
          <WorkspaceStats items={stats} isLoading={isLoading && records.length === 0} />
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">练习记录</h2>
              <p className="mt-1 text-sm text-slate-500">继续未完成练习，或回看已完成记录与结果。</p>
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

          {isLoading && <HistoryRowsSkeleton />}

          {!isLoading && error && (
            <div className="px-6 py-14 text-center">
              <p className="font-medium text-red-700">刷题记录加载失败</p>
              <p className="mt-2 text-sm text-red-600">{error}</p>
            </div>
          )}

          {!isLoading && !error && records.length === 0 && (
            <div className="px-6 py-16 text-center text-slate-500">
              <BarChart3 className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
              <p className="mt-4 font-medium text-slate-700">暂无刷题记录</p>
              <p className="mt-1 text-sm">从试卷列表开始一次练习后，记录会显示在这里。</p>
            </div>
          )}

          {!isLoading && !error && records.length > 0 && (
            <>
              <div className="divide-y divide-slate-100">
                {records.map((record) => {
                  const progress = getProgress(record);
                  const completed = record.status === 'completed';
                  const modeClass = record.examMode === 'exam'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-blue-200 bg-blue-50 text-blue-700';
                  const statusClass = completed
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700';
                  return (
                    <article
                      key={record.id}
                      className="flex flex-col gap-5 px-5 py-5 transition-colors hover:bg-slate-50/80 sm:px-6 lg:flex-row lg:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-semibold text-slate-900">{record.examName}</h3>
                          <Badge variant="outline" className="shrink-0 rounded-lg border-slate-200 bg-white text-xs text-slate-600">
                            {record.examType}
                          </Badge>
                          <Badge variant="outline" className={'shrink-0 rounded-lg text-xs ' + modeClass}>
                            {record.examMode === 'exam' ? '考试模式' : '练习模式'}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                            {record.createTime}
                          </span>
                          <span className="tabular-nums">{progress.answered}/{progress.total} 题</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:shrink-0">
                        <div className="w-full sm:w-28">
                          <Progress
                            value={progress.percentage}
                            aria-label={record.examName + '答题进度'}
                            aria-valuetext={progress.answered + '/' + progress.total}
                            className="h-2 bg-slate-100 [&>div]:bg-blue-600"
                          />
                        </div>
                        <Badge variant="outline" className={'w-fit shrink-0 rounded-lg ' + statusClass}>
                          {completed ? '已完成' : '进行中'}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <Button
                            variant={completed ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => onContinue(record.id, record.status)}
                            className={completed
                              ? 'h-9 rounded-lg border-blue-200 text-blue-700 hover:bg-blue-50'
                              : 'h-9 rounded-lg bg-blue-600 hover:bg-blue-700'}
                          >
                            {completed ? <Eye className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}
                            {completed ? '查看' : '继续'}
                          </Button>
                          {completed && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onViewResult(record.id)}
                              className="h-9 rounded-lg text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                            >
                              结果
                            </Button>
                          )}
                        </div>
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
