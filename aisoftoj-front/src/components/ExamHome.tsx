import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import {
  BookOpen,
  Play,
  RotateCcw,
  GraduationCap,
  Calendar,
  FileText,
  ChevronRight,
  History,
  AlertCircle,
  X,
  Zap,
  CheckCircle2,
  PenLine,
} from 'lucide-react';
import { supportedSubjects, supportedCategories, ExamPaper } from '../data/examPapers';
import { AppHeader } from './AppHeader';
import { fetchPapers, fetchPracticeHistory, fetchWrongQuestions } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

interface ExamHomeProps {
  onStartPaper: (paper: ExamPaper, mode: 'practice' | 'exam') => void;
  onShowProfile: () => void;
  onShowAuth: () => void;
  onShowPracticeHistory: () => void;
  onShowWrongQuestions: () => void;
}

export function ExamHome({ onStartPaper, onShowProfile, onShowAuth, onShowPracticeHistory, onShowWrongQuestions }: ExamHomeProps) {
  const [selectedSubject, setSelectedSubject] = useState('系统架构设计师');
  const [selectedCategory, setSelectedCategory] = useState('综合知识');
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<ExamPaper | null>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    let isMounted = true;
    fetchPapers()
      .then((data) => {
        if (isMounted) {
          setPapers(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || '试卷加载失败');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    fetchPracticeHistory({ pageSize: 100 })
      .then((history) => {
        if (isMounted) {
          const total = history.records.reduce((sum, s) => sum + (s.answeredCount || 0), 0);
          setTotalAnswered(total);
        }
      })
      .catch(() => {/* 未登录时忽略 */});

    fetchWrongQuestions()
      .then((wrongs) => {
        if (isMounted) {
          setWrongCount(wrongs.total);
        }
      })
      .catch(() => {/* 未登录时忽略 */});

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredPapers = useMemo(() => {
    return papers
      .filter((paper) => !selectedSubject || paper.subject === selectedSubject)
      .filter((paper) => !selectedCategory || paper.category === selectedCategory)
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
  }, [papers, selectedCategory, selectedSubject]);

  const openModeDialog = (paper: ExamPaper) => {
    setSelectedPaper(paper);
    setShowModeDialog(true);
  };

  const handleModeSelect = (mode: 'practice' | 'exam') => {
    if (selectedPaper) {
      onStartPaper(selectedPaper, mode);
      setShowModeDialog(false);
      setSelectedPaper(null);
    }
  };

  const getStatusButton = (paper: ExamPaper) => {
    switch (paper.status) {
      case 'completed':
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => openModeDialog(paper)}
            className="paper-action-secondary transition-colors"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            重新刷题
          </Button>
        );
      case 'in_progress':
        return (
          <Button
            size="sm"
            onClick={() => onStartPaper(paper, 'practice')}
            className="paper-action-primary transition-all"
          >
            <Play className="w-4 h-4 mr-1" />
            继续刷题
          </Button>
        );
      default:
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => openModeDialog(paper)}
            className="paper-action-secondary transition-colors"
          >
            <Play className="w-4 h-4 mr-1" />
            开始刷题
          </Button>
        );
    }
  };

  return (
    <div className="home-page min-h-screen">
      <AppHeader onShowAuth={onShowAuth} onShowProfile={onShowProfile} />

      <div className="home-content mx-auto px-4">
        {/* Hero */}
        <div className="home-section">
          <div className="home-hero overflow-hidden">
            <div className="home-hero-grid">
              {/* 左侧：主张 */}
              <div className="home-hero-copy">
                <div className="home-eyebrow inline-flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  专为在职备考设计
                </div>
                <h1 className="home-hero-title">
                  碎片时间备考软考，<span className="home-accent">从真题出发</span>
                </h1>
                <p className="home-hero-lead">
                  下班后 1-2 小时，跟着真题走，不走弯路。
                </p>
                <p className="home-hero-description">
                  作者本人 23 届计算机，工作一年后用 2 个月拿下架构师，
                  这套备考路径直接做进了平台里。
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    className="home-primary-action transition-all"
                    onClick={() => document.getElementById('paper-list')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    开始刷真题
                  </Button>
                  {!isAuthenticated && (
                    <Button variant="outline" className="home-secondary-action" onClick={onShowAuth}>
                      注册免费使用
                    </Button>
                  )}
                </div>
              </div>

              {/* 右侧：三阶段备考路径 */}
              <div className="home-hero-path">
                <p className="home-path-heading">备考路径</p>
                <div className="home-path-list">
                  {[
                    {
                      week: '第 1-4 周',
                      title: '打基础',
                      desc: '视频 + 电子笔记 + 思维导图，快速过一遍知识点',
                      icon: BookOpen,
                    },
                    {
                      week: '第 5-6 周',
                      title: '刷真题',
                      desc: '只刷近 5 年真题，做两遍，重点在订正和复盘',
                      icon: CheckCircle2,
                    },
                    {
                      week: '第 7-8 周',
                      title: '论文冲刺',
                      desc: '准备一个万金油项目，覆盖 3-4 个主题，AI 批改打分',
                      icon: PenLine,
                    },
                  ].map((step) => {
                    const Icon = step.icon;
                    return (
                      <div key={step.week} className="home-path-step">
                        <div className="home-path-icon">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="home-path-title-row">
                            <span className="home-path-week">{step.week}</span>
                            <span className="home-path-title">{step.title}</span>
                          </div>
                          <p className="home-path-description">{step.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 已登录用户的学习数据 */}
        {isAuthenticated && (
          <div className="study-overview home-section">
            <div className="study-overview-heading">
              <div>
                <p className="text-sm font-semibold text-slate-900">今日学习摘要</p>
                <p className="mt-1 text-xs text-slate-500">每一次作答，都在缩短与目标的距离。</p>
              </div>
              <span className="text-xs text-slate-400">保持节奏</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2">
              <button type="button" className="study-stat-card" onClick={onShowPracticeHistory}>
                <span className="study-stat-icon">
                  <History className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm text-slate-500">累计答题</span>
                  <span className="mt-0.5 block text-2xl font-semibold tracking-tight text-slate-900">{totalAnswered}</span>
                </span>
                <span className="study-stat-link">
                  查看记录
                  <ChevronRight className="h-4 w-4" />
                </span>
              </button>
              <button type="button" className="study-stat-card" onClick={onShowWrongQuestions}>
                <span className="study-stat-icon">
                  <AlertCircle className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm text-slate-500">待复盘错题</span>
                  <span className="mt-0.5 block text-2xl font-semibold tracking-tight text-slate-900">{wrongCount}</span>
                </span>
                <span className="study-stat-link">
                  开始复盘
                  <ChevronRight className="h-4 w-4" />
                </span>
              </button>
            </div>
          </div>
        )}

        {/* 题库筛选与试卷列表 */}
        <div id="paper-list" className="paper-browser">
          <aside className="home-panel paper-filter-card" aria-label="试卷筛选">
            <h3 className="paper-filter-heading">
              <FileText className="h-4 w-4" />
              筛选条件
            </h3>

            <div className="paper-filter-group">
              <p className="paper-filter-label">考试方向</p>
              <div className="paper-filter-options">
                {supportedSubjects.slice(0, 6).map(subject => (
                  <Button
                    key={subject}
                    variant={selectedSubject === subject ? "default" : "ghost"}
                    onClick={() => setSelectedSubject(subject)}
                    className={`home-filter-option ${
                      selectedSubject === subject
                        ? "home-filter-active"
                        : "home-filter-inactive"
                    }`}
                  >
                    {subject}
                  </Button>
                ))}
              </div>
            </div>

            <div className="paper-filter-group">
              <p className="paper-filter-label">试卷类型</p>
              <div className="paper-filter-options">
                {supportedCategories.map(category => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    onClick={() => setSelectedCategory(category)}
                    className={`home-filter-option ${
                      selectedCategory === category
                        ? "home-filter-active"
                        : "home-filter-inactive"
                    }`}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="paper-list-heading">
              <h3 className="flex items-center gap-2 text-lg text-slate-800">
                <Calendar className="h-4 w-4" />
                {selectedSubject} - {selectedCategory}
              </h3>
              <Badge variant="outline" className="border-slate-200 text-slate-600">
                共 {filteredPapers.length} 套试卷
              </Badge>
            </div>

            {isLoading && (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-slate-500">
                正在加载试卷数据...
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-red-700">
                {error}
              </div>
            )}

            {!isLoading && !error && (
              <div className="paper-list-grid">
                {filteredPapers.map(paper => (
                <Card key={paper.id} className="paper-card transition-all duration-300 group">
                  <CardHeader className="p-4 pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base text-slate-800 transition-colors group-hover:text-orange-700">
                          {paper.year}年{paper.month}月真题
                        </CardTitle>
                        <p className="mt-1 text-xs text-slate-500">{paper.subject}</p>
                      </div>
                      <Badge
                        variant="secondary"
                        className="paper-category-badge"
                      >
                        {paper.category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">题目数量</span>
                        <span className="font-medium text-slate-800">{paper.questionCount} 题</span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 flex items-center gap-1">
                          <History className="w-3 h-3" />
                          做题次数
                        </span>
                        <span className="text-slate-800">{paper.practiceCount}</span>
                      </div>

                      {paper.status === 'in_progress' && Boolean(paper.completedCount) && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">练习进度</span>
                            <span className="text-slate-800">{paper.completedCount}/{paper.questionCount}</span>
                          </div>
                          <Progress
                            value={(paper.completedCount / paper.questionCount) * 100}
                            className="h-2 bg-slate-100"
                          />
                        </div>
                      )}

                      <div className="border-t border-slate-100 pt-2">
                        <div className="flex items-center justify-end">
                          {getStatusButton(paper)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                ))}
              </div>
            )}
          </section>
        </div>

      </div>

      {/* 模式选择弹窗（原生 fixed overlay，不依赖 Radix Portal） */}
      {showModeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* 半透明遮罩 */}
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setShowModeDialog(false)}
          />
          {/* 弹窗主体 */}
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-7">
            {/* 关闭按钮 */}
            <button
              onClick={() => setShowModeDialog(false)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="mb-2 pr-10 text-center text-2xl font-semibold text-slate-800">选择答题模式</h2>
            {selectedPaper && (
              <p className="mb-6 text-center text-base text-slate-500">
                {selectedPaper.year}年{selectedPaper.month}月 · {selectedPaper.subject}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* 练习模式 */}
              <button
                onClick={() => handleModeSelect('practice')}
                className="mode-option mode-option-primary flex h-40 flex-col items-center justify-center p-5 transition-all"
              >
                <FileText className="home-accent mb-3 h-11 w-11" />
                <div className="text-lg font-semibold text-slate-800">练习模式</div>
                <div className="mt-2 text-center text-sm text-slate-500">即时显示解析</div>
              </button>

              {/* 考试模式 */}
              <button
                onClick={() => handleModeSelect('exam')}
                className="mode-option flex h-40 flex-col items-center justify-center p-5 transition-all"
              >
                <GraduationCap className="mb-3 h-11 w-11 text-slate-700" />
                <div className="text-lg font-semibold text-slate-800">考试模式</div>
                <div className="mt-2 text-center text-sm text-slate-500">交卷后查看</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
