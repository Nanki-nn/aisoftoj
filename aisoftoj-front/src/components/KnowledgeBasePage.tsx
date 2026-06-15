import React, { DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ChevronRight,
  Database,
  Download,
  FileText,
  FolderPlus,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { Switch } from './ui/switch';
import {
  cancelKnowledgeDocument,
  createKnowledgeBase,
  deleteKnowledgeBase,
  deleteKnowledgeDocument,
  downloadKnowledgeOriginal,
  getKnowledgeArtifact,
  getKnowledgeCapabilities,
  getKnowledgeDocument,
  KnowledgeBase,
  KnowledgeCapabilities,
  KnowledgeDocument,
  KnowledgeDocumentStatus,
  KnowledgeParseOptions,
  listKnowledgeBases,
  listKnowledgeDocuments,
  moveKnowledgeDocument,
  retryKnowledgeDocument,
  uploadKnowledgeDocument,
} from '../lib/api';

const ACCEPTED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'docx', 'pptx', 'xlsx', 'txt', 'md', 'markdown'];
const RUNNING_STATUSES: KnowledgeDocumentStatus[] = [
  'uploaded', 'queued', 'parsing', 'normalizing', 'chunking', 'embedding', 'indexing',
];

const DEFAULT_OPTIONS: KnowledgeParseOptions = {
  backend: 'hybrid-engine',
  effort: 'medium',
  parse_method: 'auto',
  lang_list: ['ch'],
  formula_enable: true,
  table_enable: true,
  image_analysis: false,
  start_page_id: 0,
  end_page_id: 99999,
  return_md: true,
  return_content_list: true,
  return_middle_json: false,
  return_model_output: false,
  return_images: true,
  chunk_size: 800,
  chunk_overlap: 120,
};

const statusMeta: Record<KnowledgeDocumentStatus, { label: string; color: string }> = {
  uploaded: { label: '已上传', color: 'text-slate-600 bg-slate-100' },
  queued: { label: '排队中', color: 'text-amber-700 bg-amber-50' },
  parsing: { label: 'MinerU 解析', color: 'text-blue-700 bg-blue-50' },
  normalizing: { label: '结果规范化', color: 'text-cyan-700 bg-cyan-50' },
  chunking: { label: '知识切块', color: 'text-violet-700 bg-violet-50' },
  embedding: { label: '向量化', color: 'text-indigo-700 bg-indigo-50' },
  indexing: { label: '写入索引', color: 'text-teal-700 bg-teal-50' },
  ready: { label: '可检索', color: 'text-emerald-700 bg-emerald-50' },
  failed: { label: '失败', color: 'text-red-700 bg-red-50' },
  cancelled: { label: '已取消', color: 'text-slate-600 bg-slate-100' },
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function OptionSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="knowledge-option-switch">
      <span className="text-sm text-slate-700">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function ParseOptionsForm({
  options,
  onChange,
  capabilities,
}: {
  options: KnowledgeParseOptions;
  onChange: (options: KnowledgeParseOptions) => void;
  capabilities: KnowledgeCapabilities | null;
}) {
  const backendEnum = capabilities?.parseOptionsSchema?.properties?.backend?.enum;
  const backends = backendEnum?.length ? backendEnum : ['pipeline', 'hybrid-engine'];
  const update = <K extends keyof KnowledgeParseOptions>(key: K, value: KnowledgeParseOptions[K]) =>
    onChange({ ...options, [key]: value });

  return (
    <div className="knowledge-parameter-cards">
      <Card className="knowledge-card knowledge-parameter-card">
        <CardHeader className="px-4 pb-3 pt-4">
          <CardTitle className="text-sm font-semibold">基础解析</CardTitle>
          <CardDescription className="text-xs">引擎、强度、解析方法与 OCR 语言</CardDescription>
        </CardHeader>
        <CardContent className="knowledge-form-grid">
          <label className="space-y-1.5 text-sm">
            <span className="text-slate-600">Backend</span>
            <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3" value={options.backend}
              onChange={(event) => update('backend', event.target.value)}>
              {backends.map((backend) => <option key={backend}>{backend}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-slate-600">解析强度</span>
            <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3" value={options.effort}
              onChange={(event) => update('effort', event.target.value as KnowledgeParseOptions['effort'])}>
              <option value="low">low</option><option value="medium">medium</option><option value="high">high</option>
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-slate-600">解析方法</span>
            <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3" value={options.parse_method}
              onChange={(event) => update('parse_method', event.target.value as KnowledgeParseOptions['parse_method'])}>
              <option value="auto">auto</option><option value="txt">txt</option><option value="ocr">ocr</option>
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-slate-600">OCR 语言</span>
            <Input value={options.lang_list.join(',')} onChange={(event) =>
              update('lang_list', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} />
          </label>
        </CardContent>
      </Card>

      <div className="knowledge-parameter-split">
        <Card className="knowledge-card knowledge-parameter-card">
          <CardHeader className="px-4 pb-3 pt-4">
            <CardTitle className="text-sm font-semibold">识别能力</CardTitle>
          </CardHeader>
          <CardContent className="knowledge-switch-grid">
            <OptionSwitch label="公式识别" checked={options.formula_enable} onChange={(value) => update('formula_enable', value)} />
            <OptionSwitch label="表格识别" checked={options.table_enable} onChange={(value) => update('table_enable', value)} />
            <OptionSwitch label="图片分析" checked={options.image_analysis} onChange={(value) => update('image_analysis', value)} />
          </CardContent>
        </Card>

        <Card className="knowledge-card knowledge-parameter-card">
          <CardHeader className="px-4 pb-3 pt-4">
            <CardTitle className="text-sm font-semibold">页码与切块</CardTitle>
          </CardHeader>
          <CardContent className="knowledge-form-grid">
            {([
              ['start_page_id', '起始页'],
              ['end_page_id', '结束页'],
              ['chunk_size', '切块大小'],
              ['chunk_overlap', '重叠长度'],
            ] as const).map(([key, label]) => (
              <label key={key} className="space-y-1.5 text-sm">
                <span className="text-slate-600">{label}</span>
                <Input type="number" min={0} value={options[key]}
                  onChange={(event) => update(key, Math.max(0, Number(event.target.value)))} />
              </label>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="knowledge-card knowledge-parameter-card">
        <details>
          <summary className="cursor-pointer px-4 py-4 text-sm font-semibold text-slate-800">
            解析产物
            <span className="ml-2 text-xs font-normal text-slate-500">Markdown、JSON、图片与模型输出</span>
          </summary>
          <CardContent className="grid gap-2 border-t border-slate-200 px-4 py-4">
          <OptionSwitch label="保留 Markdown" checked={options.return_md} onChange={(value) => update('return_md', value)} />
          <OptionSwitch label="保留 content list" checked={options.return_content_list} onChange={(value) => update('return_content_list', value)} />
          <OptionSwitch label="保留图片资源" checked={options.return_images} onChange={(value) => update('return_images', value)} />
          <OptionSwitch label="保留中间 JSON" checked={options.return_middle_json} onChange={(value) => update('return_middle_json', value)} />
          <OptionSwitch label="保留模型输出" checked={options.return_model_output} onChange={(value) => update('return_model_output', value)} />
          </CardContent>
        </details>
      </Card>
    </div>
  );
}

export default function KnowledgeBasePage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const [activeBaseId, setActiveBaseId] = useState<number | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [capabilities, setCapabilities] = useState<KnowledgeCapabilities | null>(null);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [keyword, setKeyword] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newBaseName, setNewBaseName] = useState('');
  const [newBaseDescription, setNewBaseDescription] = useState('');
  const [detail, setDetail] = useState<KnowledgeDocument | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'markdown' | 'content-list' | 'chunks' | 'versions'>('overview');
  const [artifact, setArtifact] = useState('');
  const [artifactError, setArtifactError] = useState('');
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadAll = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const loadedBases = await listKnowledgeBases();
      setBases(loadedBases);
      const targetId = activeBaseId && loadedBases.some((base) => base.id === activeBaseId)
        ? activeBaseId
        : loadedBases[0]?.id || null;
      setActiveBaseId(targetId);
      setDocuments(await listKnowledgeDocuments(targetId || undefined));
      setError('');
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [activeBaseId]);

  useEffect(() => {
    void Promise.all([
      loadAll(),
      getKnowledgeCapabilities().then(setCapabilities).catch(() => setCapabilities(null)),
    ]);
  }, []);

  useEffect(() => {
    if (!activeBaseId) return;
    void listKnowledgeDocuments(activeBaseId).then(setDocuments).catch((loadError) =>
      setError((loadError as Error).message));
  }, [activeBaseId]);

  useEffect(() => {
    if (!documents.some((document) => RUNNING_STATUSES.includes(document.status))) return;
    const timer = window.setInterval(() => void loadAll(true), 3000);
    return () => window.clearInterval(timer);
  }, [documents, loadAll]);

  const visibleDocuments = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return documents.filter((document) => !query || document.fileName.toLowerCase().includes(query));
  }, [documents, keyword]);

  const chooseFiles = (files: File[]) => {
    const legacy = files.find((file) => ['doc', 'ppt'].includes(file.name.split('.').pop()?.toLowerCase() || ''));
    if (legacy) {
      setError(`不支持旧格式 ${legacy.name}，请转换为 DOCX 或 PPTX。`);
      return;
    }
    const accepted = files.filter((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      return ACCEPTED_EXTENSIONS.includes(extension) && file.size <= 50 * 1024 * 1024;
    });
    if (!accepted.length) {
      setError('请选择 50MB 以内的 PDF、图片、DOCX、PPTX、XLSX、TXT 或 Markdown 文件。');
      return;
    }
    setSelectedFiles(accepted);
    setError('');
    setNotice(`${accepted.length} 个文件已加入待提交任务，请在右侧确认参数后提交。`);
  };

  const submitUpload = async () => {
    if (!activeBaseId || !selectedFiles.length) return;
    if (options.chunk_overlap >= options.chunk_size) {
      setError('切块重叠长度必须小于切块大小。');
      return;
    }
    setBusy(true);
    try {
      for (const file of selectedFiles) {
        await uploadKnowledgeDocument(activeBaseId, file, options);
      }
      setSelectedFiles([]);
      setNotice(`${selectedFiles.length} 个文档已提交，worker 会异步恢复和推进各处理阶段。`);
      await loadAll(true);
    } catch (uploadError) {
      setError((uploadError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const createBase = async () => {
    if (!newBaseName.trim()) return;
    setBusy(true);
    try {
      const created = await createKnowledgeBase({
        name: newBaseName.trim(),
        description: newBaseDescription.trim(),
        color: '#2563eb',
      });
      setBases((current) => [...current, created]);
      setActiveBaseId(created.id);
      setCreateOpen(false);
      setNewBaseName('');
      setNewBaseDescription('');
      setNotice('知识库已创建。');
    } catch (createError) {
      setError((createError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (document: KnowledgeDocument) => {
    setDetailTab('overview');
    setArtifact('');
    setArtifactError('');
    setDetail(await getKnowledgeDocument(document.id));
  };

  const loadArtifact = async (kind: 'markdown' | 'content-list' | 'chunks') => {
    if (!detail) return;
    setDetailTab(kind);
    setArtifactLoading(true);
    setArtifactError('');
    try {
      setArtifact(await getKnowledgeArtifact(detail.id, detail.version, kind));
    } catch (artifactError) {
      setArtifact('');
      setArtifactError((artifactError as Error).message);
    } finally {
      setArtifactLoading(false);
    }
  };

  const removeDocument = async (document: KnowledgeDocument) => {
    if (!window.confirm(`确定删除“${document.fileName}”及全部版本、产物和向量吗？`)) return;
    try {
      await deleteKnowledgeDocument(document.id);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setDetail(null);
      await loadAll(true);
      setNotice('文档及其解析版本、向量索引已删除。');
    } catch (deleteError) {
      setError((deleteError as Error).message);
    }
  };

  const activeBase = bases.find((base) => base.id === activeBaseId);
  const running = documents.filter((document) => RUNNING_STATUSES.includes(document.status)).length;
  const ready = documents.filter((document) => document.status === 'ready').length;
  const chunks = documents.reduce((sum, document) => sum + (document.chunkCount || 0), 0);
  const optionIssues = [
    options.end_page_id < options.start_page_id ? '结束页不能小于起始页' : '',
    options.chunk_overlap >= options.chunk_size ? '重叠长度必须小于切块大小' : '',
    !options.lang_list.length ? '至少填写一种 OCR 语言' : '',
  ].filter(Boolean);

  return (
    <main className="app-page knowledge-workbench-page">
      <div className="app-page-content max-w-[1500px]">
        <section className="app-page-heading knowledge-page-heading">
          <div className="flex items-center gap-3">
            <span className="app-page-icon"><Database className="h-5 w-5" /></span>
            <div>
              <h1>知识库管理</h1>
              <p>文档入库，清晰解析与知识管理</p>
            </div>
          </div>
          <div className="knowledge-heading-actions">
            <Button variant="outline" className="app-secondary-button" onClick={() => void loadAll()}>
              <RefreshCw className="mr-2 h-4 w-4" />刷新
            </Button>
            <Button className="app-primary-button" onClick={() => inputRef.current?.click()} disabled={!activeBaseId}>
              <UploadCloud className="mr-2 h-4 w-4" />上传文档
            </Button>
            <input ref={inputRef} type="file" multiple className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.pptx,.xlsx,.txt,.md,.markdown"
              onChange={(event) => { chooseFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
          </div>
        </section>

        {(notice || error) && (
          <div className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}>
            {error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {error || notice}
          </div>
        )}

        <div className="knowledge-workbench-grid">
          <aside className="knowledge-parameter-column">
            <Card className="knowledge-card knowledge-task-card">
              <CardContent className="knowledge-task-content">
                <div>
                  <div className="knowledge-task-heading">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <SlidersHorizontal className="h-4 w-4 text-blue-700" />
                      解析参数
                    </span>
                    <span className="text-xs text-slate-500">{selectedFiles.length} 个</span>
                  </div>
                  {selectedFiles.length === 0 ? (
                    <button
                      type="button"
                      className="knowledge-file-picker"
                      onClick={() => inputRef.current?.click()}
                    >
                      选择文档
                    </button>
                  ) : (
                    <div className="max-h-36 space-y-2 overflow-y-auto">
                      {selectedFiles.map((file, index) => (
                        <div key={`${file.name}-${file.size}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                          <span className="min-w-0 flex-1 truncate text-xs text-slate-700">{file.name}</span>
                          <span className="text-[11px] text-slate-400">{formatSize(file.size)}</span>
                          <button
                            type="button"
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                            aria-label={`移除 ${file.name}`}
                            onClick={() => setSelectedFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {optionIssues.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {optionIssues.map((issue) => <p key={issue}>{issue}</p>)}
                  </div>
                )}
              </CardContent>
              <CardFooter className="knowledge-task-footer">
                <Button
                  className="app-primary-button w-full"
                  onClick={() => void submitUpload()}
                  disabled={busy || !activeBaseId || selectedFiles.length === 0 || optionIssues.length > 0}
                >
                  {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                  {busy ? '正在提交...' : `提交 ${selectedFiles.length || ''} 个解析任务`}
                </Button>
              </CardFooter>
            </Card>

            <ParseOptionsForm options={options} onChange={setOptions} capabilities={capabilities} />
          </aside>

          <section className="knowledge-main-column">
            <Card className="knowledge-card knowledge-base-selector">
              <CardHeader className="flex flex-row items-center justify-between px-5 pb-3 pt-5">
                <CardTitle className="text-base font-semibold">我的知识库</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                  <FolderPlus className="mr-2 h-4 w-4" />新建
                </Button>
              </CardHeader>
              <CardContent className="knowledge-base-grid">
                {bases.map((base) => (
                  <button
                    key={base.id}
                    type="button"
                    onClick={() => setActiveBaseId(base.id)}
                    className={`knowledge-base-option ${activeBaseId === base.id ? 'is-selected' : ''}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <strong className="truncate text-sm">{base.name}</strong>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{base.documentCount}</span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-500">{base.description || '暂无描述'}</span>
                  </button>
                ))}
              </CardContent>
              {activeBase && !activeBase.isDefault && (
                <CardFooter className="justify-end border-t px-5 py-3">
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700"
                  onClick={async () => {
                    if (!window.confirm(`删除知识库“${activeBase.name}”及其中全部文档吗？`)) return;
                    await deleteKnowledgeBase(activeBase.id);
                    setActiveBaseId(null);
                    await loadAll();
                  }}>
                  <Trash2 className="mr-2 h-4 w-4" />删除知识库
                </Button>
                </CardFooter>
              )}
            </Card>

            <Card className="knowledge-card knowledge-overview-card">
              <CardHeader className="border-b px-5 py-4">
                <CardTitle className="text-base font-semibold">知识库概览</CardTitle>
              </CardHeader>
              <CardContent className="knowledge-overview-grid">
              {[
                ['全部文档', documents.length],
                ['可检索', ready],
                ['处理中', running],
                ['知识切块', chunks],
              ].map(([label, value]) => (
                <div key={label} className="border-b border-r border-slate-100 px-5 py-5 sm:border-b-0">
                  <strong className="block text-2xl text-slate-900">{value}</strong>
                  <span className="text-sm text-slate-500">{label}</span>
                </div>
              ))}
              </CardContent>
            </Card>

            <Card
              className={`knowledge-card knowledge-upload-card ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400'
              }`}
              onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event: DragEvent<HTMLDivElement>) => {
                event.preventDefault();
                setIsDragging(false);
                chooseFiles(Array.from(event.dataTransfer.files));
              }}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
              }}
            >
              <CardContent className="knowledge-upload-card-content">
                <span className="rounded-xl bg-blue-50 p-3 text-blue-700">
                  <UploadCloud className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm text-slate-900">
                    拖放文件到这里，或点击选择
                  </strong>
                  <span className="mt-1 block text-xs text-slate-500">
                    PDF、图片、DOCX、PPTX、XLSX、TXT、Markdown，单文件 50MB
                  </span>
                </div>
                <span className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 sm:block">
                  选择文件
                </span>
              </CardContent>
            </Card>

            <Card className="knowledge-card knowledge-documents-card">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                <div>
                  <CardTitle className="text-base font-semibold">{activeBase?.name || '知识库文档'}</CardTitle>
                  <CardDescription className="mt-1 text-xs">{activeBase?.description || '选择或创建一个知识库'}</CardDescription>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="knowledge-document-search-icon h-4 w-4 text-slate-400" />
                  <Input className="knowledge-document-search-input" value={keyword} onChange={(event) => setKeyword(event.target.value)}
                    placeholder="搜索文档" />
                </div>
              </CardHeader>

              <div className="divide-y divide-slate-100">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 p-16 text-sm text-slate-500">
                    <LoaderCircle className="h-5 w-5 animate-spin" />加载知识库
                  </div>
                ) : visibleDocuments.length === 0 ? (
                  <div className="flex flex-col items-center px-6 py-16 text-center">
                    <FileText className="mb-3 h-7 w-7 text-slate-400" />
                    <strong className="text-sm text-slate-800">当前知识库还没有文档</strong>
                  </div>
                ) : visibleDocuments.map((document) => {
                  const runningStatus = RUNNING_STATUSES.includes(document.status);
                  return (
                    <button
                      key={document.id}
                      type="button"
                      className="knowledge-document-trigger"
                      onClick={() => void openDetail(document)}
                      aria-label={`查看文档详情：${document.fileName}`}
                    >
                      <span className="rounded-xl bg-slate-100 p-3 text-slate-600"><FileText className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1 text-left">
                        <strong className="block truncate text-sm text-slate-900">{document.fileName}</strong>
                        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>{formatSize(document.fileSize)}</span><span>版本 {document.version}</span>
                          <span>{document.chunkCount || 0} 切块</span><span>{formatDate(document.updateTime)}</span>
                        </span>
                        {runningStatus && <Progress value={document.progress || 5} className="mt-2 h-1.5 max-w-md" />}
                        {document.errorMessage && <span className="mt-2 block text-xs text-red-600">{document.errorMessage}</span>}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta[document.status].color}`}>
                        {statusMeta[document.status].label}
                        {document.status === 'queued' && document.queuedAhead != null ? ` · 前方 ${document.queuedAhead}` : ''}
                      </span>
                      <span className="knowledge-document-chevron">
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
          </section>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="knowledge-dialog knowledge-create-dialog">
          <DialogHeader><DialogTitle>创建知识库</DialogTitle><DialogDescription>按科目、项目或资料来源隔离检索范围。</DialogDescription></DialogHeader>
          <div className="knowledge-create-form">
            <div><Label>名称</Label><Input value={newBaseName} onChange={(event) => setNewBaseName(event.target.value)} /></div>
            <div><Label>描述</Label><Input value={newBaseDescription} onChange={(event) => setNewBaseDescription(event.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button><Button onClick={() => void createBase()} disabled={busy || !newBaseName.trim()}>创建</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="knowledge-dialog knowledge-detail-dialog">
          {detail && (
            <>
              <DialogHeader className="knowledge-detail-header">
                <DialogTitle>{detail.fileName}</DialogTitle>
                <DialogDescription>{detail.knowledgeBaseName} · 版本 {detail.version} · {statusMeta[detail.status].label}</DialogDescription>
              </DialogHeader>
              <div className="knowledge-detail-tabs">
                <Button variant={detailTab === 'overview' ? 'secondary' : 'ghost'} size="sm" onClick={() => setDetailTab('overview')}>概览</Button>
                <Button variant={detailTab === 'markdown' ? 'secondary' : 'ghost'} size="sm" onClick={() => void loadArtifact('markdown')}>Markdown</Button>
                <Button variant={detailTab === 'content-list' ? 'secondary' : 'ghost'} size="sm" onClick={() => void loadArtifact('content-list')}>Content list</Button>
                <Button variant={detailTab === 'chunks' ? 'secondary' : 'ghost'} size="sm" onClick={() => void loadArtifact('chunks')}>知识切块</Button>
                <Button variant={detailTab === 'versions' ? 'secondary' : 'ghost'} size="sm" onClick={() => setDetailTab('versions')}>历史版本</Button>
              </div>
              <div className="knowledge-detail-body">
                {detailTab === 'overview' ? (
                  <div className="knowledge-detail-overview">
                    <div className="knowledge-detail-metrics">
                      <div><span>阶段</span><strong>{statusMeta[detail.status].label}</strong></div>
                      <div><span>进度</span><strong>{detail.progress || 0}%</strong></div>
                      <div><span>切块</span><strong>{detail.chunkCount || 0}</strong></div>
                      <div><span>更新时间</span><strong>{formatDate(detail.updateTime)}</strong></div>
                    </div>
                    {detail.errorMessage && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{detail.errorMessage}</div>}
                    <div className="knowledge-detail-section">
                      <h3>解析参数快照</h3>
                      <pre className="knowledge-detail-code">{JSON.stringify(detail.options || {}, null, 2)}</pre>
                    </div>
                  </div>
                ) : detailTab === 'versions' ? (
                  <div className="space-y-3">
                    {(detail.versions || []).map((version) => (
                      <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                        <div>
                          <strong>版本 {version.version}</strong>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(version.createTime)} · {version.chunkCount || 0} 切块
                            {version.totalDurationMs ? ` · ${(version.totalDurationMs / 1000).toFixed(1)} 秒` : ''}
                          </p>
                          {(version.failureType || version.traceId) && (
                            <p className="mt-1 text-xs text-slate-500">
                              {version.failureType ? `失败分类：${version.failureType}` : ''}
                              {version.traceId ? ` · Trace：${version.traceId}` : ''}
                            </p>
                          )}
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs ${statusMeta[version.status].color}`}>{statusMeta[version.status].label}</span>
                      </div>
                    ))}
                  </div>
                ) : artifactLoading ? (
                  <div className="flex justify-center p-16"><LoaderCircle className="h-6 w-6 animate-spin" /></div>
                ) : artifactError ? (
                  <div className="knowledge-artifact-error">
                    <AlertCircle className="h-5 w-5" />
                    <div>
                      <strong>产物加载失败</strong>
                      <p>{artifactError}</p>
                    </div>
                  </div>
                ) : detailTab === 'markdown' ? (
                  <div className="prose prose-slate max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{artifact}</ReactMarkdown></div>
                ) : (
                  <pre className="knowledge-detail-code knowledge-artifact-code">{artifact}</pre>
                )}
              </div>
              <DialogFooter className="knowledge-detail-footer">
                <div className="knowledge-detail-actions">
                  <Button variant="outline" onClick={() => void downloadKnowledgeOriginal(detail.id, detail.fileName)}><Download className="mr-2 h-4 w-4" />原文件</Button>
                  {RUNNING_STATUSES.includes(detail.status) && <Button variant="outline" onClick={async () => { await cancelKnowledgeDocument(detail.id); setDetail(await getKnowledgeDocument(detail.id)); }}><Ban className="mr-2 h-4 w-4" />取消</Button>}
                  <Button variant="outline" onClick={async () => { await retryKnowledgeDocument(detail.id, options); setDetail(await getKnowledgeDocument(detail.id)); await loadAll(true); }}><RotateCcw className="mr-2 h-4 w-4" />按当前参数重解析</Button>
                  <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={detail.knowledgeBaseId}
                    onChange={async (event) => { const moved = await moveKnowledgeDocument(detail.id, Number(event.target.value)); setDetail(moved); await loadAll(true); }}>
                    {bases.map((base) => <option key={base.id} value={base.id}>移动到：{base.name}</option>)}
                  </select>
                </div>
                <Button variant="destructive" onClick={() => void removeDocument(detail)}><Trash2 className="mr-2 h-4 w-4" />删除</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
