import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ECharts, EChartsOption } from 'echarts';
import { GraphChart } from 'echarts/charts';
import { LegendComponent, TooltipComponent } from 'echarts/components';
import { init, use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import {
  Bot,
  Brain,
  Filter,
  GitBranch,
  Link2,
  Maximize2,
  Network,
  Search,
  Sparkles,
  Target,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { importanceLevels, PracticeRecord } from '../types/record';
import {
  KnowledgeGraph,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeGraphScope,
  KnowledgePointRecommendation,
  fetchKnowledgeGraph,
  fetchKnowledgePointRecommendations,
  fetchWrongQuestions,
} from '../lib/api';

const RECOMMENDATION_TIMEOUT_MS = 15000;
const GRAPH_TIMEOUT_MS = 120000;

use([GraphChart, LegendComponent, TooltipComponent, CanvasRenderer]);

type GraphSelection =
  | { kind: 'node'; item: KnowledgeGraphNode }
  | { kind: 'edge'; item: KnowledgeGraphEdge }
  | null;

const graphCategoryIndex: Record<string, number> = {
  question: 0,
  knowledge: 1,
  related: 2,
};

function graphCategoryName(type: string) {
  if (type === 'knowledge') return '薄弱知识点';
  if (type === 'question') return '关联错题';
  if (type === 'related') return '关联知识';
  return '其他节点';
}

function graphNodeColor(type: string) {
  if (type === 'knowledge') return '#0d9488';
  if (type === 'related') return '#f59e0b';
  if (type === 'question') return '#db2777';
  return '#7c3aed';
}

function graphRelationColor(type: string) {
  if (type === 'PREREQUISITE_OF') return '#14b8a6';
  if (type === 'CONFUSED_WITH') return '#e11d48';
  if (type === 'CONTAINS') return '#f97316';
  if (type === 'TESTS') return '#a855f7';
  if (type === 'PENDING_TESTS') return '#c084fc';
  return '#65a30d';
}

function relationLabel(type: string) {
  if (type === 'PREREQUISITE_OF') return '前置';
  if (type === 'CONTAINS') return '包含';
  if (type === 'CONFUSED_WITH') return '易混淆';
  if (type === 'TESTS') return '考查';
  if (type === 'PENDING_TESTS') return '待确认考查';
  return '关联';
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
  onTimeout: () => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      onTimeout();
      reject(new Error(`${label}响应超时`));
    }, timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timer));
  });
}

function levelLabel(level: KnowledgePointRecommendation['level']) {
  if (level === 'must') return '优先补齐';
  if (level === 'high') return '重点突破';
  if (level === 'medium') return '建议巩固';
  return '保持复盘';
}

function buildAiPrompt(item: KnowledgePointRecommendation) {
  return `请作为我的软考备考 Agent，结合我的错题记录分析“${item.name}”这个薄弱知识点：先解释核心概念，再找相关错题的共性错误，最后给出下一步练习建议。`;
}

interface WrongQuestionsProps {
  onBack: () => void;
  onViewQuestion: (record: PracticeRecord) => void;
}

function GraphView({
  graph,
  scope,
  query,
  typeFilter,
  selection,
  onSelect,
}: {
  graph: KnowledgeGraph | null;
  scope: KnowledgeGraphScope;
  query: string;
  typeFilter: string;
  selection: GraphSelection;
  onSelect: (selection: GraphSelection) => void;
}) {
  const chartElRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);
  const onSelectRef = useRef(onSelect);
  const nodeMap = useMemo(() => new Map((graph?.nodes || []).map(node => [node.id, node])), [graph]);
  const edgeMap = useMemo(() => new Map((graph?.edges || []).map(edge => [edge.id, edge])), [graph]);
  const selectedId = selection?.item.id || null;

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const visualGraph = useMemo(() => {
    if (!graph) return { nodes: [] as KnowledgeGraphNode[], edges: [] as KnowledgeGraphEdge[] };
    const normalizedQuery = query.trim().toLowerCase();
    const matchedNodes = graph.nodes.filter((node) => {
      if (typeFilter !== 'all' && node.type !== typeFilter) return false;
      if (!normalizedQuery) return true;
      return node.label.toLowerCase().includes(normalizedQuery)
        || node.id.toLowerCase().includes(normalizedQuery);
    });
    const visibleIds = new Set(matchedNodes.map(node => node.id));
    const expandedIds = new Set<string>(visibleIds);
    graph.edges.forEach((edge) => {
      if (visibleIds.has(edge.source) || visibleIds.has(edge.target)) {
        expandedIds.add(edge.source);
        expandedIds.add(edge.target);
      }
    });
    const maxNodes = normalizedQuery || typeFilter !== 'all' ? 220 : scope === 'full' ? 1000 : 160;
    const nodes = graph.nodes
      .filter(node => expandedIds.has(node.id))
      .sort((left, right) => (right.score || 0) - (left.score || 0))
      .slice(0, maxNodes);
    const nodeIds = new Set(nodes.map(node => node.id));
    const edges = graph.edges
      .filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .sort((left, right) => (right.weight || 0) - (left.weight || 0))
      .slice(0, normalizedQuery || typeFilter !== 'all' ? 280 : scope === 'full' ? 1800 : 220);
    return { nodes, edges };
  }, [graph, query, scope, typeFilter]);

  const degreeMap = useMemo(() => {
    const degrees = new Map<string, number>();
    visualGraph.nodes.forEach(node => degrees.set(node.id, 0));
    visualGraph.edges.forEach((edge) => {
      degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1);
      degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1);
    });
    return degrees;
  }, [visualGraph]);

  const option = useMemo<EChartsOption | null>(() => {
    if (!graph || visualGraph.nodes.length === 0) return null;
    return {
      animation: scope !== 'full',
      animationDurationUpdate: 420,
      backgroundColor: 'transparent',
      color: ['#db2777', '#0d9488', '#f59e0b', '#7c3aed'],
      legend: {
        top: 12,
        left: 14,
        itemWidth: 10,
        itemHeight: 10,
        selectedMode: false,
        data: ['关联错题', '薄弱知识点', '关联知识', '其他节点'],
        textStyle: { color: '#475569', fontSize: 12 },
      },
      tooltip: {
        appendToBody: true,
        borderWidth: 0,
        className: 'wrong-graph-tooltip',
        formatter: (params: any) => {
          if (params.dataType === 'edge') {
            const edge = params.data.raw as KnowledgeGraphEdge;
            const source = nodeMap.get(edge.source)?.label || edge.source;
            const target = nodeMap.get(edge.target)?.label || edge.target;
            return `
              <div class="wrong-graph-tooltip-inner">
                <strong>${escapeHtml(edge.label || relationLabel(edge.type))}</strong>
                <span>${escapeHtml(source)} -> ${escapeHtml(target)}</span>
                ${edge.evidence ? `<span>${escapeHtml(edge.evidence)}</span>` : ''}
              </div>
            `;
          }
          const node = params.data.raw as KnowledgeGraphNode;
          return `
            <div class="wrong-graph-tooltip-inner">
              <strong>${escapeHtml(node.label)}</strong>
              <span>${escapeHtml(graphCategoryName(node.type))}</span>
              <span>连接 ${degreeMap.get(node.id) || 0} 条，错误 ${node.errorCount || 0} 次</span>
            </div>
          `;
        },
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          roam: true,
          draggable: true,
          left: '3%',
          right: '3%',
          top: '4%',
          bottom: '4%',
          scaleLimit: { min: scope === 'full' ? 0.08 : 0.35, max: scope === 'full' ? 12 : 4 },
          force: {
            initLayout: 'circular',
            repulsion: scope === 'full' ? 90 : 340,
            gravity: scope === 'full' ? 0.025 : 0.07,
            friction: scope === 'full' ? 0.76 : 0.62,
            edgeLength: scope === 'full' ? [36, 72] : [90, 190],
            layoutAnimation: scope !== 'full',
          },
          categories: [
            { name: '关联错题' },
            { name: '薄弱知识点' },
            { name: '关联知识' },
            { name: '其他节点' },
          ],
          data: visualGraph.nodes.map((node) => {
            const degree = degreeMap.get(node.id) || 0;
            const isSelected = selectedId === node.id;
            return {
              id: node.id,
              name: node.label,
              value: degree || node.errorCount || 1,
              category: graphCategoryIndex[node.type] ?? 3,
              symbol: node.type === 'question' ? 'roundRect' : 'circle',
              symbolSize: Math.min(
                56,
                scope === 'full'
                  ? (node.type === 'knowledge' ? 13 : node.type === 'question' ? 7 : 8) + Math.log1p(degree) * 2.4
                  : (node.type === 'question' ? 10 : 24) + Math.log1p(degree) * 11
              ),
              raw: node,
              itemStyle: {
                color: graphNodeColor(node.type),
                borderColor: isSelected ? '#0f172a' : '#ffffff',
                borderWidth: isSelected ? 3 : scope === 'full' ? 1 : 2,
                shadowBlur: isSelected ? 18 : scope === 'full' ? 0 : 8,
                shadowColor: isSelected ? 'rgba(15, 23, 42, 0.24)' : 'rgba(30, 58, 95, 0.14)',
              },
              label: {
                show: isSelected
                  || node.type === 'knowledge'
                  || (scope === 'focus' && node.type !== 'question')
                  || Boolean(query.trim()),
                formatter: node.label,
                color: '#1e293b',
                fontSize: node.type === 'knowledge' ? 12 : 11,
                fontWeight: node.type === 'knowledge' ? 700 : 600,
                width: node.type === 'knowledge' ? 120 : 108,
                overflow: 'truncate',
                position: 'right',
                distance: 7,
              },
              emphasis: { focus: 'adjacency' },
            };
          }),
          links: visualGraph.edges.map((edge) => {
            const isSelected = selectedId === edge.id;
            return {
              id: edge.id,
              source: edge.source,
              target: edge.target,
              raw: edge,
              value: edge.weight || 1,
              lineStyle: {
                color: graphRelationColor(edge.type),
                width: isSelected ? 3.4 : scope === 'full' ? 0.65 : edge.type === 'TESTS' ? 1.5 : 2.3,
                opacity: isSelected ? 0.95 : scope === 'full' ? 0.08 : edge.type === 'TESTS' ? 0.58 : 0.82,
                curveness: scope === 'full' ? 0 : edge.type === 'CONFUSED_WITH' ? 0.22 : 0.08,
                type: edge.type === 'PENDING_TESTS' ? 'dashed' : 'solid',
              },
              label: {
                show: isSelected,
                formatter: edge.label || relationLabel(edge.type),
                color: '#334155',
                fontSize: 10,
                backgroundColor: 'rgba(255,255,255,0.86)',
                borderRadius: 4,
                padding: [2, 5],
              },
              emphasis: {
                lineStyle: {
                  opacity: 0.82,
                  width: 2.2,
                },
              },
            };
          }),
          edgeSymbol: scope === 'full' ? ['none', 'none'] : ['none', 'arrow'],
          edgeSymbolSize: scope === 'full' ? [0, 0] : [0, 7],
          emphasis: { focus: 'adjacency', blurScope: 'coordinateSystem' },
        },
      ],
    };
  }, [
    degreeMap,
    graph,
    nodeMap,
    query,
    scope,
    selectedId,
    visualGraph,
  ]);

  useEffect(() => {
    if (!chartElRef.current || !option) return;
    const chart = chartRef.current || init(chartElRef.current);
    chartRef.current = chart;
    chart.setOption(option, true);
    const handleClick = (params: any) => {
      if (params.dataType === 'node') {
        const node = nodeMap.get(params.data.id);
        if (node) onSelectRef.current({ kind: 'node', item: node });
      }
      if (params.dataType === 'edge') {
        const edge = edgeMap.get(params.data.id);
        if (edge) onSelectRef.current({ kind: 'edge', item: edge });
      }
    };
    chart.off('click');
    chart.on('click', handleClick);
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(chartElRef.current);
    return () => {
      chart.off('click', handleClick);
      resizeObserver.disconnect();
    };
  }, [edgeMap, nodeMap, option]);

  useEffect(() => () => {
    chartRef.current?.dispose();
    chartRef.current = null;
  }, []);

  if (!graph || visualGraph.nodes.length === 0) {
    return (
      <div className="wrong-graph-empty">
        <Sparkles className="h-5 w-5" />
        <span>暂无可展示的薄弱知识图谱，完成练习后会自动生成。</span>
      </div>
    );
  }

  return (
    <div className="wrong-graph-canvas">
      <div ref={chartElRef} className="wrong-graph-echarts" aria-label="错题知识图谱" />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="wrong-graph-fit"
        onClick={() => chartRef.current?.dispatchAction({ type: 'restore' })}
        aria-label="适应全部节点"
        title="适应全部节点"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
      <div className="wrong-graph-metrics">
        <Brain className="h-5 w-5" />
        <span>{visualGraph.nodes.length} 个节点</span>
        <span>{visualGraph.edges.length} 条关系</span>
      </div>
      <div className="wrong-graph-hint">
        {scope === 'full' ? '滚轮放大查看局部，点击右上角恢复全图' : '滚轮缩放，拖拽节点，点击节点或关系查看证据'}
      </div>
    </div>
  );
}

function GraphDetailPanel({
  graph,
  selection,
  recommendations,
}: {
  graph: KnowledgeGraph | null;
  selection: GraphSelection;
  recommendations: KnowledgePointRecommendation[];
}) {
  const nodeById = useMemo(() => new Map((graph?.nodes || []).map(node => [node.id, node])), [graph]);
  if (!selection) {
    const first = recommendations[0];
    return (
      <aside className="wrong-graph-detail">
        <div className="wrong-detail-empty-icon">
          <Link2 className="h-5 w-5" />
        </div>
        <h3>{first?.name || '选择图谱元素'}</h3>
        <p>{first?.reason || '点击图谱中的知识点或关系，可以查看错题证据和来源。'}</p>
        {first?.evidences?.slice(0, 3).map((evidence) => (
          <div key={`${evidence.questionId}-${evidence.questionName}`} className="wrong-evidence-row">
            <strong>{evidence.questionName}</strong>
            <span>{evidence.paperName || evidence.subjectName || '软考题库'}，错 {evidence.errorCount} 次</span>
          </div>
        ))}
      </aside>
    );
  }

  if (selection.kind === 'node') {
    const node = selection.item;
    const recommendation = recommendations.find(item => item.id === node.id);
    const nodeDegree = (graph?.edges || []).filter(edge => edge.source === node.id || edge.target === node.id).length;
    return (
      <aside className="wrong-graph-detail">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs app-meta">{graphCategoryName(node.type)}</p>
            <h3>{node.label}</h3>
          </div>
          <Badge variant="secondary">{nodeDegree} 条连接</Badge>
        </div>
        <div className="wrong-score-row">
          <span>{graphCategoryName(node.type)}</span>
          <span>连接 {nodeDegree} 条</span>
          <span>错误 {node.errorCount || 0} 次</span>
        </div>
        <p className="wrong-card-reason">
          {recommendation?.reason || '该节点来自错题证据或知识库关联。'}
        </p>
        <div className="wrong-graph-evidence">
          {(recommendation?.evidences || []).slice(0, 4).map((evidence) => (
            <div key={`${evidence.questionId}-${evidence.questionName}`}>
              <strong>{evidence.questionName}</strong>
              <span>{evidence.paperName || evidence.subjectName || '软考题库'}，错 {evidence.errorCount} 次</span>
            </div>
          ))}
        </div>
      </aside>
    );
  }

  const edge = selection.item;
  const source = nodeById.get(edge.source);
  const target = nodeById.get(edge.target);
  return (
    <aside className="wrong-graph-detail">
      <p className="text-xs app-meta">知识关系</p>
      <h3>{edge.label || relationLabel(edge.type)}</h3>
      <p>{source?.label || edge.source} -&gt; {target?.label || edge.target}</p>
      <div className="wrong-meta-pills">
        <span>{relationLabel(edge.type)}</span>
        {edge.sourceType && <span>{edge.sourceType}</span>}
        {edge.weight > 0 && <span>置信度 {Math.round(edge.weight * 100)}%</span>}
      </div>
      {edge.evidence && <p className="wrong-card-reason">{edge.evidence}</p>}
    </aside>
  );
}

function RecommendationCards({
  recommendations,
}: {
  recommendations: KnowledgePointRecommendation[];
}) {
  if (recommendations.length === 0) {
    return (
      <div className="wrong-graph-empty">
        <Sparkles className="h-5 w-5" />
        <span>暂无薄弱知识点推荐。</span>
      </div>
    );
  }

  return (
    <div className="wrong-recommendation-grid">
      {recommendations.slice(0, 8).map((item) => (
        <section key={item.id} className="wrong-recommendation-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3>{item.name}</h3>
              <p>{item.subject}</p>
            </div>
            <Badge className="bg-blue-100 text-blue-700">{levelLabel(item.level)}</Badge>
          </div>
          <div className="wrong-score-row">
            <span>薄弱分 {item.score}</span>
            <span>掌握度 {item.mastery}%</span>
            <span>{item.wrongQuestionCount} 道错题</span>
          </div>
          <p className="wrong-card-reason">{item.reason}</p>
          <p className="wrong-card-suggestion">{item.suggestion}</p>
          <div className="wrong-card-actions">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                window.location.assign(`/ai-chat?prompt=${encodeURIComponent(buildAiPrompt(item))}`);
              }}
            >
              <Bot className="h-4 w-4" />
              AI 分析
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => document.getElementById('wrong-records')?.scrollIntoView({ behavior: 'smooth' })}
            >
              相关错题
            </Button>
          </div>
        </section>
      ))}
    </div>
  );
}

export function WrongQuestions({ onViewQuestion }: WrongQuestionsProps) {
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<KnowledgePointRecommendation[]>([]);
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [graphScope, setGraphScope] = useState<KnowledgeGraphScope>('focus');
  const [isIntelLoading, setIsIntelLoading] = useState(true);
  const [intelError, setIntelError] = useState<string | null>(null);
  const [selection, setSelection] = useState<GraphSelection>(null);
  const [graphQuery, setGraphQuery] = useState('');
  const [graphTypeFilter, setGraphTypeFilter] = useState('all');
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, total);

  const loadIntel = useCallback(() => {
    let cancelled = false;
    const recommendationController = new AbortController();
    const graphController = new AbortController();
    setIsIntelLoading(true);
    setIntelError(null);

    withTimeout(
      fetchKnowledgePointRecommendations(recommendationController.signal),
      RECOMMENDATION_TIMEOUT_MS,
      '知识点推荐',
      () => recommendationController.abort()
    )
      .then((items) => {
        if (!cancelled) setRecommendations(items);
      })
      .catch((err) => {
        if (!cancelled) {
          setRecommendations([]);
          setIntelError(err.message || '知识点推荐加载失败');
        }
      });

    withTimeout(
      fetchKnowledgeGraph(graphScope, graphController.signal),
      GRAPH_TIMEOUT_MS,
      '知识图谱',
      () => graphController.abort()
    )
      .then((loadedGraph) => {
        if (!cancelled) setGraph(loadedGraph);
      })
      .catch((err) => {
        if (!cancelled) {
          setGraph(null);
          setIntelError((current) => [current, err.message || '知识图谱加载失败'].filter(Boolean).join('；'));
        }
      })
      .finally(() => !cancelled && setIsIntelLoading(false));

    return () => {
      cancelled = true;
      recommendationController.abort();
      graphController.abort();
    };
  }, [graphScope]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    fetchWrongQuestions({ page, pageSize })
      .then((data) => {
        if (isMounted) {
          setRecords(data.records);
          setTotal(data.total);
          setError(null);
        }
      })
      .catch((err) => isMounted && setError(err.message || '错题记录加载失败'))
      .finally(() => isMounted && setIsLoading(false));
    return () => {
      isMounted = false;
    };
  }, [page, pageSize]);

  useEffect(() => loadIntel(), [loadIntel]);

  const handleRemove = (id: string) => {
    if (confirm('确定要移除这条错题记录吗？')) {
      setRecords(records.filter(record => record.id !== id));
    }
  };

  const handleView = (record: PracticeRecord) => {
    if (!record.sessionId || !record.questionId) {
      alert('这条错题缺少对应刷题会话，暂时无法查看原题。');
      return;
    }
    onViewQuestion(record);
  };

  const handlePageSizeChange = (value: string) => {
    setPage(1);
    setPageSize(Number(value));
  };

  return (
    <main className="app-page wrong-questions-page">
      <div className="app-page-content">
        <section className="app-page-heading">
          <div className="flex items-center gap-3">
            <span className="app-page-icon">
              <GitBranch className="h-5 w-5" />
            </span>
            <div>
              <h1>错题图谱</h1>
              <p>从错题记录中沉淀薄弱知识点，查看证据并复盘高频失误。</p>
            </div>
          </div>
        </section>

        <Card id="wrong-knowledge-graph" className="app-surface wrong-intelligence-card">
          <CardContent className="wrong-intelligence-body pt-6">
            {intelError && (
              <div className="app-status-note app-status-note-warning p-3 text-sm">
                {intelError}
              </div>
            )}
            <div className="wrong-graph-toolbar">
              <ToggleGroup
                type="single"
                value={graphScope}
                onValueChange={(value) => value && setGraphScope(value as KnowledgeGraphScope)}
                variant="outline"
                className="wrong-graph-scope"
                aria-label="图谱范围"
              >
                <ToggleGroupItem value="focus" aria-label="错题聚焦">
                  <Target className="h-4 w-4" />
                  错题聚焦
                </ToggleGroupItem>
                <ToggleGroupItem value="full" aria-label="完整图谱">
                  <Network className="h-4 w-4" />
                  完整图谱
                </ToggleGroupItem>
              </ToggleGroup>
              <div className="app-input-shell wrong-graph-search">
                <Search className="h-4 w-4 text-slate-400" />
                <Input
                  value={graphQuery}
                  onChange={(event) => setGraphQuery(event.target.value)}
                  placeholder="搜索知识点或错题"
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
              </div>
              <Select value={graphTypeFilter} onValueChange={setGraphTypeFilter}>
                <SelectTrigger className="wrong-filter-select">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部节点</SelectItem>
                  <SelectItem value="knowledge">薄弱知识点</SelectItem>
                  <SelectItem value="related">关联知识</SelectItem>
                  <SelectItem value="question">关联错题</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isIntelLoading ? (
              <div className="wrong-intelligence-loading" aria-label="正在加载错题图谱">
                <div />
                <div />
                <div />
              </div>
            ) : (
              <div className="wrong-graph-layout">
                <GraphView
                  graph={graph}
                  scope={graphScope}
                  query={graphQuery}
                  typeFilter={graphTypeFilter}
                  selection={selection}
                  onSelect={setSelection}
                />
                <GraphDetailPanel
                  graph={graph}
                  selection={selection}
                  recommendations={recommendations}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="app-surface">
          <CardHeader className="wrong-section-header">
            <div>
              <CardTitle>推荐知识点</CardTitle>
              <p>按错题频次和重要级别排序，建议优先处理前几项。</p>
            </div>
          </CardHeader>
          <CardContent>
            <RecommendationCards recommendations={recommendations} />
          </CardContent>
        </Card>

        <Card id="wrong-records" className="app-surface">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>错题记录</CardTitle>
                <p className="mt-1 text-sm text-slate-500">题库列表 &gt; 错题记录</p>
              </div>
              <div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
                <span>每页</span>
                <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="h-8 w-20 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span>条</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading && <div className="p-6 text-slate-500">正在加载错题记录...</div>}
            {error && <div className="p-6 text-red-600">{error}</div>}
            {!isLoading && !error && (
              <>
                <div className="wrong-table-scroll">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-slate-600">题目名称</TableHead>
                        <TableHead className="text-slate-600">所属题库</TableHead>
                        <TableHead className="text-center text-slate-600">题目类型</TableHead>
                        <TableHead className="text-center text-slate-600">错误次数</TableHead>
                        <TableHead className="text-slate-600">更新时间</TableHead>
                        <TableHead className="text-center text-slate-600">重要级别</TableHead>
                        <TableHead className="text-center text-slate-600">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((record) => (
                        <TableRow key={record.id} className="hover:bg-slate-50">
                          <TableCell className="text-slate-800">{record.topicName}</TableCell>
                          <TableCell className="text-slate-600">{record.questionBank}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="border-blue-200 bg-blue-50 text-blue-700">
                              {record.topicType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-slate-800">{record.errorCount}</TableCell>
                          <TableCell className="text-slate-600">{record.updateTime}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className={importanceLevels[record.importance].color}>
                              {importanceLevels[record.importance].label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(record)}
                              className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            >
                              查看
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemove(record.id)}
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              移除
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {records.length === 0 ? (
                  <div className="py-10 text-center text-slate-500">暂无错题记录</div>
                ) : (
                  <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-slate-500">
                      共 {total} 条，当前显示 {startRecord}-{endRecord}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        上一页
                      </Button>
                      <span className="min-w-16 text-center text-sm text-slate-600">
                        {page} / {totalPages}
                      </span>
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                        下一页
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
