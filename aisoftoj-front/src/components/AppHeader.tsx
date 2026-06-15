import React from 'react';
import { Link } from 'react-router-dom';
import { Bot, BookOpen, Database, FileText, History, LogIn, UserRound } from 'lucide-react';

import { Button } from './ui/button';
import { BrandLogo } from './BrandLogo';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../hooks/useAuth';

type AppHeaderProps = {
  onShowAuth: () => void;
  onShowProfile: () => void;
};

export function AppHeader({ onShowAuth, onShowProfile }: AppHeaderProps) {
  const { user, isAuthenticated } = useAuth();

  return (
    <header className="app-header sticky top-0 z-40">
      <div className="app-header-inner mx-auto w-full px-4 py-3">
        <div className="shrink-0">
          <BrandLogo />
        </div>

        <nav className="app-header-nav" aria-label="主要导航">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/papers">
              <BookOpen className="mr-1.5 h-4 w-4" />
              历年真题
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/essay">
              <FileText className="mr-1.5 h-4 w-4" />
              论文批改
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/ai-chat">
              <Bot className="mr-1.5 h-4 w-4" />
              AI 问答
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/knowledge-base">
              <Database className="mr-1.5 h-4 w-4" />
              知识库
            </Link>
          </Button>
          {isAuthenticated && (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/practice-history">
                <History className="mr-1.5 h-4 w-4" />
                刷题记录
              </Link>
            </Button>
          )}
        </nav>

        <div className="typewriter-motto" aria-label="不积跬步，无以至千里。">
          <span>不积跬步，无以至千里。</span>
        </div>

        <div className="flex items-center justify-self-end gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <Button variant="outline" size="sm" onClick={onShowProfile} className="app-secondary-button header-account-button header-utility-button">
              <UserRound className="mr-1.5 h-4 w-4" />
              {user?.nickname || user?.username || '个人中心'}
            </Button>
          ) : (
            <Button size="sm" onClick={onShowAuth} className="app-primary-button header-login-button header-utility-button">
              <LogIn className="mr-1.5 h-4 w-4" />
              登录
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
