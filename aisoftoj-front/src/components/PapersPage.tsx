import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  FileText,
  GraduationCap,
  LogIn,
  Play,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { AppHeader } from './AppHeader';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Progress } from './ui/progress';
import { Skeleton } from './ui/skeleton';
import { PapersWorkspaceHeader } from './PapersWorkspaceHeader';
import {
  fetchPapers,
  fetchPracticeHistory,
  fetchWrongQuestions,
  isApiRequestError,
} from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import type { ExamPaper } from '../types/exam';

interface PapersPageProps {
  onStartPaper: (paper: ExamPaper, mode: 'practice' | 'exam') => void;
  onShowProfile: () => void;
  onShowAuth: () => void;
}

const SUBJECT_ORDER = [
  '系统架构设计师',
  '系统分析师',
  '软件设计师',
  '网络工程师',
  '数据库系统工程师',
  '信息系统项目管理师',
] as const;

const CATEGORY_ORDER = ['综合知识', '案例分析', '论文'] as const;

function sortWithPreferredOrder(values: string[], preferred: readonly string[]) {
  return [...values].sort((a, b) => {
    const aIndex = preferred.indexOf(a);
    const bIndex = preferred.indexOf(b);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b, 'zh-CN');
  });
}

function formatDate(dateValue: string) {
  if (!dateValue) return '待更新';
  const normalized = String(dateValue).trim();
  const dateParts = normalized.match(/^(\d{4})(?:年|-)(\d{1,2})(?:月|-)(\d{1,2})/);
  if (!dateParts) return normalized.slice(0, 10);
  const [, year, month, day] = dateParts;
  return `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')}`;
}

function getPaperProgress(paper: ExamPaper) {
  const total = Math.max(0, paper.questionCount || 0);
  let completed = 0;

  if (paper.status === 'completed') {
    completed = total;
  } else if (paper.status === 'in_progress') {
    const value = typeof paper.completedCount === 'number' && Number.isFinite(paper.completedCount)
      ? Math.trunc(paper.completedCount)
      : 0;
    completed = Math.min(total, Math.max(0, value));
  }

  return {
    completed,
    total,
    percentage: total > 0 ? (completed / total) * 100 : 0,
  };
}

function PapersSkeleton() {
  return (
    <div className="space-y-8" aria-label="正在加载试卷数据" aria-busy="true">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Skeleton className="h-6 w-28" />
        <div className="mt-4 flex flex-wrap gap-3">
          {[120, 100, 112, 96].map((width) => (
            <Skeleton key={width} className="h-10 rounded-xl" style={{ width }} />
          ))}
        </div>
        <Skeleton className="mt-7 h-6 w-24" />
        <div className="mt-4 flex gap-3">
          {[96, 88, 72].map((width) => (
            <Skeleton key={width} className="h-10 rounded-xl" style={{ width }} />
          ))}
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div
            key={item}
            className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            style={{ minHeight: 300 }}
          >
            <div className="flex justify-between gap-4">
              <div className="space-y-3">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-6 w-16 rounded-lg" />
            </div>
            <div className="mt-8 space-y-5">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center justify-between gap-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PapersPage({
  onStartPaper,
  onShowProfile,
  onShowAuth,
}: PapersPageProps) {
  const {
    isAuthenticated,
    isAuthInitialized,
    authInitializationError,
    checkAuthStatus,
    clearAuth,
  } = useAuth();
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  const [wrongCount, setWrongCount] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<ExamPaper | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthInitialized || authInitializationError) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);
    setHistoryCount(null);
    setWrongCount(null);

    const requests = isAuthenticated
      ? [
          fetchPapers(),
          fetchPracticeHistory({ pageSize: 1 }),
          fetchWrongQuestions({ pageSize: 1 }),
        ] as const
      : [fetchPapers()] as const;

    void Promise.allSettled(requests).then((results) => {
      if (!isMounted) return;

      const papersResult = results[0];
      if (papersResult.status === 'fulfilled') {
        setPapers(papersResult.value);
      } else if (
        isAuthenticated
        && isApiRequestError(papersResult.reason)
        && (papersResult.reason.status === 401 || papersResult.reason.code === 401)
      ) {
        // Token 在初始化后失效时，清理本地状态；依赖变更会自动按游客身份重新加载目录。
        setSessionNotice('登录已过期，已切换为游客浏览');
        clearAuth();
        setIsLoading(false);
        return;
      } else {
        setPapers([]);
        setError((papersResult.reason as Error)?.message || '试卷加载失败，请检查网络后重试。');
      }

      if (isAuthenticated) {
        const historyResult = results[1];
        const wrongResult = results[2];
        setHistoryCount(historyResult?.status === 'fulfilled' ? historyResult.value.total : null);
        setWrongCount(wrongResult?.status === 'fulfilled' ? wrongResult.value.total : null);
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [authInitializationError, clearAuth, isAuthInitialized, isAuthenticated, reloadKey]);

  const subjectOptions = useMemo(() => {
    const values = papers.map((paper) => paper.subject).filter(Boolean);
    return sortWithPreferredOrder([...new Set(values)], SUBJECT_ORDER);
  }, [papers]);

  useEffect(() => {
    if (subjectOptions.length === 0) {
      setSelectedSubject('');
      return;
    }
    if (!subjectOptions.includes(selectedSubject)) {
      setSelectedSubject(subjectOptions[0]);
    }
  }, [selectedSubject, subjectOptions]);

  const categoryOptions = useMemo(() => {
    const values = papers
      .filter((paper) => paper.subject === selectedSubject)
      .map((paper) => paper.category)
      .filter(Boolean);
    return sortWithPreferredOrder([...new Set(values)], CATEGORY_ORDER);
  }, [papers, selectedSubject]);

  useEffect(() => {
    if (categoryOptions.length === 0) {
      setSelectedCategory('');
      return;
    }
    if (!categoryOptions.includes(selectedCategory)) {
      setSelectedCategory(categoryOptions[0]);
    }
  }, [categoryOptions, selectedCategory]);

  const filteredPapers = useMemo(() => {
    return papers
      .filter((paper) => paper.subject === selectedSubject && paper.category === selectedCategory)
      .sort((a, b) => (a.year === b.year ? b.month - a.month : b.year - a.year));
  }, [papers, selectedCategory, selectedSubject]);

  const openModeDialog = (paper: ExamPaper) => {
    if (!isAuthenticated) {
      onShowAuth();
      return;
    }
    setSelectedPaper(paper);
    setShowModeDialog(true);
  };

  const handleDialogChange = (open: boolean) => {
    setShowModeDialog(open);
    if (!open) setSelectedPaper(null);
  };

  const handleModeSelect = (mode: 'practice' | 'exam') => {
    if (!selectedPaper || !isAuthenticated) return;
    onStartPaper(selectedPaper, mode);
    setShowModeDialog(false);
    setSelectedPaper(null);
  };

  const renderStatusAction = (paper: ExamPaper) => {
    if (!isAuthenticated) {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={onShowAuth}
          className="h-9 rounded-lg border-slate-300 px-4 font-medium text-slate-800 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
        >
          <Play className="mr-1.5 h-4 w-4" aria-hidden="true" />
          开始刷题
        </Button>
      );
    }

    if (paper.status === 'in_progress') {
      return (
        <Button
          size="sm"
          onClick={() => onStartPaper(paper, 'practice')}
          className="h-9 rounded-lg bg-blue-600 px-4 font-medium shadow-sm shadow-blue-600/20 hover:bg-blue-700"
        >
          <Play className="mr-1.5 h-4 w-4" aria-hidden="true" />
          继续刷题
        </Button>
      );
    }

    if (paper.status === 'completed') {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => openModeDialog(paper)}
          className="h-9 rounded-lg border-emerald-200 px-4 font-medium text-emerald-700 hover:bg-emerald-50"
        >
          <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
          重新刷题
        </Button>
      );
    }

    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => openModeDialog(paper)}
        className="h-9 rounded-lg border-slate-300 px-4 font-medium text-slate-800 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
      >
        <Play className="mr-1.5 h-4 w-4" aria-hidden="true" />
        开始刷题
      </Button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-slate-50 text-slate-950">
      <AppHeader onShowAuth={onShowAuth} onShowProfile={onShowProfile} />

      <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <PapersWorkspaceHeader activeTab="papers" historyCount={historyCount} wrongCount={wrongCount} />

        {!isAuthInitialized && !authInitializationError && (
          <div className="mt-8">
            <PapersSkeleton />
          </div>
        )}

        {!isAuthInitialized && authInitializationError && (
          <section className="mt-8 rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-xl font-semibold text-slate-950">登录状态校验失败</h2>
            <p className="mx-auto mt-2 max-w-lg text-base leading-7 text-slate-600">{authInitializationError}</p>
            <Button
              onClick={() => void checkAuthStatus()}
              className="mt-6 h-11 rounded-xl bg-blue-600 px-5 hover:bg-blue-700"
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              重新校验
            </Button>
          </section>
        )}

        {isAuthInitialized && (
          <>
            {sessionNotice && (
              <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900" role="status">
                <span>{sessionNotice}</span>
                <button
                  type="button"
                  onClick={() => setSessionNotice(null)}
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                >
                  知道了
                </button>
              </div>
            )}

            {!isAuthenticated && (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
                <LogIn className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>你正在以游客身份浏览真实试卷目录；选择试卷开始刷题时再登录即可。</span>
              </div>
            )}

            <div className="mt-8">
              {isLoading && <PapersSkeleton />}

              {!isLoading && error && (
                <section className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                    <AlertCircle className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h2 className="mt-5 text-xl font-semibold text-slate-950">试卷暂时加载失败</h2>
                  <p className="mx-auto mt-2 max-w-lg text-base leading-7 text-slate-600">{error}</p>
                  <div className="mt-6 flex justify-center">
                    <Button onClick={() => setReloadKey((value) => value + 1)} className="h-11 rounded-xl bg-blue-600 px-5 hover:bg-blue-700">
                      <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                      重新加载
                    </Button>
                  </div>
                </section>
              )}

              {!isLoading && !error && papers.length === 0 && (
                <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <BookOpen className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <h2 className="mt-5 text-xl font-semibold text-slate-950">暂时还没有可用试卷</h2>
                  <p className="mt-2 text-slate-600">题库正在持续整理，稍后再来看看。</p>
                </section>
              )}

              {!isLoading && !error && papers.length > 0 && (
                <>
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div>
                      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                        <BookOpen className="h-5 w-5 text-slate-700" aria-hidden="true" />
                        科目筛选
                      </h2>
                      <div className="mt-4 flex flex-wrap gap-2.5">
                        {subjectOptions.map((subject) => {
                          const active = selectedSubject === subject;
                          return (
                            <button
                              key={subject}
                              type="button"
                              aria-pressed={active}
                              onClick={() => setSelectedSubject(subject)}
                              className={`min-h-10 rounded-xl border px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                                active
                                  ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900'
                              }`}
                            >
                              {subject}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-7 border-t border-slate-100 pt-6">
                      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                        <FileText className="h-5 w-5 text-slate-700" aria-hidden="true" />
                        题型分类
                      </h2>
                      <div className="mt-4 flex flex-wrap gap-2.5">
                        {categoryOptions.map((category) => {
                          const active = selectedCategory === category;
                          return (
                            <button
                              key={category}
                              type="button"
                              aria-pressed={active}
                              onClick={() => setSelectedCategory(category)}
                              className={`min-h-10 rounded-xl border px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                                active
                                  ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900'
                              }`}
                            >
                              {category}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </section>

                  <section className="mt-9">
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <h2 className="flex min-w-0 items-center gap-2 text-xl font-semibold text-slate-950">
                        <CalendarDays className="h-5 w-5 shrink-0 text-slate-700" aria-hidden="true" />
                        <span className="truncate">{selectedSubject} · {selectedCategory}</span>
                      </h2>
                      <Badge variant="outline" className="w-fit rounded-lg border-slate-200 bg-white px-3 py-1 text-slate-600">
                        共 {filteredPapers.length} 套试卷
                      </Badge>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                      {filteredPapers.map((paper) => {
                        const progress = getPaperProgress(paper);
                        return (
                          <Card
                            key={paper.id}
                            className="group flex flex-col rounded-2xl border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg motion-reduce:transform-none"
                            style={{ minHeight: 300 }}
                          >
                            <CardHeader className="pb-5">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <CardTitle className="text-lg font-semibold tracking-tight text-slate-950 transition-colors group-hover:text-blue-700">
                                    {paper.year}年{paper.month}月真题
                                  </CardTitle>
                                  <p className="mt-2 truncate text-sm text-slate-500">{paper.subject}</p>
                                </div>
                                <Badge className="shrink-0 rounded-lg border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-50">
                                  {paper.category}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="flex flex-1 flex-col pt-0">
                              <dl className="space-y-4 text-sm">
                                <div className="flex items-center justify-between gap-4">
                                  <dt className="text-slate-600">题目数量</dt>
                                  <dd className="font-semibold tabular-nums text-slate-900">{progress.total} 题</dd>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <dt className="text-slate-600">练习次数</dt>
                                  <dd className="font-medium tabular-nums text-slate-900">{paper.practiceCount || 0}</dd>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-4">
                                    <dt className="text-slate-600">练习进度</dt>
                                    <dd className="font-medium tabular-nums text-slate-900">
                                      {progress.completed}/{progress.total}
                                    </dd>
                                  </div>
                                  <Progress
                                    value={progress.percentage}
                                    aria-label={`${paper.year}年${paper.month}月真题练习进度`}
                                    aria-valuetext={`${progress.completed}/${progress.total}`}
                                    className="h-2 bg-slate-100 [&>div]:bg-blue-600"
                                  />
                                </div>
                              </dl>

                              <div className="mt-auto flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                                <span className="text-xs text-slate-500">更新：{formatDate(paper.lastUpdated)}</span>
                                {renderStatusAction(paper)}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </section>
                </>
              )}
            </div>
          </>
        )}
      </main>

      <Dialog open={showModeDialog} onOpenChange={handleDialogChange}>
        <DialogContent className="rounded-2xl border-slate-200 bg-white p-6 shadow-2xl sm:max-w-xl sm:p-7">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">选择答题模式</DialogTitle>
            <DialogDescription className="pt-1 text-base text-slate-500">
              {selectedPaper ? `${selectedPaper.year}年${selectedPaper.month}月 · ${selectedPaper.subject}` : '选择适合当前目标的方式'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => handleModeSelect('practice')}
              className="group flex flex-col items-start rounded-2xl border border-blue-200 bg-blue-50 p-5 text-left outline-none transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transform-none"
              style={{ minHeight: 176 }}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="mt-5 text-lg font-semibold text-slate-950">练习模式</span>
              <span className="mt-2 text-sm leading-6 text-slate-600">逐题作答，即时查看答案与解析。</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeSelect('exam')}
              className="group flex flex-col items-start rounded-2xl border border-red-200 bg-red-50 p-5 text-left outline-none transition-all hover:-translate-y-0.5 hover:border-red-500 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 motion-reduce:transform-none"
              style={{ minHeight: 176 }}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600 text-white shadow-sm">
                <GraduationCap className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="mt-5 text-lg font-semibold text-slate-950">考试模式</span>
              <span className="mt-2 text-sm leading-6 text-slate-600">完整模拟考试，交卷后统一查看结果。</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
