import React from 'react';
import { Check, Cpu, Shield, Activity, RefreshCw } from 'lucide-react';
import type { SiteType } from '../../../shared/types.js';

interface SiteTypeSelectorProps {
  selectedType: SiteType;
  onSelectType: (type: SiteType) => void;
}

export const SiteTypeSelector: React.FC<SiteTypeSelectorProps> = ({
  selectedType,
  onSelectType,
}) => {
  return (
    <div className="py-2">
      <div className="mb-4 text-center">
        <h3 className="text-base font-semibold text-slate-900">Select Runtime Environment</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Choose the application runtime for this site. ZoomPanel will automatically configure PM2 supervision and the NGINX reverse proxy.
        </p>
      </div>

      {/* Centered, beautifully proportioned card container */}
      <div className="max-w-lg mx-auto">
        <div
          onClick={() => onSelectType('nodejs')}
          className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-smooth group ${
            selectedType === 'nodejs'
              ? 'border-brand-600 bg-brand-50/30 shadow-card ring-4 ring-brand-500/10'
              : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-card'
          }`}
        >
          {/* Top selection indicator */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3.5">
              {/* Hexagon Node emblem */}
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shadow-sm">
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2L3.5 6.9v9.8L12 21.6l8.5-4.9V6.9L12 2zm6.7 13.8L12 19.6l-6.7-3.8V8.2L12 4.4l6.7 3.8v7.6z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 text-base">Node.js Application</h4>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100/70 text-emerald-700 border border-emerald-300/50">
                    Production Ready
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  JavaScript & TypeScript Full-Stack Apps & APIs
                </p>
              </div>
            </div>

            {/* Checkmark circle */}
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                selectedType === 'nodejs'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'border-2 border-slate-300 text-transparent'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed mb-5">
            Deploy Express, Fastify, Next.js, or custom Node.js servers. Fully managed with zero-downtime PM2 clustering and high-performance NGINX reverse proxying.
          </p>

          {/* Feature Badges Grid */}
          <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-100/90 text-xs text-slate-700">
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200/70 shadow-xs">
              <Activity className="w-4 h-4 text-brand-600 flex-shrink-0" />
              <span className="font-medium text-[11px]">PM2 Supervised</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200/70 shadow-xs">
              <Shield className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="font-medium text-[11px]">NGINX Reverse Proxy</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200/70 shadow-xs">
              <RefreshCw className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <span className="font-medium text-[11px]">Auto Reboot Recovery</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200/70 shadow-xs">
              <Cpu className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="font-medium text-[11px]">Live CPU & RAM Gauges</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
