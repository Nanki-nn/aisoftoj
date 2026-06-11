import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Brain, Calculator, ClipboardCheck, Layers3, Map } from 'lucide-react';
import { AppHeader } from './AppHeader';
import { Button } from './ui/button';

interface FoundationPageProps {
  onShowAuth: () => void;
  onShowProfile: () => void;
}

const modules = [
  { title: '计算机组成与系统基础', tag: '上午题', icon: Calculator, points: ['进制与编码', '流水线', '存储层次'] },
  { title: '软件工程与架构基础', tag: '核心', icon: Layers3, points: ['设计模式', '质量属性', '架构风格'] },
  { title: '项目管理与案例材料', tag: '下午题', icon: ClipboardCheck, points: ['进度成本', '风险质量', '案例拆解'] },
  { title: '知识网络复盘', tag: '复习', icon: Map, points: ['关键词', '错题归因', '考频回看'] },
];

export function FoundationPage({ onShowAuth, onShowProfile }: FoundationPageProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f6f7f2] text-slate-900">
      <AppHeader onShowAuth={onShowAuth} onShowProfile={onShowProfile} />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="border border-slate-900/10 bg-white p-7 shadow-sm lg:p-9">
            <div className="mb-7 inline-flex items-center gap-2 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
              <BookOpen className="h-4 w-4" />
              打基础
            </div>
            <h1 className="text-[clamp(2.2rem,5.6vw,4.6rem)] font-semibold leading-[0.95] text-slate-950">
              先把知识点，
              <span className="block">整理成能拿分的形状。</span>
            </h1>
            <p className="mt-6 max-w-xl text-[1.05rem] leading-8 text-slate-600">
              基础阶段只做三件事：建立知识框架、记高频结论、练固定题型。目标不是学完所有资料，而是知道每类题该往哪里想。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={() => navigate('/papers')}
                className="h-12 rounded-[4px] bg-blue-700 px-6 text-white hover:bg-blue-800"
              >
                学完去刷真题
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/')}
                className="h-12 rounded-[4px] border-slate-900/20 bg-white px-6"
              >
                返回路径
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {modules.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="group bg-white p-6 shadow-sm ring-1 ring-slate-900/8 transition-transform duration-300 hover:-translate-y-0.5">
                  <div className="mb-8 flex items-center justify-between">
                    <Icon className="h-7 w-7 text-blue-700" />
                    <span className="bg-slate-100 px-2.5 py-1 text-xs text-slate-500">{item.tag}</span>
                  </div>
                  <h2 className="text-xl font-semibold leading-tight text-slate-950">{item.title}</h2>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {item.points.map((point) => (
                      <span key={point} className="border border-slate-900/10 px-2.5 py-1 text-xs text-slate-600">
                        {point}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-8 grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
          {[
            ['01', '每天 40 分钟过知识卡', '不要边看边收藏，今天能复述的才算学过。'],
            ['02', '每章只留一页复盘纸', '把定义、公式、易错点压到一页，考前才能翻得动。'],
            ['03', '遇到真题再回补概念', '不会的知识点回到框架里补洞，不重新开一条资料线。'],
          ].map(([step, title, desc]) => (
            <div key={step} className="bg-[#fffdf3] p-6 shadow-sm ring-1 ring-slate-900/8">
              <div className="mb-8 text-sm font-semibold text-amber-700">{step}</div>
              <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{desc}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 overflow-hidden bg-slate-950 text-white shadow-sm ring-1 ring-slate-900/8">
          <div className="grid gap-0 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="p-7 lg:p-9">
              <Brain className="mb-6 h-8 w-8 text-blue-300" />
              <h2 className="text-2xl font-semibold">基础阶段的合格线</h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">
                看到题干能判断考点，看到错题能说出原因，看到论文主题能想到项目素材。
              </p>
            </div>
            <div className="grid border-t border-white/10 sm:grid-cols-3 lg:border-l lg:border-t-0">
              {['能分类', '能复述', '能迁移'].map((item) => (
                <div key={item} className="border-b border-white/10 p-7 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
                  <div className="text-3xl font-semibold text-blue-200">{item}</div>
                  <p className="mt-3 text-sm text-slate-400">比“看完一遍”更可靠</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
