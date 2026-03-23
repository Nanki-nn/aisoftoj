import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Checkbox } from './ui/checkbox';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Flag, 
  CheckCircle, 
  AlertCircle,
  Timer,
  BookOpen,
  ArrowLeft
} from 'lucide-react';
import { ExamSession as ExamSessionType, Question } from '../types/exam';

function sanitizeQuestionHtml(html: string): string {
  if (!html) {
    return '';
  }

  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

interface ExamSessionProps {
  session: ExamSessionType;
  onUpdateAnswer: (questionId: string, answer: string | string[]) => void;
  onCompleteExam: () => void;
  onBackToConfig: () => void;
}

export function ExamSession({ 
  session, 
  onUpdateAnswer, 
  onCompleteExam, 
  onBackToConfig 
}: ExamSessionProps) {
  const questionCardRef = useRef<HTMLDivElement | null>(null);
  const hasMountedRef = useRef(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0); // 已用时间（秒）
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [markedQuestions, setMarkedQuestions] = useState<Set<number>>(new Set());
  const [answerCardPage, setAnswerCardPage] = useState(0);
  const [multipleDraft, setMultipleDraft] = useState<string[]>([]);
  const [fillDraft, setFillDraft] = useState('');

  const currentQuestion = session.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / session.questions.length) * 100;
  const answeredCount = session.questions.filter((question) => {
    const answer = session.answers[question.id];
    if (Array.isArray(answer)) return answer.length > 0;
    return !!answer;
  }).length;

  // 答题卡分页常量 - 5列3行
  const ITEMS_PER_PAGE = 15;
  const totalPages = Math.ceil(session.questions.length / ITEMS_PER_PAGE);

  // 计时器逻辑
  useEffect(() => {
    if (!session.timeLimit) return;

    const totalSeconds = session.timeLimit * 60;
    const elapsed = Math.floor((Date.now() - session.startTime.getTime()) / 1000);
    const remaining = totalSeconds - elapsed;

    if (remaining <= 0) {
      onCompleteExam();
      return;
    }

    setTimeLeft(remaining);

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          onCompleteExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [session.timeLimit, session.startTime, onCompleteExam]);

  // 已用时间计时器（从0开始）
  useEffect(() => {
    const startTime = session.startTime.getTime();
    
    // 初始化已用时间
    const initialElapsed = Math.floor((Date.now() - startTime) / 1000);
    setElapsedTime(initialElapsed);
    
    // 每秒更新
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedTime(elapsed);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [session.startTime]);

  // 自动切换答题卡页面（仅当题目切换时）
  useEffect(() => {
    const currentPage = Math.floor(currentQuestionIndex / ITEMS_PER_PAGE);
    if (currentPage !== answerCardPage) {
      setAnswerCardPage(currentPage);
    }
  }, [currentQuestionIndex]);

  useEffect(() => {
    const currentAnswer = session.answers[currentQuestion.id];
    if (currentQuestion.type === 'multiple') {
      setMultipleDraft(Array.isArray(currentAnswer) ? currentAnswer : []);
    } else {
      setMultipleDraft([]);
    }

    if (currentQuestion.type === 'fill') {
      setFillDraft(typeof currentAnswer === 'string' ? currentAnswer : '');
    } else {
      setFillDraft('');
    }
  }, [currentQuestion.id, currentQuestion.type, session.answers]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    const top = questionCardRef.current?.getBoundingClientRect().top;
    if (typeof top === 'number') {
      window.scrollTo({
        top: Math.max(0, window.scrollY + top - 96),
        behavior: 'smooth',
      });
    }
  }, [currentQuestionIndex]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (answer: string | string[]) => {
    onUpdateAnswer(currentQuestion.id, answer);
  };

  const handleConfirmMultipleAnswer = () => {
    if (multipleDraft.length === 0) {
      alert('请至少选择一个选项后再确认');
      return;
    }
    handleAnswerChange(multipleDraft);
  };

  const handleConfirmFillAnswer = () => {
    if (!fillDraft.trim()) {
      alert('请输入答案后再确认');
      return;
    }
    handleAnswerChange(fillDraft.trim());
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < session.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleSubmit = () => {
    if (answeredCount < session.questions.length) {
      setShowConfirmSubmit(true);
    } else {
      onCompleteExam();
    }
  };

  const toggleMarkQuestion = () => {
    const newMarked = new Set(markedQuestions);
    if (newMarked.has(currentQuestionIndex)) {
      newMarked.delete(currentQuestionIndex);
    } else {
      newMarked.add(currentQuestionIndex);
    }
    setMarkedQuestions(newMarked);
  };

  const jumpToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
  };

  // 计算已用时间
  const getElapsedTime = () => {
    const elapsed = Math.floor((Date.now() - session.startTime.getTime()) / 1000);
    return formatTime(elapsed);
  };

  // 答题卡分页索引计算
  const startIndex = answerCardPage * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, session.questions.length);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return '简单';
      case 'medium': return '中等';
      case 'hard': return '困难';
      default: return difficulty;
    }
  };

  // 验证答案是否正确
  const isAnswerCorrect = (userAnswer: string | string[], correctAnswer: string | string[]): boolean => {
    if (Array.isArray(userAnswer) && Array.isArray(correctAnswer)) {
      // 多选题：比较数组内容是否相同（忽略顺序）
      if (userAnswer.length !== correctAnswer.length) return false;
      return userAnswer.every(answer => correctAnswer.includes(answer)) && 
             correctAnswer.every(answer => userAnswer.includes(answer));
    } else if (!Array.isArray(userAnswer) && !Array.isArray(correctAnswer)) {
      // 单选题、判断题、填空题
      return userAnswer === correctAnswer;
    }
    return false;
  };

  const renderQuestionContent = () => {
    const currentAnswer = session.answers[currentQuestion.id];
    const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
    const isAnswered = !!currentAnswer;
    const isCorrect = isAnswered ? isAnswerCorrect(currentAnswer, currentQuestion.correctAnswer) : false;

    switch (currentQuestion.type) {
      case 'single':
      case 'judge':
        return (
          <RadioGroup 
            value={currentAnswer as string || ''} 
            onValueChange={handleAnswerChange}
            className="!grid !gap-4"
          >
            {currentQuestion.options?.map((option, index) => {
              const isSelected = currentAnswer === option;
              const isCorrectOption = option === currentQuestion.correctAnswer;
              const isWrongSelected = isSelected && !isCorrect;
              
              return (
                <Label 
                  key={index} 
                  htmlFor={`option-${index}`} 
                  className={`
                    flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                    ${isSelected 
                      ? (isCorrect 
                          ? 'bg-green-50 border-green-500 text-green-900' 
                          : 'bg-red-50 border-red-500 text-red-900')
                      : (isAnswered && isCorrectOption
                          ? 'bg-green-50 border-green-300 text-green-800'
                          : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50')
                    }
                  `}
                >
                  <RadioGroupItem value={option} id={`option-${index}`} />
                  <span className="flex-1 leading-relaxed">{optionLabels[index]}. {option}</span>
                </Label>
              );
            })}
          </RadioGroup>
        );

      case 'multiple':
        const committedMultipleAnswers = Array.isArray(currentAnswer) ? currentAnswer : [];
        const isMultipleAnswered = committedMultipleAnswers.length > 0;
        const isMultipleCorrect = isMultipleAnswered ? isAnswerCorrect(committedMultipleAnswers, currentQuestion.correctAnswer) : false;
        const correctOptions = Array.isArray(currentQuestion.correctAnswer) ? currentQuestion.correctAnswer : [currentQuestion.correctAnswer];
        const hasDraftChanges =
          multipleDraft.length !== committedMultipleAnswers.length ||
          multipleDraft.some((answer) => !committedMultipleAnswers.includes(answer));
        
        return (
          <div className="grid gap-4">
            <Alert className="border-blue-200 bg-blue-50">
              <AlertDescription className="text-blue-800">
                多选题支持选择多个答案。选完后点击“确认答案”再提交本题，不会因为点第一个选项就立刻判错。
              </AlertDescription>
            </Alert>
            {currentQuestion.options?.map((option, index) => {
              const isSelected = multipleDraft.includes(option);
              const isCorrectOption = correctOptions.includes(option);
              
              return (
                <Label
                  key={index}
                  htmlFor={`option-${index}`}
                  className={`
                    flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                    ${isSelected 
                      ? (isMultipleCorrect 
                          ? 'bg-green-50 border-green-500 text-green-900' 
                          : 'bg-red-50 border-red-500 text-red-900')
                      : (isMultipleAnswered && isCorrectOption
                          ? 'bg-green-50 border-green-300 text-green-800'
                          : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50')
                    }
                  `}
                >
                  <Checkbox
                    id={`option-${index}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        if (!multipleDraft.includes(option)) {
                          setMultipleDraft([...multipleDraft, option]);
                        }
                      } else {
                        setMultipleDraft(multipleDraft.filter(a => a !== option));
                      }
                    }}
                  />
                  <span className="flex-1 leading-relaxed">{optionLabels[index]}. {option}</span>
                </Label>
              );
            })}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button onClick={handleConfirmMultipleAnswer} className="bg-blue-600 hover:bg-blue-700">
                {isMultipleAnswered ? '更新答案' : '确认答案'}
              </Button>
              <Button variant="outline" onClick={() => setMultipleDraft(committedMultipleAnswers)}>
                撤销修改
              </Button>
              <div className="text-sm text-slate-500">
                当前已选 {multipleDraft.length} 项
                {hasDraftChanges && <span className="ml-2 text-amber-600">未确认</span>}
              </div>
            </div>
          </div>
        );

      case 'fill':
        return (
          <div className="space-y-4">
            <Alert className="border-slate-200 bg-slate-50">
              <AlertDescription className="text-slate-700">
                填空题输入完成后点击“确认答案”，系统再记录本题答案。
              </AlertDescription>
            </Alert>
            <Input
              value={fillDraft}
              onChange={(e) => setFillDraft(e.target.value)}
              placeholder="请输入答案"
              className="mt-4 p-4"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleConfirmFillAnswer} className="bg-blue-600 hover:bg-blue-700">
                {currentAnswer ? '更新答案' : '确认答案'}
              </Button>
              <Button variant="outline" onClick={() => setFillDraft(typeof currentAnswer === 'string' ? currentAnswer : '')}>
                撤销修改
              </Button>
              {fillDraft !== (typeof currentAnswer === 'string' ? currentAnswer : '') && (
                <span className="text-sm text-amber-600">未确认</span>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* 顶部导航栏 */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={onBackToConfig} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              返回
            </Button>
            <h1 className="text-lg text-slate-800">
              {session.subject} - {session.category}
            </h1>
            {timeLeft !== null && (
              <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${
                timeLeft < 300 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
              }`}>
                <Clock className="w-4 h-4" />
                <span>{formatTime(timeLeft)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：题目区域 */}
          <div ref={questionCardRef} className="lg:col-span-2">
            <Card className="bg-white shadow-sm border border-slate-200">
              <CardHeader className="border-b border-slate-100 pb-4">
                <div className="space-y-3">
                  <h2 className="text-xl text-slate-800">
                    {currentQuestion.year ? `${currentQuestion.year}年` : ''}
                    {session.subject}真题 -&gt; {session.category}
                  </h2>
                  
                  {/* 试卷信息 */}
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">试卷信息：</span>
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        做{answeredCount}题
                      </Badge>
                      <Badge variant="outline">
                        查看知识
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">总题数：{session.questions.length}</span>
                      <span className="text-slate-500">已做：{answeredCount}</span>
                      <Badge variant="secondary">未做：{session.questions.length - answeredCount}</Badge>
                    </div>
                  </div>

                  {/* 本题信息 */}
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">本题信息：</span>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                        了解即可
                      </Badge>
                      <span className="text-slate-600">
                        {currentQuestionIndex + 1}题-{currentQuestion.type === 'single' ? '单选' : currentQuestion.type === 'multiple' ? '多选' : currentQuestion.type === 'judge' ? '判断' : '填空'}-这是较容易的题
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">
                        进度：{answeredCount}/{session.questions.length}
                      </span>
                      <span className="text-slate-500">用时：{getElapsedTime()}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                {/* 题目内容 */}
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">第 {currentQuestionIndex + 1} / {session.questions.length} 题</Badge>
                    <Badge className={getDifficultyColor(currentQuestion.difficulty)}>
                      {getDifficultyText(currentQuestion.difficulty)}
                    </Badge>
                    <Badge variant="secondary">
                      {currentQuestion.type === 'single' ? '单选题' : currentQuestion.type === 'multiple' ? '多选题' : currentQuestion.type === 'judge' ? '判断题' : '填空题'}
                    </Badge>
                    {session.answers[currentQuestion.id] && (
                      <Badge className={isAnswerCorrect(session.answers[currentQuestion.id], currentQuestion.correctAnswer) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {isAnswerCorrect(session.answers[currentQuestion.id], currentQuestion.correctAnswer) ? '已答对' : '已作答'}
                      </Badge>
                    )}
                    {markedQuestions.has(currentQuestionIndex) && (
                      <Badge className="bg-orange-100 text-orange-700">已标记</Badge>
                    )}
                  </div>

                  <div
                    className="leading-relaxed text-slate-700 [&_font[color='red']]:font-semibold [&_font[color='blue']]:font-semibold [&_u]:underline"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeQuestionHtml(currentQuestion.question),
                    }}
                  />

                  {/* 选项区域 */}
                  <div className="space-y-3">
                    {renderQuestionContent()}
                  </div>
                </div>

                {/* 底部导航 */}
                <div className="flex items-center justify-between pt-8 border-t border-slate-100 mt-8">
                  <Button
                    variant="outline"
                    onClick={toggleMarkQuestion}
                    className={markedQuestions.has(currentQuestionIndex) ? 'border-red-500 text-red-600' : ''}
                  >
                    <Flag className="w-4 h-4 mr-2" />
                    {markedQuestions.has(currentQuestionIndex) ? '取消标记' : '标记'}
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handlePrevious}
                      disabled={currentQuestionIndex === 0}
                      className="px-6"
                    >
                      上一题
                    </Button>
                    <Button
                      onClick={handleNext}
                      disabled={currentQuestionIndex === session.questions.length - 1}
                      className="bg-blue-600 hover:bg-blue-700 px-6"
                    >
                      下一题
                    </Button>
                  </div>
                </div>

                {/* 练题模式下的解析显示 */}
                {session.examMode === 'practice' && session.answers[currentQuestion.id] && (
                  <div className={`mt-6 p-4 border-l-4 rounded-r-lg ${
                    isAnswerCorrect(session.answers[currentQuestion.id], currentQuestion.correctAnswer)
                      ? 'bg-green-50 border-green-500'
                      : 'bg-red-50 border-red-500'
                  }`}>
                    <div className="flex items-start gap-2 mb-3">
                      {isAnswerCorrect(session.answers[currentQuestion.id], currentQuestion.correctAnswer) ? (
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className={`mb-1 ${
                          isAnswerCorrect(session.answers[currentQuestion.id], currentQuestion.correctAnswer)
                            ? 'text-green-900'
                            : 'text-red-900'
                        }`}>
                          {isAnswerCorrect(session.answers[currentQuestion.id], currentQuestion.correctAnswer)
                            ? '回答正确！'
                            : '回答错误'
                          }
                        </div>
                        <div className="space-y-2">
                          <div className={`${
                            isAnswerCorrect(session.answers[currentQuestion.id], currentQuestion.correctAnswer)
                              ? 'text-green-800'
                              : 'text-red-800'
                          }`}>
                            <span className="font-medium">你的答案：</span>
                            <span className="ml-2">
                              {Array.isArray(session.answers[currentQuestion.id]) 
                                ? (session.answers[currentQuestion.id] as string[]).join(', ')
                                : session.answers[currentQuestion.id]
                              }
                            </span>
                          </div>
                          <div className={`${
                            isAnswerCorrect(session.answers[currentQuestion.id], currentQuestion.correctAnswer)
                              ? 'text-green-800'
                              : 'text-red-800'
                          }`}>
                            <span className="font-medium">正确答案：</span>
                            <span className="ml-2">
                              {Array.isArray(currentQuestion.correctAnswer) 
                                ? currentQuestion.correctAnswer.join(', ')
                                : currentQuestion.correctAnswer
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="pl-7">
                      <div className={`mb-1 ${
                        isAnswerCorrect(session.answers[currentQuestion.id], currentQuestion.correctAnswer)
                          ? 'text-green-900'
                          : 'text-red-900'
                      }`}>
                        解析
                      </div>
                      <div className={`leading-relaxed ${
                        isAnswerCorrect(session.answers[currentQuestion.id], currentQuestion.correctAnswer)
                          ? 'text-green-700'
                          : 'text-red-700'
                      }`}>
                        {currentQuestion.explanation}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右侧：答题卡 */}
          <div className="lg:col-span-1">
            {/* 计时器显示 */}
            <div className="mb-3 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-50 rounded-md border border-blue-200">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-base font-mono font-semibold text-blue-700">
                {formatTime(elapsedTime)}
              </span>
            </div>

            <Card className="bg-white shadow-sm border border-slate-200 sticky top-20 max-h-[400px] flex flex-col">
              <CardHeader className="border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">答题卡</CardTitle>
                  {timeLeft !== null && (
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium ${
                      timeLeft < 300 ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                    }`}>
                      <Timer className="w-4 h-4" />
                      <span>{formatTime(timeLeft)}</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex-1 overflow-y-auto">
                {/* 题号网格 - 5列3行布局 */}
                <div className="grid grid-cols-5 gap-2 mb-4" style={{ gridTemplateRows: 'repeat(3, 1fr)' }}>
                  {Array.from({ length: endIndex - startIndex }, (_, i) => {
                    const questionIndex = startIndex + i;
                    const question = session.questions[questionIndex];
                    const userAnswer = session.answers[question.id];
                    const isAnswered = !!userAnswer;
                    const isCurrent = questionIndex === currentQuestionIndex;
                    const isMarked = markedQuestions.has(questionIndex);
                    
                    // 判断答案是否正确
                    const isCorrect = isAnswered ? isAnswerCorrect(userAnswer, question.correctAnswer) : false;

                    let buttonClasses = 'w-full aspect-square rounded text-sm transition-all font-medium flex items-center justify-center min-h-[32px] ';
                    
                    // 背景和文字颜色
                    if (isAnswered) {
                      if (isCorrect) {
                        buttonClasses += 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 ';
                      } else {
                        buttonClasses += 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 ';
                      }
                    } else {
                      buttonClasses += 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 ';
                    }
                    
                    // 边框高亮（当前题优先）
                    if (isCurrent) {
                      buttonClasses += 'ring-2 ring-blue-500 ring-offset-2 ';
                    } else if (isMarked) {
                      buttonClasses += 'ring-2 ring-orange-500 ';
                    }

                    return (
                      <button
                        key={questionIndex}
                        type="button"
                        onClick={() => jumpToQuestion(questionIndex)}
                        className={buttonClasses}
                      >
                        {questionIndex + 1}
                      </button>
                    );
                  })}
                </div>

                {/* 分页器 - 简洁版 */}
                {totalPages > 1 && (
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-sm">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAnswerCardPage(Math.max(0, answerCardPage - 1))}
                        disabled={answerCardPage === 0}
                        className="h-8 px-2"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      
                      <span className="text-slate-600">
                        {answerCardPage + 1} / {totalPages}
                      </span>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAnswerCardPage(Math.min(totalPages - 1, answerCardPage + 1))}
                        disabled={answerCardPage === totalPages - 1}
                        className="h-8 px-2"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* 统计信息 */}
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="inline-block h-3 w-3 rounded border border-slate-300 bg-white"></span>
                      未答
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="inline-block h-3 w-3 rounded border border-green-200 bg-green-50"></span>
                      正确
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="inline-block h-3 w-3 rounded border border-red-200 bg-red-50"></span>
                      错误
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="inline-block h-3 w-3 rounded ring-2 ring-orange-500"></span>
                      已标记
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">总题数：</span>
                    <span className="text-slate-800">{session.questions.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">已答题：</span>
                    <span className="text-slate-800">{answeredCount}</span>
                  </div>
                  {answeredCount > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-600">正确：</span>
                        <span className="text-green-600">
                          {session.questions.filter(q => {
                            const answer = session.answers[q.id];
                            return answer && isAnswerCorrect(answer, q.correctAnswer);
                          }).length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">错误：</span>
                        <span className="text-red-600">
                          {session.questions.filter(q => {
                            const answer = session.answers[q.id];
                            return answer && !isAnswerCorrect(answer, q.correctAnswer);
                          }).length}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-600">未答题：</span>
                    <span className="text-slate-400">{session.questions.length - answeredCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">已标记：</span>
                    <span className="text-orange-600">{markedQuestions.size}</span>
                  </div>
                </div>

                {/* 交卷按钮 */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <Button
                    onClick={handleSubmit}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2"
                  >
                    交卷
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* 确认提交对话框 */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                确认提交
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertDescription>
                  您还有 {session.questions.length - answeredCount} 道题未作答，确定要提交试卷吗？
                </AlertDescription>
              </Alert>
              <div className="flex gap-2 mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowConfirmSubmit(false)}
                  className="flex-1"
                >
                  继续答题
                </Button>
                <Button 
                  onClick={() => {
                    setShowConfirmSubmit(false);
                    onCompleteExam();
                  }}
                  className="flex-1"
                >
                  确认提交
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
