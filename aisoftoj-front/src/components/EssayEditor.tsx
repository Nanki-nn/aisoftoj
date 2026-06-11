import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { GraduationCap, FileText, ArrowLeft, Clock, Save, Loader2, CheckCircle } from 'lucide-react';
import { getEssayQuestions, submitEssay, EssayQuestion } from '../lib/api';

function formatTime(seconds: number): string {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function getAbstractBadgeStyle(count: number): { background: string; color: string } {
  if (count >= 280 && count <= 320) return { background: '#d1fae5', color: '#065f46' };
  if (count < 200 || count > 400) return { background: '#fee2e2', color: '#991b1b' };
  return { background: '#fef3c7', color: '#92400e' };
}

function getContentBadgeStyle(count: number): { background: string; color: string } {
  if (count >= 2000 && count <= 3000) return { background: '#d1fae5', color: '#065f46' };
  if (count >= 1000) return { background: '#fef3c7', color: '#92400e' };
  return { background: '#fee2e2', color: '#991b1b' };
}

export function EssayEditor() {
  const navigate = useNavigate();
  const { questionId } = useParams<{ questionId: string }>();

  const parsedId = parseInt(questionId || '0', 10);
  const draftKey = `essay-draft-${parsedId}`;

  const [question, setQuestion] = useState<EssayQuestion | null>(null);
  const [questionLoading, setQuestionLoading] = useState(true);
  const [abstractText, setAbstractText] = useState('');
  const [contentText, setContentText] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [showRestoreNotice, setShowRestoreNotice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch question data from API
  useEffect(() => {
    getEssayQuestions()
      .then((list) => {
        const found = list.find((q) => q.id === parsedId) || null;
        setQuestion(found);
      })
      .catch(() => setQuestion(null))
      .finally(() => setQuestionLoading(false));
  }, [parsedId]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // On mount: restore draft, set up timer and auto-save
  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.abstractText !== undefined) setAbstractText(parsed.abstractText);
        if (parsed.contentText !== undefined) setContentText(parsed.contentText);
        setShowRestoreNotice(true);
        const hideTimer = setTimeout(() => setShowRestoreNotice(false), 3000);
        return () => clearTimeout(hideTimer);
      } catch {
        // ignore malformed draft
      }
    }
  }, [draftKey]);

  // Timer: counts up every second
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Auto-save every 30 seconds
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      localStorage.setItem(draftKey, JSON.stringify({ abstractText, contentText }));
      setLastSaveTime(new Date());
    }, 30000);
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [draftKey, abstractText, contentText]);

  const abstractCount = abstractText.length;
  const contentCount = contentText.length;
  const totalCount = abstractCount + contentCount;

  const abstractBadgeStyle = getAbstractBadgeStyle(abstractCount);
  const contentBadgeStyle = getContentBadgeStyle(contentCount);

  const handleManualSave = () => {
    localStorage.setItem(draftKey, JSON.stringify({ abstractText, contentText }));
    setLastSaveTime(new Date());
  };

  const handleSubmit = async () => {
    if (abstractCount < 200) {
      alert('摘要不足200字，请补充后再提交');
      return;
    }
    if (contentCount < 1000) {
      alert('正文不足1000字，请补充后再提交');
      return;
    }

    setIsSubmitting(true);
    try {
      const { submissionId } = await submitEssay(parsedId, abstractText, contentText);
      localStorage.removeItem(draftKey);
      navigate(`/essay/result/${submissionId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      if (message.includes('今日批改次数已用完')) {
        alert('今日批改次数已用完（3/3），明天再来');
      } else {
        alert(`提交失败：${message}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (questionLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-slate-400">加载题目中…</div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50 p-12 text-center max-w-md w-full">
          <p className="text-slate-500 mb-2 text-sm">题目 #{questionId} 不存在</p>
          <h2 className="text-xl text-slate-700 mb-6">未找到对应题目</h2>
          <Button variant="outline" onClick={() => navigate('/essay')} className="border-slate-200">
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回题目列表
          </Button>
        </div>
      </div>
    );
  }

  const subjectName = question.subjectName || '未知科目';
  const subjectBadgeStyle =
    subjectName === '系统架构师'
      ? { background: '#dbeafe', color: '#1d4ed8' }
      : subjectName === '项目管理师'
      ? { background: '#d1fae5', color: '#065f46' }
      : { background: '#fef3c7', color: '#92400e' };

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
              <button
                onClick={() => navigate('/essay')}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span className="text-base">AI 论文批改</span>
              </button>
              <span className="text-slate-300">/</span>
              <span className="text-base text-blue-600 truncate max-w-xs">{question.name || `题目 #${question.id}`}</span>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate('/essay')}
              className="text-slate-600 hover:text-slate-800 hover:bg-slate-100"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回列表
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 草稿恢复通知 */}
        {showRestoreNotice && (
          <div
            className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg border text-sm"
            style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }}
          >
            <CheckCircle className="w-4 h-4 shrink-0" />
            已自动恢复上次保存的草稿内容
          </div>
        )}

        {/* 主区域：左栏 + 右侧边栏 */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* 左列 */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* 题目卡片 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50 p-6">
              <div className="flex items-center gap-2 mb-3">
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
                  style={{ background: subjectBadgeStyle.background, color: subjectBadgeStyle.color }}
                >
                  {subjectName}
                </span>
              </div>
              <h2 className="text-lg text-slate-800 mb-3">{question.name || `题目 #${question.id}`}</h2>
              <p className="text-slate-600 text-sm leading-relaxed">{question.intro}</p>
            </div>

            {/* 摘要区 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50 p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-base text-slate-700">摘要</span>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded"
                  style={{ background: abstractBadgeStyle.background, color: abstractBadgeStyle.color }}
                >
                  {abstractCount} 字
                </span>
              </div>
              <textarea
                rows={6}
                value={abstractText}
                onChange={(e) => setAbstractText(e.target.value)}
                placeholder="请在此输入摘要（目标280~320字）..."
                className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all placeholder-slate-400"
                style={{ background: '#f8fafc' }}
              />
            </div>

            {/* 正文区 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50 p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-base text-slate-700">正文</span>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded"
                  style={{ background: contentBadgeStyle.background, color: contentBadgeStyle.color }}
                >
                  {contentCount} 字
                </span>
              </div>
              <textarea
                rows={20}
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                placeholder="请在此输入正文（目标2000~3000字）..."
                className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all placeholder-slate-400"
                style={{ background: '#f8fafc' }}
              />
            </div>
          </div>

          {/* 右侧边栏 */}
          <div className="w-full lg:w-64 shrink-0 sticky top-20">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50 p-5 space-y-5">
              {/* 统计数据 */}
              <div>
                <h3 className="text-sm text-slate-500 mb-3">答题统计</h3>
                <div className="space-y-3">
                  {/* 总字数 */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">总字数</span>
                    <span className="text-sm text-slate-800">{totalCount} 字</span>
                  </div>

                  {/* 计时器 */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      用时
                    </span>
                    <span
                      className="text-sm font-mono"
                      style={{ color: '#2563eb' }}
                    >
                      {formatTime(elapsed)}
                    </span>
                  </div>

                  {/* 最后保存 */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 flex items-center gap-1">
                      <Save className="w-3.5 h-3.5 text-slate-400" />
                      上次保存
                    </span>
                    <span className="text-xs text-slate-500">
                      {lastSaveTime
                        ? lastSaveTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : '未保存'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 分隔线 */}
              <div className="border-t border-slate-100" />

              {/* 手动保存按钮 */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualSave}
                className="w-full border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                立即保存草稿
              </Button>

              {/* 提交按钮 */}
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    提交中...
                  </>
                ) : (
                  '提交批改'
                )}
              </Button>

              <p className="text-xs text-slate-400 text-center leading-relaxed">
                提交后将由 AI 进行评分，约需 15 秒
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
