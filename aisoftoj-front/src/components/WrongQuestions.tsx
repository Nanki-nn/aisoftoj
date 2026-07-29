import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Eye, Trash2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Skeleton } from './ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { fetchWrongQuestions } from '../lib/api';
import { importanceLevels, type PracticeRecord } from '../types/record';

interface WrongQuestionsProps {
  onViewQuestion: (record: PracticeRecord) => void;
}

function WrongRowsSkeleton() {
  return (
    <div className="divide-y divide-slate-100" aria-label="正在加载错题记录" aria-busy="true">
      {[0, 1, 2, 3, 4].map((item) => (
        <div key={item} className="grid min-w-[900px] grid-cols-[2fr_1.5fr_1fr_0.75fr_1.4fr_1fr_1.2fr] items-center gap-4 px-4 py-5 sm:px-6">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-6 w-20 rounded-lg" />
          <Skeleton className="mx-auto h-5 w-10" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mx-auto h-6 w-20 rounded-lg" />
          <Skeleton className="mx-auto h-9 w-24 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function WrongQuestions({ onViewQuestion }: WrongQuestionsProps) {
  const navigate = useNavigate();
  const [records, setRecords] = useState<PracticeRecord[]>([]);
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
    setError(null);

    fetchWrongQuestions({ page, pageSize })
      .then((data) => {
        if (!isMounted) return;
        setRecords(data.records);
        setTotal(data.total);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || '错题记录加载失败');
        setRecords([]);
        setTotal(0);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [page, pageSize]);

  const handleRemove = (id: string) => {
    if (confirm('确定要从当前视图移除这条错题记录吗？重新加载后仍会恢复。')) {
      setRecords((current) => current.filter((record) => record.id !== id));
    }
  };

  const handleView = (record: PracticeRecord) => {
    if (!record.sessionId || !record.questionId) {
      alert('这条错题缺少对应刷题会话，暂时无法查看原题');
      return;
    }
    onViewQuestion(record);
  };

  const handlePageSizeChange = (value: string) => {
    setPage(1);
    setPageSize(Number(value));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-4 text-sm">
          <button
            type="button"
            onClick={() => navigate('/papers')}
            className="inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            返回试卷列表
          </button>
          <span className="text-slate-400" aria-hidden="true">›</span>
          <span className="text-slate-500">错题记录</span>
        </div>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <CardTitle className="text-2xl font-medium text-slate-800">错题记录</CardTitle>
              <Button
                onClick={() => navigate('/papers')}
                className="h-10 rounded-lg bg-blue-600 px-4 font-medium shadow-sm shadow-blue-600/20 hover:bg-blue-700"
              >
                生成练习
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-6">
              <p className="text-sm text-slate-500">按错误次数优先排序，集中复习高频薄弱点。</p>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>每页</span>
                <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="h-9 w-20 rounded-lg bg-white">
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

            {isLoading && <WrongRowsSkeleton />}

            {!isLoading && error && (
              <div className="px-6 py-14 text-center">
                <p className="font-medium text-red-700">错题记录加载失败</p>
                <p className="mt-2 text-sm text-red-600">{error}</p>
              </div>
            )}

            {!isLoading && !error && records.length === 0 && (
              <div className="px-6 py-16 text-center text-slate-500">
                <AlertCircle className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
                <p className="mt-4 font-medium text-slate-700">暂无错题记录</p>
                <p className="mt-1 text-sm">继续刷题，答错的题目会自动沉淀在这里。</p>
              </div>
            )}

            {!isLoading && !error && records.length > 0 && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="px-4 py-3 text-slate-600 sm:px-6">题目名称</TableHead>
                      <TableHead className="px-4 py-3 text-slate-600">所属题库</TableHead>
                      <TableHead className="px-4 py-3 text-center text-slate-600">题目类型</TableHead>
                      <TableHead className="px-4 py-3 text-center text-slate-600">错误次数</TableHead>
                      <TableHead className="px-4 py-3 text-slate-600">更新时间</TableHead>
                      <TableHead className="px-4 py-3 text-center text-slate-600">重要级别</TableHead>
                      <TableHead className="px-4 py-3 text-center text-slate-600">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => {
                      const importance = importanceLevels[record.importance];
                      return (
                        <TableRow key={record.id} className="hover:bg-slate-50">
                          <TableCell className="max-w-72 px-4 py-4 font-medium text-slate-800 sm:px-6">
                            <span className="block truncate" title={record.topicName}>{record.topicName}</span>
                          </TableCell>
                          <TableCell className="max-w-64 px-4 py-4 text-slate-600">
                            <span className="block truncate" title={record.questionBank}>{record.questionBank}</span>
                          </TableCell>
                          <TableCell className="px-4 py-4 text-center">
                            <Badge variant="secondary" className="border-blue-200 bg-blue-50 text-blue-700">
                              {record.topicType}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-4 text-center font-semibold tabular-nums text-red-500">{record.errorCount}</TableCell>
                          <TableCell className="whitespace-nowrap px-4 py-4 text-slate-600">{record.updateTime}</TableCell>
                          <TableCell className="px-4 py-4 text-center">
                            <Badge variant="secondary" className={importance.color}>
                              {importance.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleView(record)}
                                className="h-9 rounded-lg text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                              >
                                <Eye className="mr-1.5 h-4 w-4" aria-hidden="true" />
                                查看
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemove(record.id)}
                                className="h-9 w-9 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                                aria-label={'移除' + record.topicName}
                                title="仅从当前视图移除，重新加载后恢复"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="text-sm text-slate-500">共 {total} 条，当前显示 {startRecord}-{endRecord}</div>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
                    <span className="min-w-16 text-center text-sm tabular-nums text-slate-600">{page} / {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
