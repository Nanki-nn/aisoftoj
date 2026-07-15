import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpenCheck,
  CalendarDays,
  GraduationCap,
  Github,
  History,
  LogOut,
  Menu,
  Shield,
  User,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { useAuth } from '../hooks/useAuth';

interface AppHeaderProps {
  onShowAuth: () => void;
  onShowProfile: () => void;
}

const EXAM_DATE = new Date('2026-05-23T00:00:00+08:00');

const NAV_LINKS = [
  { path: '/foundation', label: '打基础', enabled: false },
  { path: '/papers', label: '刷真题', enabled: true },
  { path: '/essay-sprint', label: '论文冲刺', enabled: false },
] as const;

function isCurrentRoute(currentPath: string, path: string) {
  return currentPath === path || currentPath.startsWith(`${path}/`);
}

export function AppHeader({ onShowAuth, onShowProfile }: AppHeaderProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const examStatus = useMemo(() => {
    const diff = EXAM_DATE.getTime() - Date.now();
    if (diff <= 0) {
      return { ended: true, days: 0 };
    }
    return { ended: false, days: Math.ceil(diff / (1000 * 60 * 60 * 24)) };
  }, []);

  const closeAndRun = (action: () => void) => {
    setMobileOpen(false);
    action();
  };

  const handleLogout = () => {
    setMobileOpen(false);
    logout();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-8">
          <Link
            to="/"
            className="group inline-flex shrink-0 items-center gap-2.5 rounded-lg text-slate-900 no-underline outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4"
            aria-label="返回知构软考首页"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/20">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="whitespace-nowrap text-lg font-semibold tracking-tight">知构软考</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="主导航">
            {NAV_LINKS.map((link) => {
              if (!link.enabled) {
                return (
                  <span
                    key={link.path}
                    aria-disabled="true"
                    className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-lg px-4 text-sm font-medium text-slate-400"
                  >
                    {link.label}
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                      暂未开放
                    </span>
                  </span>
                );
              }
              const active = isCurrentRoute(location.pathname, link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm font-medium text-amber-900 sm:px-4">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
            {examStatus.ended ? (
              <>
                <span className="sm:hidden">已结束</span>
                <span className="hidden sm:inline">本期考试已结束</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">距离考试还有</span>
                <span className="font-semibold tabular-nums">{examStatus.days} 天</span>
              </>
            )}
          </div>

          <a
            href="https://github.com/Nanki-nn/aisoftoj"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-700 no-underline outline-none transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 lg:inline-flex"
          >
            <Github className="h-4 w-4" aria-hidden="true" />
            Star
          </a>

          <div className="hidden lg:block">
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-10 w-10 rounded-full p-0 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                    aria-label="打开用户菜单"
                  >
                    <Avatar className="h-9 w-9 border border-blue-100">
                      <AvatarImage src={user.avatar} alt="" />
                      <AvatarFallback className="bg-blue-50 font-semibold text-blue-700">
                        {user.nickname.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl p-2">
                  <DropdownMenuItem onClick={onShowProfile} className="flex items-center gap-2 rounded-lg">
                    <User className="h-4 w-4" aria-hidden="true" />
                    个人中心
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/practice-history')} className="flex items-center gap-2 rounded-lg">
                    <History className="h-4 w-4" aria-hidden="true" />
                    刷题记录
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/wrong-questions')} className="flex items-center gap-2 rounded-lg">
                    <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
                    错题分析
                  </DropdownMenuItem>
                  {user.role === 'ADMIN' && (
                    <DropdownMenuItem onClick={() => navigate('/admin')} className="flex items-center gap-2 rounded-lg">
                      <Shield className="h-4 w-4" aria-hidden="true" />
                      后台管理
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={logout} className="flex items-center gap-2 rounded-lg text-red-600 focus:text-red-700">
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={onShowAuth}
                variant="outline"
                className="h-10 rounded-lg border-slate-300 bg-white px-4 font-medium text-slate-800 shadow-sm hover:bg-slate-50"
              >
                登录 / 注册
              </Button>
            )}
          </div>

          <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-lg border-slate-300 bg-white text-slate-800 lg:hidden"
                aria-label="打开导航菜单"
                aria-expanded={mobileOpen}
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
            </DialogTrigger>
            <DialogContent
              className="gap-0 rounded-none border-y-0 border-r-0 border-l border-slate-200 bg-white p-0"
              style={{
                left: 'auto',
                right: 0,
                top: 0,
                width: '75%',
                maxWidth: '24rem',
                height: '100%',
                transform: 'none',
                translate: 'none',
              }}
            >
              <DialogHeader className="border-b border-slate-100 px-6 py-5 text-left">
                <DialogTitle className="flex items-center gap-2.5 text-lg text-slate-900">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
                    <GraduationCap className="h-5 w-5" aria-hidden="true" />
                  </span>
                  知构软考
                </DialogTitle>
                <DialogDescription>按清晰路径完成软考备考</DialogDescription>
              </DialogHeader>

              <div className="flex flex-1 flex-col overflow-y-auto px-4 py-5">
                <nav className="space-y-1" aria-label="移动端主导航">
                  {NAV_LINKS.map((link) => {
                    if (!link.enabled) {
                      return (
                        <span
                          key={link.path}
                          aria-disabled="true"
                          className="flex min-h-12 cursor-not-allowed items-center justify-between rounded-xl px-4 text-base font-medium text-slate-400"
                        >
                          {link.label}
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-400">
                            暂未开放
                          </span>
                        </span>
                      );
                    }
                    const active = isCurrentRoute(location.pathname, link.path);
                    return (
                      <Link
                        key={link.path}
                        to={link.path}
                        onClick={() => setMobileOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={`flex min-h-12 items-center rounded-xl px-4 text-base font-medium no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 ${
                          active ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </nav>

                <div className="my-5 h-px bg-slate-100" />

                <a
                  href="https://github.com/Nanki-nn/aisoftoj"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 items-center gap-3 rounded-xl px-4 font-medium text-slate-700 no-underline outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <Github className="h-5 w-5" aria-hidden="true" />
                  GitHub Star
                </a>

                {isAuthenticated && user ? (
                  <div className="mt-5 space-y-1 border-t border-slate-100 pt-5">
                    <button
                      type="button"
                      onClick={() => closeAndRun(onShowProfile)}
                      className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-left font-medium text-slate-700 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      <User className="h-5 w-5" aria-hidden="true" />
                      个人中心
                    </button>
                    <button
                      type="button"
                      onClick={() => closeAndRun(() => navigate('/practice-history'))}
                      className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-left font-medium text-slate-700 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      <History className="h-5 w-5" aria-hidden="true" />
                      刷题记录
                    </button>
                    <button
                      type="button"
                      onClick={() => closeAndRun(() => navigate('/wrong-questions'))}
                      className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-left font-medium text-slate-700 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
                      错题分析
                    </button>
                    {user.role === 'ADMIN' && (
                      <button
                        type="button"
                        onClick={() => closeAndRun(() => navigate('/admin'))}
                        className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-left font-medium text-slate-700 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600"
                      >
                        <Shield className="h-5 w-5" aria-hidden="true" />
                        后台管理
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-left font-medium text-red-600 outline-none hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      <LogOut className="h-5 w-5" aria-hidden="true" />
                      退出登录
                    </button>
                  </div>
                ) : (
                  <Button
                    onClick={() => closeAndRun(onShowAuth)}
                    className="mt-auto h-12 rounded-xl bg-blue-600 text-base font-medium hover:bg-blue-700"
                  >
                    登录 / 注册
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}
