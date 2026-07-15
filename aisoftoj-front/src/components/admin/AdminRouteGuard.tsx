import React from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { useAuth } from '../../hooks/useAuth';

export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const {
    user,
    isAuthInitialized,
    authInitializationError,
    checkAuthStatus,
  } = useAuth();

  if (!isAuthInitialized) {
    if (authInitializationError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-semibold text-slate-900">管理员身份校验失败</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{authInitializationError}</p>
            <Button className="mt-6" onClick={() => void checkAuthStatus()}>
              重新校验
            </Button>
          </div>
        </main>
      );
    }

    return (
      <div
        className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600"
        role="status"
      >
        正在验证管理员权限…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
