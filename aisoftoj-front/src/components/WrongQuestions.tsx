import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft } from 'lucide-react';
import { importanceLevels } from '../types/record';
import { PracticeRecord } from '../types/record';
import { fetchWrongQuestions } from '../lib/api';

interface WrongQuestionsProps {
  onBack: () => void;
  onViewQuestion: (record: PracticeRecord) => void;
}

export function WrongQuestions({ onBack, onViewQuestion }: WrongQuestionsProps) {
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
    fetchWrongQuestions({ page, pageSize })
      .then((data) => {
        if (isMounted) {
          setRecords(data.records);
          setTotal(data.total);
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
  }, [page, pageSize]);

  const handleRemove = (id: string) => {
    if (confirm('确定要移除这条错题记录吗？')) {
      setRecords(records.filter(r => r.id !== id));
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
      {/* 顶部导航栏 */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              返回
            </Button>
            <div className="text-slate-500">题库列表 {'>'} 错题记录</div>
          </div>
        </div>
      </div>

      {/* 主体内容 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Card className="bg-white shadow-sm border border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle>错题记录</CardTitle>
              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
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
                <Button className="bg-blue-600 hover:bg-blue-700">
                  生成练习
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading && <div className="p-6 text-slate-500">正在加载错题记录...</div>}
            {error && <div className="p-6 text-red-600">{error}</div>}
            {!isLoading && !error && (
            <>
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
                          onClick={() => handleView(record)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          查看
                        </Button>
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
              {records.length === 0 ? (
                <div className="py-10 text-center text-slate-500">暂无错题记录</div>
              ) : (
                <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
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
