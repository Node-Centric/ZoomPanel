import React from 'react';
import { 
  Globe, 
  Cpu, 
  HardDrive, 
  Clock, 
  Server, 
  ShieldCheck, 
  ArrowUpRight, 
  Play, 
  Square, 
  RotateCw, 
  Activity,
  CheckCircle2
} from 'lucide-react';
import type { Site, SystemStats } from '../../../shared/types.js';

interface DashboardProps {
  stats: SystemStats | null;
  sites: Site[];
  onSelectSite: (site: Site) => void;
  onOpenCreateSite: () => void;
  onRefresh: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  stats,
  sites,
  onSelectSite,
  onOpenCreateSite,
  onRefresh,
}) => {
  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const runningCount = sites.filter((s) => s.status === 'running').length;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-600 to-indigo-700 rounded-3xl p-8 text-white shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Background decorative glow */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-semibold backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{stats?.os.distro || 'Ubuntu 26.04 LTS'}{stats?.os.platform === 'Linux' ? ' VPS' : ''} Environment</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">System Performance & Sites</h2>
          <p className="text-white/80 text-sm max-w-xl">
            ZoomPanel is actively managing your NGINX reverse proxy, PM2 Node.js processes, and OpenSSL certificates with zero downtime.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <button
            onClick={onOpenCreateSite}
            className="px-5 py-2.5 rounded-2xl bg-white text-brand-700 hover:bg-slate-50 font-bold text-sm shadow-md transition-smooth active:scale-95"
          >
            + Create New Site
          </button>
        </div>
      </div>

      {/* Hardware Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* CPU Usage */}
        <div className="p-6 rounded-3xl bg-surface-card border border-slate-200/80 shadow-card hover:shadow-card-hover transition-smooth">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600">
              <Cpu className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {stats?.cpu.cores || 1} Cores
            </span>
          </div>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">CPU Load</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {stats ? `${stats.cpu.usagePercent}%` : '...'}
            </span>
            <span className="text-xs text-slate-400 font-medium">utilized</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
            <div
              className="bg-brand-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${stats?.cpu.usagePercent || 5}%` }}
            ></div>
          </div>
        </div>

        {/* Memory / RAM */}
        <div className="p-6 rounded-3xl bg-surface-card border border-slate-200/80 shadow-card hover:shadow-card-hover transition-smooth">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {stats ? formatBytes(stats.memory.total) : 'RAM'}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Memory</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {stats ? formatBytes(stats.memory.used) : '...'}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              ({stats?.memory.usagePercent}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${stats?.memory.usagePercent || 15}%` }}
            ></div>
          </div>
        </div>

        {/* Disk Space */}
        <div className="p-6 rounded-3xl bg-surface-card border border-slate-200/80 shadow-card hover:shadow-card-hover transition-smooth">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200/60 flex items-center justify-center text-sky-600">
              <HardDrive className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              Mount /
            </span>
          </div>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Disk Storage</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {stats ? formatBytes(stats.disk.used) : '...'}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              / {stats ? formatBytes(stats.disk.total) : '...'}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
            <div
              className="bg-sky-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${stats?.disk.usagePercent || 20}%` }}
            ></div>
          </div>
        </div>

        {/* Server Uptime */}
        <div className="p-6 rounded-3xl bg-surface-card border border-slate-200/80 shadow-card hover:shadow-card-hover transition-smooth">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Online
            </span>
          </div>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Uptime</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {stats ? formatUptime(stats.os.uptime) : '...'}
            </span>
            <span className="text-xs text-slate-400 font-medium">steady</span>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>NGINX & PM2 Daemons Active</span>
          </div>
        </div>
      </div>

      {/* Sites Section */}
      <div className="bg-surface-card rounded-3xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Configured Sites</h3>
            <p className="text-xs text-slate-500 font-medium">
              {sites.length} total sites • {runningCount} running in PM2
            </p>
          </div>
          <button
            onClick={onOpenCreateSite}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold border border-brand-200/60 transition-smooth"
          >
            <span>+ Add Site</span>
          </button>
        </div>

        {sites.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 mx-auto">
              <Globe className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-800">No Sites Created Yet</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Create your first Node.js site. ZoomPanel will automatically set up NGINX reverse proxying, generate self-signed SSL, and supervise with PM2.
            </p>
            <button
              onClick={onOpenCreateSite}
              className="px-5 py-2.5 rounded-2xl bg-brand-600 text-white font-semibold text-xs shadow-sm hover:bg-brand-700 transition-smooth"
            >
              Create First Site
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sites.map((site) => (
              <div
                key={site.id}
                onClick={() => onSelectSite(site)}
                className="px-8 py-4 flex items-center justify-between hover:bg-slate-50/70 cursor-pointer transition-smooth group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 flex-shrink-0">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 group-hover:text-brand-600 transition-colors">
                        {site.domain}
                      </span>
                      {site.ssl && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>{site.ssl.type === 'self-signed' ? 'Self-Signed SSL' : 'Let\'s Encrypt'}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-0.5">
                      <span>Node.js ({site.nodeVersion})</span>
                      <span>•</span>
                      <span>Port :{site.port}</span>
                      <span>•</span>
                      <span className="font-mono text-[11px] truncate">{site.rootDirectory}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Status pill */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      site.status === 'running'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        site.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                      }`}
                    ></span>
                    <span className="capitalize">{site.status}</span>
                  </span>

                  <div className="p-2 rounded-xl text-slate-400 group-hover:text-brand-600 group-hover:bg-brand-50 transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
