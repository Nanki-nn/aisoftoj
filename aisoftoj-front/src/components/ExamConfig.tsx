import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { BookOpen, Clock, Shuffle, Target, FileText, GraduationCap } from 'lucide-react';
import { ExamConfig as ExamConfigType } from '../types/exam';
import { BrandLogo } from './BrandLogo';
import { subjects, getCategoriesBySubject, filterQuestions } from '../data/questions';

interface ExamConfigProps {
  onStartExam: (config: ExamConfigType) => void | Promise<void>;
  initialConfig?: Partial<ExamConfigType> | null;
}

export function ExamConfig({ onStartExam, initialConfig = null }: ExamConfigProps) {
  const [config, setConfig] = useState<Partial<ExamConfigType>>({
    questionCount: 20,
    timeLimit: 60,
    randomOrder: true,
    examMode: 'practice', // 默认练题模式
  });
  
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const isPaperRestart = Boolean(config.paperId);

  React.useEffect(() => {
    if (!initialConfig) {
      return;
    }

    const subject = initialConfig.subject || '';
    const categories = subject ? getCategoriesBySubject(subject) : [];

    setSelectedSubject(subject);
    setAvailableCategories(categories);
    setConfig(prev => ({
      ...prev,
      ...initialConfig,
      subject,
      category: initialConfig.category || '',
      questionCount: initialConfig.questionCount || prev.questionCount,
      timeLimit: initialConfig.timeLimit ?? prev.timeLimit,
      randomOrder: initialConfig.randomOrder ?? prev.randomOrder,
      examMode: initialConfig.examMode || prev.examMode,
    }));
  }, [initialConfig]);

  const handleSubjectChange = (subject: string) => {
    setSelectedSubject(subject);
    const categories = getCategoriesBySubject(subject);
    setAvailableCategories(categories);
    setConfig(prev => ({ ...prev, subject, category: '' }));
  };

  const handleStartExam = () => {
    if (
      !config.questionCount ||
      !config.examMode ||
      (!isPaperRestart && (!config.subject || !config.category))
    ) {
      return;
    }

    const examConfig: ExamConfigType = {
      paperId: config.paperId,
      paperName: config.paperName,
      subject: config.subject || '',
      category: config.category || '',
      questionCount: config.questionCount,
      timeLimit: config.timeLimit,
      difficulty: config.difficulty,
      randomOrder: config.randomOrder || false,
      examMode: config.examMode,
    };

    onStartExam(examConfig);
  };

  const getAvailableQuestionCount = () => {
    if (isPaperRestart) return config.questionCount || 0;
    if (!config.subject || !config.category) return 0;
    return filterQuestions(config.subject, config.category, config.difficulty).length;
  };

  const availableCount = getAvailableQuestionCount();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* 顶部导航栏 */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <BrandLogo />
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="mb-2">软考刷题系统</h1>
        <p className="text-muted-foreground">选择考试科目和配置，开始你的学习之旅</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            考试配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 答题模式选择 */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              答题模式
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <Card 
                className={`cursor-pointer border-2 transition-all ${
                  config.examMode === 'practice' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-slate-200 hover:border-blue-300'
                }`}
                onClick={() => setConfig(prev => ({ ...prev, examMode: 'practice' }))}
              >
                <CardContent className="p-4 text-center">
                  <FileText className={`w-8 h-8 mx-auto mb-2 ${
                    config.examMode === 'practice' ? 'text-blue-600' : 'text-slate-400'
                  }`} />
                  <h3 className={config.examMode === 'practice' ? 'text-blue-900' : 'text-slate-700'}>
                    练题模式
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">每题显示解析</p>
                </CardContent>
              </Card>
              <Card 
                className={`cursor-pointer border-2 transition-all ${
                  config.examMode === 'exam' 
                    ? 'border-red-500 bg-red-50' 
                    : 'border-slate-200 hover:border-red-300'
                }`}
                onClick={() => setConfig(prev => ({ ...prev, examMode: 'exam' }))}
              >
                <CardContent className="p-4 text-center">
                  <GraduationCap className={`w-8 h-8 mx-auto mb-2 ${
                    config.examMode === 'exam' ? 'text-red-600' : 'text-slate-400'
                  }`} />
                  <h3 className={config.examMode === 'exam' ? 'text-red-900' : 'text-slate-700'}>
                    考试模式
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">完成后统一查看</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {isPaperRestart ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 text-sm text-slate-500">当前重开试卷</div>
              <div className="text-slate-900">{config.paperName || config.subject}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600">
                <Badge variant="secondary">{config.category || '综合知识'}</Badge>
                <Badge variant="outline">{config.questionCount || 0} 题</Badge>
              </div>
            </div>
          ) : (
            <>
              {/* 科目选择 */}
              <div className="space-y-2">
                <Label htmlFor="subject" className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  考试科目
                </Label>
                <Select value={selectedSubject} onValueChange={handleSubjectChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择考试科目" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map(subject => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 分类选择 */}
              {availableCategories.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="category">知识分类</Label>
                  <Select
                    value={config.category || ''}
                    onValueChange={(category) => setConfig(prev => ({ ...prev, category }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="请选择知识分类" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCategories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {/* 难度选择 */}
          <div className="space-y-2">
            <Label htmlFor="difficulty">难度等级（可选）</Label>
            <Select 
              value={config.difficulty || 'all'} 
              onValueChange={(difficulty) => setConfig(prev => ({ 
                ...prev, 
                difficulty: difficulty === 'all' ? undefined : difficulty as 'easy' | 'medium' | 'hard'
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="全部难度" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部难度</SelectItem>
                <SelectItem value="easy">简单</SelectItem>
                <SelectItem value="medium">中等</SelectItem>
                <SelectItem value="hard">困难</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 题目数量 */}
          <div className="space-y-2">
            <Label htmlFor="questionCount">题目数量</Label>
            <Input
              id="questionCount"
              type="number"
              min="1"
              max={availableCount}
              value={config.questionCount || ''}
              onChange={(e) => setConfig(prev => ({ 
                ...prev, 
                questionCount: parseInt(e.target.value) || 0 
              }))}
              placeholder="请输入题目数量"
            />
            {availableCount > 0 && (
              <p className="text-sm text-muted-foreground">
                当前条件下可用题目：<Badge variant="secondary">{availableCount}</Badge> 道
              </p>
            )}
          </div>

          {/* 时间限制 */}
          <div className="space-y-2">
            <Label htmlFor="timeLimit" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              时间限制（分钟，可选）
            </Label>
            <Input
              id="timeLimit"
              type="number"
              min="0"
              value={config.timeLimit || ''}
              onChange={(e) => setConfig(prev => ({ 
                ...prev, 
                timeLimit: parseInt(e.target.value) || undefined 
              }))}
              placeholder="不限制时间请留空"
            />
          </div>

          {/* 随机排序 */}
          <div className="flex items-center justify-between">
            <Label htmlFor="randomOrder" className="flex items-center gap-2">
              <Shuffle className="w-4 h-4" />
              随机排序题目
            </Label>
            <Switch
              id="randomOrder"
              checked={config.randomOrder || false}
              onCheckedChange={(randomOrder) => setConfig(prev => ({ ...prev, randomOrder }))}
            />
          </div>

          {/* 开始考试按钮 */}
          <Button 
            onClick={handleStartExam}
            disabled={
              !config.questionCount ||
              !config.examMode ||
              (!isPaperRestart && (!config.subject || !config.category || availableCount === 0))
            }
            className="w-full"
            size="lg"
          >
            {isPaperRestart ? '按当前模式重新开始' : '开始答题'}
          </Button>
        </CardContent>
      </Card>
    </div>
    </div>
  );
}
