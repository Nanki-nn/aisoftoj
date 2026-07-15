import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { useAuth } from '../hooks/useAuth';

export type PapersWorkspaceTab = 'papers' | 'history' | 'wrong';
export type WorkspaceStatTone = 'blue' | 'amber' | 'emerald' | 'red' | 'violet';

interface PapersWorkspaceHeaderProps {
  activeTab: PapersWorkspaceTab;
  historyCount?: number | null;
  wrongCount?: number | null;
}

export interface WorkspaceStat {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone: WorkspaceStatTone;
}

interface WorkspaceStatsProps {
  items: WorkspaceStat[];
  isLoading?: boolean;
}

const TAB_CONFIG = [
  { key: 'papers' as const, label: '试卷列表', path: '/papers', icon: FileText },
  { key: 'history' as const, label: '刷题记录', path: '/practice-history', icon: ClipboardList },
  { key: 'wrong' as const, label: '错题分析', path: '/wrong-questions', icon: AlertCircle },
];

const TONE_CLASSES: Record<WorkspaceStatTone, { icon: string; value: string; background: string }> = {
  blue: { icon: 'text-blue-600', value: 'text-blue-600', background: 'bg-blue-50' },
  amber: { icon: 'text-amber-600', value: 'text-amber-600', background: 'bg-amber-50' },
  emerald: { icon: 'text-emerald-600', value: 'text-emerald-600', background: 'bg-emerald-50' },
  red: { icon: 'text-red-600', value: 'text-red-600', background: 'bg-red-50' },
  violet: { icon: 'text-violet-600', value: 'text-violet-600', background: 'bg-violet-50' },
};

export const historyStatIcons = {
  total: ClipboardList,
  inProgress: Clock3,
  completed: CheckCircle2,
  answered: TrendingUp,
};

export function PapersWorkspaceHeader({ activeTab, historyCount, wrongCount }: PapersWorkspaceHeaderProps) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleNavigate = (tab: typeof TAB_CONFIG[number]) => {
    if (tab.key !== 'papers' && !isAuthenticated) {
      navigate('/login');
      return;
    }
    navigate(tab.path);
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
          <FileText className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-medium text-blue-700">历年真题题库</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">刷真题</h1>
        </div>
      </div>

      <nav
        className="mt-8 inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="真题功能导航"
      >
        {TAB_CONFIG.map((tab) => {
          const active = activeTab === tab.key;
          const count = tab.key === 'history' ? historyCount : tab.key === 'wrong' ? wrongCount : null;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleNavigate(tab)}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:gap-2 sm:px-4 ${
                active
                  ? 'bg-blue-600 font-semibold text-white shadow-sm shadow-blue-600/20'
                  : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950'
              }`}
            >
              <tab.icon className="hidden h-4 w-4 sm:block" aria-hidden="true" />
              {tab.label}
              {isAuthenticated && tab.key !== 'papers' && (
                <span className={`rounded-md px-1 py-0.5 text-xs tabular-nums sm:px-1.5 ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {typeof count === 'number' ? count : '--'}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}

export function WorkspaceStats({ items, isLoading = false }: WorkspaceStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((item) => {
        const tone = TONE_CLASSES[item.tone];
        return (
          <div key={item.label} className="flex min-h-28 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:gap-4 sm:p-5">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${tone.background} ${tone.icon}`}>
              <item.icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className={`text-xl font-semibold tabular-nums sm:text-2xl ${tone.value}`}>{item.value}</div>
              )}
              <div className="mt-1 text-xs font-medium leading-tight text-slate-500">{item.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
