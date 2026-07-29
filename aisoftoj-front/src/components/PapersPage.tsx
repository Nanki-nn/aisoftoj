import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  FileText,
  Filter,
  GraduationCap,
  History,
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
  return [...values].sort((first, second) => {
    const firstIndex = preferred.indexOf(first);
    const secondIndex = preferred.indexOf(second);
    if (firstIndex !== -1 && secondIndex !== -1) return firstIndex - secondIndex;
    if (firstIndex !== -1) return -1;
    if (secondIndex !== -1) return 1;
    return first.localeCompare(second, 'zh-CN');
  });
}

function formatDate(dateValue: string) {
  if (!dateValue) return '待更新';
  const normalized = String(dateValue).trim();
  const dateParts = normalized.match(/^(\d{4})(?:年|\/|-)(\d{1,2})(?:月|\/|-)(\d{1,2})(.*)$/);
  if (!dateParts) return normalized;
  const [, year, month, day, suffix] = dateParts;
  const timeSuffix = suffix.replace(/^\s*(\d{1,2})时(\d{1,2})分(\d{1,2})秒$/, ' $1:$2:$3');
  return `${year}/${Number(month)}/${Number(day)}${timeSuffix}`;
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
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-3 h-5 w-80 max-w-full" />
        <div className="mt-6 flex flex-wrap gap-3">
          <Skeleton className="h-12 w-32 rounded-lg" />
          <Skeleton className="h-12 w-32 rounded-lg" />
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Skeleton className="h-5 w-24" />
        <div className="mt-5 flex flex-wrap gap-3">
          {[120, 100, 112, 96].map((width) => (
            <Skeleton key={width} className="h-10 rounded-lg" style={{ width }} />
          ))}
        </div>
        <Skeleton className="mt-6 h-5 w-24" />
        <div className="mt-5 flex gap-3">
          {[96, 88, 72].map((width) => (
            <Skeleton key={width} className="h-10 rounded-lg" style={{ width }} />
          ))}
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm" style={{ minHeight: 384 }}>
            <div className="flex justify-between gap-4">
              <div className="space-y-3">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-6 w-16 rounded-lg" />
            </div>
            <div className="mt-10 space-y-5">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center justify-between gap-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            <div className="mt-12 flex items-center justify-between border-t border-slate-100 pt-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PapersPage({ onStartPaper, onShowProfile, onShowAuth }: PapersPageProps) {
  const {
    isAuthenticated,
    isAuthInitialized,
    authInitializationError,
    checkAuthStatus,
    clearAuth,
  } = useAuth();
  const navigate = useNavigate();
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

  useEffect(() => {
    if (!isAuthInitialized || authInitializationError) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);
    setHistoryCount(null);
    setWrongCount(null);

    const requests = isAuthenticated
      ? [fetchPapers(), fetchPracticeHistory({ pageSize: 1 }), fetchWrongQuestions({ pageSize: 1 })] as const
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
      .sort((first, second) => (first.year === second.year ? second.month - first.month : second.year - first.year));
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
          <Play className="mr-1 h-4 w-4" aria-hidden="true" />
          开始刷题
        </Button>
      );
    }

    if (paper.status === 'in_progress') {
      return (
        <Button
          size="sm"
          onClick={() => onStartPaper(paper, 'practice')}
          className="h-9 rounded-lg bg-blue-600 px-4 font-medium shadow-md shadow-blue-600/20 hover:bg-blue-700"
        >
          <Play className="mr-1 h-4 w-4" aria-hidden="true" />
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
          className="h-9 rounded-lg border-emerald-200 px-4 font-medium text-emerald-600 hover:bg-emerald-50"
        >
          <RotateCcw className="mr-1 h-4 w-4" aria-hidden="true" />
          重新刷题
        </Button>
      );
    }

    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => openModeDialog(paper)}
        className="h-9 rounded-lg border-slate-200 px-4 font-medium text-slate-700 hover:bg-slate-50"
      >
        <Play className="mr-1 h-4 w-4" aria-hidden="true" />
        开始刷题
      </Button>
    );
  };

  const handleHistoryClick = () => {
    if (!isAuthenticated) {
      onShowAuth();
      return;
    }
    navigate('/practice-history');
  };

  const handleWrongClick = () => {
    if (!isAuthenticated) {
      onShowAuth();
      return;
    }
    navigate('/wrong-questions');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <AppHeader onShowAuth={onShowAuth} onShowProfile={onShowProfile} />

      <main id="main-content" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {!isAuthInitialized && !authInitializationError && <PapersSkeleton />}

        {!isAuthInitialized && authInitializationError && (
          <section className="rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-xl font-semibold text-slate-950">登录状态校验失败</h2>
            <p className="mx-auto mt-2 max-w-lg text-base leading-7 text-slate-600">{authInitializationError}</p>
            <Button onClick={() => void checkAuthStatus()} className="mt-6 h-11 rounded-lg bg-blue-600 px-5 hover:bg-blue-700">
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              重新校验
            </Button>
          </section>
        )}

        {isAuthInitialized && (
          <>
            {isLoading && <PapersSkeleton />}

            {!isLoading && error && (
              <section className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <AlertCircle className="h-6 w-6" aria-hidden="true" />
                </span>
                <h2 className="mt-5 text-xl font-semibold text-slate-950">试卷暂时加载失败</h2>
                <p className="mx-auto mt-2 max-w-lg text-base leading-7 text-slate-600">{error}</p>
                <Button onClick={() => setReloadKey((value) => value + 1)} className="mt-6 h-11 rounded-lg bg-blue-600 px-5 hover:bg-blue-700">
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  重新加载
                </Button>
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
                <section className="mb-8 flex flex-col items-start gap-6 rounded-2xl border border-slate-200/50 bg-white p-6 shadow-sm md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <h1 className="mb-1 text-2xl font-medium text-slate-800">开始你的软考之旅</h1>
                    <p className="mb-5 text-sm text-slate-500">精选历年真题，智能分析错题，助你高效备考软考</p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        className="h-12 rounded-lg bg-blue-600 px-5 text-base font-medium shadow-md shadow-blue-600/20 hover:bg-blue-700"
                        onClick={() => filteredPapers[0] && openModeDialog(filteredPapers[0])}
                      >
                        <Play className="mr-2 h-4 w-4" aria-hidden="true" />
                        开始练习
                      </Button>
                      <Button
                        variant="outline"
                        className="h-12 rounded-lg border-slate-200 px-5 text-base font-medium text-slate-600 hover:bg-slate-50"
                        onClick={handleHistoryClick}
                      >
                        <History className="mr-2 h-4 w-4" aria-hidden="true" />
                        查看进度
                      </Button>
                    </div>
                  </div>

                  <div className="flex w-full shrink-0 gap-4 md:w-auto">
                    <button
                      type="button"
                      onClick={handleHistoryClick}
                      className="flex-1 rounded-xl bg-blue-600 p-5 text-center text-white transition-colors hover:bg-blue-700 md:w-36 md:flex-none"
                    >
                      <History className="mx-auto mb-2 h-6 w-6 opacity-90" aria-hidden="true" />
                      <div className="mb-1 text-sm">刷题记录</div>
                      <div className="text-2xl font-semibold tabular-nums">{historyCount ?? 0}+</div>
                    </button>
                    <button
                      type="button"
                      onClick={handleWrongClick}
                      className="flex-1 rounded-xl bg-emerald-500 p-5 text-center text-white transition-colors hover:bg-emerald-600 md:w-36 md:flex-none"
                    >
                      <AlertCircle className="mx-auto mb-2 h-6 w-6 opacity-90" aria-hidden="true" />
                      <div className="mb-1 text-sm">错题记录</div>
                      <div className="text-2xl font-semibold tabular-nums">{wrongCount ?? 0}</div>
                    </button>
                  </div>
                </section>

                <section className="mb-8 rounded-xl border border-slate-200/50 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 flex items-center gap-2 text-sm text-slate-500">
                    <Filter className="h-4 w-4" aria-hidden="true" />
                    筛选条件
                  </h2>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {subjectOptions.map((subject) => {
                      const active = selectedSubject === subject;
                      return (
                        <button
                          key={subject}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSelectedSubject(subject)}
                          className={`rounded-lg px-4 py-2 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                            active ? 'bg-blue-600 font-medium text-white shadow-sm shadow-blue-600/20' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {subject}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categoryOptions.map((category) => {
                      const active = selectedCategory === category;
                      return (
                        <button
                          key={category}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSelectedCategory(category)}
                          className={`rounded-lg px-4 py-2 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-800 focus-visible:ring-offset-2 ${
                            active ? 'bg-slate-800 font-medium text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {category}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <h2 className="flex min-w-0 items-center gap-2 text-xl font-medium text-slate-700">
                      <Calendar className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{selectedSubject} - {selectedCategory}</span>
                    </h2>
                    <span className="shrink-0 text-sm text-slate-500">共 {filteredPapers.length} 套试卷</span>
                  </div>

                  <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {filteredPapers.map((paper) => {
                      const progress = getPaperProgress(paper);
                      return (
                        <Card
                          key={paper.id}
                          className="group flex flex-col rounded-xl border-slate-200 bg-white transition-all duration-300 hover:border-blue-200 hover:shadow-lg"
                        >
                          <CardHeader className="pb-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <CardTitle className="text-lg font-medium text-slate-800 transition-colors group-hover:text-blue-600">
                                  {paper.year}年{paper.month}月真题
                                </CardTitle>
                                <p className="mt-1 truncate text-sm text-slate-500">{paper.subject}</p>
                              </div>
                              <Badge variant="secondary" className="shrink-0 border-blue-100 bg-blue-50 text-blue-700">
                                {paper.category}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">题目数量</span>
                                <span className="text-slate-800">{progress.total} 题</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-1 text-slate-500">
                                  <History className="h-3 w-3" aria-hidden="true" />
                                  刷题次数
                                </span>
                                <span className="text-slate-800">{paper.practiceCount || 0}</span>
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex justify-between text-xs text-slate-500">
                                  <span>练习进度</span>
                                  <span>{progress.completed}/{progress.total}</span>
                                </div>
                                <Progress value={progress.percentage} className="h-1.5 bg-slate-100" />
                              </div>

                              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                                {paper.lastPracticeTime ? (
                                  <span className="text-xs text-slate-400">上次刷题：{formatDate(paper.lastPracticeTime)}</span>
                                ) : (
                                  <span />
                                )}
                                {renderStatusAction(paper)}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              </>
            )}
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
              className="group flex min-h-44 flex-col items-start rounded-2xl border border-blue-200 bg-blue-50 p-5 text-left outline-none transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
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
              className="group flex min-h-44 flex-col items-start rounded-2xl border border-red-200 bg-red-50 p-5 text-left outline-none transition-all hover:-translate-y-0.5 hover:border-red-500 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
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
