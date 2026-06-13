import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  ArrowRight,
  Award,
  Brain,
  BriefcaseBusiness,
  BookOpen,
  Check,
  FileText,
  MapPin,
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

const experienceHighlights = [
  '综合知识通过',
  '案例分析通过',
  '论文写作通过',
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
    <div className="min-h-screen bg-blue-50 text-slate-900">
      <AppHeader onShowAuth={onShowAuth} onShowProfile={onShowProfile} />

      <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8" style={{ paddingTop: 72 }}>
        <section className="mx-auto max-w-6xl text-center">
          <h1
            className="font-semibold leading-tight text-slate-800"
            style={{ fontSize: 'clamp(2.5rem, 5vw, 4.4rem)' }}
          >
            软考备考，从路径开始。
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg font-semibold leading-relaxed text-slate-600 sm:text-xl">
            不靠玄学，靠路径。把 2 个月备考拆成三条清晰路线，
            每条路线有对应工具支撑，专为碎片时间设计
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
            <Button
              size="lg"
              onClick={() => navigate('/papers')}
              className="h-13 rounded-lg bg-blue-600 px-7 text-base font-semibold shadow-lg shadow-blue-600/20 hover:bg-blue-700 sm:h-14 sm:text-lg"
            >
              <Zap className="mr-2 h-5 w-5" />
              开始刷历年真题
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/foundation')}
              className="h-13 rounded-lg border-slate-300 bg-white px-7 text-base font-semibold text-slate-900 shadow-sm hover:bg-slate-50 sm:h-14 sm:text-lg"
            >
              <BookOpen className="mr-2 h-5 w-5" />
              先看备考路径
            </Button>
          </div>
        </section>

        <section className="grid scroll-mt-24 grid-cols-1 gap-6 lg:grid-cols-3" style={{ marginTop: 84 }}>
          {learningPaths.map((path) => {
            const Icon = path.icon;

            return (
              <button
                key={path.id}
                type="button"
                onClick={() => navigate(path.path)}
                className="group rounded-2xl bg-white p-7 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-8"
                style={{ minHeight: 284 }}
              >
                <span
                  className={`flex items-center justify-center rounded-2xl ${path.iconClass}`}
                  style={{ width: 64, height: 64 }}
                >
                  <Icon className="h-7 w-7 text-white" />
                </span>
                <h2 className="mt-8 text-2xl font-semibold text-slate-800 sm:text-3xl">
                  {path.id} {path.title}
                </h2>
                <p className="mt-5 text-base font-semibold text-slate-600 sm:text-lg">{path.description}</p>
                <span className="mt-8 inline-flex items-center gap-2 text-base font-semibold text-blue-600 transition-transform group-hover:translate-x-1 sm:text-lg">
                  开始学习
                  <ArrowRight className="h-5 w-5" />
                </span>
              </button>
            );
          })}
        </section>

        <section className="scroll-mt-24 rounded-2xl border border-amber-200 bg-white p-6 shadow-sm md:p-12" style={{ marginTop: 84 }}>
          <div className="flex flex-wrap gap-3">
            <Badge className="border-amber-200 bg-amber-600 px-4 py-2 text-white hover:bg-amber-600">
              作者经历
            </Badge>
            <Badge variant="outline" className="border-amber-300 bg-amber-50 px-4 py-2 text-amber-800">
              真实备考路径
            </Badge>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-base font-semibold text-slate-700">
            <span className="inline-flex items-center gap-2">
              <BriefcaseBusiness className="h-4 w-4 text-amber-700" />
              23 届计算机 · 后端开发
            </span>
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-amber-700" />
              目标：杭州 E 类人才
            </span>
          </div>

          <div className="mt-7 rounded-xl border border-amber-100 bg-amber-50/50 p-6 md:p-8">
            <p className="text-xl font-semibold leading-relaxed text-slate-800">
              工作一年后备考架构师。
            </p>
            <p className="mt-5 text-lg font-semibold leading-relaxed text-slate-700">
              两个月，分三个阶段：
              <span className="text-amber-800"> 前四周快速过知识点，第五六周只刷近五年真题，最后两周准备一个万金油项目覆盖几个论文主题。</span>
            </p>
            <p className="mt-5 text-lg font-semibold leading-relaxed text-slate-700">
              最终综合知识、案例、论文全部通过。
            </p>
            <div className="mt-7 border-t border-amber-200 pt-5 text-base font-semibold text-slate-600">
              这套路经直接做进了平台里。
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {experienceHighlights.map((item) => (
              <div key={item} className="flex min-h-20 items-center justify-center rounded-xl border border-amber-100 bg-white px-5 text-center font-semibold text-slate-700">
                <Check className="mr-2 h-6 w-6 text-amber-700" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-12" style={{ marginTop: 64 }}>
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
