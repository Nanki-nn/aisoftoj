import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { GraduationCap, FileText, AlertTriangle, XCircle } from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';
import { getEssayResult, EssayResultData } from '../lib/api';

// --------------------------------------------------
// Dimension definitions (max values match grading rubric)
// --------------------------------------------------
const DIMENSIONS = [
  { key: 'scoreAbstract', label: '摘要质量', max: 5 },
  { key: 'scoreStructure', label: '结构完整性', max: 5 },
  { key: 'scoreRelevance', label: '主题相关性', max: 5 },
  { key: 'scoreDepth', label: '技术深度', max: 4 },
  { key: 'scoreEvidence', label: '论据充实度', max: 3 },
  { key: 'scoreLanguage', label: '语言流畅度', max: 3 },
] as const;

// Suggestion badge colors
const SUGGESTION_BADGE_STYLES: Record<number, { background: string; color: string }> = {
  0: { background: '#dbeafe', color: '#1d4ed8' },
  1: { background: '#fef3c7', color: '#92400e' },
  2: { background: '#d1fae5', color: '#065f46' },
};

// --------------------------------------------------
// Sub-components
// --------------------------------------------------

function LoadingState() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col items-center justify-center gap-6">
      <div
        className="w-16 h-16 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"
        style={{ borderTopColor: '#2563eb', borderColor: '#bfdbfe' }}
      />
      <div className="text-center">
        <p className="text-xl text-slate-700 mb-1">AI 正在批改中...</p>
        <div className="flex items-center justify-center gap-1 mb-3">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-blue-400"
              style={{
                animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite`,
                display: 'inline-block',
              }}
            />
          ))}
        </div>
        <p className="text-sm text-slate-500">预计需要 15 秒，请稍候</p>
      </div>
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

function FailedState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col items-center justify-center gap-6">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: '#fee2e2' }}
      >
        <XCircle className="w-9 h-9" style={{ color: '#dc2626' }} />
      </div>
      <div className="text-center">
        <p className="text-xl text-slate-700 mb-1">批改失败</p>
        <p className="text-sm text-slate-500 mb-6">AI 服务暂时不可用，请稍后重试</p>
        <Button
          onClick={onRetry}
          style={{ background: '#dc2626' }}
          className="text-white hover:opacity-90"
        >
          重新提交
        </Button>
      </div>
    </div>
  );
}

function TimeoutState({ onViewHistory }: { onViewHistory: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col items-center justify-center gap-6">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: '#fef3c7' }}
      >
        <AlertTriangle className="w-9 h-9" style={{ color: '#d97706' }} />
      </div>
      <div className="text-center">
        <p className="text-xl text-slate-700 mb-1">批改超时</p>
        <p className="text-sm text-slate-500 mb-6">已超过30秒，请稍后查看历史记录</p>
        <Button
          onClick={onViewHistory}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          查看历史
        </Button>
      </div>
    </div>
  );
}

function ReportState({ data, onBack, onViewHistory }: {
  data: EssayResultData;
  onBack: () => void;
  onViewHistory: () => void;
}) {
  const isPassed = data.totalScore >= 15;

  const radarData = [
    { subject: '摘要质量', score: data.scoreAbstract, fullMark: 5 },
    { subject: '结构完整性', score: data.scoreStructure, fullMark: 5 },
    { subject: '主题相关性', score: data.scoreRelevance, fullMark: 5 },
    { subject: '技术深度', score: data.scoreDepth, fullMark: 4 },
    { subject: '论据充实度', score: data.scoreEvidence, fullMark: 3 },
    { subject: '语言流畅度', score: data.scoreLanguage, fullMark: 3 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Top nav */}
      <div className="bg-white/70 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-slate-600">
              <GraduationCap className="w-7 h-7 text-blue-600" />
              <span className="text-lg text-slate-700">知构软考刷题平台</span>
            </div>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-1 text-blue-600">
              <FileText className="w-5 h-5" />
              <span className="text-base">AI 批改报告</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* 1. Score header card */}
        <Card className="bg-white border border-slate-200/50 shadow-sm">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-3">
            <div
              style={{ fontSize: '3rem', fontWeight: 700, color: isPassed ? '#16a34a' : '#dc2626', lineHeight: 1 }}
            >
              {data.totalScore}/25
            </div>
            <div
              className="px-3 py-1 rounded-full text-sm font-medium"
              style={
                isPassed
                  ? { background: '#d1fae5', color: '#065f46' }
                  : { background: '#fee2e2', color: '#dc2626' }
              }
            >
              {isPassed ? '及格 ✓' : '未及格 ✗'}
            </div>
            <p className="text-slate-500 text-sm">提交编号 #{data.submissionId}</p>
          </CardContent>
        </Card>

        {/* 2. Radar chart */}
        <Card className="bg-white border border-slate-200/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-800 text-base">各维度得分雷达图</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#64748b' }} />
                <Radar
                  name="得分"
                  dataKey="score"
                  stroke="#2563eb"
                  fill="#2563eb"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 3. Dimension scores table */}
        <Card className="bg-white border border-slate-200/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-800 text-base">各维度得分详情</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {DIMENSIONS.map((dim) => {
                const score = data[dim.key] as number;
                const pct = Math.round((score / dim.max) * 100);
                return (
                  <div key={dim.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-700">{dim.label}</span>
                      <span className="text-sm font-medium text-slate-800">
                        {score} / {dim.max}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full" style={{ background: '#e2e8f0' }}>
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${pct}%`, background: '#2563eb', transition: 'width 0.4s ease' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 4. Suggestions */}
        <Card className="bg-white border border-slate-200/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-800 text-base">改进建议</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.suggestions.map((text, i) => {
                const badgeStyle = SUGGESTION_BADGE_STYLES[i] ?? SUGGESTION_BADGE_STYLES[0];
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                      style={{ background: badgeStyle.background, color: badgeStyle.color }}
                    >
                      {i + 1}
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 5. Bottom actions */}
        <div className="flex flex-col sm:flex-row gap-3 pb-8">
          <Button
            variant="outline"
            onClick={onBack}
            className="border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            再次练习
          </Button>
          <Button
            onClick={onViewHistory}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            查看历史
          </Button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------
// Main component
// --------------------------------------------------
export function EssayResult() {
  const navigate = useNavigate();
  const { submissionId } = useParams<{ submissionId: string }>();

  type PageState = 'loading' | 'completed' | 'failed' | 'timeout';
  const [pageState, setPageState] = useState<PageState>('loading');
  const [resultData, setResultData] = useState<EssayResultData | null>(null);

  const pollCount = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MAX_POLLS = 15;

  useEffect(() => {
    const id = submissionId ?? '';
    if (!id) {
      setPageState('failed');
      return;
    }

    const fetchResult = async () => {
      try {
        const data = await getEssayResult(id);
        if (data.status === 1) {
          clearInterval(intervalRef.current!);
          setResultData(data);
          setPageState('completed');
        } else if (data.status === 2) {
          clearInterval(intervalRef.current!);
          setPageState('failed');
        }
        // status 0 => keep polling
      } catch {
        // Network error — keep polling until MAX_POLLS
      }

      pollCount.current += 1;
      if (pollCount.current >= MAX_POLLS) {
        clearInterval(intervalRef.current!);
        setPageState((prev) => (prev === 'loading' ? 'timeout' : prev));
      }
    };

    intervalRef.current = setInterval(fetchResult, 2000);
    fetchResult();

    return () => {
      clearInterval(intervalRef.current!);
    };
  }, [submissionId]);

  if (pageState === 'loading') {
    return <LoadingState />;
  }

  if (pageState === 'failed') {
    return <FailedState onRetry={() => navigate(-1)} />;
  }

  if (pageState === 'timeout') {
    return <TimeoutState onViewHistory={() => navigate('/essay/history')} />;
  }

  // completed
  return (
    <ReportState
      data={resultData!}
      onBack={() => navigate(-1)}
      onViewHistory={() => navigate('/essay/history')}
    />
  );
}
