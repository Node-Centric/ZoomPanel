import React, { useState, useEffect } from 'react';
import { X, Save, FileCode, Check, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface FileEditorModalProps {
  filePath: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

export const FileEditorModal: React.FC<FileEditorModalProps> = ({
  filePath,
  onClose,
  onSaved,
}) => {
  const [content, setContent] = useState('');
  const [initialContent, setInitialContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!filePath) return;
    setIsLoading(true);
    setError(null);

    api
      .readFile(filePath)
      .then((data) => {
        setContent(data.content);
        setInitialContent(data.content);
      })
      .catch((err) => {
        setError(err.message || 'Failed to open file');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [filePath]);

  if (!filePath) return null;

  const isDirty = content !== initialContent;

  const handleSave = async () => {
    if (!filePath) return;
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      await api.saveFile(filePath, content);
      setInitialContent(content);
      setSaveSuccess(true);
      if (onSaved) onSaved();
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to save file');
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut Ctrl+S
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    // Tab key indent support
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const updated = content.substring(0, start) + '  ' + content.substring(end);
      setContent(updated);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const lineCount = content.split('\n').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-modal w-full max-w-4xl border border-slate-200/80 overflow-hidden flex flex-col h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600">
              <FileCode className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-800 truncate">
                  {filePath}
                </span>
                {isDirty && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    Unsaved Changes
                  </span>
                )}
                {saveSuccess && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Saved!
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {lineCount} lines • UTF-8 • Press <kbd className="px-1 py-0.5 rounded bg-slate-200 font-mono text-[10px]">Ctrl+S</kbd> to save
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition-smooth disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save File'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 overflow-hidden relative flex bg-slate-900 text-slate-100 font-mono text-xs">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white text-slate-500">
              <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : error ? (
            <div className="p-6 text-rose-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="w-full h-full p-4 bg-[#0F172A] text-slate-200 resize-none outline-none font-mono text-xs leading-relaxed selection:bg-brand-600 selection:text-white"
            />
          )}
        </div>
      </div>
    </div>
  );
};
