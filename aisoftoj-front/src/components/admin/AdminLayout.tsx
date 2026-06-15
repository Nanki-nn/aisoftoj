import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, ImageUp, ChevronLeft } from 'lucide-react';

import { ThemeToggle } from '../ThemeToggle';

const NAV_ITEMS = [
  { path: '/admin', label: '数据概览', icon: LayoutDashboard, exact: true },
  { path: '/admin/users', label: '用户管理', icon: Users, exact: false },
  { path: '/admin/questions', label: '题库管理', icon: BookOpen, exact: false },
  { path: '/admin/oss', label: '图片上传', icon: ImageUp, exact: false },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  function isActive(item: (typeof NAV_ITEMS)[number]) {
    if (item.exact) {
      return location.pathname === item.path;
    }
    return location.pathname.startsWith(item.path);
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-14 items-center justify-between gap-2 border-b border-slate-200 px-4">
          <span className="text-sm font-semibold text-slate-800">知构后台管理</span>
          <ThemeToggle />
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <ChevronLeft size={16} />
            返回前台
          </Link>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
}
