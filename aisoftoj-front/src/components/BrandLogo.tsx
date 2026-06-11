import React from 'react';
import { Link } from 'react-router-dom';

export function BrandLogo() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-2 no-underline"
    >
      {/* Geometric mark */}
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="0" y="0" width="9" height="9" className="fill-blue-900" />
        <rect x="11" y="0" width="9" height="9" className="fill-blue-900" opacity="0.35" />
        <rect x="0" y="11" width="9" height="9" className="fill-blue-900" opacity="0.35" />
        <rect x="11" y="11" width="9" height="9" className="fill-blue-900" />
      </svg>
      <span className="font-bold text-sm text-slate-900 whitespace-nowrap" style={{ letterSpacing: '-0.01em' }}>
        知构<span className="text-blue-900">软考</span>
      </span>
    </Link>
  );
}
