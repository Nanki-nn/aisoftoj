import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

export function BrandLogo() {
  return (
    <Link
      to="/"
      className="brand-logo inline-flex items-center gap-2 text-slate-800 transition-colors"
    >
      <span className="brand-logo-mark flex h-9 w-9 items-center justify-center text-white">
        <GraduationCap className="h-5 w-5" />
      </span>
      <span className="font-semibold">知构软考刷题平台</span>
    </Link>
  );
}
