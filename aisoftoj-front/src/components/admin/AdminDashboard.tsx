import React, { useEffect, useState } from 'react';
import { Users, UserCheck, BookOpen, CheckCircle } from 'lucide-react';
import { fetchAdminDashboard, AdminDashboardDTO } from '../../lib/api';

type StatCardProps = {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  color: string;
};

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-semibold text-slate-800 mt-0.5">
          {value === null ? '—' : value.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const [data, setData] = useState<AdminDashboardDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminDashboard()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  const stats: StatCardProps[] = [
    {
      label: '总用户数',
      value: data?.userTotal ?? null,
      icon: <Users size={22} className="text-blue-600" />,
      color: 'bg-blue-50',
    },
    {
      label: '已启用用户',
      value: data?.enabledUserTotal ?? null,
      icon: <UserCheck size={22} className="text-green-600" />,
      color: 'bg-green-50',
    },
    {
      label: '题目总数',
      value: data?.questionTotal ?? null,
      icon: <BookOpen size={22} className="text-amber-600" />,
      color: 'bg-amber-50',
    },
    {
      label: '有效题目',
      value: data?.activeQuestionTotal ?? null,
      icon: <CheckCircle size={22} className="text-purple-600" />,
      color: 'bg-purple-50',
    },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-6">数据概览</h1>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>
    </div>
  );
}
