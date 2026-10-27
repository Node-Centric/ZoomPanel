import React, { useState } from 'react';
import { Globe, Search, Plus, ShieldCheck, ArrowUpRight, RotateCw, ExternalLink } from 'lucide-react';
import type { Site } from '../../../shared/types.js';

interface SitesProps {
  sites: Site[];
  onSelectSite: (site: Site) => void;
  onOpenCreateSite: () => void;
  onRefresh: () => void;
}

export const Sites: React.FC<SitesProps> = ({
  sites,
  onSelectSite,
  onOpenCreateSite,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'running' | 'stopped'>('all');

  const filtered = sites.filter((s) => {
    const matchesSearch = s.domain.toLowerCase().includes(search.toLowerCase());
    if (filter === 'all') return matchesSearch;
    return matchesSearch && s.status === filter;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Sites</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage your domain names, PM2 Node.js processes, and NGINX virtual hosts.
          </p>
        </div>

        <button
          onClick={onOpenCreateSite}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition-smooth"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Site</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search domains..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-smooth"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {(['all', 'running', 'stopped'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-smooth ${
                filter === tab
                  ? 'bg-brand-50 text-brand-700 border border-brand-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Sites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((site) => (
          <div
            key={site.id}
            onClick={() => onSelectSite(site)}
            className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-card hover:shadow-card-hover transition-smooth cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shadow-sm">
                  <Globe className="w-6 h-6" />
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold ${
                    site.status === 'running'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
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
              </div>

              <h3 className="font-bold text-base text-slate-900 group-hover:text-brand-600 transition-colors">
                {site.domain}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Node.js • Port :{site.port}
              </p>

              <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span>SSL Security:</span>
                  <span className="font-semibold text-slate-800 capitalize flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    {site.ssl.type}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Entry Script:</span>
                  <span className="font-mono text-slate-800 font-semibold">{site.entryFile}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-100 text-xs font-bold text-brand-600">
              <span>Manage Site</span>
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
