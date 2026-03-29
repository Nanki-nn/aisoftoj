import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { GraduationCap, FileText, Calendar, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getEssayHistory, EssayHistoryItem } from '../lib/api';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd} ${hh}:${mm}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${MM}-${dd}`;
}

function StatusBadge({ status }: { status: number }) {
  if (status === 1) {
    return (
      <span
        className="text-xs font-medium px-2 py-0.5 rounded"
        style={{ background: '#d1fae5', color: '#065f46' }}
      >
        已完成
      </span>
    );
  }
  if (status === 0) {
    return (
      <span
        className="text-xs font-medium px-2 py-0.5 rounded"
        style={{ background: '#fef3c7', color: '#92400e' }}
      >
        批改中
      </span>
    );
  }
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded"
      style={{ background: '#fee2e2', color: '#991b1b' }}
    >
      失败
    </span>
  );
}

export function EssayHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [history, setHistory] = useState<EssayHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    getEssayHistory()
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  const chartData = [...history]
    .sort((a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime())
    .map((item) => ({
      date: formatDate(item.createTime),
      score: item.totalScore,
    }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* 顶部导航栏 */}
      <div className="bg-white/70 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
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
              <span className="text-slate-300">/</span>
              <div className="flex items-center gap-1 text-slate-600">
                <Calendar className="w-5 h-5" />
                <span className="text-base">练习历史</span>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate('/essay')}
              className="text-slate-600 hover:text-slate-800 hover:bg-slate-100"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回题目列表
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-2xl text-slate-800 mb-1">论文练习历史</h1>
          {!loading && (
            <p className="text-slate-500">共 {history.length} 篇</p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-slate-400 text-base">加载中…</div>
          </div>
        ) : history.length === 0 ? (
          /* 空状态 */
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <FileText className="w-16 h-16 text-slate-300" />
            <p className="text-xl text-slate-500">还没有练习记录</p>
            <p className="text-slate-400">去选题开始练习吧</p>
            <Button
              className="mt-2 bg-blue-600 hover:bg-blue-700"
              onClick={() => navigate('/essay')}
            >
              去选题
            </Button>
          </div>
        ) : (
          <>
            {/* 得分趋势图 */}
            <div
              className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/50 p-6 mb-8"
            >
              <h2 className="text-base text-slate-700 mb-4">得分趋势</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 25]}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255,255,255,0.95)',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                    formatter={(value: number) => [`${value} 分`, '得分']}
                  />
                  <ReferenceLine
                    y={15}
                    stroke="orange"
                    strokeDasharray="3 3"
                    label={{ value: '及格线', position: 'insideTopRight', fontSize: 12, fill: 'orange' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={true}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 历史列表表格 */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/50 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200/70">
                    <th className="text-left text-sm text-slate-500 font-medium px-6 py-4">题目</th>
                    <th className="text-left text-sm text-slate-500 font-medium px-4 py-4 whitespace-nowrap">提交时间</th>
                    <th className="text-left text-sm text-slate-500 font-medium px-4 py-4 whitespace-nowrap">字数</th>
                    <th className="text-left text-sm text-slate-500 font-medium px-4 py-4 whitespace-nowrap">得分</th>
                    <th className="text-left text-sm text-slate-500 font-medium px-4 py-4 whitespace-nowrap">状态</th>
                    <th className="text-left text-sm text-slate-500 font-medium px-4 py-4 whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item, idx) => (
                    <tr
                      key={item.submissionId}
                      onClick={() => navigate(`/essay/result/${item.submissionId}`)}
                      className={`cursor-pointer hover:bg-blue-50/60 transition-colors ${
                        idx !== history.length - 1 ? 'border-b border-slate-100' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-700 line-clamp-1">
                          {item.questionTitle}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-500">
                          {formatDateTime(item.createTime)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-500">{item.wordCount}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className="text-sm font-medium"
                          style={{ color: item.totalScore >= 15 ? '#16a34a' : '#dc2626' }}
                        >
                          {item.totalScore}/25
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/essay/result/${item.submissionId}`);
                          }}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 h-7"
                        >
                          查看报告
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
