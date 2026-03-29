import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from './ui/button';
import { ArrowLeft } from 'lucide-react';

export function EssayResult() {
  const navigate = useNavigate();
  const { submissionId } = useParams();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50 p-12 text-center max-w-md w-full">
        <p className="text-slate-500 mb-2 text-sm">提交记录 #{submissionId}</p>
        <h2 className="text-xl text-slate-700 mb-6">论文批改结果（开发中）</h2>
        <Button variant="outline" onClick={() => navigate('/essay')} className="border-slate-200">
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回题目列表
        </Button>
      </div>
    </div>
  );
}
