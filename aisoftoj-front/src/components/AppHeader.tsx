import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookMarked, BookOpen, Calendar, FileText, Github, LogOut, Settings, Shield, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { BrandLogo } from './BrandLogo';
import { useAuth } from '../hooks/useAuth';

interface AppHeaderProps {
  onShowAuth: () => void;
  onShowProfile: () => void;
}

export function AppHeader({ onShowAuth, onShowProfile }: AppHeaderProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const daysToExam = useMemo(() => {
    const examDate = new Date('2026-05-23');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    examDate.setHours(0, 0, 0, 0);
    return Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }, []);

  const navLinks = [
    { label: '打基础', href: '/foundation', icon: BookMarked },
    { label: '刷真题', href: '/papers', icon: BookOpen },
    { label: '论文冲刺', href: '/essay-sprint', icon: FileText },
  ];

  return (
    <header className="bg-white/70 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

        {/* Left: logo + nav */}
        <div className="flex items-center gap-6">
          <BrandLogo />
          <nav className="hidden md:flex gap-1">
            {navLinks.map(({ label, href, icon: Icon }) => (
              <button
                key={href}
                onClick={() => navigate(href)}
                className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors bg-transparent border-none cursor-pointer"
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Countdown — always visible */}
          <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">距离软考还有</span>
            <span>{daysToExam > 0 ? `${daysToExam}天` : daysToExam === 0 ? '今天考试！' : '已结束'}</span>
          </div>

          {/* GitHub */}
          <a
            href="https://github.com/Nanki-nn/aisoftoj"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-400 transition-colors no-underline"
          >
            <Github className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">项目开源 · </span>Star
          </a>

          {/* Auth */}
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full p-0 border-none bg-transparent cursor-pointer">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-bold">
                      {user.nickname.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onShowProfile} className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  个人中心
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/admin')} className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  后台管理
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  设置
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="flex items-center gap-2 text-red-600">
                  <LogOut className="w-4 h-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              onClick={onShowAuth}
              className="text-sm font-semibold px-4 py-1.5 rounded-md bg-slate-950 text-white hover:bg-blue-900 transition-colors border-none cursor-pointer"
            >
              登录
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
