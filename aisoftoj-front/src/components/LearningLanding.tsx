import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  ArrowRight,
  Award,
  BookOpen,
  Brain,
  Briefcase,
  CheckCircle,
  Clock,
  FileText,
  MapPin,
  PenTool,
  Quote,
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
    id: 1,
    title: '打基础',
    description: '系统学习基础知识，构建知识体系',
    icon: BookOpen,
    path: '/foundation',
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 2,
    title: '刷真题',
    description: '历年真题实战，查漏补缺',
    icon: FileText,
    path: '/papers',
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    id: 3,
    title: '论文冲刺',
    description: 'AI 批改论文，提升写作能力',
    icon: PenTool,
    path: '/essay-sprint',
    color: 'from-violet-500 to-violet-600',
  },
];

const features = [
  { icon: Target, text: '2 个月冲刺节奏' },
  { icon: TrendingUp, text: '真题优先' },
  { icon: Brain, text: '错题复盘' },
  { icon: Award, text: 'AI 论文批改' },
];

const steps = [
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
];

export function LearningLanding({ onShowAuth, onShowProfile }: LearningLandingProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <AppHeader onShowAuth={onShowAuth} onShowProfile={onShowProfile} />

      <div className="max-w-7xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl text-slate-800 mb-6">
            软考备考，从路径开始。
          </h1>
          <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
            不靠玄学，靠路径。把 2 个月备考拆成三条清晰路线，
            每条路线有对应工具支撑，专为碎片时间设计
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate('/papers')}
              className="bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all px-8 py-6 text-lg"
            >
              <Zap className="w-5 h-5 mr-2" />
              直接刷真题
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/foundation')}
              className="border-slate-300 hover:bg-slate-50 px-8 py-6 text-lg"
            >
              <BookOpen className="w-5 h-5 mr-2" />
              先看备考路径
            </Button>
          </div>
        </div>

        {/* 三条路线卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {learningPaths.map((path) => {
            const Icon = path.icon;
            return (
              <Card
                key={path.id}
                className="group hover:shadow-2xl transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-slate-200"
                onClick={() => navigate(path.path)}
              >
                <CardContent className="p-8">
                  <div
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${path.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}
                  >
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl text-slate-800">
                        {String(path.id).padStart(2, '0')} {path.title}
                      </h3>
                    </div>
                  </div>
                  <p className="text-slate-600 mb-6">{path.description}</p>
                  <div className="flex items-center text-blue-600 group-hover:translate-x-2 transition-transform">
                    <span className="mr-2">开始学习</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 作者经历 */}
        <div className="mb-16">
          <Card className="bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-200/50 shadow-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="relative">
                {/* 装饰性引号 */}
                <div className="absolute top-8 left-8 opacity-10">
                  <Quote className="w-24 h-24 text-amber-600" />
                </div>

                <div className="relative p-8 md:p-12">
                  {/* 标签 */}
                  <div className="flex items-center gap-3 mb-6">
                    <Badge className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5">
                      作者经历
                    </Badge>
                    <Badge variant="outline" className="border-amber-300 text-amber-700 px-4 py-1.5">
                      真实备考路径
                    </Badge>
                  </div>

                  {/* 作者信息 */}
                  <div className="flex flex-wrap items-center gap-4 mb-6 text-slate-700">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-amber-600" />
                      <span>23 届计算机 · 后端开发</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-amber-600" />
                      <span>目标：杭州 E 类人才</span>
                    </div>
                  </div>

                  {/* 核心内容 */}
                  <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-amber-200/50">
                    <p className="text-lg md:text-xl text-slate-700 leading-relaxed mb-4">
                      工作一年后备考架构师。
                    </p>
                    <p className="text-lg md:text-xl text-slate-700 leading-relaxed mb-4">
                      两个月，分三个阶段：
                      <span className="text-amber-700 font-medium">
                        前四周快速过知识点，第五六周只刷近五年真题，最后两周准备一个万金油项目覆盖几个论文主题。
                      </span>
                    </p>
                    <p className="text-lg md:text-xl text-slate-700 leading-relaxed mb-6">
                      最终
                      <span className="text-amber-700 font-medium">综合知识、案例、论文全部通过。</span>
                    </p>
                    <div className="pt-4 border-t border-amber-200">
                      <p className="text-base text-slate-600 italic">这套路径直接做进了平台里。</p>
                    </div>
                  </div>

                  {/* 成果展示 */}
                  <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-amber-200/50 text-center">
                      <p className="text-2xl text-amber-700 mb-1">✓</p>
                      <p className="text-sm text-slate-600">综合知识通过</p>
                    </div>
                    <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-amber-200/50 text-center">
                      <p className="text-2xl text-amber-700 mb-1">✓</p>
                      <p className="text-sm text-slate-600">案例分析通过</p>
                    </div>
                    <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-amber-200/50 text-center">
                      <p className="text-2xl text-amber-700 mb-1">✓</p>
                      <p className="text-sm text-slate-600">论文写作通过</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 方法论说明 */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-8 md:p-12 mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl text-slate-800 mb-4">为什么这样排？</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              基于实战经验总结的备考路径，帮助在职工程师在碎片时间高效备考
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((item, index) => (
              <div key={item.step} className="relative">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-lg">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="text-xl text-slate-800 mb-2">{item.title}</h3>
                    <p className="text-slate-600">{item.description}</p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-full w-full h-0.5 bg-gradient-to-r from-blue-200 to-transparent -translate-x-4" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 特性标签 */}
        <div className="flex flex-wrap justify-center gap-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Badge
                key={feature.text}
                variant="outline"
                className="px-6 py-3 text-base border-slate-300 bg-white hover:bg-slate-50 transition-colors"
              >
                <Icon className="w-4 h-4 mr-2" />
                {feature.text}
              </Badge>
            );
          })}
        </div>

        {/* 底部统计 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-4" />
              <p className="text-3xl mb-2">85%</p>
              <p className="text-blue-100">学员通过率</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0">
            <CardContent className="p-8 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4" />
              <p className="text-3xl mb-2">5,000+</p>
              <p className="text-emerald-100">历年真题</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-violet-500 to-violet-600 text-white border-0">
            <CardContent className="p-8 text-center">
              <Clock className="w-12 h-12 mx-auto mb-4" />
              <p className="text-3xl mb-2">2 个月</p>
              <p className="text-violet-100">冲刺周期</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
