import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { Alert, AlertDescription } from './ui/alert';
import {
  Trophy,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  BookOpen,
  RotateCcw,
  Home,
  BookMarked,
  ArrowLeft
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { ExamSession, Question } from '../types/exam';

interface ExamResultProps {
  session: ExamSession;
  onRestartExam: () => void;
  onBackToHome: () => void;
  onContinuePractice: () => void;
  onBackToExam: () => void;
}

export function ExamResult({ session, onRestartExam, onBackToHome, onContinuePractice, onBackToExam }: ExamResultProps) {
  // 所有题目都是主观题（essay）时，不进行自动评分
  const isSubjectiveExam = session.questions.every(q => q.type === 'essay');

  const calculateResults = () => {
    let correctCount = 0;
    const questionResults: Array<{
      question: Question;
      userAnswer: string | string[];
      isCorrect: boolean;
    }> = [];

    session.questions.forEach(question => {
      const userAnswer = session.answers[question.id];
      let isCorrect = false;

      if (!isSubjectiveExam && userAnswer !== undefined) {
        if (question.type === 'multiple') {
          const correctAnswers = Array.isArray(question.correctAnswer)
            ? question.correctAnswer
            : [question.correctAnswer];
          const userAnswers = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
          isCorrect = correctAnswers.length === userAnswers.length &&
                     correctAnswers.every(answer => userAnswers.includes(answer));
        } else if (question.type !== 'essay') {
          isCorrect = userAnswer === question.correctAnswer;
        }
      }

      if (isCorrect) correctCount++;

      questionResults.push({
        question,
        userAnswer: userAnswer || '',
        isCorrect
      });
    });

    const accuracy = Math.round((correctCount / session.questions.length) * 100);
    const duration = session.endTime
      ? Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000 / 60)
      : 0;

    return { correctCount, accuracy, duration, questionResults };
  };

  const { correctCount, accuracy, duration, questionResults } = calculateResults();
  const wrongCount = session.questions.length - correctCount;
  const answeredCount = questionResults.filter(result => result.userAnswer && (Array.isArray(result.userAnswer) ? result.userAnswer.length > 0 : true)).length;
  const unansweredCount = session.questions.length - answeredCount;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLevel = (score: number) => {
    if (score >= 90) return '优秀';
    if (score >= 80) return '良好';
    if (score >= 60) return '及格';
    return '不及格';
  };

  const formatUserAnswer = (answer: string | string[], isMultiple: boolean) => {
    if (!answer) return '未作答';
    if (isMultiple && Array.isArray(answer)) {
      return answer.join(', ');
    }
    return Array.isArray(answer) ? answer.join(', ') : answer;
  };

  const formatCorrectAnswer = (answer: string | string[], isMultiple: boolean) => {
    if (isMultiple && Array.isArray(answer)) {
      return answer.join(', ');
    }
    return Array.isArray(answer) ? answer.join(', ') : answer;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* 顶部导航栏 */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BrandLogo />
              <span className="text-slate-300">|</span>
              <Button variant="ghost" size="sm" onClick={onBackToExam} className="flex items-center gap-1 text-slate-600">
                首页
              </Button>
            </div>
            <h1 className="text-lg text-slate-800">考试结果</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* 成绩概览 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-600" />
              考试结果
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {isSubjectiveExam ? (
                <div className="text-center">
                  <div className="text-2xl mb-2 text-slate-500">主观题</div>
                  <div className="text-muted-foreground">待人工评分</div>
                </div>
              ) : (
                <div className="text-center">
                  <div className={`text-4xl mb-2 ${getScoreColor(accuracy)}`}>
                    {accuracy}分
                  </div>
                  <div className="text-muted-foreground">
                    {getScoreLevel(accuracy)}
                  </div>
                </div>
              )}
              <div className="text-center">
                <div className="text-2xl mb-2">
                  {isSubjectiveExam ? `${answeredCount}/${session.questions.length}` : `${correctCount}/${session.questions.length}`}
                </div>
                <div className="text-muted-foreground">
                  {isSubjectiveExam ? '已作答题数' : '正确题数'}
                </div>
              </div>

              <div className="text-center">
                <div className="text-2xl mb-2 flex items-center justify-center gap-1">
                  <Clock className="w-5 h-5" />
                  {duration}分钟
                </div>
                <div className="text-muted-foreground">
                  答题用时
                </div>
              </div>
            </div>

            {!isSubjectiveExam && <Progress value={accuracy} className="h-3 mb-4" />}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                <span>{session.subject}</span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span>{session.category}</span>
              </div>
              {isSubjectiveExam ? (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                    <span>{answeredCount} 道已答</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-slate-400" />
                    <span>{unansweredCount} 道未答</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>{correctCount} 道正确</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span>{wrongCount} 道错误</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 border-blue-100 bg-white/95 shadow-sm">
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm text-slate-500">考试完成后常用操作</div>
              <div className="text-slate-800">重新作答、继续练习和返回首页都放在这里，首屏就能点。</div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={onRestartExam} variant="outline" className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                重新答题
              </Button>
              <Button onClick={onContinuePractice} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
                <BookMarked className="w-4 h-4" />
                继续刷题
              </Button>
              <Button onClick={onBackToHome} variant="outline" className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                返回首页
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 答题详情 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>答题详情</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {questionResults.map((result, index) => {
                const isEssay = result.question.type === 'essay';
                const hasAnswer = result.userAnswer && (Array.isArray(result.userAnswer) ? result.userAnswer.length > 0 : result.userAnswer !== '');
                return (
                  <div key={result.question.id} className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center">
                        {isEssay ? (
                          hasAnswer
                            ? <CheckCircle className="w-5 h-5 text-blue-500" />
                            : <XCircle className="w-5 h-5 text-slate-400" />
                        ) : (
                          result.isCorrect
                            ? <CheckCircle className="w-5 h-5 text-green-600" />
                            : <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span>第 {index + 1} 题</span>
                          {isEssay ? (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                              {hasAnswer ? '已作答' : '未作答'}
                            </Badge>
                          ) : (
                            <Badge variant={result.isCorrect ? 'default' : 'destructive'}>
                              {result.isCorrect ? '正确' : '错误'}
                            </Badge>
                          )}
                          <Badge variant="outline">
                            {result.question.difficulty === 'easy' ? '简单' :
                             result.question.difficulty === 'medium' ? '中等' : '困难'}
                          </Badge>
                        </div>
                        <p className="mb-3">{result.question.question}</p>

                        <div className="bg-muted p-3 rounded-lg mb-2">
                          <div className="flex items-start gap-2">
                            <span className="font-medium text-sm">你的答案：</span>
                            <span className={isEssay ? 'text-slate-700 whitespace-pre-wrap' : (result.isCorrect ? 'text-green-600' : 'text-red-600')}>
                              {formatUserAnswer(result.userAnswer, result.question.type === 'multiple')}
                            </span>
                          </div>
                        </div>

                        {!isEssay && !result.isCorrect && (
                          <div className="bg-green-50 p-3 rounded-lg mb-2">
                            <div className="flex items-start gap-2">
                              <span className="font-medium text-sm">正确答案：</span>
                              <span className="text-green-600">
                                {formatCorrectAnswer(result.question.correctAnswer, result.question.type === 'multiple')}
                              </span>
                            </div>
                          </div>
                        )}

                        {isEssay ? (
                          result.question.explanation && (
                            <Alert className="border-blue-200 bg-blue-50">
                              <AlertCircle className="h-4 w-4 text-blue-600" />
                              <AlertDescription className="text-blue-800">
                                <strong>参考要点：</strong>
                                <div className="markdown-body text-sm mt-1">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                    {result.question.explanation}
                                  </ReactMarkdown>
                                </div>
                              </AlertDescription>
                            </Alert>
                          )
                        ) : (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              <strong>解析：</strong>
                              <div className="markdown-body text-sm mt-1">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                  {result.question.explanation}
                                </ReactMarkdown>
                              </div>
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                    {index < questionResults.length - 1 && <Separator />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={onRestartExam} variant="outline" className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            重新答题
          </Button>
          <Button onClick={onContinuePractice} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
            <BookMarked className="w-4 h-4" />
            继续刷题
          </Button>
          <Button onClick={onBackToHome} variant="outline" className="flex items-center gap-2">
            <Home className="w-4 h-4" />
            返回首页
          </Button>
        </div>
      </div>
    </div>
  );
}
