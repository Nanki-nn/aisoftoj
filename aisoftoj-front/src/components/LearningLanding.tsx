import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  ArrowRight,
  Award,
  Brain,
  BookOpen,
  FileText,
  PenTool,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { AppHeader } from './AppHeader';

interface LearningLandingProps {
  onShowAuth: () => void;
  onShowProfile: () => void;
}

const learningPaths = [
  {
    id: '01',
    title: '打基础',
    description: '系统学习基础知识，构建知识体系',
    icon: BookOpen,
    path: '/foundation',
    iconClass: 'bg-blue-600',
  },
  {
    id: '02',
    title: '刷真题',
    description: '历年真题实战，查漏补缺',
    icon: FileText,
    path: '/papers',
    iconClass: 'bg-emerald-600',
  },
  {
    id: '03',
    title: '论文冲刺',
    description: 'AI 批改论文，提升写作能力',
    icon: PenTool,
    path: '/essay-sprint',
    iconClass: 'bg-purple-600',
  },
];

const methodSteps = [
  {
    step: '01',
    title: '打基础',
    description: '系统整理备考笔记，按模块分类，快速建立知识框架',
  },
  {
    step: '02',
    title: '刷真题',
    description: '历年真题优先，练习模式和考试模式都能即时反馈',
  },
  {
    step: '03',
    title: '论文冲刺',
    description: 'AI 批改论文，按评分维度给出针对性改进建议',
  },
];

const featureBadges = [
  { icon: Target, text: '2 个月冲刺节奏' },
  { icon: TrendingUp, text: '真题优先' },
  { icon: Brain, text: '错题复盘' },
  { icon: Award, text: 'AI 论文批改' },
];

export function LearningLanding({ onShowAuth, onShowProfile }: LearningLandingProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-blue-50">
      <AppHeader onShowAuth={onShowAuth} onShowProfile={onShowProfile} />

      <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8" style={{ paddingTop: 112 }}>
        <section className="mx-auto max-w-4xl text-center">
          <h1
            className="font-semibold leading-tight text-slate-800"
            style={{ fontSize: 'clamp(3.25rem, 5vw, 5.5rem)' }}
          >
            软考备考，从路径开始。
          </h1>
          <p className="mx-auto mt-7 max-w-3xl text-xl font-semibold leading-relaxed text-slate-600">
            不靠玄学，靠路径。把 2 个月备考拆成三条清晰路线，
            每条路线有对应工具支撑，专为碎片时间设计
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate('/papers')}
              className="h-14 rounded-lg bg-blue-600 px-7 text-lg font-semibold shadow-lg shadow-blue-600/20 hover:bg-blue-700"
            >
              <Zap className="mr-2 h-5 w-5" />
              直接刷真题
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/foundation')}
              className="h-14 rounded-lg border-slate-300 bg-white px-7 text-lg font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
            >
              <BookOpen className="mr-2 h-5 w-5" />
              先看备考路径
            </Button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-8 lg:grid-cols-3" style={{ marginTop: 120 }}>
          {learningPaths.map((path) => {
            const Icon = path.icon;

            return (
              <button
                key={path.id}
                type="button"
                onClick={() => navigate(path.path)}
                className="group rounded-2xl bg-white p-8 text-left shadow-sm transition-all duration-300 hover:shadow-xl"
                style={{ minHeight: 330 }}
              >
                <span
                  className={`flex items-center justify-center rounded-2xl ${path.iconClass}`}
                  style={{ width: 80, height: 80 }}
                >
                  <Icon className="h-8 w-8 text-white" />
                </span>
                <h2 className="mt-9 text-3xl font-semibold text-slate-800">
                  {path.id} {path.title}
                </h2>
                <p className="mt-6 text-lg font-semibold text-slate-600">{path.description}</p>
                <span className="mt-9 inline-flex items-center gap-2 text-lg font-semibold text-blue-600 transition-transform group-hover:translate-x-1">
                  开始学习
                  <ArrowRight className="h-5 w-5" />
                </span>
              </button>
            );
          })}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-12" style={{ marginTop: 112 }}>
          <div className="text-center">
            <h2 className="text-3xl font-semibold text-slate-800">为什么这样排？</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold leading-relaxed text-slate-600">
              基于实战经验总结的备考路径，帮助在职工程师在碎片时间里稳住节奏。
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-3">
            {methodSteps.map((item) => (
              <div key={item.step} className="flex items-start gap-4">
                <span
                  className="flex shrink-0 items-center justify-center rounded-full bg-blue-50 text-lg font-semibold text-blue-600"
                  style={{ width: 48, height: 48 }}
                >
                  {item.step}
                </span>
                <div>
                  <h3 className="text-xl font-semibold text-slate-800">{item.title}</h3>
                  <p className="mt-2 text-base font-semibold leading-relaxed text-slate-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-wrap justify-center gap-4" style={{ marginTop: 48 }}>
          {featureBadges.map((feature) => {
            const Icon = feature.icon;

            return (
              <Badge
                key={feature.text}
                variant="outline"
                className="border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Icon className="mr-2 h-4 w-4" />
                {feature.text}
              </Badge>
            );
          })}
        </section>
      </main>
    </div>
  );
}
