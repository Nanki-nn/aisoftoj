import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookMarked,
  CheckCircle2,
  FileText,
  GraduationCap,
  PenLine,
  Play,
} from 'lucide-react';
import { AppHeader } from './AppHeader';

interface LearningLandingProps {
  onShowAuth: () => void;
  onShowProfile: () => void;
}

const paths = [
  {
    href: '/foundation',
    label: '打基础',
    step: '01',
    time: '第 1–4 周',
    title: '把高频知识点压成一张能复习的网',
    desc: '先抓高频概念、计算题套路和下午题常见材料，不追求面面俱到。',
    icon: BookMarked,
    sidebarClass: 'bg-blue-900',
    labelClass: 'text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40',
  },
  {
    href: '/papers',
    label: '刷真题',
    step: '02',
    time: '第 5–6 周',
    title: '近五年真题滚两遍，错题沉淀到最后一天',
    desc: '练习模式即时看解析，考试模式训练节奏，错题自动留下复盘线索。',
    icon: CheckCircle2,
    sidebarClass: 'bg-emerald-900',
    labelClass: 'text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40',
  },
  {
    href: '/essay-sprint',
    label: '论文冲刺',
    step: '03',
    time: '第 7–8 周',
    title: '准备一个万金油项目，反复改到能上考场',
    desc: '围绕架构、质量、管理等主题写作，用 AI 批改找结构和扣分点。',
    icon: PenLine,
    sidebarClass: 'bg-violet-900',
    labelClass: 'text-violet-800 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/40',
  },
];

const methodItems = [
  { icon: FileText, step: '01', title: '先建立框架', desc: '知道考什么，才不会被资料拖着走。' },
  { icon: CheckCircle2, step: '02', title: '再用真题校准', desc: '真题负责暴露漏洞，错题负责留证据。' },
  { icon: GraduationCap, step: '03', title: '最后练输出', desc: '论文要提前写，考场只负责复现。' },
];

export function LearningLanding({ onShowAuth, onShowProfile }: LearningLandingProps) {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    const raf = requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1)';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <AppHeader onShowAuth={onShowAuth} onShowProfile={onShowProfile} />

      <main>
        {/* Hero */}
        <section className="border-b border-slate-200 dark:border-slate-800">
          <div
            ref={heroRef}
            className="mx-auto max-w-7xl px-4 sm:px-6"
            style={{ paddingTop: '56px', paddingBottom: '64px' }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">

              {/* Left: headline */}
              <div className="lg:col-span-5">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase mb-8 text-blue-800 dark:text-blue-400" style={{ letterSpacing: '0.12em' }}>
                  <span className="inline-block w-6 h-0.5 bg-blue-800 dark:bg-blue-400" />
                  在职备考路径
                </div>

                <h1
                  className="font-bold leading-none text-slate-950 dark:text-white"
                  style={{ fontSize: 'clamp(44px, 5.5vw, 80px)', letterSpacing: '-0.03em', lineHeight: 1.05 }}
                >
                  软考备考，
                  <br />
                  <span className="text-blue-800 dark:text-blue-400">从路径开始。</span>
                </h1>

                <p className="mt-6 leading-relaxed text-slate-500 dark:text-slate-400" style={{ fontSize: '1.0625rem', maxWidth: 400 }}>
                  打基础、刷真题、论文冲刺拆成三条清晰路线。每天晚上推进一点，最后一周只做复盘和提分。
                </p>

                <div className="mt-10 flex flex-wrap gap-3">
                  <button
                    onClick={() => navigate('/papers')}
                    className="inline-flex items-center gap-2 font-semibold text-sm px-6 py-3 rounded-md bg-slate-950 dark:bg-white text-white dark:text-slate-950 hover:bg-blue-900 dark:hover:bg-slate-100 transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    直接刷真题
                  </button>
                  <button
                    onClick={() => navigate('/foundation')}
                    className="inline-flex items-center gap-2 font-medium text-sm px-6 py-3 rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-blue-800 dark:hover:border-blue-400 hover:text-blue-800 dark:hover:text-blue-400 transition-colors bg-transparent"
                  >
                    先看备考路径
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Proof tags */}
                <div className="mt-10 flex flex-wrap gap-2">
                  {['2 个月冲刺节奏', '真题优先', '错题复盘', 'AI 论文批改'].map(tag => (
                    <span
                      key={tag}
                      className="text-xs font-medium px-3 py-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right: path cards */}
              <div className="lg:col-span-7 flex flex-col gap-3">
                {paths.map((path) => {
                  const Icon = path.icon;
                  return (
                    <button
                      key={path.href}
                      onClick={() => navigate(path.href)}
                      className="group text-left w-full flex items-stretch rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-800 dark:hover:border-blue-500 hover:shadow-md transition-all hover:-translate-y-px overflow-hidden"
                    >
                      {/* Step sidebar */}
                      <div className={`w-14 shrink-0 flex flex-col items-center justify-between py-5 ${path.sidebarClass}`}>
                        <span
                          className="text-white/50 font-bold"
                          style={{ fontSize: '0.625rem', letterSpacing: '0.1em', writingMode: 'vertical-rl' }}
                        >
                          {path.step}
                        </span>
                        <Icon className="w-5 h-5 text-white/85" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 px-6 py-5 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase" style={{ letterSpacing: '0.06em' }}>
                            {path.time}
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${path.labelClass}`}>
                            {path.label}
                          </span>
                        </div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug mb-1.5">
                          {path.title}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                          {path.desc}
                        </p>
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center pr-5 text-slate-300 dark:text-slate-600">
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Method section */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6" style={{ paddingTop: 64, paddingBottom: 80 }}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
            <div className="lg:col-span-4">
              <p className="text-xs font-bold uppercase mb-4 text-blue-800 dark:text-blue-400" style={{ letterSpacing: '0.12em' }}>
                为什么这样排
              </p>
              <h2
                className="font-bold leading-tight text-slate-950 dark:text-white"
                style={{ fontSize: 'clamp(24px, 3vw, 36px)', letterSpacing: '-0.02em' }}
              >
                备考不是堆资料，是把每周任务变清楚。
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                作者本人 23 届计算机，工作一年后用 2 个月拿下架构师，这套备考路径直接做进了平台里。
              </p>
            </div>

            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              {methodItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"
                  >
                    <div className="w-9 h-9 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-5">
                      <Icon className="w-4.5 h-4.5 w-[18px] h-[18px] text-blue-800 dark:text-blue-400" />
                    </div>
                    <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2" style={{ letterSpacing: '0.1em' }}>
                      Step {item.step}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">{item.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
