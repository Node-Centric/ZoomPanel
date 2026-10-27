import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  RefreshCw, 
  Copy, 
  Check, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Radio, 
  ShieldCheck,
  Server
} from 'lucide-react';
import { api } from '../services/api';
import type { SystemStats } from '../../../shared/types.js';

interface SystemLogsProps {
  stats?: SystemStats | null;
}

export const SystemLogs: React.FC<SystemLogsProps> = ({ stats }) => {
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [selectedService, setSelectedService] = useState<'all' | 'nginx' | 'pm2'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLPreElement | null>(null);

  const fetchLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const serviceParam = selectedService === 'all' ? undefined : selectedService;
      const data = await api.getSystemLogs(serviceParam);
      setLogs(data.logs);
    } catch {
      // fallback
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedService]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedService]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(logs);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadLogs = () => {
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zoompanel-system-logs-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLines = logs.split('\n').filter((line) => {
    if (!searchQuery.trim()) return true;
    return line.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Page Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">System Logs</h2>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Journal Active
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Real-time server journal, process status, and core ZoomPanel daemon events.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAutoRefresh((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-smooth ${
              autoRefresh
                ? 'bg-brand-50 border-brand-200/80 text-brand-700 shadow-2xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
          >
            <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'text-brand-600 animate-pulse' : 'text-slate-400'}`} />
            <span>{autoRefresh ? 'Live Stream: On' : 'Live Stream: Paused'}</span>
          </button>

          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-smooth shadow-xs"
            title="Refresh logs now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-smooth shadow-xs"
            title="Copy logs to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={downloadLogs}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-smooth shadow-xs"
            title="Download log file"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Card with Terminal Viewer */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card overflow-hidden flex flex-col">
        {/* Filters Toolbar */}
        <div className="px-5 py-3 border-b border-slate-200/80 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
          {/* Service Channel Selector Tabs */}
          <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setSelectedService('all')}
              className={`px-3 py-1.5 rounded-lg transition-smooth ${
                selectedService === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Services
            </button>
            <button
              onClick={() => setSelectedService('pm2')}
              className={`px-3 py-1.5 rounded-lg transition-smooth ${
                selectedService === 'pm2'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Node.js & PM2
            </button>
            <button
              onClick={() => setSelectedService('nginx')}
              className={`px-3 py-1.5 rounded-lg transition-smooth ${
                selectedService === 'nginx'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              NGINX Server
            </button>
          </div>

          {/* Search Filter & Auto-scroll Toggle */}
          <div className="flex items-center gap-3">
            <div className="relative w-44 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter log lines..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-smooth"
              />
            </div>

            <label className="flex items-center gap-1.5 text-xs text-slate-600 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500/20"
              />
              <span className="text-[11px] font-medium">Auto-scroll</span>
            </label>
          </div>
        </div>

        {/* Terminal Window */}
        <div className="relative bg-slate-950 p-4 min-h-[480px] max-h-[640px] flex flex-col font-mono">
          <pre
            ref={logContainerRef}
            className="flex-1 overflow-y-auto text-xs leading-relaxed text-slate-300 font-mono select-text space-y-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950"
          >
            {filteredLines.length === 0 ? (
              <div className="p-8 text-center text-slate-500 font-sans text-xs">
                {searchQuery ? `No logs match "${searchQuery}"` : 'No logs recorded.'}
              </div>
            ) : (
              filteredLines.map((line, idx) => {
                const isError = /error|fail|exception/i.test(line);
                const isWarn = /warn|notice/i.test(line);
                const isSuccess = /ok|success|ready|started/i.test(line);

                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 px-2 py-0.5 rounded hover:bg-slate-900/60 transition-colors ${
                      isError
                        ? 'text-rose-400 font-semibold'
                        : isWarn
                        ? 'text-amber-300'
                        : isSuccess
                        ? 'text-emerald-300'
                        : 'text-slate-300'
                    }`}
                  >
                    <span className="text-slate-600 select-none text-[11px] w-8 text-right shrink-0">
                      {idx + 1}
                    </span>
                    <span className="break-all whitespace-pre-wrap">{line}</span>
                  </div>
                );
              })
            )}
          </pre>

          {/* Terminal Footer info */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 px-2 mt-2 select-none">
            <div className="flex items-center gap-3">
              <span>Lines: <strong className="text-slate-300">{filteredLines.length}</strong></span>
              <span>Host: <strong className="text-slate-300">{stats?.os.hostname || 'ubuntu-26.04'}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Buffer OK</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
