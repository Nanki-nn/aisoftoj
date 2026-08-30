import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookMarked,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import {
  KnowledgeDocument,
  KnowledgeDocumentContent,
  KnowledgeDocumentStatus,
  deleteKnowledgeDocument,
  getKnowledgeDocument,
  getKnowledgeDocumentContent,
  listKnowledgeDocuments,
  updateKnowledgeDocument,
  uploadKnowledgeFile,
} from '../../lib/aiApi';

const TERMINAL = new Set(['active', 'failed']);
const STATUS: Record<KnowledgeDocumentStatus, string> = {
  queued: '排队中',
  parsing: '解析中',
  indexing: '建立索引中',
  active: '已启用',
  failed: '失败',
};

type DetailTab = 'details' | 'content';

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

function statusClass(status: KnowledgeDocumentStatus): string {
  if (status === 'active') return 'bg-emerald-50 text-emerald-700';
  if (status === 'failed') return 'bg-red-50 text-red-700';
  return 'bg-blue-50 text-blue-700';
}

export function AdminKnowledgeDocuments() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [selected, setSelected] = useState<KnowledgeDocument | null>(null);
  const [title, setTitle] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<KnowledgeDocumentStatus | ''>('');
  const [activeTab, setActiveTab] = useState<DetailTab>('details');
  const [content, setContent] = useState<KnowledgeDocumentContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ocr, setOcr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pollTimer = useRef<number | null>(null);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const select = (item: KnowledgeDocument | null) => {
    setSelected(item);
    setTitle(item?.title ?? '');
    setContent(null);
    setContentError(null);
    setActiveTab('details');
  };

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const result = await listKnowledgeDocuments({
        page,
        pageSize,
        keyword: keyword || undefined,
        status: statusFilter || undefined,
      });
      setDocuments(result.records);
      setTotal(result.total);
      setSelected(current => result.records.find(item => item.documentId === current?.documentId) ?? null);
    } catch (loadError) {
      setError((loadError as Error).message || '知识库加载失败');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [keyword, page, pageSize, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => () => {
    if (pollTimer.current !== null) window.clearInterval(pollTimer.current);
  }, []);

  useEffect(() => {
    if (pollTimer.current !== null || !documents.some(item => !TERMINAL.has(item.status))) return;
    pollTimer.current = window.setInterval(() => {
      void Promise.all(documents.filter(item => !TERMINAL.has(item.status)).map(item => getKnowledgeDocument(item.documentId)))
        .then(updated => {
          setDocuments(current => current.map(item => updated.find(next => next.documentId === item.documentId) ?? item));
          setSelected(current => updated.find(next => next.documentId === current?.documentId) ?? current);
        })
        .catch(() => undefined);
    }, 3000);
    return () => {
      if (pollTimer.current !== null) {
        window.clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [documents]);

  const loadContent = useCallback(async (offset = 0, append = false) => {
    if (!selected || contentLoading) return;
    setContentLoading(true);
    setContentError(null);
    try {
      const next = await getKnowledgeDocumentContent(selected.documentId, offset);
      setContent(current => append && current ? {
        ...next,
        content: current.content + next.content,
      } : next);
    } catch (contentLoadError) {
      setContentError((contentLoadError as Error).message || '解析内容暂不可用');
    } finally {
      setContentLoading(false);
    }
  }, [contentLoading, selected]);

  useEffect(() => {
    if (activeTab === 'content' && selected && !content && !contentLoading) {
      void loadContent();
    }
  }, [activeTab, content, contentLoading, loadContent, selected]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('请选择 PDF 文件');
      return;
    }
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const created = await uploadKnowledgeFile(file, ocr);
      setPage(1);
      setKeyword('');
      setKeywordInput('');
      setStatusFilter('');
      setDocuments(current => [created, ...current.slice(0, pageSize - 1)]);
      setTotal(current => current + 1);
      select(created);
      setNotice('文档已提交处理。');
    } catch (uploadError) {
      setError((uploadError as Error).message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!selected || !title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateKnowledgeDocument(selected.documentId, title.trim());
      setDocuments(current => current.map(item => item.documentId === updated.documentId ? updated : item));
      setSelected(updated);
      setTitle(updated.title);
      setNotice('文档标题已更新。');
    } catch (saveError) {
      setError((saveError as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: KnowledgeDocument) => {
    if (deleting || !window.confirm(`删除“${item.title}”？原始 PDF、解析内容和向量索引将同时删除。`)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteKnowledgeDocument(item.documentId);
      const remaining = documents.filter(entry => entry.documentId !== item.documentId);
      setDocuments(remaining);
      setTotal(current => Math.max(0, current - 1));
      if (selected?.documentId === item.documentId) select(null);
      if (remaining.length === 0 && page > 1) setPage(current => current - 1);
      setNotice('文档、原始 PDF、解析内容和向量索引已删除。');
    } catch (deleteError) {
      setError((deleteError as Error).message || '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const search = () => {
    setPage(1);
    setKeyword(keywordInput.trim());
  };

  return (
    <div className="w-full space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div><div className="flex items-center gap-2 text-blue-700"><BookMarked className="h-5 w-5" /><span className="text-sm font-medium">知识库</span></div><h1 className="mt-1 text-xl font-semibold text-slate-900">知识库管理</h1></div>
        <button type="button" onClick={() => void load(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" />刷新</button>
      </div>

      {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><TriangleAlert className="h-4 w-4" />{error}</div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{notice}</div>}

      <section className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}{uploading ? '上传中' : '上传 PDF'}
          <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={ocr} onChange={event => setOcr(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />启用 OCR</label>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold text-slate-900">文档</h2><span className="text-sm text-slate-500">共 {total} 个</span></div><div className="mt-3 flex gap-2"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={keywordInput} onChange={event => setKeywordInput(event.target.value)} onKeyDown={event => event.key === 'Enter' && search()} placeholder="搜索文档标题" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></div><select value={statusFilter} onChange={event => { setPage(1); setStatusFilter(event.target.value as KnowledgeDocumentStatus | ''); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"><option value="">全部状态</option>{Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" onClick={search} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">查询</button></div></div>
          {loading ? <div className="px-5 py-12 text-center text-sm text-slate-400">加载中…</div> : documents.length === 0 ? <div className="px-5 py-12 text-center text-sm text-slate-500">暂无匹配文档</div> : <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3 font-medium">文档</th><th className="px-3 py-3 font-medium">状态</th><th className="px-3 py-3 font-medium">OCR</th><th className="px-3 py-3 font-medium">分块</th><th className="px-3 py-3 font-medium">更新时间</th><th className="px-5 py-3 text-right font-medium">操作</th></tr></thead><tbody className="divide-y divide-slate-100">{documents.map(item => <tr key={item.documentId} className={selected?.documentId === item.documentId ? 'bg-blue-50/50' : 'hover:bg-slate-50'}><td className="px-5 py-4"><button type="button" onClick={() => select(item)} className="flex max-w-[145px] items-center gap-2 text-left"><FileText className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate font-medium text-slate-800">{item.title}</span></button></td><td className="px-3 py-4"><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(item.status)}`}>{STATUS[item.status]}</span></td><td className="px-3 py-4 text-slate-600">{item.isOcr ? '开启' : '关闭'}</td><td className="px-3 py-4 text-slate-600">{item.chunkCount}</td><td className="px-3 py-4 whitespace-nowrap text-xs text-slate-600">{formatDate(item.updatedAt || item.createdAt)}</td><td className="px-5 py-4"><div className="flex justify-end gap-1"><button type="button" title="查看和编辑" onClick={() => select(item)} className="rounded-md p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Pencil className="h-4 w-4" /></button><button type="button" title="删除文档" disabled={deleting} onClick={() => void handleDelete(item)} className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div>}
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-600"><label className="flex items-center gap-2">每页<select value={pageSize} onChange={event => { setPage(1); setPageSize(Number(event.target.value)); }} className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select>条</label><div className="flex items-center gap-2"><span>{page} / {pageCount}</span><button type="button" title="上一页" disabled={page <= 1} onClick={() => setPage(current => current - 1)} className="rounded-md p-1.5 hover:bg-slate-100 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><button type="button" title="下一页" disabled={page >= pageCount} onClick={() => setPage(current => current + 1)} className="rounded-md p-1.5 hover:bg-slate-100 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>
        </section>

        <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white xl:sticky xl:top-6 xl:min-h-[calc(100vh-9rem)]">
          {!selected ? <div className="px-5 py-14 text-center text-sm text-slate-500">选择一个文档查看详情</div> : <><div className="flex items-center justify-between border-b border-slate-100 px-4"><div className="flex h-12 items-center gap-1"><button type="button" onClick={() => setActiveTab('details')} className={`h-full border-b-2 px-3 text-sm ${activeTab === 'details' ? 'border-blue-600 font-medium text-blue-700' : 'border-transparent text-slate-500'}`}>详情</button><button type="button" onClick={() => setActiveTab('content')} className={`h-full border-b-2 px-3 text-sm ${activeTab === 'content' ? 'border-blue-600 font-medium text-blue-700' : 'border-transparent text-slate-500'}`}>解析内容</button></div><button type="button" title="关闭详情" onClick={() => select(null)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>{activeTab === 'details' ? <div className="space-y-5 p-5"><label className="block text-sm font-medium text-slate-700">文档标题<input value={title} onChange={event => setTitle(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label><div className="flex gap-2"><button type="button" disabled={saving || !title.trim() || title.trim() === selected.title} onClick={() => void handleSave()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}保存</button><button type="button" disabled={deleting} onClick={() => void handleDelete(selected)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" />删除</button></div><dl className="grid gap-x-4 gap-y-4 text-sm"><div><dt className="text-slate-500">处理状态</dt><dd className="mt-1 text-slate-800">{STATUS[selected.status]}</dd></div><div><dt className="text-slate-500">分块数量</dt><dd className="mt-1 text-slate-800">{selected.chunkCount}</dd></div><div><dt className="text-slate-500">OCR</dt><dd className="mt-1 text-slate-800">{selected.isOcr ? '已开启' : '未开启'}</dd></div><div><dt className="text-slate-500">创建时间</dt><dd className="mt-1 text-slate-800">{formatDate(selected.createdAt)}</dd></div><div><dt className="text-slate-500">完成时间</dt><dd className="mt-1 text-slate-800">{formatDate(selected.activatedAt)}</dd></div><div><dt className="text-slate-500">向量集合</dt><dd className="mt-1 break-all font-mono text-xs text-slate-700">{selected.collectionName}</dd></div><div><dt className="text-slate-500">Embedding 模型</dt><dd className="mt-1 break-all font-mono text-xs text-slate-700">{selected.embeddingModel}</dd></div><div><dt className="text-slate-500">MinerU 批次</dt><dd className="mt-1 break-all font-mono text-xs text-slate-700">{selected.mineruBatchId || '-'}</dd></div>{selected.errorCode && <div><dt className="text-slate-500">错误信息</dt><dd className="mt-1 text-red-600">{selected.errorCode}</dd></div>}</dl></div> : <div className="p-4">{contentLoading && !content ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-blue-600" /></div> : contentError ? <div className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-800">{contentError}</div> : content ? <><div className="mb-3 text-xs text-slate-500">已加载 {content.content.length.toLocaleString()} / {content.totalChars.toLocaleString()} 个字符</div><pre className="max-h-[560px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">{content.content}</pre>{content.nextOffset !== null && <button type="button" disabled={contentLoading} onClick={() => void loadContent(content.nextOffset, true)} className="mt-3 w-full rounded-lg border border-slate-300 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">{contentLoading ? '加载中…' : '加载更多'}</button>}</> : <div className="py-12 text-center text-sm text-slate-500">暂无解析内容</div>}</div>}</>}
        </aside>
      </div>
    </div>
  );
}
