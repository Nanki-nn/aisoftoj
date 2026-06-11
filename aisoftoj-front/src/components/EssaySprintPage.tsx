import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FilePenLine, Gauge, NotebookPen, PenTool, SearchCheck, Sparkles } from 'lucide-react';
import { AppHeader } from './AppHeader';
import { Button } from './ui/button';

interface EssaySprintPageProps {
  onShowAuth: () => void;
  onShowProfile: () => void;
}

const sprintBlocks = [
  { title: '项目底稿', desc: '准备一个可复用项目，提前写清背景、目标、架构和难点。', icon: NotebookPen },
  { title: '主题套写', desc: '围绕质量属性、架构设计、项目管理等主题拆成可替换段落。', icon: PenTool },
  { title: 'AI 批改', desc: '检查结构、论点密度、字数节奏和题目贴合度。', icon: SearchCheck },
  { title: '考场节奏', desc: '训练开头、主体、结尾的时间分配，减少临场卡壳。', icon: Gauge },
];

export function EssaySprintPage({ onShowAuth, onShowProfile }: EssaySprintPageProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#faf6ed] text-slate-900">
      <AppHeader onShowAuth={onShowAuth} onShowProfile={onShowProfile} />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <section className="overflow-hidden bg-white shadow-sm ring-1 ring-slate-900/8">
          <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
            <div className="p-7 lg:p-10">
              <div className="mb-8 inline-flex items-center gap-2 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                <FilePenLine className="h-4 w-4" />
                论文冲刺
              </div>
              <h1 className="max-w-3xl text-[clamp(2.35rem,6vw,4.8rem)] font-semibold leading-[0.92] text-slate-950">
                论文不是灵感题，
                <span className="block text-amber-700">是预案题。</span>
              </h1>
              <p className="mt-6 max-w-2xl text-[1.05rem] leading-8 text-slate-600">
                最后一阶段不再泛泛看范文，而是用一个项目底稿覆盖多个主题，反复写、反复改，把可复现的表达带上考场。
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={() => navigate('/essay')}
                  className="h-12 rounded-[4px] bg-amber-700 px-6 text-white hover:bg-amber-800"
                >
                  开始 AI 批改
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/papers')}
                  className="h-12 rounded-[4px] border-slate-900/20 bg-white px-6"
                >
                  先刷真题
                </Button>
              </div>
            </div>

            <div className="border-t border-slate-900/10 bg-slate-950 p-6 text-white lg:border-l lg:border-t-0 lg:p-8">
              <Sparkles className="mb-8 h-8 w-8 text-amber-300" />
              <div className="space-y-5">
                {[
                  ['开头', '背景 + 问题 + 本文主线'],
                  ['主体', '方法 + 过程 + 取舍 + 效果'],
                  ['结尾', '复盘 + 改进 + 个人职责'],
                ].map(([title, desc], index) => (
                    <div key={title} className="bg-white/[0.04] p-5 ring-1 ring-white/10">
                      <div className="mb-4 text-sm text-amber-200">0{index + 1}</div>
                      <h2 className="text-xl font-semibold">{title}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{desc}</p>
                    </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {sprintBlocks.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="bg-white p-6 shadow-sm ring-1 ring-slate-900/8">
                <Icon className="mb-7 h-7 w-7 text-amber-700" />
                <h2 className="text-lg font-semibold text-slate-950">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.desc}</p>
              </article>
            );
          })}
        </section>

        <section className="mt-8 bg-[#fff9e8] p-7 shadow-sm ring-1 ring-slate-900/8 lg:p-9">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-semibold text-amber-700">冲刺安排</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-950">
                一周三篇，不求多，求每篇都能改出下一版。
              </h2>
            </div>
            <div className="grid gap-3">
              {['第一篇：确认项目素材能不能撑住主题', '第二篇：压缩废话，提高论证密度', '第三篇：按考试时间完整写完'].map((item) => (
                <div key={item} className="flex items-center justify-between border border-slate-900/10 bg-white px-4 py-4 text-sm text-slate-700">
                  <span>{item}</span>
                  <ArrowRight className="h-4 w-4 text-amber-700" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
