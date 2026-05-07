import React, { useEffect, useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { fetchPracticeHistory } from '../lib/api';
import { PracticeSessionRecord } from '../types/record';

interface PracticeHistoryProps {
  onBack: () => void;
  onContinue: (recordId: string, status: PracticeSessionRecord['status']) => void;
  onViewResult: (recordId: string) => void;
}

export function PracticeHistory({ onBack, onContinue, onViewResult }: PracticeHistoryProps) {
  const [records, setRecords] = useState<PracticeSessionRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, total);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    fetchPracticeHistory({ page, pageSize })
      .then((data) => {
        if (isMounted) {
          setRecords(data.records);
          setTotal(data.total);
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
  }, [page, pageSize]);

  const handleContinue = (id: string) => {
    const record = records.find(item => item.id === id);
    if (!record) {
      return;
    }
    onContinue(id, record.status);
  };

  const handlePageSizeChange = (value: string) => {
    setPage(1);
    setPageSize(Number(value));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* 主体内容 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Card className="bg-white shadow-sm border border-slate-200">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600">
                  首页
                </Button>
                <h2 className="text-slate-800">刷题记录</h2>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>每页</span>
                <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="h-8 w-20 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span>条</span>
              </div>
            </div>
            {isLoading && <div className="text-slate-500">正在加载刷题记录...</div>}
            {error && <div className="text-red-600">{error}</div>}
            {!isLoading && !error && (
            <>
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
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleContinue(record.id)}
                            className={
                              record.status === 'completed'
                                ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                                : 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'
                            }
                          >
                            {record.status === 'completed' ? '查看' : '继续'}
                          </Button>
                          {record.status === 'completed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onViewResult(record.id)}
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            >
                              结果
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {records.length === 0 ? (
                <div className="py-10 text-center text-slate-500">暂无刷题记录</div>
              ) : (
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-slate-500">
                    共 {total} 条，当前显示 {startRecord}-{endRecord}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      上一页
                    </Button>
                    <span className="min-w-16 text-center text-sm text-slate-600">
                      {page} / {totalPages}
                    </span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                      下一页
                    </Button>
                  </div>
                </div>
              )}
            </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
