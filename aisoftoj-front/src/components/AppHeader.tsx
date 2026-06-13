import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Calendar, GraduationCap, Github, LogOut, Settings, Shield, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useAuth } from '../hooks/useAuth';

interface AppHeaderProps {
  onShowAuth: () => void;
  onShowProfile: () => void;
}

const HIDE_FOUNDATION_AND_ESSAY = false;

const NAV_LINKS = [
  { path: '/foundation', label: '打基础' },
  { path: '/papers', label: '刷真题' },
  { path: '/essay-sprint', label: '论文冲刺' },
];

const VISIBLE_NAV_LINKS = HIDE_FOUNDATION_AND_ESSAY
  ? NAV_LINKS.filter((l) => l.path === '/papers')
  : NAV_LINKS;

export function AppHeader({ onShowAuth, onShowProfile }: AppHeaderProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const daysLeft = useMemo(() => {
    const examDate = new Date('2026-05-23');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    examDate.setHours(0, 0, 0, 0);
    const diff = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, []);

  return (
    <div className="bg-white border-b border-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* 左侧：Logo + 主导航 */}
          <div className="flex items-center gap-8">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity bg-transparent border-none cursor-pointer p-0"
            >
              <GraduationCap className="w-7 h-7 text-blue-600" />
              <span className="text-xl font-semibold text-slate-800">知构软考</span>
            </button>

            <nav className="hidden md:flex items-center gap-7">
              {VISIBLE_NAV_LINKS.map((link) => (
                <Button
                  key={link.path}
                  variant="ghost"
                  onClick={() => navigate(link.path)}
                  className={
                    currentPath === link.path
                      ? 'text-blue-700 bg-blue-50 hover:bg-blue-50 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                  }
                >
                  {link.label}
                </Button>
              ))}
            </nav>
          </div>

          {/* 右侧：倒计时 + GitHub + 用户菜单 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-amber-50 text-amber-800 px-4 py-2 rounded-lg border border-amber-200">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">距离考试还有</span>
              <span className="font-semibold">{daysLeft}天</span>
            </div>

            <a
              href="https://github.com/Nanki-nn/aisoftoj"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-md text-slate-800 hover:text-slate-950 hover:bg-slate-50 transition-colors no-underline"
            >
              <Github className="w-4 h-4" />
              <span>Star</span>
            </a>

            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-10 w-10 rounded-full p-0">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {user.nickname.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={onShowProfile} className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    个人中心
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/practice-history')} className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    刷题历史
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/wrong-questions')} className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    错题本
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/admin')} className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    后台管理
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout} className="flex items-center gap-2 text-red-600">
                    <LogOut className="w-4 h-4" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button onClick={onShowAuth} variant="outline" className="font-semibold border-slate-200 shadow-sm hover:bg-slate-50">
                登录 / 注册
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
