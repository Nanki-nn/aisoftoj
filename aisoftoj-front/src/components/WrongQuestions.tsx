import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ArrowLeft } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { importanceLevels } from '../types/record';
import { PracticeRecord } from '../types/record';
import { fetchWrongQuestions } from '../lib/api';

interface WrongQuestionsProps {
  onBack: () => void;
}

export function WrongQuestions({ onBack }: WrongQuestionsProps) {
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchWrongQuestions()
      .then((data) => {
        if (isMounted) {
          setRecords(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || '错题记录加载失败');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRemove = (id: string) => {
    if (confirm('确定要移除这条错题记录吗？')) {
      setRecords(records.filter(r => r.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* 顶部导航栏 */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BrandLogo />
              <span className="text-slate-300">|</span>
              <Button variant="ghost" size="sm" onClick={onBack} className="flex items-center gap-1 text-slate-600">
                首页
              </Button>
              <span className="text-slate-400 text-sm">题库列表 {'>'} 错题记录</span>
            </div>
          </div>
        </div>
      </div>

      {/* 主体内容 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Card className="bg-white shadow-sm border border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle>错题记录</CardTitle>
              <Button className="bg-blue-600 hover:bg-blue-700">
                生成练习
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading && <div className="p-6 text-slate-500">正在加载错题记录...</div>}
            {error && <div className="p-6 text-red-600">{error}</div>}
            {!isLoading && !error && (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-slate-600">题目名称</TableHead>
                  <TableHead className="text-slate-600">所属题库</TableHead>
                  <TableHead className="text-slate-600 text-center">题目类型</TableHead>
                  <TableHead className="text-slate-600 text-center">错误次数</TableHead>
                  <TableHead className="text-slate-600">更新时间</TableHead>
                  <TableHead className="text-slate-600 text-center">重要级别</TableHead>
                  <TableHead className="text-slate-600 text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id} className="hover:bg-slate-50">
                    <TableCell className="text-slate-800">{record.topicName}</TableCell>
                    <TableCell className="text-slate-600">{record.questionBank}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                        {record.topicType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-slate-800">{record.errorCount}</TableCell>
                    <TableCell className="text-slate-600">{record.updateTime}</TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant="secondary" 
                        className={importanceLevels[record.importance].color}
                      >
                        {importanceLevels[record.importance].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(record.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        移除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
