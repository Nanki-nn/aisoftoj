import React, { useCallback, useEffect, useState } from 'react';
import { Search, Pencil, Trash2, X, Check } from 'lucide-react';
import {
  AdminUserDTO,
  AdminUserUpdateRequest,
  listAdminUsers,
  updateAdminUser,
  deleteAdminUser,
} from '../../lib/api';

const PAGE_SIZE = 10;

type EditState = {
  userId: number;
  loginName: string;
  nickName: string;
  email: string;
  phone: string;
  isEnabled: boolean;
};

function buildEditState(user: AdminUserDTO): EditState {
  return {
    userId: user.id,
    loginName: user.loginName ?? '',
    nickName: user.nickName ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
    isEnabled: user.isEnabled,
  };
}

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUserDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [inputKeyword, setInputKeyword] = useState('');
  const [enabledFilter, setEnabledFilter] = useState<'' | 'true' | 'false'>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editState, setEditState] = useState<EditState | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<AdminUserDTO | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(
    (p: number, kw: string, enabled: '' | 'true' | 'false') => {
      setLoading(true);
      setError(null);
      listAdminUsers({
        keyword: kw || undefined,
        enabled: enabled === '' ? undefined : enabled === 'true',
        page: p,
        pageSize: PAGE_SIZE,
      })
        .then((res) => {
          setUsers(res.records);
          setTotal(res.total);
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    load(page, keyword, enabledFilter);
  }, [load, page, keyword, enabledFilter]);

  function handleSearch() {
    setPage(1);
    setKeyword(inputKeyword);
  }

  function handleEnabledChange(val: '' | 'true' | 'false') {
    setPage(1);
    setEnabledFilter(val);
  }

  async function handleEditSave() {
    if (!editState) return;
    setEditLoading(true);
    setEditError(null);
    const payload: AdminUserUpdateRequest = {
      loginName: editState.loginName || undefined,
      nickName: editState.nickName || undefined,
      email: editState.email || undefined,
      phone: editState.phone || undefined,
      isEnabled: editState.isEnabled,
    };
    try {
      const updated = await updateAdminUser(editState.userId, payload);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditState(null);
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteAdminUser(deleteTarget.id);
      setDeleteTarget(null);
      load(page, keyword, enabledFilter);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDeleteLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-5">用户管理</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="搜索用户名 / 邮箱 / 手机"
            value={inputKeyword}
            onChange={(e) => setInputKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <Search size={14} />
            搜索
          </button>
        </div>
        <select
          value={enabledFilter}
          onChange={(e) => handleEnabledChange(e.target.value as '' | 'true' | 'false')}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全部状态</option>
          <option value="true">已启用</option>
          <option value="false">已禁用</option>
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
              <th className="text-left px-4 py-3 text-slate-600 font-medium">用户名</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">昵称</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">邮箱</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">刷题次数</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">错题数</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">状态</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-slate-400">
                  加载中...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-slate-400">
                  暂无数据
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{user.id}</td>
                  <td className="px-4 py-3 text-slate-800">{user.loginName || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{user.nickName || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{user.email || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{user.sessionCount}</td>
                  <td className="px-4 py-3 text-slate-600">{user.wrongQuestionCount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.isEnabled
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {user.isEnabled ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditState(buildEditState(user))}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="编辑"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(user)}
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

      {/* Edit Modal */}
      {editState && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-800">编辑用户</h2>
              <button
                onClick={() => setEditState(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X size={18} />
              </button>
            </div>
            {editError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {editError}
              </div>
            )}
            <div className="space-y-4">
              {(
                [
                  { key: 'loginName', label: '用户名' },
                  { key: 'nickName', label: '昵称' },
                  { key: 'email', label: '邮箱' },
                  { key: 'phone', label: '手机号' },
                ] as const
              ).map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-sm text-slate-600 mb-1">{label}</label>
                  <input
                    type="text"
                    value={editState[key]}
                    onChange={(e) =>
                      setEditState((prev) => prev && { ...prev, [key]: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-600">账号状态</label>
                <button
                  type="button"
                  onClick={() =>
                    setEditState((prev) => prev && { ...prev, isEnabled: !prev.isEnabled })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    editState.isEnabled ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      editState.isEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm text-slate-500">
                  {editState.isEnabled ? '启用' : '禁用'}
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditState(null)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleEditSave}
                disabled={editLoading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                <Check size={14} />
                {editLoading ? '保存中...' : '保存'}
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
              确定要删除用户{' '}
              <span className="font-medium text-slate-800">
                {deleteTarget.loginName || deleteTarget.email}
              </span>{' '}
              吗？此操作不可恢复。
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
