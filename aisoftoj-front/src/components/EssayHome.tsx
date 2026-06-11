import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { FileText, GraduationCap, Calendar, Play } from 'lucide-react';
import { getEssayQuestions, EssayQuestion } from '../lib/api';

const SUBJECT_FILTERS = ['全部', '系统架构师', '项目管理师', '系统分析师'];

const SUBJECT_BADGE_COLORS: Record<string, { background: string; color: string }> = {
  '系统架构师': { background: '#dbeafe', color: '#1d4ed8' },
  '项目管理师': { background: '#d1fae5', color: '#065f46' },
  '系统分析师': { background: '#fef3c7', color: '#92400e' },
};

export function EssayHome() {
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState('全部');
  const [questions, setQuestions] = useState<EssayQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEssayQuestions()
      .then(setQuestions)
      .catch((e: Error) => setError(e.message || '加载题目失败'))
      .finally(() => setLoading(false));
  }, []);

  const filteredQuestions = questions.filter(
    (q) => selectedSubject === '全部' || q.subjectName === selectedSubject
  );

  return (
    <div className="min-h-screen bg-white">
      {/* 顶部导航栏 */}
      <div className="bg-white/70 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <GraduationCap className="w-7 h-7 text-blue-600" />
                <span className="text-lg text-slate-700">知构软考刷题平台</span>
              </button>
              <span className="text-slate-300">/</span>
              <div className="flex items-center gap-1 text-blue-600">
                <FileText className="w-5 h-5" />
                <span className="text-base">AI 论文批改</span>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate('/essay/history')}
              className="text-slate-600 hover:text-slate-800 hover:bg-slate-100"
            >
              <Calendar className="w-4 h-4 mr-1" />
              我的练习记录
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 页面标题区 */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50 p-8">
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
              >
                <FileText className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl text-slate-800 mb-2">AI 论文批改</h1>
                <p className="text-slate-500 text-lg">历年软考论文真题，AI 即时批改评分</p>
              </div>
            </div>
          </div>
        </div>

        {/* 科目筛选 */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {SUBJECT_FILTERS.map((subject) => (
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
        </div>

        {/* 题目数量 */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg text-slate-700 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-500" />
            {selectedSubject === '全部' ? '全部题目' : selectedSubject}
          </h2>
          {!loading && (
            <Badge variant="outline" className="border-slate-200 text-slate-600">
              共 {filteredQuestions.length} 题
            </Badge>
          )}
        </div>

        {/* 加载/错误/内容 */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-400">加载中…</div>
        ) : error ? (
          <div className="flex items-center justify-center py-24 text-red-400">{error}</div>
        ) : filteredQuestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
            <FileText className="w-12 h-12" />
            <p>暂无{selectedSubject === '全部' ? '' : selectedSubject}题目</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredQuestions.map((question) => {
              const subject = question.subjectName || '未知科目';
              const badgeStyle = SUBJECT_BADGE_COLORS[subject] || {
                background: '#f1f5f9',
                color: '#475569',
              };
              const preview = question.intro
                ? question.intro.substring(0, 80) + (question.intro.length > 80 ? '…' : '')
                : '';
              return (
                <Card
                  key={question.id}
                  className="bg-white hover:shadow-lg transition-all duration-300 border border-slate-200/50 hover:border-slate-300/50 group"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {question.year && (
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded"
                              style={{ background: '#dbeafe', color: '#1d4ed8' }}
                            >
                              {question.year} 年
                            </span>
                          )}
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded"
                            style={{ background: badgeStyle.background, color: badgeStyle.color }}
                          >
                            {subject}
                          </span>
                        </div>
                        <CardTitle className="text-base text-slate-800 group-hover:text-blue-600 transition-colors leading-snug">
                          {question.name || `题目 #${question.id}`}
                        </CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">{preview}</p>
                    <div className="flex items-center justify-end">
                      <Button
                        size="sm"
                        onClick={() => navigate(`/essay/write/${question.id}`)}
                        className="bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md transition-all"
                      >
                        <Play className="w-3 h-3 mr-1" />
                        开始练习
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
