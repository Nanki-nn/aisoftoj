import React, { useCallback, useRef, useState } from 'react';
import { Upload, Copy, Check, X, ImageIcon, Loader2 } from 'lucide-react';
import { uploadOssFile } from '../../lib/api';

type UploadedFile = {
  id: string;
  name: string;
  url: string;
  size: number;
  copied: boolean;
};

const DIR_OPTIONS = [
  { value: 'questions/', label: '题目图片 (questions/)' },
  { value: 'papers/', label: '试卷图片 (papers/)' },
  { value: 'misc/', label: '其他 (misc/)' },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminOssUpload() {
  const [dir, setDir] = useState('questions/');
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);
      setUploading(true);

      const results: UploadedFile[] = [];
      for (const file of Array.from(files)) {
        try {
          const url = await uploadOssFile(file, dir);
          results.push({
            id: `${Date.now()}-${Math.random()}`,
            name: file.name,
            url,
            size: file.size,
            copied: false,
          });
        } catch (err) {
          setError(`${file.name} 上传失败：${(err as Error).message}`);
        }
      }

      setUploadedFiles((prev) => [...results, ...prev]);
      setUploading(false);
    },
    [dir]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleCopy(id: string, url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, copied: true } : f))
      );
      setTimeout(() => {
        setUploadedFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, copied: false } : f))
        );
      }, 2000);
    });
  }

  function handleRemove(id: string) {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-5">图片上传</h1>

      {/* Dir selector */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-slate-600 shrink-0">上传目录</label>
        <select
          value={dir}
          onChange={(e) => setDir(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {DIR_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
          dragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/50'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        {uploading ? (
          <Loader2 size={36} className="text-blue-500 animate-spin" />
        ) : (
          <Upload size={36} className="text-slate-400" />
        )}
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700">
            {uploading ? '上传中...' : '点击或拖拽图片到此处'}
          </p>
          <p className="text-xs text-slate-400 mt-1">支持 JPG、PNG、GIF、WebP、SVG，单文件最大 10MB</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Uploaded list */}
      {uploadedFiles.length > 0 && (
        <div className="mt-5">
          <h2 className="text-sm font-medium text-slate-700 mb-3">已上传（{uploadedFiles.length} 张）</h2>
          <div className="space-y-2">
            {uploadedFiles.map((f) => (
              <div
                key={f.id}
                className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3"
              >
                {/* Preview */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
                  <img
                    src={f.url}
                    alt={f.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <ImageIcon size={20} className="text-slate-400 absolute" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{f.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatSize(f.size)}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate font-mono">{f.url}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleCopy(f.id, f.url)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      f.copied
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                    }`}
                  >
                    {f.copied ? <Check size={13} /> : <Copy size={13} />}
                    {f.copied ? '已复制' : '复制链接'}
                  </button>
                  <button
                    onClick={() => handleRemove(f.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
