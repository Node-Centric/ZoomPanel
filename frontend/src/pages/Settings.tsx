import React, { useState } from 'react';
import { 
  Server, 
  RotateCw, 
  CheckCircle2, 
  HardDrive, 
  Cpu, 
  Activity, 
  Globe, 
  Clock, 
  Terminal,
  Database,
  Layers,
  FolderSync,
  AlertCircle,
  HelpCircle,
  SlidersHorizontal,
  X
} from 'lucide-react';
import type { SystemStats } from '../../../shared/types.js';
import { api } from '../services/api.js';

interface SettingsProps {
  stats: SystemStats | null;
  onRefresh?: () => void;
}

const DelayedTooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => {
  const [visible, setVisible] = useState(false);
  const timerRef = React.useRef<any>(null);

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      setVisible(true);
    }, 500);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  };

  return (
    <div className="relative inline-flex items-center" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
      {visible && (
        <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 w-64 p-3 bg-slate-900/95 backdrop-blur-md text-white text-xs rounded-xl shadow-2xl border border-slate-700/80 z-50 animate-fade-in pointer-events-none">
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 border-l border-b border-slate-700/80 rotate-45"></div>
          <p className="leading-relaxed font-normal text-slate-200">{text}</p>
        </div>
      )}
    </div>
  );
};

export const Settings: React.FC<SettingsProps> = ({ stats, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'services'>('overview');
  const [restartingServices, setRestartingServices] = useState<Record<string, boolean>>({});
  const [togglingServices, setTogglingServices] = useState<Record<string, boolean>>({});
  const [restartMessage, setRestartMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Service Port Modal State
  const [showPortModal, setShowPortModal] = useState(false);
  const [portModalService, setPortModalService] = useState<'sftp' | 'daemon'>('sftp');
  const [targetPort, setTargetPort] = useState<number>(stats?.services?.sftpPort || 22);
  const [isSavingPort, setIsSavingPort] = useState(false);
  const [portModalError, setPortModalError] = useState<string | null>(null);

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: Server },
    { id: 'services' as const, label: 'Services', icon: Activity },
  ];

  const handleToggle = async (serviceKey: string, serviceLabel: string, currentRunning: boolean) => {
    setTogglingServices((prev) => ({ ...prev, [serviceKey]: true }));
    setRestartMessage(null);
    try {
      const res = await api.toggleService(serviceKey, currentRunning ? 'stop' : 'start');
      setRestartMessage({
        type: 'success',
        text: res.message || `${serviceLabel} ${currentRunning ? 'stopped' : 'started'} successfully.`,
      });
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      setRestartMessage({
        type: 'error',
        text: err.message || `Failed to update ${serviceLabel}`,
      });
    } finally {
      setTimeout(() => {
        setTogglingServices((prev) => ({ ...prev, [serviceKey]: false }));
      }, 500);
    }
  };

  const handleRestart = async (serviceKey: string, serviceLabel: string) => {
    setRestartingServices((prev) => ({ ...prev, [serviceKey]: true }));
    setRestartMessage(null);
    try {
      await api.restartService(serviceKey);
      setRestartMessage({
        type: 'success',
        text: `${serviceLabel} restarted successfully.`,
      });
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      setRestartMessage({
        type: 'error',
        text: err.message || `Failed to restart ${serviceLabel}`,
      });
    } finally {
      // Keep busy animation for a brief moment for smooth UX feedback
      setTimeout(() => {
        setRestartingServices((prev) => ({ ...prev, [serviceKey]: false }));
      }, 600);
    }
  };

  const handleOpenPortModal = (serviceId: 'sftp' | 'daemon', currentPort: number) => {
    setPortModalService(serviceId);
    setTargetPort(currentPort);
    setPortModalError(null);
    setShowPortModal(true);
  };

  const handleSavePort = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(targetPort);
    if (!num || isNaN(num) || num < 1 || num > 65535) {
      setPortModalError('Port must be a valid number between 1 and 65535.');
      return;
    }
    if (portModalService === 'sftp' && num === (stats?.services?.daemonPort || 8443)) {
      setPortModalError(`Port ${num} is reserved for the ZoomPanel daemon.`);
      return;
    }
    setIsSavingPort(true);
    setPortModalError(null);
    try {
      if (portModalService === 'daemon') {
        const res = await api.updateDaemonPort(num);
        setRestartMessage({
          type: 'success',
          text: res.message || `ZoomPanel daemon port updated to ${num}. Firewall rules automatically updated.`,
        });
      } else {
        const res = await api.updateSftpPort(num);
        setRestartMessage({
          type: 'success',
          text: res.message || `SFTP service port updated to ${num}.`,
        });
      }
      setShowPortModal(false);
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      setPortModalError(err.message || 'Failed to update service port');
    } finally {
      setIsSavingPort(false);
    }
  };

  const isLinux = stats?.os.platform?.toLowerCase().includes('linux') || stats?.os.platform?.toLowerCase().includes('ubuntu');

  const servicesList = [
    {
      id: 'nginx',
      name: 'NGINX Web Server',
      desc: 'HTTP/HTTPS Reverse Proxy & Virtual Hosts',
      icon: Globe,
      isRunning: stats?.services ? stats.services.nginx !== false : true,
    },
    {
      id: 'pm2',
      name: 'PM2 Process Supervisor',
      desc: 'Node.js Daemon Clustering & Auto-Restart',
      icon: Terminal,
      isRunning: stats?.services ? stats.services.pm2 !== false : true,
    },
    {
      id: 'mariadb',
      name: `MariaDB ${stats?.services.mariadbVersion || '13.0.2'} Database Engine`,
      desc: 'Relational SQL Database Engine • Port 3306',
      icon: Database,
      isRunning: stats?.services ? stats.services.mariadb !== false : true,
    },
    {
      id: 'sftp',
      name: 'SFTP Server',
      desc: `SSH File Transfer Protocol Subsystem • Port ${stats?.services?.sftpPort || 22}`,
      icon: FolderSync,
      isRunning: stats?.services ? Boolean(stats.services.sftp) : false,
      canToggle: true,
      canEditPort: true,
      port: stats?.services?.sftpPort || 22,
      showHelpTooltip: isLinux,
      helpTooltipText: 'This service only needs to be turned on if you wish to change the default port. By default, Linux uses native OpenSSH on port 22.',
    },
    {
      id: 'daemon',
      name: 'ZoomPanel Core Daemon',
      desc: `Process Management, System Vitals & Control Plane API • Port ${stats?.services?.daemonPort || 8443}`,
      icon: Layers,
      isRunning: true,
      canEditPort: true,
      port: stats?.services?.daemonPort || 8443,
      showHelpTooltip: true,
      helpTooltipText: 'Changing the daemon port automatically updates firewall rules (for both IPv4 & IPv6) and listener settings.',
    },
  ];

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds) return 'Active';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Panel & Host Settings</h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Server configurations, core service statuses, and runtime information.
        </p>
      </div>

      {/* Horizontal Tabs Navigation */}
      <div 
        className="flex items-end border-b border-slate-200/80 gap-1 overflow-x-auto overflow-y-hidden pb-0 min-h-[46px] no-scrollbar"
        style={{ overflowY: 'hidden' }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-t-2xl text-xs font-bold transition-smooth relative shrink-0 ${
                isActive
                  ? 'text-brand-700 bg-white border-t border-x border-slate-200/80 shadow-sm -mb-[1px]'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-brand-600 rounded-t-full"></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Host Specifications */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Host Specifications</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-medium">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
                <span className="text-slate-400">Operating System</span>
                <p className="text-sm font-bold text-slate-800 mt-1">{stats?.os.distro || 'Ubuntu 26.04 LTS'}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
                <span className="text-slate-400">Hostname</span>
                <p className="text-sm font-bold text-slate-800 mt-1">{stats?.os.hostname || 'ubuntu-vps'}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
                <span className="text-slate-400">Server IP Address</span>
                <p className="text-sm font-mono font-bold text-slate-800 mt-1">{stats?.os.ip || '127.0.0.1'}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
                <span className="text-slate-400">CPU Architecture</span>
                <p className="text-sm font-bold text-slate-800 mt-1">{stats?.cpu.model || 'x86_64'}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
                <span className="text-slate-400">Node.js Global Runtime</span>
                <p className="text-sm font-bold text-slate-800 mt-1">{stats?.os.nodeVersion || 'v26.12.1'} (Latest)</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
                <span className="text-slate-400">System Uptime</span>
                <p className="text-sm font-bold text-slate-800 mt-1">{formatUptime(stats?.os.uptime)}</p>
              </div>
            </div>
          </div>

          {/* System Utilization Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Memory Usage */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-brand-600" />
                  <h3 className="text-sm font-bold text-slate-900">System Memory</h3>
                </div>
                <span className="text-xs font-bold font-mono text-slate-700">
                  {stats?.memory.usagePercent || 0}%
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-brand-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, stats?.memory.usagePercent || 0))}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>Used: {formatBytes(stats?.memory.used || 0)}</span>
                <span>Total: {formatBytes(stats?.memory.total || 0)}</span>
              </div>
            </div>

            {/* Disk Usage */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">Disk Storage</h3>
                </div>
                <span className="text-xs font-bold font-mono text-slate-700">
                  {stats?.disk.usagePercent || 0}%
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, stats?.disk.usagePercent || 0))}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>Used: {formatBytes(stats?.disk.used || 0)}</span>
                <span>Total: {formatBytes(stats?.disk.total || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'services' && (
        <div className="space-y-4">
          {restartMessage && (
            <div
              className={`p-4 rounded-2xl text-xs font-medium flex items-center justify-between ${
                restartMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {restartMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                )}
                <span>{restartMessage.text}</span>
              </div>
              <button
                onClick={() => setRestartMessage(null)}
                className="text-slate-400 hover:text-slate-600 text-xs ml-4"
              >
                ✕
              </button>
            </div>
          )}

          {/* Services Section */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Services</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Manage and restart core runtime daemon processes.
              </p>
            </div>

            <div className="space-y-3">
              {servicesList.map((svc) => {
                const SvcIcon = svc.icon;
                const isRestarting = Boolean(restartingServices[svc.id]);
                const isToggling = Boolean(togglingServices[svc.id]);

                return (
                  <div
                    key={svc.id}
                    className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200/60 transition-all hover:bg-slate-50/80"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-700 shadow-xs">
                        <SvcIcon className="w-4 h-4 text-brand-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-800">{svc.name}</p>
                          {svc.showHelpTooltip && (
                            <DelayedTooltip text={svc.helpTooltipText || ''}>
                              <button type="button" className="text-slate-400 hover:text-slate-600 focus:outline-none transition-colors">
                                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                              </button>
                            </DelayedTooltip>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">{svc.desc}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* On/Off Toggle Switch */}
                      {svc.canToggle && (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={svc.isRunning}
                          disabled={isToggling || isRestarting}
                          onClick={() => handleToggle(svc.id, svc.name, svc.isRunning)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-40 disabled:cursor-not-allowed ${
                            svc.isRunning ? 'bg-brand-600' : 'bg-slate-300'
                          }`}
                          title={svc.isRunning ? `Turn off ${svc.name}` : `Turn on ${svc.name}`}
                          aria-label={`Toggle ${svc.name}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              svc.isRunning ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      )}

                      {/* Icon-only Edit Action Button to the LEFT of Restart Button */}
                      {svc.canEditPort && (
                        <button
                          type="button"
                          onClick={() => handleOpenPortModal(svc.id as 'sftp' | 'daemon', svc.port || (svc.id === 'daemon' ? 8443 : 22))}
                          disabled={isRestarting || isToggling}
                          className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-brand-600 hover:bg-white hover:border-brand-200 transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                          title={`Configure ${svc.name} Port`}
                          aria-label={`Configure ${svc.name} Port`}
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Icon-only Restart Action Button */}
                      <button
                        type="button"
                        onClick={() => handleRestart(svc.id, svc.name)}
                        disabled={isRestarting || isToggling || (!svc.isRunning && Boolean(svc.canToggle))}
                        className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-brand-600 hover:bg-white hover:border-brand-200 transition-colors shadow-xs disabled:opacity-30 disabled:cursor-not-allowed"
                        title={`Restart ${svc.name}`}
                        aria-label={`Restart ${svc.name}`}
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${isRestarting ? 'animate-spin text-brand-600' : ''}`} />
                      </button>

                      {/* Status Pill with Busy Animation - Moved to the Furthest Right with fixed width alignment */}
                      <div className="w-28 flex justify-end">
                        {isRestarting ? (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 animate-pulse">
                            <RotateCw className="w-3 h-3 animate-spin text-amber-600" />
                            <span>Restarting...</span>
                          </span>
                        ) : isToggling ? (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 animate-pulse">
                            <RotateCw className="w-3 h-3 animate-spin text-amber-600" />
                            <span>{svc.isRunning ? 'Stopping...' : 'Starting...'}</span>
                          </span>
                        ) : svc.isRunning ? (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Running</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                            <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                            <span>Stopped</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Configure Service Port Modal */}
      {showPortModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 shadow-xs">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {portModalService === 'daemon' ? 'Configure ZoomPanel Daemon Port' : 'Configure SFTP Port'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {portModalService === 'daemon'
                      ? 'Change listener port for ZoomPanel control plane & Web GUI'
                      : 'Change listener port for the SFTP server'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPortModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePort} className="p-6 space-y-4">
              {portModalService === 'daemon' && (
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium flex items-start gap-2">
                  <span className="text-sm">ℹ️</span>
                  <span>
                    Firewall rules named <strong>ZoomPanel</strong> (both IPv4 &amp; IPv6) will automatically be updated to match this new port.
                  </span>
                </div>
              )}
              {portModalError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                  <span>{portModalError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Port Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="65535"
                  required
                  value={targetPort}
                  onChange={(e) => setTargetPort(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-smooth"
                  placeholder="e.g. 22 or 2222"
                />
                <p className="text-[11px] text-slate-400">
                  Standard port is 22. If running alongside Linux OpenSSH, use an alternate port such as 2222.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPortModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPort}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition-smooth disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingPort ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Applying...</span>
                    </>
                  ) : (
                    <span>Save & Apply</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
