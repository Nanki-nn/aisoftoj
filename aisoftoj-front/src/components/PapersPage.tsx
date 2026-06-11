import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  FileText,
  GraduationCap,
  History,
  Play,
  RotateCcw,
} from 'lucide-react';
import { supportedSubjects, supportedCategories, ExamPaper } from '../data/examPapers';
import { AppHeader } from './AppHeader';
import { fetchPapers, fetchPracticeHistory, fetchWrongQuestions } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

interface PapersPageProps {
  onStartPaper: (paper: ExamPaper, mode: 'practice' | 'exam') => void;
  onShowProfile: () => void;
  onShowAuth: () => void;
  onShowPracticeHistory: () => void;
  onShowWrongQuestions: () => void;
}

export function PapersPage({
  onStartPaper,
  onShowProfile,
  onShowAuth,
  onShowPracticeHistory,
  onShowWrongQuestions,
}: PapersPageProps) {
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
      .catch(() => {
        /* 未登录时忽略 */
      });

    fetchWrongQuestions()
      .then((wrongs) => {
        if (isMounted) {
          setWrongCount(wrongs.total);
        }
      })
      .catch(() => {
        /* 未登录时忽略 */
      });

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

  const formatDate = (dateStr: string) => {
    return dateStr.replace(/(\d{4})\/(\d{1,2})\/(\d{1,2})/, '$1/$2/$3');
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
    <div className="min-h-screen bg-white">
      <AppHeader onShowAuth={onShowAuth} onShowProfile={onShowProfile} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl text-slate-800">刷真题</h1>
          </div>
        </div>

        {/* 已登录用户的学习数据 */}
        {isAuthenticated && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <Card
              className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 cursor-pointer hover:shadow-lg transition-all"
              onClick={onShowPracticeHistory}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <History className="w-8 h-8 opacity-80 shrink-0" />
                <div>
                  <p className="text-blue-100 text-sm">累计答题</p>
                  <p className="text-2xl font-bold">{totalAnswered}</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 cursor-pointer hover:shadow-lg transition-all"
              onClick={onShowWrongQuestions}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <AlertCircle className="w-8 h-8 opacity-80 shrink-0" />
                <div>
                  <p className="text-emerald-100 text-sm">错题记录</p>
                  <p className="text-2xl font-bold">{wrongCount}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 筛选区域 */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/50 p-6">
            <h3 className="text-lg text-slate-800 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              科目筛选
            </h3>
            <div className="flex flex-wrap gap-3 mb-6">
              {supportedSubjects.map((subject) => (
                <Button
                  key={subject}
                  variant={selectedSubject === subject ? 'default' : 'outline'}
                  onClick={() => setSelectedSubject(subject)}
                  className={
                    selectedSubject === subject
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }
                >
                  {subject}
                </Button>
              ))}
            </div>

            <h3 className="text-lg text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              题型分类
            </h3>
            <div className="flex flex-wrap gap-3">
              {supportedCategories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory(category)}
                  className={
                    selectedCategory === category
                      ? 'bg-slate-800 hover:bg-slate-900 text-white shadow-md'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* 试卷列表 */}
        <div className="mb-8">
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
              {filteredPapers.map((paper) => (
                <Card
                  key={paper.id}
                  className="bg-white hover:shadow-lg transition-all duration-300 border border-slate-200/50 hover:border-slate-300/50 group"
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg text-slate-800 group-hover:text-blue-600 transition-colors">
                          {paper.year}年{paper.month}月真题
                        </CardTitle>
                        <p className="text-slate-500 mt-1">{paper.subject}</p>
                      </div>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
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
                            <span className="text-slate-800">
                              {paper.completedCount}/{paper.questionCount}
                            </span>
                          </div>
                          <Progress
                            value={((paper.completedCount || 0) / paper.questionCount) * 100}
                            className="h-2 bg-slate-100"
                          />
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-slate-500">
                            更新: {formatDate(paper.lastUpdated)}
                          </div>
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
      </div>

      {/* 模式选择对话框 */}
      <Dialog open={showModeDialog} onOpenChange={setShowModeDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl text-center">选择答题模式</DialogTitle>
            <DialogDescription className="text-center">
              {selectedPaper && (
                <>
                  {selectedPaper.year}年{selectedPaper.month}月 - {selectedPaper.subject} -{' '}
                  {selectedPaper.category}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Card
              className="cursor-pointer border-2 border-blue-200 hover:border-blue-500 hover:shadow-lg transition-all"
              onClick={() => handleModeSelect('practice')}
            >
              <CardContent className="p-6 text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 text-blue-600" />
                <h3 className="text-lg mb-2 text-slate-800">练习模式</h3>
                <p className="text-sm text-slate-600 mb-3">边做边学，即时反馈</p>
                <div className="space-y-1 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    每题显示详细解析
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    不限制答题时间
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    可随时查看答案
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer border-2 border-red-200 hover:border-red-500 hover:shadow-lg transition-all"
              onClick={() => handleModeSelect('exam')}
            >
              <CardContent className="p-6 text-center">
                <GraduationCap className="w-12 h-12 mx-auto mb-3 text-red-600" />
                <h3 className="text-lg mb-2 text-slate-800">考试模式</h3>
                <p className="text-sm text-slate-600 mb-3">模拟考试，检验实力</p>
                <div className="space-y-1 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    完成后统一查看解析
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    模拟真实考试环境
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    全面检验学习成果
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
