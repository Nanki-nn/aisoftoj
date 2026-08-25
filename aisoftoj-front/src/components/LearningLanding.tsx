import React from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Brain,
  Briefcase,
  CheckCircle,
  Clock,
  ExternalLink,
  FileText,
  MapPin,
  PenTool,
  Quote,
  Star,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { AppHeader } from './AppHeader';
import { Badge } from './ui/badge';

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
    path: 'https://www.yuque.com/jiangnan-3o7ge/psketn/qhzlsv6emvy1rz9i',
    color: 'from-blue-500 to-blue-600',
    enabled: true,
    external: true,
  },
  {
    id: '02',
    title: '刷真题',
    description: '历年真题实战，查漏补缺',
    icon: FileText,
    path: '/papers',
    color: 'from-emerald-500 to-emerald-600',
    enabled: true,
    external: false,
  },
  {
    id: '03',
    title: '论文冲刺',
    description: '打磨一个项目，复用多个论文主题',
    icon: PenTool,
    path: 'https://www.yuque.com/jiangnan-3o7ge/psketn/crwg7ayq7zf5si6z',
    color: 'from-violet-500 to-violet-600',
    enabled: true,
    external: true,
  },
] as const;

const features = [
  { icon: Target, text: '2 个月冲刺节奏' },
  { icon: TrendingUp, text: '真题优先' },
  { icon: Brain, text: '错题复盘' },
  { icon: Award, text: 'AI 论文批改' },
] as const;

const methodSteps = [
  {
    step: '01',
    title: '打基础',
    description: '系统整理的备考笔记，按模块分类，快速建立知识框架',
  },
  {
    step: '02',
    title: '刷真题',
    description: '历年真题精选，支持练习模式和考试模式，即时反馈',
  },
  {
    step: '03',
    title: '论文冲刺',
    description: 'AI 智能批改，六维评分，针对性改进建议',
  },
] as const;

const outcomes = ['综合知识通过', '案例分析通过', '论文写作通过'] as const;

export function LearningLanding({ onShowAuth, onShowProfile }: LearningLandingProps) {
  return (
    <div className="min-h-screen text-slate-950">
      <AppHeader onShowAuth={onShowAuth} onShowProfile={onShowProfile} />

      <main id="main-content" className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h1 className="mb-6 text-5xl font-medium leading-tight text-slate-800 md:text-6xl">
              软考备考，从路径开始。
            </h1>
            <p className="mx-auto mb-8 max-w-3xl text-xl leading-8 text-slate-600">
              不靠玄学，靠路径。把 2 个月备考拆成三条清晰路线，每条路线有对应工具支撑，专为碎片时间设计
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/papers"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-lg bg-blue-600 px-8 text-lg font-medium text-white no-underline shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <Zap className="h-5 w-5" aria-hidden="true" />
                直接刷真题
              </Link>
              <a
                href="#exam-experience"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-8 text-lg font-medium text-slate-800 no-underline shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <BookOpen className="h-5 w-5" aria-hidden="true" />
                先看备考路径
              </a>
            </div>
          </div>

          <div className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-3">
            {learningPaths.map((path) => {
              const Icon = path.icon;
              const cardClassName = `group rounded-xl border-2 border-transparent bg-white text-left no-underline shadow-sm outline-none transition-all duration-300 ${
                path.enabled
                  ? 'cursor-pointer hover:border-slate-200 hover:shadow-2xl focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4'
                  : 'cursor-not-allowed'
              }`;
              const cardContent = (
                <div className="p-8">
                  <div className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${path.color} transition-transform duration-300 ${path.enabled ? 'group-hover:scale-110' : ''}`}>
                    <Icon className="h-8 w-8 text-white" aria-hidden="true" />
                  </div>
                  <h2 className="mb-4 text-2xl font-medium text-slate-800">
                    {path.id} {path.title}
                  </h2>
                  <p className="mb-6 text-slate-600">{path.description}</p>
                </div>
              );

              if (!path.enabled) {
                return (
                  <article key={path.id} aria-disabled="true" className={cardClassName}>
                    {cardContent}
                  </article>
                );
              }

              if (path.external) {
                return (
                  <a
                    key={path.id}
                    href={path.path}
                    target="_blank"
                    rel="noreferrer"
                    className={cardClassName}
                  >
                    {cardContent}
                    <span className="sr-only">（在新标签页打开）</span>
                  </a>
                );
              }

              return (
                <Link
                  key={path.id}
                  to={path.path}
                  className={cardClassName}
                >
                  {cardContent}
                </Link>
              );
            })}
          </div>

          <section id="exam-experience" className="mb-16 scroll-mt-24">
            <article className="overflow-hidden rounded-xl border-2 border-amber-200/50 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 shadow-xl">
              <div className="relative p-8 md:p-12">
                <div className="pointer-events-none absolute left-8 top-8 opacity-10">
                  <Quote className="h-24 w-24 text-amber-600" aria-hidden="true" />
                </div>

                <div className="relative">
                  <div className="mb-6 flex flex-wrap items-center gap-3">
                    <Badge className="bg-amber-600 px-4 py-1.5 text-white hover:bg-amber-700">作者经历</Badge>
                    <Badge variant="outline" className="border-amber-300 px-4 py-1.5 text-amber-700">真实备考路径</Badge>
                  </div>

                  <div className="mb-6 flex flex-wrap items-center gap-4 text-slate-700">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-amber-600" aria-hidden="true" />
                      <span>23 届计算机 · 后端开发</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-amber-600" aria-hidden="true" />
                      <span>目标：杭州 E 类人才</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-200/50 bg-white/60 p-6 backdrop-blur-sm md:p-8">
                    <p className="mb-4 text-lg leading-relaxed text-slate-700 md:text-xl">工作一年后备考架构师。</p>
                    <p className="mb-4 text-lg leading-relaxed text-slate-700 md:text-xl">
                      两个月，分三个阶段：<span className="font-medium text-amber-700">前四周快速过知识点，第五六周只刷近五年真题，最后两周准备一个万金油项目覆盖几个论文主题。</span>
                    </p>
                    <p className="mb-6 text-lg leading-relaxed text-slate-700 md:text-xl">
                      最终<span className="font-medium text-amber-700">综合知识、案例、论文全部通过。</span>
                    </p>
                    <div className="border-t border-amber-200 pt-4">
                      <p className="text-base italic text-slate-600">这套路径直接做进了平台里。</p>
                    </div>
                    <a
                      href="https://github.com/Nanki-nn/aisoftoj/blob/main/guides/%E7%B3%BB%E7%BB%9F%E6%9E%B6%E6%9E%84%E5%B8%88%E5%A4%87%E8%80%83%E7%BB%8F%E9%AA%8C.md"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-6 inline-flex items-center gap-2 border-b border-amber-300 pb-1 text-sm font-semibold text-amber-800 no-underline transition-colors hover:border-amber-600 hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-4"
                    >
                      阅读完整备考经验
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">（在新标签页打开）</span>
                    </a>
                  </div>

                  <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                    {outcomes.map((outcome) => (
                      <div key={outcome} className="rounded-lg border border-amber-200/50 bg-white/60 p-4 text-center backdrop-blur-sm">
                        <p className="mb-1 text-2xl text-amber-700">✓</p>
                        <p className="text-sm text-slate-600">{outcome}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <div className="mt-8 flex flex-col gap-4 rounded-xl border border-amber-300 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold text-amber-800">觉得项目有帮助？</p>
              <a
                href="https://github.com/Nanki-nn/aisoftoj"
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-5 py-3 text-sm font-semibold text-white no-underline shadow-sm transition-colors hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 sm:w-auto"
              >
                <Star className="h-4 w-4 fill-current" aria-hidden="true" />
                去 GitHub 点 Star
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">（在新标签页打开）</span>
              </a>
            </div>
          </section>

          <section className="mb-16 rounded-2xl border border-slate-200/50 bg-white p-8 shadow-lg md:p-12">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-medium text-slate-800">为什么这样排？</h2>
              <p className="mx-auto max-w-2xl text-lg text-slate-600">基于实战经验总结的备考路径，帮助在职工程师在碎片时间高效备考</p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {methodSteps.map((methodStep, index) => (
                <div key={methodStep.step} className="relative">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg text-blue-600">
                      {methodStep.step}
                    </div>
                    <div>
                      <h3 className="mb-2 text-xl font-medium text-slate-800">{methodStep.title}</h3>
                      <p className="text-slate-600">{methodStep.description}</p>
                    </div>
                  </div>
                  {index < methodSteps.length - 1 && (
                    <div className="absolute left-full top-6 hidden h-0.5 w-full -translate-x-4 bg-gradient-to-r from-blue-200 to-transparent md:block" />
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="mb-16 flex flex-wrap justify-center gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Badge key={feature.text} variant="outline" className="bg-white px-6 py-3 text-base text-slate-700 transition-colors hover:bg-slate-50">
                  <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                  {feature.text}
                </Badge>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <div className="p-8 text-center">
                <CheckCircle className="mx-auto mb-4 h-12 w-12" aria-hidden="true" />
                <p className="mb-2 text-3xl font-medium">85%</p>
                <p className="text-blue-100">学员通过率</p>
              </div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
              <div className="p-8 text-center">
                <FileText className="mx-auto mb-4 h-12 w-12" aria-hidden="true" />
                <p className="mb-2 text-3xl font-medium">5,000+</p>
                <p className="text-emerald-100">历年真题</p>
              </div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white">
              <div className="p-8 text-center">
                <Clock className="mx-auto mb-4 h-12 w-12" aria-hidden="true" />
                <p className="mb-2 text-3xl font-medium">2 个月</p>
                <p className="text-violet-100">冲刺周期</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
