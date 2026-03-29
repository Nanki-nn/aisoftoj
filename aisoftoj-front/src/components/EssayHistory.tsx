import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { ArrowLeft } from 'lucide-react';

export function EssayHistory() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50 p-12 text-center max-w-md w-full">
        <h2 className="text-xl text-slate-700 mb-6">论文练习记录（开发中）</h2>
        <Button variant="outline" onClick={() => navigate('/essay')} className="border-slate-200">
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回题目列表
        </Button>
      </div>
    </div>
  );
}
