import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, ImageUp, ChevronLeft } from 'lucide-react';

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
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col">
        <div className="h-14 flex items-center px-4 border-b border-slate-200">
          <span className="font-semibold text-slate-800 text-sm">知构后台管理</span>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
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
        <div className="p-3 border-t border-slate-200">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <ChevronLeft size={16} />
            返回前台
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 p-6 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
