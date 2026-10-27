import React, { useState, useEffect } from 'react';
import { 
  FolderTree, 
  FileCode, 
  FolderPlus, 
  FilePlus, 
  ArrowLeft, 
  RefreshCw, 
  Trash2, 
  Shield, 
  Clock, 
  HardDrive 
} from 'lucide-react';
import { api } from '../services/api';
import type { FileItem } from '../../../shared/types.js';

interface FileManagerProps {
  onOpenFileEditor: (filePath: string) => void;
}

export const FileManager: React.FC<FileManagerProps> = ({ onOpenFileEditor }) => {
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDirectory();
  }, []);

  const loadDirectory = async (targetPath?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listFiles(targetPath);
      setItems(res.items);
      setCurrentPath(res.path);
    } catch (err: any) {
      setError(err.message || 'Failed to list directory');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split(/[/\\]/).filter(Boolean);
    parts.pop();
    const parentPath = currentPath.startsWith('/') ? '/' + parts.join('/') : parts.join('\\');
    loadDirectory(parentPath || '/');
  };

  const handleDelete = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete ${path}?`)) return;
    try {
      await api.deleteFile(path);
      loadDirectory(currentPath);
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const handleCreateDirectory = async () => {
    const name = prompt('Enter new directory name:');
    if (!name) return;
    const newPath = currentPath.endsWith('/') || currentPath.endsWith('\\') 
      ? `${currentPath}${name}` 
      : `${currentPath}/${name}`;
    try {
      await fetch('/api/files/create-dir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: newPath }),
      });
      loadDirectory(currentPath);
    } catch (err: any) {
      alert(err.message || 'Failed to create directory');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Server File Manager</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Explore and edit server files, site directories, and configuration templates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateDirectory}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-smooth"
          >
            <FolderPlus className="w-4 h-4 text-brand-600" />
            <span>New Folder</span>
          </button>
          <button
            onClick={() => loadDirectory(currentPath)}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-smooth"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Path Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-card flex items-center gap-3">
        <button
          onClick={handleNavigateUp}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
          title="Parent Directory"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 font-mono text-xs font-semibold text-slate-800 truncate px-2 py-1 bg-slate-50 rounded-xl border border-slate-200/60">
          {currentPath || 'Loading...'}
        </div>
      </div>

      {/* Files List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading directory contents...</div>
        ) : error ? (
          <div className="p-6 text-center text-rose-500 text-xs">{error}</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">This directory is empty.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div
                key={item.name}
                onClick={() => {
                  if (item.isDirectory) {
                    loadDirectory(item.path);
                  } else {
                    onOpenFileEditor(item.path);
                  }
                }}
                className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/70 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.isDirectory ? (
                    <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 flex-shrink-0">
                      <FolderTree className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-500 flex-shrink-0 group-hover:text-brand-600">
                      <FileCode className="w-4 h-4" />
                    </div>
                  )}
                  <span className="text-xs font-bold text-slate-800 font-mono group-hover:text-brand-600 transition-colors truncate">
                    {item.name}
                  </span>
                </div>

                <div className="flex items-center gap-6 text-xs text-slate-400 font-medium">
                  <span className="font-mono text-[11px] hidden sm:inline">
                    {item.isDirectory ? 'Folder' : `${(item.size / 1024).toFixed(1)} KB`}
                  </span>
                  <span className="text-[11px] hidden md:inline">
                    {new Date(item.modifiedAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, item.path)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
