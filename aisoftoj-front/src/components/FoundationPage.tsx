import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  ArrowRight,
  Book,
  BookOpen,
  Code,
  Cpu,
  Database,
  ExternalLink,
  FileText,
  Network,
  Shield,
  Video,
} from 'lucide-react';
import { supportedSubjects } from '../data/examPapers';
import { AppHeader } from './AppHeader';

interface FoundationPageProps {
  onShowAuth: () => void;
  onShowProfile: () => void;
}

interface Material {
  title: string;
  description: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  url: string;
  tags: string[];
  subjects: string[];
  type: 'video' | 'note';
}

const materials: Material[] = [
  // 视频资源
  {
    title: '软件架构设计精讲',
    description: '系统讲解架构风格、设计模式、架构评估方法，配合实战案例',
    category: '架构设计',
    icon: Code,
    url: 'https://www.bilibili.com/video/architecture-design',
    tags: ['架构风格', '设计模式', 'ATAM'],
    subjects: ['系统架构设计师', '系统分析师', '软件设计师'],
    type: 'video',
  },
  {
    title: '质量属性与架构策略',
    description: '深入解析性能、可靠性、安全性等质量属性的架构设计策略',
    category: '质量属性',
    icon: Shield,
    url: 'https://www.bilibili.com/video/quality-attributes',
    tags: ['性能', '可靠性', '安全性'],
    subjects: ['系统架构设计师', '系统分析师', '软件设计师'],
    type: 'video',
  },
  {
    title: '分布式系统设计实战',
    description: '分布式架构、微服务、消息队列、分布式事务完整讲解',
    category: '分布式',
    icon: Network,
    url: 'https://www.bilibili.com/video/distributed-systems',
    tags: ['微服务', '消息队列', 'CAP'],
    subjects: ['系统架构设计师', '系统分析师'],
    type: 'video',
  },
  {
    title: '数据库设计与优化',
    description: '从设计范式到索引优化，从SQL调优到性能监控',
    category: '数据库',
    icon: Database,
    url: 'https://www.bilibili.com/video/database-design',
    tags: ['范式', '索引', 'SQL优化'],
    subjects: ['数据库系统工程师', '软件设计师', '系统分析师'],
    type: 'video',
  },
  // 笔记资源
  {
    title: '软件架构设计笔记',
    description: '架构风格、设计模式、架构评估方法知识点整理',
    category: '架构设计',
    icon: Code,
    url: 'https://github.com/Nanki-nn/aisoftoj',
    tags: ['架构风格', '设计模式', 'ATAM'],
    subjects: ['系统架构设计师', '系统分析师', '软件设计师'],
    type: 'note',
  },
  {
    title: '质量属性设计笔记',
    description: '性能、可靠性、安全性等质量属性的设计策略总结',
    category: '质量属性',
    icon: Shield,
    url: 'https://github.com/Nanki-nn/aisoftoj',
    tags: ['性能', '可靠性', '安全性'],
    subjects: ['系统架构设计师', '系统分析师', '软件设计师'],
    type: 'note',
  },
  {
    title: '分布式系统笔记',
    description: '分布式架构、微服务、消息队列、分布式事务核心要点',
    category: '分布式',
    icon: Network,
    url: 'https://github.com/Nanki-nn/aisoftoj',
    tags: ['微服务', '消息队列', 'CAP'],
    subjects: ['系统架构设计师', '系统分析师'],
    type: 'note',
  },
  {
    title: '数据库设计笔记',
    description: '数据库设计范式、索引优化、SQL调优知识总结',
    category: '数据库',
    icon: Database,
    url: 'https://github.com/Nanki-nn/aisoftoj',
    tags: ['范式', '索引', 'SQL优化'],
    subjects: ['数据库系统工程师', '软件设计师', '系统分析师'],
    type: 'note',
  },
  {
    title: '性能优化笔记',
    description: '性能分析方法、缓存策略、负载均衡实践总结',
    category: '性能优化',
    icon: Cpu,
    url: 'https://github.com/Nanki-nn/aisoftoj',
    tags: ['缓存', '负载均衡', '性能分析'],
    subjects: ['系统架构设计师', '软件设计师', '系统分析师'],
    type: 'note',
  },
  {
    title: '项目管理笔记',
    description: '项目管理方法、风险管理、配置管理知识整理',
    category: '项目管理',
    icon: FileText,
    url: 'https://github.com/Nanki-nn/aisoftoj',
    tags: ['PMBOK', '敏捷', '风险管理'],
    subjects: ['信息系统项目管理师', '系统分析师'],
    type: 'note',
  },
];

const categoryColors: Record<string, string> = {
  架构设计: 'bg-blue-100 text-blue-700 border-blue-200',
  质量属性: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  分布式: 'bg-violet-100 text-violet-700 border-violet-200',
  数据库: 'bg-amber-100 text-amber-700 border-amber-200',
  性能优化: 'bg-rose-100 text-rose-700 border-rose-200',
  项目管理: 'bg-cyan-100 text-cyan-700 border-cyan-200',
};

const iconBgColors: Record<string, string> = {
  架构设计: 'bg-blue-100',
  质量属性: 'bg-emerald-100',
  分布式: 'bg-violet-100',
  数据库: 'bg-amber-100',
  性能优化: 'bg-rose-100',
  项目管理: 'bg-cyan-100',
};

const iconTextColors: Record<string, string> = {
  架构设计: 'text-blue-600',
  质量属性: 'text-emerald-600',
  分布式: 'text-violet-600',
  数据库: 'text-amber-600',
  性能优化: 'text-rose-600',
  项目管理: 'text-cyan-600',
};

export function FoundationPage({ onShowAuth, onShowProfile }: FoundationPageProps) {
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState<string>('全部科目');

  const filteredMaterials =
    selectedSubject === '全部科目'
      ? materials
      : materials.filter((m) => m.subjects.includes(selectedSubject));

  const videoResources = filteredMaterials.filter((m) => m.type === 'video');
  const noteResources = filteredMaterials.filter((m) => m.type === 'note');

  const renderMaterialCard = (material: Material, index: number) => {
    const Icon = material.icon;
    return (
      <Card
        key={`${material.title}-${index}`}
        className="group hover:shadow-xl transition-all duration-300 cursor-pointer border border-slate-200/50 hover:border-slate-300"
        onClick={() => window.open(material.url, '_blank')}
      >
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between mb-3">
            <div
              className={`w-12 h-12 rounded-lg ${iconBgColors[material.category] || 'bg-slate-100'} flex items-center justify-center`}
            >
              <Icon className={`w-6 h-6 ${iconTextColors[material.category] || 'text-slate-600'}`} />
            </div>
            <Badge
              variant="secondary"
              className={categoryColors[material.category] || 'bg-slate-100 text-slate-700 border-slate-200'}
            >
              {material.category}
            </Badge>
          </div>
          <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
            {material.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-slate-600 mb-4 text-sm leading-relaxed">{material.description}</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {material.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs border-slate-200 text-slate-600">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex items-center text-blue-600 text-sm group-hover:translate-x-2 transition-transform">
            {material.type === 'video' ? (
              <>
                <Video className="w-4 h-4 mr-1" />
                <span>观看视频</span>
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4 mr-1" />
                <span>查看笔记</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <AppHeader onShowAuth={onShowAuth} onShowProfile={onShowProfile} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl text-slate-800">打基础</h1>
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
            <Video className="w-4 h-4 mr-2" />
            {videoResources.length} 个视频
          </Badge>
          <Badge variant="outline" className="px-4 py-2 text-base">
            <Book className="w-4 h-4 mr-2" />
            {noteResources.length} 份笔记
          </Badge>
        </div>

        {/* 视频资源区块 */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl text-slate-800">视频资源</h2>
              <p className="text-sm text-slate-600">系统讲解，配合实战案例</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videoResources.map(renderMaterialCard)}
          </div>
        </div>

        {/* 笔记资源区块 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Book className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl text-slate-800">备考笔记</h2>
              <p className="text-sm text-slate-600">知识点整理，快速复习</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {noteResources.map(renderMaterialCard)}
          </div>
        </div>

        {/* CTA区域 */}
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl mb-2">基础知识掌握了？</h3>
                <p className="text-blue-100">开始刷历年真题，检验学习成果，查漏补缺</p>
              </div>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => navigate('/papers')}
                className="bg-white text-blue-600 hover:bg-blue-50 px-8"
              >
                去刷真题
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
