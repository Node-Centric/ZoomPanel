import React from 'react';
import { 
  LayoutDashboard, 
  Globe, 
  FolderTree, 
  Terminal, 
  Settings, 
  Server, 
  ExternalLink,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  serverHostname?: string;
  osDistro?: string;
  nodeVersion?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentTab, 
  onSelectTab, 
  serverHostname = 'ubuntu-vps',
  osDistro,
  nodeVersion
}) => {
  const displayOs = osDistro || 'Linux';
  const displayNode = nodeVersion || 'v26.13.0';
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sites', label: 'Sites', icon: Globe },
    { id: 'files', label: 'File Manager', icon: FolderTree },
    { id: 'logs', label: 'System Logs', icon: Terminal },
    { id: 'security', label: 'Security', icon: ShieldCheck },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-surface-card border-r border-slate-200/80 flex flex-col justify-between h-screen sticky top-0 select-none shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
      {/* Brand Header */}
      <div>
        <div className="p-6 pb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <Zap className="w-5 h-5 fill-white/20 stroke-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">ZoomPanel</span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Server Management</p>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="px-4 py-2">
          <p className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Control Center
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-smooth ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-200/50 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-brand-600 stroke-[2.2]' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-600"></div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Host Info Card */}
      <div className="p-4 border-t border-slate-100">
        <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600">
            <Server className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-xs font-semibold text-slate-800 truncate">{serverHostname}</p>
            </div>
            <p 
              className="text-[11px] text-slate-500 font-medium truncate" 
              title={`${displayOs} • Node ${displayNode}`}
            >
              {displayOs} • Node {displayNode}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
