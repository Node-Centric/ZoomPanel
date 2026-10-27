import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, Cpu, HardDrive, User, LogOut, ShieldCheck, ChevronDown, Globe } from 'lucide-react';
import type { SystemStats, SafeUser } from '../../../shared/types.js';

interface TopBarProps {
  title: string;
  subtitle?: string;
  stats?: SystemStats | null;
  currentUser?: SafeUser | null;
  onRefresh?: () => void;
  onOpenCreateSite: () => void;
  onOpenMyAccount?: () => void;
  onLogout?: () => void;
  isRefreshing?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  subtitle,
  stats,
  currentUser,
  onRefresh,
  onOpenCreateSite,
  onOpenMyAccount,
  onLogout,
  isRefreshing = false,
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#topbar-user-menu')) {
        setShowUserDropdown(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <header className="h-20 bg-surface-card/90 backdrop-blur-md border-b border-slate-200/80 px-8 flex items-center justify-between sticky top-0 z-30 shadow-[0_1px_5px_rgba(0,0,0,0.02)]">
      {/* Title & Subtitle */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3.5">
        {/* Quick Vitals */}
        {stats && (
          <div className="hidden lg:flex items-center gap-2 bg-slate-50/80 border border-slate-200/70 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600">
            {stats.os.ip && (
              <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono text-slate-800 font-semibold">{stats.os.ip}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200">
              <Cpu className="w-3.5 h-3.5 text-brand-600" />
              <span>CPU: <strong className="text-slate-800">{stats.cpu.usagePercent}%</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
              <span>RAM: <strong className="text-slate-800">{stats.memory.usagePercent}%</strong></span>
            </div>
          </div>
        )}

        {/* Refresh Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-smooth disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-brand-600' : ''}`} />
          </button>
        )}

        {/* New Site Primary Button */}
        <button
          onClick={onOpenCreateSite}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white text-sm font-semibold shadow-sm shadow-brand-600/30 transition-smooth"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Site</span>
        </button>

        {/* User Account Dropdown Menu Interface */}
        {currentUser && (
          <div className="relative pl-2 border-l border-slate-200" id="topbar-user-menu">
            <button
              type="button"
              onClick={() => setShowUserDropdown((prev) => !prev)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 transition-smooth cursor-pointer text-left select-none group"
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center text-[11px] font-bold shadow-2xs">
                {currentUser.firstName ? currentUser.firstName[0].toUpperCase() : currentUser.username[0].toUpperCase()}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-slate-800 leading-tight group-hover:text-brand-700 transition-colors">
                  {currentUser.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : currentUser.username}
                </span>
                <span className="text-[10px] text-indigo-600 font-semibold leading-none flex items-center gap-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  {currentUser.isDefaultAdmin ? 'Root Admin' : 'Administrator'}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showUserDropdown && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200/90 rounded-2xl shadow-xl py-1.5 z-50 animate-fade-in text-xs font-medium">
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {currentUser.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : currentUser.username}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono truncate">{currentUser.email}</p>
                </div>

                <div className="p-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      onOpenMyAccount?.();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 hover:text-brand-700 transition-colors text-left"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>My Account</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      onLogout?.();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors text-left font-semibold"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
