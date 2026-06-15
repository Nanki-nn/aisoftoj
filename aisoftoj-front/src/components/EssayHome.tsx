import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { FileText, Calendar, History, Play } from 'lucide-react';
import { getEssayQuestions, EssayQuestion } from '../lib/api';

const SUBJECT_FILTERS = ['全部', '系统架构师', '项目管理师', '系统分析师'];

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
    <main className="app-page">
      <div className="app-page-content">
        <section className="app-page-heading">
          <div className="flex items-center gap-3">
            <span className="app-page-icon">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h1>AI 论文批改</h1>
              <p>历年软考论文真题，AI 即时批改评分</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/essay/history')} className="app-secondary-button">
            <History className="mr-1.5 h-4 w-4" />
            我的练习记录
          </Button>
        </section>

        <div className="paper-browser">
          <aside className="home-panel paper-filter-card">
            <h2 className="paper-filter-heading">科目筛选</h2>
            <div className="paper-filter-options">
              {SUBJECT_FILTERS.map((subject) => (
                <Button
                  key={subject}
                  variant={selectedSubject === subject ? 'default' : 'outline'}
                  onClick={() => setSelectedSubject(subject)}
                  className={`home-filter-option ${
                    selectedSubject === subject ? 'home-filter-active' : 'home-filter-inactive'
                  }`}
                >
                  {subject}
                </Button>
              ))}
            </div>
          </aside>

          <section className="min-w-0">
            <div className="paper-list-heading">
              <h2 className="flex items-center gap-2 text-lg text-slate-800">
                <Calendar className="h-4 w-4" />
                {selectedSubject === '全部' ? '全部题目' : selectedSubject}
              </h2>
              {!loading && (
                <Badge variant="outline" className="border-slate-200 text-slate-600">
                  共 {filteredQuestions.length} 题
                </Badge>
              )}
            </div>

            {loading ? (
              <div className="app-empty-state">加载中...</div>
            ) : error ? (
              <div className="app-empty-state text-red-600">{error}</div>
            ) : filteredQuestions.length === 0 ? (
              <div className="app-empty-state">
                <FileText className="h-10 w-10" />
                <p>暂无{selectedSubject === '全部' ? '' : selectedSubject}题目</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredQuestions.map((question) => {
                  const subject = question.subjectName || '未知科目';
                  const preview = question.intro
                    ? question.intro.substring(0, 80) + (question.intro.length > 80 ? '...' : '')
                    : '';
                  return (
                    <Card key={question.id} className="paper-card group transition-all duration-300">
                      <CardHeader className="p-4 pb-3">
                        <div className="mb-2 flex items-center gap-2">
                          {question.year && <span className="paper-category-badge px-2 py-0.5 text-xs">{question.year} 年</span>}
                          <span className="paper-category-badge px-2 py-0.5 text-xs">{subject}</span>
                        </div>
                        <CardTitle className="text-base leading-snug text-slate-800 transition-colors group-hover:text-teal-700">
                          {question.name || `题目 #${question.id}`}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 pt-0">
                        <p className="mb-4 line-clamp-2 text-sm text-slate-500">{preview}</p>
                        <div className="flex justify-end">
                          <Button size="sm" onClick={() => navigate(`/essay/write/${question.id}`)} className="app-primary-button">
                            <Play className="mr-1 h-3 w-3" />
                            开始练习
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
