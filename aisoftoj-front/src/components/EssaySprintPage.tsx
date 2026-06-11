import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  ArrowRight,
  Award,
  ExternalLink,
  FileText,
  Lightbulb,
  PenTool,
} from 'lucide-react';
import { supportedSubjects } from '../data/examPapers';
import { AppHeader } from './AppHeader';

interface EssaySprintPageProps {
  onShowAuth: () => void;
  onShowProfile: () => void;
}

interface EssayExample {
  title: string;
  topic: string;
  summary: string;
  githubUrl: string;
  tags: string[];
  subjects: string[];
}

const essayExamples: EssayExample[] = [
  {
    title: '论软件架构风格的选择与应用',
    topic: '架构设计',
    summary: '结合项目实践，讨论如何根据业务需求选择合适的架构风格（如分层架构、微服务架构等），并分析其优缺点',
    githubUrl: 'https://github.com/Nanki-nn/aisoftoj',
    tags: ['架构风格', '分层架构', '微服务'],
    subjects: ['系统架构设计师', '系统分析师'],
  },
  {
    title: '论软件系统的可靠性设计',
    topic: '质量属性',
    summary: '探讨如何通过冗余设计、容错机制、故障恢复等手段提升软件系统的可靠性',
    githubUrl: 'https://github.com/Nanki-nn/aisoftoj',
    tags: ['可靠性', '容错', '高可用'],
    subjects: ['系统架构设计师', '系统分析师', '软件设计师'],
  },
  {
    title: '论软件系统的性能优化',
    topic: '质量属性',
    summary: '分析性能瓶颈识别方法，讨论缓存策略、数据库优化、负载均衡等性能优化手段',
    githubUrl: 'https://github.com/Nanki-nn/aisoftoj',
    tags: ['性能优化', '缓存', '负载均衡'],
    subjects: ['系统架构设计师', '软件设计师', '系统分析师'],
  },
  {
    title: '论大型项目的质量管理',
    topic: '项目管理',
    summary: '结合实际项目经验，讨论质量计划、质量保证、质量控制的实施方法',
    githubUrl: 'https://github.com/Nanki-nn/aisoftoj',
    tags: ['质量管理', 'QA', '测试'],
    subjects: ['信息系统项目管理师', '系统分析师'],
  },
  {
    title: '论软件项目的风险管理',
    topic: '项目管理',
    summary: '探讨风险识别、风险评估、风险应对的方法，结合案例说明风险管理的重要性',
    githubUrl: 'https://github.com/Nanki-nn/aisoftoj',
    tags: ['风险管理', '项目管理', 'PMBOK'],
    subjects: ['信息系统项目管理师', '系统分析师'],
  },
  {
    title: '论分布式系统的设计与实现',
    topic: '架构设计',
    summary: '讨论分布式系统的特点、挑战以及设计原则，包括一致性、可用性、分区容错性的权衡',
    githubUrl: 'https://github.com/Nanki-nn/aisoftoj',
    tags: ['分布式', 'CAP', '一致性'],
    subjects: ['系统架构设计师', '系统分析师'],
  },
];

const topicColors: Record<string, string> = {
  架构设计: 'bg-blue-100 text-blue-700 border-blue-200',
  质量属性: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  项目管理: 'bg-violet-100 text-violet-700 border-violet-200',
};

export function EssaySprintPage({ onShowAuth, onShowProfile }: EssaySprintPageProps) {
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState<string>('全部科目');

  const filteredEssays =
    selectedSubject === '全部科目'
      ? essayExamples
      : essayExamples.filter((e) => e.subjects.includes(selectedSubject));

  return (
    <div className="min-h-screen bg-white">
      <AppHeader onShowAuth={onShowAuth} onShowProfile={onShowProfile} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <PenTool className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl text-slate-800">论文冲刺</h1>
          </div>
        </div>

        {/* 科目选择器 */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedSubject === '全部科目' ? 'default' : 'outline'}
              onClick={() => setSelectedSubject('全部科目')}
              className={selectedSubject === '全部科目' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              全部科目
            </Button>
            {supportedSubjects.map((subject) => (
              <Button
                key={subject}
                variant={selectedSubject === subject ? 'default' : 'outline'}
                onClick={() => setSelectedSubject(subject)}
                className={selectedSubject === subject ? 'bg-blue-600 hover:bg-blue-700' : ''}
              >
                {subject}
              </Button>
            ))}
          </div>
        </div>

        {/* 统计信息 */}
        <div className="flex items-center gap-4 mb-8">
          <Badge variant="outline" className="px-4 py-2 text-base">
            <FileText className="w-4 h-4 mr-2" />
            共 {filteredEssays.length} 篇论文案例
          </Badge>
          <Badge variant="outline" className="px-4 py-2 text-base">
            <ExternalLink className="w-4 h-4 mr-2" />
            点击卡片跳转 GitHub
          </Badge>
        </div>

        {/* 论文案例列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {filteredEssays.map((essay, index) => (
            <Card
              key={`${essay.title}-${index}`}
              className="group hover:shadow-xl transition-all duration-300 cursor-pointer border border-slate-200/50 hover:border-slate-300"
              onClick={() => window.open(essay.githubUrl, '_blank')}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between mb-3">
                  <Badge
                    variant="secondary"
                    className={topicColors[essay.topic] || 'bg-slate-100 text-slate-700 border-slate-200'}
                  >
                    {essay.topic}
                  </Badge>
                  <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </div>
                <CardTitle className="text-lg group-hover:text-blue-600 transition-colors leading-relaxed">
                  {essay.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-slate-600 mb-4 text-sm leading-relaxed">{essay.summary}</p>
                <div className="flex flex-wrap gap-2">
                  {essay.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs border-slate-200 text-slate-600">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* AI批改CTA */}
        <Card className="bg-gradient-to-br from-violet-500 to-violet-600 text-white border-0 mb-8">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <Lightbulb className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl">AI 论文批改</h3>
                </div>
                <p className="text-violet-100 mb-4">
                  智能分析你的论文，提供六维评分和针对性改进建议
                </p>
                <div className="flex flex-wrap gap-3">
                  <Badge variant="secondary" className="bg-white/20 border-white/30 text-white">
                    <Award className="w-3 h-3 mr-1" />
                    六维评分
                  </Badge>
                  <Badge variant="secondary" className="bg-white/20 border-white/30 text-white">
                    <FileText className="w-3 h-3 mr-1" />
                    详细建议
                  </Badge>
                  <Badge variant="secondary" className="bg-white/20 border-white/30 text-white">
                    <PenTool className="w-3 h-3 mr-1" />
                    快速提升
                  </Badge>
                </div>
              </div>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => navigate('/essay')}
                className="bg-white text-violet-600 hover:bg-violet-50 px-8"
              >
                用 AI 批改我的论文
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 论文写作技巧 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border border-slate-200/50">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg text-slate-800 mb-2">摘要写作</h3>
              <p className="text-slate-600 text-sm">
                280-320字，概括项目背景、采用技术、取得成效
              </p>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/50">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <PenTool className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-lg text-slate-800 mb-2">正文结构</h3>
              <p className="text-slate-600 text-sm">
                2000-3000字，项目概述、技术应用、问题解决、总结反思
              </p>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/50">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mb-4">
                <Award className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-lg text-slate-800 mb-2">评分标准</h3>
              <p className="text-slate-600 text-sm">
                题目贴合度、技术深度、论据充分性、语言流畅度
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
