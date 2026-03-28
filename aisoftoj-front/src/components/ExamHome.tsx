import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import {
  BookOpen,
  Clock,
  Eye,
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
  Github,
  User,
  LogOut,
  Settings,
  History,
  AlertCircle
} from 'lucide-react';
import { supportedSubjects, supportedCategories, ExamPaper } from '../data/examPapers';
import { useAuth } from '../hooks/useAuth';
import { fetchPapers, fetchPracticeHistory, fetchWrongQuestions } from '../lib/api';

interface ExamHomeProps {
  onStartPaper: (paper: ExamPaper) => void;
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
  const { user, logout, isAuthenticated } = useAuth();

  // 距离 2026 上半年软考首日（5月23日）的天数，每次渲染自动更新
  const daysToExam = useMemo(() => {
    const examDate = new Date('2026-05-23');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    examDate.setHours(0, 0, 0, 0);
    return Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }, []);

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

    fetchPracticeHistory()
      .then((history) => {
        if (isMounted) {
          const total = history.reduce((sum, s) => sum + (s.answeredCount || 0), 0);
          setTotalAnswered(total);
        }
      })
      .catch(() => {/* 未登录时忽略 */});

    fetchWrongQuestions()
      .then((wrongs) => {
        if (isMounted) {
          setWrongCount(wrongs.length);
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

  const getStatusButton = (paper: ExamPaper) => {
    switch (paper.status) {
      case 'completed':
        return (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onStartPaper(paper)}
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
            onClick={() => onStartPaper(paper)}
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
            onClick={() => onStartPaper(paper)}
            className="text-slate-700 border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Play className="w-4 h-4 mr-1" />
            开始刷题
          </Button>
        );
    }
  };

  const formatDate = (dateStr: string) => {
    return dateStr.replace(/(\d{4})\/(\d{1,2})\/(\d{1,2})/, '$1/$2/$3');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* 顶部导航栏 */}
      <div className="bg-white/70 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-8 h-8 text-blue-600" />
                <h1 className="text-xl text-slate-800">知构软考刷题平台</h1>
              </div>
              <div className="hidden md:flex items-center gap-2">
                {supportedSubjects.slice(0, 2).map(subject => (
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
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-lg border border-amber-200">
                <Calendar className="w-4 h-4" />
                {daysToExam > 0 ? (
                  <>
                    <span className="hidden sm:inline">距离软考还有</span>
                    <span className="font-semibold">{daysToExam}天</span>
                  </>
                ) : daysToExam === 0 ? (
                  <span className="font-semibold">今天就是考试日，加油！</span>
                ) : (
                  <span className="font-semibold">2026上半年软考已结束</span>
                )}
              </div>

              {/* GitHub Star */}
              <a
                href="https://github.com/Nanki-nn/aisoftoj"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white/60 text-slate-500 hover:text-slate-900 hover:bg-white hover:border-slate-300 text-sm transition-all"
              >
                <Github className="w-4 h-4 shrink-0" />
                <span>项目开源 · 欢迎 Star 支持</span>
              </a>

              {/* 用户头像和菜单 */}
              {isAuthenticated && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-10 w-10 rounded-full p-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback className="bg-blue-100 text-blue-600">
                          {user.nickname.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={onShowProfile} className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      个人中心
                    </DropdownMenuItem>
                    <DropdownMenuItem className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      设置
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={logout} className="flex items-center gap-2 text-red-600">
                      <LogOut className="w-4 h-4" />
                      退出登录
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button onClick={onShowAuth} variant="outline">
                  登录 / 注册
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

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
                  <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all">
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
                        <Eye className="w-3 h-3" />
                        浏览次数
                      </span>
                      <span className="text-slate-800">{paper.viewCount}</span>
                    </div>

                    {paper.status === 'in_progress' && paper.completedCount && (
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
    </div>
  );
}
