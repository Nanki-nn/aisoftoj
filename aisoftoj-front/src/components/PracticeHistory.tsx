import React, { useEffect, useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ArrowLeft } from 'lucide-react';
import { fetchPracticeHistory } from '../lib/api';
import { PracticeSessionRecord } from '../types/record';

interface PracticeHistoryProps {
  onBack: () => void;
  onContinue: (recordId: string) => void;
}

export function PracticeHistory({ onBack, onContinue }: PracticeHistoryProps) {
  const [records, setRecords] = useState<PracticeSessionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchPracticeHistory()
      .then((data) => {
        if (isMounted) {
          setRecords(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || '刷题记录加载失败');
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

  const handleContinue = (id: string) => {
    onContinue(id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* 顶部导航栏 */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              返回
            </Button>
          </div>
        </div>
      </div>

      {/* 主体内容 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Card className="bg-white shadow-sm border border-slate-200">
          <CardContent className="p-6">
            <h2 className="text-slate-800 mb-6">刷题记录</h2>
            {isLoading && <div className="text-slate-500">正在加载刷题记录...</div>}
            {error && <div className="text-red-600">{error}</div>}
            {!isLoading && !error && (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200">
                  <TableHead className="text-slate-600">题库名称</TableHead>
                  <TableHead className="text-slate-600">题库类型</TableHead>
                  <TableHead className="text-slate-600">创建时间</TableHead>
                  <TableHead className="text-slate-600">答题情况</TableHead>
                  <TableHead className="text-slate-600">状态</TableHead>
                  <TableHead className="text-slate-600">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id} className="border-b border-slate-100">
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-700">{record.examName}</span>
                        <Badge 
                          variant="secondary" 
                          className={
                            record.examMode === 'exam' 
                              ? "bg-red-50 text-red-600 border-0 w-fit" 
                              : "bg-slate-100 text-slate-600 border-0 w-fit"
                          }
                        >
                          {record.examMode === 'exam' ? '考试模式' : '练习模式'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">{record.examType}</TableCell>
                    <TableCell className="text-slate-600">{record.createTime}</TableCell>
                    <TableCell className="text-slate-600">
                      {record.answeredCount}/{record.totalCount}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={
                          record.status === 'inProgress'
                            ? "bg-orange-50 text-orange-600 border-0"
                            : "bg-green-50 text-green-600 border-0"
                        }
                      >
                        {record.status === 'inProgress' ? '进行中' : '已完成'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleContinue(record.id)}
                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                      >
                        继续
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
