import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, History, LogIn, UserRound } from 'lucide-react';
import { Button } from './ui/button';
import { BrandLogo } from './BrandLogo';
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
          {isAuthenticated && (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/practice-history">
                <History className="mr-1.5 h-4 w-4" />
                刷题记录
              </Link>
            </Button>
          )}
        </nav>

        <div className="typewriter-motto" aria-label="不积跬步，无以至千里！">
          <span>不积跬步，无以至千里！</span>
        </div>

        {isAuthenticated ? (
          <Button variant="outline" size="sm" onClick={onShowProfile} className="header-account-button">
            <UserRound className="mr-1.5 h-4 w-4" />
            {user?.nickname || user?.username || '个人中心'}
          </Button>
        ) : (
          <Button size="sm" onClick={onShowAuth} className="header-login-button">
            <LogIn className="mr-1.5 h-4 w-4" />
            登录
          </Button>
        )}
      </div>
    </header>
  );
}
