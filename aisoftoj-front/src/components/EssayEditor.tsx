import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { GraduationCap, FileText, ArrowLeft, Clock, Save, Loader2, CheckCircle } from 'lucide-react';

const mockQuestions = [
  {
    id: 1,
    year: 2023,
    subject: '系统架构师',
    title: '论软件架构设计方法',
    content:
      '请结合你参与的软件项目，论述软件架构设计的重要性，重点阐述你所采用的架构风格及其选择理由，并说明该架构在实际项目中遇到的问题及解决方案。要求：摘要300字左右，正文2500字左右。',
  },
  {
    id: 2,
    year: 2023,
    subject: '项目管理师',
    title: '论项目进度管理',
    content:
      '结合你管理过的软件项目，论述项目进度计划的制定、跟踪与控制方法，说明你采用的进度管理工具和技术，以及在项目执行过程中如何应对进度偏差。要求：摘要300字左右，正文2500字左右。',
  },
  {
    id: 3,
    year: 2022,
    subject: '系统架构师',
    title: '论微服务架构的设计与实践',
    content:
      '请论述微服务架构的核心概念，结合实际项目说明如何进行微服务拆分、服务间通信方式选择、数据一致性保障及服务治理实践。要求：摘要300字左右，正文2500字左右。',
  },
  {
    id: 4,
    year: 2022,
    subject: '系统分析师',
    title: '论系统需求分析方法',
    content:
      '结合具体项目，论述需求获取、需求分析和需求规格说明书编写的过程和方法，说明你在项目中如何处理需求变更。要求：摘要300字左右，正文2500字左右。',
  },
  {
    id: 5,
    year: 2021,
    subject: '项目管理师',
    title: '论信息系统项目的风险管理',
    content:
      '结合你参与管理的信息系统项目，论述项目风险管理的过程，重点阐述风险识别、风险评估和风险应对策略的制定与实施。要求：摘要300字左右，正文2500字左右。',
  },
  {
    id: 6,
    year: 2021,
    subject: '系统架构师',
    title: '论软件可靠性设计',
    content:
      '请结合你参与的软件项目，论述软件可靠性设计的重要性及具体实施方法，包括容错设计、冗余设计、检验点设置等。要求：摘要300字左右，正文2500字左右。',
  },
];

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
  const question = mockQuestions.find((q) => q.id === parsedId) || null;

  const draftKey = `essay-draft-${parsedId}`;

  const [abstractText, setAbstractText] = useState('');
  const [contentText, setContentText] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [showRestoreNotice, setShowRestoreNotice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const res = await fetch('http://localhost:8080/essay/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: parsedId,
          abstractText,
          content: contentText,
        }),
      });

      if (!res.ok) {
        throw new Error(`请求失败，状态码：${res.status}`);
      }

      const json = await res.json();
      const submissionId = json?.data?.submissionId;
      if (!submissionId) {
        throw new Error('服务器未返回有效的 submissionId');
      }
      localStorage.removeItem(draftKey);
      navigate(`/essay/result/${submissionId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      alert(`提交失败：${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!question) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col items-center justify-center">
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

  const subjectBadgeStyle =
    question.subject === '系统架构师'
      ? { background: '#dbeafe', color: '#1d4ed8' }
      : question.subject === '项目管理师'
      ? { background: '#d1fae5', color: '#065f46' }
      : { background: '#fef3c7', color: '#92400e' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
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
              <span className="text-base text-blue-600 truncate max-w-xs">{question.title}</span>
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
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded"
                  style={{ background: '#dbeafe', color: '#1d4ed8' }}
                >
                  {question.year} 年
                </span>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded"
                  style={{ background: subjectBadgeStyle.background, color: subjectBadgeStyle.color }}
                >
                  {question.subject}
                </span>
              </div>
              <h2 className="text-lg text-slate-800 mb-3">{question.title}</h2>
              <p className="text-slate-600 text-sm leading-relaxed">{question.content}</p>
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
