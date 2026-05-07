import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import {
  BookOpen,
  Clock,
  Play,
  RotateCcw,
  Trophy,
  Target,
  GraduationCap,
  Calendar,
  TrendingUp,
  Users,
  Award,
  FileText,
  ChevronRight,
  Star,
  History,
  AlertCircle,
  X
} from 'lucide-react';
import { supportedSubjects, supportedCategories, ExamPaper } from '../data/examPapers';
import { AppHeader } from './AppHeader';
import { fetchPapers, fetchPracticeHistory, fetchWrongQuestions } from '../lib/api';

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
            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 transition-colors"
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
            className="bg-blue-600 hover:bg-blue-700 shadow-lg transition-all hover:shadow-xl"
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
            className="text-slate-700 border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Play className="w-4 h-4 mr-1" />
            开始刷题
          </Button>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <AppHeader onShowAuth={onShowAuth} onShowProfile={onShowProfile} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 欢迎区域 */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50 p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-3xl text-slate-800 mb-4">
                  开始你的软考之旅
                </h2>
                <p className="text-slate-600 mb-6 text-lg">
                  精选历年真题，智能分析错题，助你高效备考软考
                </p>
                <div className="flex gap-4">
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all"
                    onClick={() => document.getElementById('paper-list')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    开始练习
                  </Button>
                  <Button variant="outline" className="border-slate-200 hover:bg-slate-50" onClick={onShowProfile}>
                    <Target className="w-4 h-4 mr-2" />
                    查看进度
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Card
                  className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 cursor-pointer hover:shadow-xl transition-all transform hover:scale-105"
                  onClick={onShowPracticeHistory}
                >
                  <CardContent className="p-6 text-center">
                    <History className="w-8 h-8 mx-auto mb-2" />
                    <h3 className="mb-1">刷题记录</h3>
                    <p className="text-2xl">{totalAnswered}</p>
                  </CardContent>
                </Card>
                <Card
                  className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 cursor-pointer hover:shadow-xl transition-all transform hover:scale-105"
                  onClick={onShowWrongQuestions}
                >
                  <CardContent className="p-6 text-center">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                    <h3 className="mb-1">错题记录</h3>
                    <p className="text-2xl">{wrongCount}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* 分类筛选 */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/50 p-6">
            <h3 className="text-lg text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              筛选条件
            </h3>
            <div className="mb-4 flex flex-wrap gap-3">
              {supportedSubjects.slice(0, 6).map(subject => (
                <Button
                  key={subject}
                  variant={selectedSubject === subject ? "default" : "ghost"}
                  onClick={() => setSelectedSubject(subject)}
                  className={selectedSubject === subject 
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md" 
                    : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                  }
                >
                  {subject}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              {supportedCategories.map(category => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category)}
                  className={selectedCategory === category 
                    ? "bg-slate-800 hover:bg-slate-900 text-white shadow-md" 
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* 历年真题列表 */}
        <div id="paper-list" className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {selectedSubject} - {selectedCategory}
            </h3>
            <Badge variant="outline" className="border-slate-200 text-slate-600">
              共 {filteredPapers.length} 套试卷
            </Badge>
          </div>
          
          {isLoading && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-slate-500">
              正在加载试卷数据...
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-red-700">
              {error}
            </div>
          )}

          {!isLoading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredPapers.map(paper => (
              <Card key={paper.id} className="bg-white hover:shadow-lg transition-all duration-300 border border-slate-200/50 hover:border-slate-300/50 group">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg text-slate-800 group-hover:text-blue-600 transition-colors">
                        {paper.year}年{paper.month}月真题
                      </CardTitle>
                      <p className="text-slate-500 mt-1">{paper.subject}</p>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className="bg-blue-100 text-blue-700 border-blue-200"
                    >
                      {paper.category}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">题目数量</span>
                      <span className="font-medium text-slate-800">{paper.questionCount} 题</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
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

                    <div className="pt-2 border-t border-slate-100">
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
        </div>

        {/* 底部统计信息 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-violet-500 to-purple-600 text-white border-0">
            <CardContent className="p-6 text-center">
              <Users className="w-8 h-8 mx-auto mb-3" />
              <h3 className="mb-2">学习用户</h3>
              <p className="text-2xl mb-1">10,000+</p>
              <p className="text-violet-100 text-sm">正在使用平台学习</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-rose-500 to-pink-600 text-white border-0">
            <CardContent className="p-6 text-center">
              <Star className="w-8 h-8 mx-auto mb-3" />
              <h3 className="mb-2">通过率</h3>
              <p className="text-2xl mb-1">85%</p>
              <p className="text-rose-100 text-sm">使用平台学习的通过率</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-teal-500 to-cyan-600 text-white border-0">
            <CardContent className="p-6 text-center">
              <BookOpen className="w-8 h-8 mx-auto mb-3" />
              <h3 className="mb-2">题库题目</h3>
              <p className="text-2xl mb-1">5,000+</p>
              <p className="text-teal-100 text-sm">历年真题及模拟题</p>
            </CardContent>
          </Card>
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
                className="flex h-40 flex-col items-center justify-center rounded-xl border-2 border-blue-200 bg-blue-50 p-5 transition-all hover:-translate-y-0.5 hover:border-blue-500 hover:bg-blue-100 hover:shadow-lg"
              >
                <FileText className="mb-3 h-11 w-11 text-blue-600" />
                <div className="text-lg font-semibold text-slate-800">练习模式</div>
                <div className="mt-2 text-center text-sm text-slate-500">即时显示解析</div>
              </button>

              {/* 考试模式 */}
              <button
                onClick={() => handleModeSelect('exam')}
                className="flex h-40 flex-col items-center justify-center rounded-xl border-2 border-red-200 bg-red-50 p-5 transition-all hover:-translate-y-0.5 hover:border-red-500 hover:bg-red-100 hover:shadow-lg"
              >
                <GraduationCap className="mb-3 h-11 w-11 text-red-600" />
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
