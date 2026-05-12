import React, { useCallback, useEffect, useState } from 'react';
import { Search, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import {
  AdminQuestionDTO,
  AdminQuestionRequest,
  listAdminQuestions,
  createAdminQuestion,
  updateAdminQuestion,
  deleteAdminQuestion,
  fetchAdminSubjects,
  fetchAdminYears,
  fetchAdminMonths,
} from '../../lib/api';

const PAGE_SIZE = 10;

const QUESTION_TYPES: Record<number, string> = {
  1: '单选题',
  2: '多选题',
  3: '判断题',
  4: '填空题',
  5: '案例题',
  6: '论文题',
};

const PAPER_CATES: Record<number, string> = {
  1: '综合知识',
  2: '案例分析',
  3: '论文',
};

const DIFFICULTIES: Record<number, string> = {
  1: '简单',
  2: '中等',
  3: '困难',
};

const DIFFICULTY_COLORS: Record<number, string> = {
  1: 'bg-green-100 text-green-700',
  2: 'bg-amber-100 text-amber-700',
  3: 'bg-red-100 text-red-700',
};

const EMPTY_FORM: AdminQuestionRequest = {
  name: '',
  intro: '',
  options: '[]',
  answer: '',
  analysis: '',
  questionType: 1,
  difficulty: 2,
};

type FormState = AdminQuestionRequest & { editId?: number };

export function AdminQuestions() {
  const [questions, setQuestions] = useState<AdminQuestionDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [inputKeyword, setInputKeyword] = useState('');
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<number | ''>('');
  const [diffFilter, setDiffFilter] = useState<number | ''>('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [yearFilter, setYearFilter] = useState<number | ''>('');
  const [monthFilter, setMonthFilter] = useState<number | ''>('');
  const [cateFilter, setCateFilter] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subjects, setSubjects] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [months, setMonths] = useState<number[]>([]);

  const [form, setForm] = useState<FormState | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<AdminQuestionDTO | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 加载科目和年份选项
  useEffect(() => {
    fetchAdminSubjects().then(setSubjects).catch(() => undefined);
    fetchAdminYears().then(setYears).catch(() => undefined);
    fetchAdminMonths().then(setMonths).catch(() => undefined);
  }, []);

  const load = useCallback(
    (
      p: number,
      kw: string,
      type: number | '',
      diff: number | '',
      subject: string,
      year: number | '',
      month: number | '',
      cate: number | ''
    ) => {
      setLoading(true);
      setError(null);
      listAdminQuestions({
        keyword: kw || undefined,
        questionType: type === '' ? undefined : type,
        difficulty: diff === '' ? undefined : diff,
        subjectName: subject || undefined,
        year: year === '' ? undefined : year,
        month: month === '' ? undefined : month,
        paperCateId: cate === '' ? undefined : cate,
        page: p,
        pageSize: PAGE_SIZE,
      })
        .then((res) => {
          setQuestions(res.records);
          setTotal(res.total);
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    load(page, keyword, typeFilter, diffFilter, subjectFilter, yearFilter, monthFilter, cateFilter);
  }, [load, page, keyword, typeFilter, diffFilter, subjectFilter, yearFilter, monthFilter, cateFilter]);

  function handleSearch() {
    setPage(1);
    setKeyword(inputKeyword);
  }

  function handleFilterChange<T>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) {
    setPage(1);
    setter(value);
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setFormError(null);
  }

  function openEdit(q: AdminQuestionDTO) {
    setForm({
      editId: q.id,
      name: q.name ?? '',
      intro: q.intro ?? '',
      options: q.options ?? '[]',
      answer: q.answer ?? '',
      analysis: q.analysis ?? '',
      questionType: q.questionType,
      difficulty: q.difficulty,
    });
    setFormError(null);
  }

  async function handleFormSave() {
    if (!form) return;
    if (!form.name.trim()) {
      setFormError('题目名称不能为空');
      return;
    }
    if (!form.answer.trim()) {
      setFormError('标准答案不能为空');
      return;
    }
    setFormLoading(true);
    setFormError(null);
    const payload: AdminQuestionRequest = {
      name: form.name.trim(),
      intro: form.intro || undefined,
      options: form.options || '[]',
      answer: form.answer.trim(),
      analysis: form.analysis || undefined,
      questionType: form.questionType,
      difficulty: form.difficulty,
    };
    try {
      if (form.editId) {
        const updated = await updateAdminQuestion(form.editId, payload);
        setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
      } else {
        await createAdminQuestion(payload);
        load(1, keyword, typeFilter, diffFilter, subjectFilter, yearFilter, monthFilter, cateFilter);
        setPage(1);
      }
      setForm(null);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteAdminQuestion(deleteTarget.id);
      setDeleteTarget(null);
      load(page, keyword, typeFilter, diffFilter, subjectFilter, yearFilter, monthFilter, cateFilter);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDeleteLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-slate-800">题库管理</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <Plus size={15} />
          新增题目
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="搜索题目名称 / 内容"
            value={inputKeyword}
            onChange={(e) => setInputKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <Search size={14} />
            搜索
          </button>
        </div>

        {/* 科目筛选 */}
        <select
          value={subjectFilter}
          onChange={(e) => handleFilterChange(setSubjectFilter, e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全部科目</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* 年份筛选 */}
        <select
          value={yearFilter}
          onChange={(e) =>
            handleFilterChange(setYearFilter, e.target.value === '' ? '' : Number(e.target.value))
          }
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全部年份</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y} 年
            </option>
          ))}
        </select>

        {/* 月份筛选 */}
        <select
          value={monthFilter}
          onChange={(e) =>
            handleFilterChange(setMonthFilter, e.target.value === '' ? '' : Number(e.target.value))
          }
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全部月份</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {m} 月
            </option>
          ))}
        </select>

        {/* 分类筛选 */}
        <select
          value={cateFilter}
          onChange={(e) =>
            handleFilterChange(setCateFilter, e.target.value === '' ? '' : Number(e.target.value))
          }
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全部分类</option>
          {Object.entries(PAPER_CATES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>

        {/* 难度筛选 */}
        <select
          value={diffFilter}
          onChange={(e) =>
            handleFilterChange(setDiffFilter, e.target.value === '' ? '' : Number(e.target.value))
          }
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全部难度</option>
          {Object.entries(DIFFICULTIES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 text-slate-600 font-medium">ID</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">题目名称</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">科目</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">年份</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">月份</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">分类</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">难度</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">答题次数</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-slate-400">
                  加载中...
                </td>
              </tr>
            ) : questions.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-slate-400">
                  暂无数据
                </td>
              </tr>
            ) : (
              questions.map((q) => (
                <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{q.id}</td>
                  <td className="px-4 py-3 text-slate-800 max-w-xs">
                    <span className="line-clamp-2">{q.name}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {q.subjectName ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
                        {q.subjectName}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {q.paperYear ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {q.paperMonth != null ? `${q.paperMonth} 月` : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {q.paperCateId ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700">
                        {PAPER_CATES[q.paperCateId] ?? q.paperCateId}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        DIFFICULTY_COLORS[q.difficulty] ?? 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {DIFFICULTIES[q.difficulty] ?? q.difficulty}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{q.readCt ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(q)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="编辑"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(q)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="删除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
        <span>共 {total} 条</span>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors"
          >
            上一页
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors"
          >
            下一页
          </button>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-800">
                {form.editId ? '编辑题目' : '新增题目'}
              </h2>
              <button
                onClick={() => setForm(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X size={18} />
              </button>
            </div>
            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {formError}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">
                  题目名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="简短描述题目"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">题目内容（intro）</label>
                <textarea
                  value={form.intro}
                  onChange={(e) => setForm((f) => f && { ...f, intro: e.target.value })}
                  rows={4}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  placeholder="完整题目内容，支持 HTML"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">题型</label>
                  <select
                    value={form.questionType}
                    onChange={(e) =>
                      setForm((f) => f && { ...f, questionType: Number(e.target.value) })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(QUESTION_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">难度</label>
                  <select
                    value={form.difficulty}
                    onChange={(e) =>
                      setForm((f) => f && { ...f, difficulty: Number(e.target.value) })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(DIFFICULTIES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">
                  选项（JSON 数组，单选/多选题填写）
                </label>
                <textarea
                  value={form.options}
                  onChange={(e) => setForm((f) => f && { ...f, options: e.target.value })}
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  placeholder='[{"key":"A","text":"选项A"},{"key":"B","text":"选项B"}]'
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">
                  标准答案 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.answer}
                  onChange={(e) => setForm((f) => f && { ...f, answer: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如 A 或 A,B（多选用逗号分隔）"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">解析</label>
                <textarea
                  value={form.analysis}
                  onChange={(e) => setForm((f) => f && { ...f, analysis: e.target.value })}
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  placeholder="答题解析说明"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setForm(null)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleFormSave}
                disabled={formLoading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                <Check size={14} />
                {formLoading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-2">确认删除</h2>
            <p className="text-sm text-slate-600 mb-6">
              确定要删除题目{' '}
              <span className="font-medium text-slate-800">「{deleteTarget.name}」</span> 吗？
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {deleteLoading ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
