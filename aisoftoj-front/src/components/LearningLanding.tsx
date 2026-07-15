import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CircleCheck,
  FileText,
  PenTool,
  Quote,
  Route,
  Sparkles,
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
    description: '系统梳理核心知识点，先搭起完整的知识框架。',
    icon: BookOpen,
    path: '/foundation',
    enabled: false,
    iconClass: 'bg-slate-300',
  },
  {
    id: '02',
    title: '刷真题',
    description: '用历年真题检验掌握程度，边做边完成查漏补缺。',
    icon: FileText,
    path: '/papers',
    enabled: true,
    iconClass: 'bg-emerald-600 shadow-emerald-600/20',
  },
  {
    id: '03',
    title: '论文冲刺',
    description: '围绕真实题目集中练习写作，沉淀稳定的论文表达。',
    icon: PenTool,
    path: '/essay-sprint',
    enabled: false,
    iconClass: 'bg-slate-300',
  },
] as const;

const methodSteps = [
  {
    step: '01',
    title: '按科目筛选真题',
    description: '从真实、已发布的历年试卷中按科目与题型筛选，快速确定当前练习范围。',
  },
  {
    step: '02',
    title: '选择合适的模式',
    description: '练习模式用于逐题理解，考试模式用于完整模拟，根据当前目标随时切换。',
  },
  {
    step: '03',
    title: '回到错题持续复盘',
    description: '完成练习后沉淀刷题记录与错题，集中复盘薄弱知识点，让每次练习都有反馈。',
  },
] as const;

const experienceHighlights = ['综合知识通过', '案例分析通过', '论文写作通过'] as const;

const capabilities = [
  { value: '历年', label: '真题目录' },
  { value: '2 种', label: '双模式刷题' },
  { value: '持续', label: '错题沉淀' },
] as const;

export function LearningLanding({ onShowAuth, onShowProfile }: LearningLandingProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-white text-slate-950">
      <AppHeader onShowAuth={onShowAuth} onShowProfile={onShowProfile} />

      <main id="main-content">
        <section className="relative overflow-hidden px-4 pb-12 pt-14 sm:px-6 sm:pb-16 sm:pt-20 lg:px-8 lg:pt-24">
          <div className="relative z-10 mx-auto max-w-6xl text-center">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-4 py-2 text-sm font-medium text-blue-800 shadow-sm">
              <Route className="h-4 w-4" aria-hidden="true" />
              真题优先 · 给在职工程师的高效备考方式
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              先刷真题，再精准补弱项。
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
              从真实历年试卷开始，用练习与考试双模式校准水平，
              再通过刷题记录和错题复盘，把碎片时间沉淀成稳定进度。
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                to="/papers"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-base font-semibold text-white no-underline shadow-lg shadow-blue-600/20 outline-none transition-transform duration-200 hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4 motion-reduce:transform-none"
              >
                <Zap className="h-5 w-5" aria-hidden="true" />
                查看历年真题
              </Link>
              <a
                href="#learning-paths"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-base font-semibold text-slate-800 no-underline shadow-sm outline-none transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4"
              >
                <BookOpen className="h-5 w-5" aria-hidden="true" />
                了解刷题方式
              </a>
            </div>
          </div>
        </section>

        <section id="learning-paths" className="scroll-mt-24 px-4 pb-12 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 md:grid-cols-3 lg:gap-6">
            {learningPaths.map((path) => {
              const Icon = path.icon;
              const content = (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <span className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg ${path.iconClass}`}>
                      <Icon className="h-7 w-7" aria-hidden="true" />
                    </span>
                    {!path.enabled && (
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                        暂未开放
                      </span>
                    )}
                  </div>
                  <h2 className={`mt-7 text-2xl font-semibold tracking-tight ${path.enabled ? 'text-slate-900' : 'text-slate-500'}`}>
                    <span className="mr-2 text-slate-400">{path.id}</span>
                    {path.title}
                  </h2>
                  <p className={`mt-3 max-w-sm text-base leading-7 ${path.enabled ? 'text-slate-600' : 'text-slate-400'}`}>
                    {path.description}
                  </p>
                  {path.enabled ? (
                    <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-emerald-700">
                      查看历年真题
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden="true" />
                    </span>
                  ) : (
                    <span className="mt-auto pt-6 text-sm font-medium text-slate-400">功能筹备中</span>
                  )}
                </>
              );

              if (!path.enabled) {
                return (
                  <article
                    key={path.id}
                    aria-disabled="true"
                    className="flex cursor-not-allowed flex-col rounded-2xl border border-slate-200 bg-slate-50/80 p-6 text-left shadow-sm sm:p-7"
                    style={{ minHeight: 256 }}
                  >
                    {content}
                  </article>
                );
              }

              return (
                <Link
                  key={path.id}
                  to={path.path}
                  className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 text-left no-underline shadow-sm outline-none transition-all duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4 motion-reduce:transform-none sm:p-7"
                  style={{ minHeight: 256 }}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm lg:grid-cols-3">
            <div className="relative bg-amber-50 p-7 sm:p-10 lg:col-span-1 lg:p-12">
              <Quote className="h-10 w-10 text-amber-600" aria-hidden="true" />
              <p className="mt-8 text-sm font-semibold uppercase tracking-widest text-amber-800">作者经历</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-slate-950">真实走过，才整理成这条路径。</h2>
              <p className="mt-5 text-base leading-7 text-amber-800">23 届计算机 · 后端开发<br />目标：杭州 E 类人才</p>
            </div>

            <div className="p-7 sm:p-10 lg:col-span-2 lg:p-12">
              <div className="max-w-3xl space-y-5 text-base leading-8 text-slate-700 sm:text-lg">
                <p className="font-medium text-slate-900">工作一年后备考系统架构设计师。</p>
                <p>
                  两个月分三个阶段：前四周快速过知识点，第五、六周只刷近五年真题，最后两周准备一个可以覆盖多个主题的项目素材。
                </p>
                <p>最终综合知识、案例分析、论文写作全部通过。现在先把最有效的真题筛选与复盘方式做进平台。</p>
              </div>

              <div className="mt-9 grid gap-3 sm:grid-cols-3">
                {experienceHighlights.map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-4 text-sm font-semibold text-amber-800">
                    <CircleCheck className="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                刷题方式
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">怎样把真题刷出效果？</h2>
              <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
                先选对试卷，再用合适模式完成练习，最后回到错题集中复盘，让有限时间花在真正影响通过率的事情上。
              </p>
            </div>

            <div className="mt-12 grid gap-8 border-t border-slate-200 pt-10 md:grid-cols-3">
              {methodSteps.map((item) => (
                <article key={item.step} className="relative pr-5">
                  <span className="text-sm font-semibold tracking-widest text-blue-600">{item.step}</span>
                  <h3 className="mt-4 text-xl font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-3 text-base leading-7 text-slate-600">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-0">
            {capabilities.map((item, index) => (
              <div key={item.label} className={`text-center ${index > 0 ? 'sm:border-l sm:border-slate-200' : ''}`}>
                <div className="text-3xl font-semibold tracking-tight text-slate-950">{item.value}</div>
                <div className="mt-2 text-sm font-medium text-slate-500">{item.label}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
