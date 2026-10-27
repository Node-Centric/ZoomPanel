import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Globe, 
  Server, 
  Database, 
  Terminal, 
  X, 
  SlidersHorizontal,
  Lock,
  ChevronDown,
  UserX,
  KeyRound,
  Zap,
  Info,
  Clock,
  Ban
} from 'lucide-react';
import { api } from '../services/api.js';
import type { 
  FirewallRule, 
  FirewallProtocol, 
  FirewallIpVersion, 
  CreateFirewallRulePayload,
  UpdateFirewallRulePayload 
} from '../../../shared/types.js';

interface QuickSetPreset {
  id: string;
  name: string;
  description: string;
  port: string;
  protocol: FirewallProtocol;
  icon: any;
}

export const Security: React.FC = () => {
  // Page Tab Navigation
  const [activeSecurityTab, setActiveSecurityTab] = useState<'port-rules' | 'ip-access' | 'login-limits' | 'bot-defense'>('port-rules');

  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [daemonPort, setDaemonPort] = useState<number>(8443);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [togglingRuleId, setTogglingRuleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [ipFilter, setIpFilter] = useState<'all' | 'ipv4' | 'ipv6'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Quick Sets Split Button State
  const [showQuickSetDropdown, setShowQuickSetDropdown] = useState<boolean>(false);
  const [showModalQuickSetDropdown, setShowModalQuickSetDropdown] = useState<boolean>(false);
  const quickSetRef = useRef<HTMLDivElement>(null);
  const modalQuickSetRef = useRef<HTMLDivElement>(null);

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<FirewallRule | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    port: string;
    protocol: FirewallProtocol;
    ipVersion: 'both' | 'ipv4' | 'ipv6';
    sourceType: 'anywhere' | 'custom';
    customSource: string;
    enabled: boolean;
  }>({
    name: '',
    description: '',
    port: '',
    protocol: 'tcp',
    ipVersion: 'both',
    sourceType: 'anywhere',
    customSource: '',
    enabled: true,
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirmation State
  const [deletingRule, setDeletingRule] = useState<FirewallRule | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quickSetRef.current && !quickSetRef.current.contains(event.target as Node)) {
        setShowQuickSetDropdown(false);
      }
      if (modalQuickSetRef.current && !modalQuickSetRef.current.contains(event.target as Node)) {
        setShowModalQuickSetDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const quickSets: QuickSetPreset[] = [
    {
      id: 'zoompanel',
      name: 'ZoomPanel',
      description: 'ZoomPanel GUI & Management API',
      port: String(daemonPort),
      protocol: 'tcp',
      icon: Layers,
    },
    {
      id: 'http',
      name: 'HTTP',
      description: 'Standard HTTP Web Traffic',
      port: '80',
      protocol: 'tcp',
      icon: Globe,
    },
    {
      id: 'https',
      name: 'HTTPS',
      description: 'Secure Encrypted Web Traffic',
      port: '443',
      protocol: 'tcp',
      icon: Lock,
    },
    {
      id: 'ssh',
      name: 'SSH / SFTP',
      description: 'Secure Shell & SFTP Access',
      port: '22',
      protocol: 'tcp',
      icon: Terminal,
    },
    {
      id: 'mariadb',
      name: 'MariaDB',
      description: 'MariaDB SQL Database Server',
      port: '3306',
      protocol: 'tcp',
      icon: Database,
    },
    {
      id: 'nodejs-default',
      name: 'Node.js App',
      description: 'Default Node.js Application Port',
      port: '3000',
      protocol: 'tcp',
      icon: Server,
    },
    {
      id: 'nodejs-range',
      name: 'Node.js Apps Range',
      description: 'ZoomPanel Managed Node.js Port Range',
      port: '3000-3100',
      protocol: 'tcp',
      icon: Server,
    },
    {
      id: 'redis',
      name: 'Redis',
      description: 'Redis In-Memory Key-Value Store',
      port: '6379',
      protocol: 'tcp',
      icon: Database,
    },
    {
      id: 'postgres',
      name: 'PostgreSQL',
      description: 'PostgreSQL Relational Database',
      port: '5432',
      protocol: 'tcp',
      icon: Database,
    },
    {
      id: 'dns',
      name: 'DNS',
      description: 'Domain Name System Resolution',
      port: '53',
      protocol: 'udp',
      icon: Globe,
    },
  ];

  const fetchFirewall = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.getFirewall();
      setRules(res.rules || []);
      setDaemonPort(res.daemonPort || 8443);
    } catch (err: any) {
      setBannerMessage({
        type: 'error',
        text: err.message || 'Failed to fetch firewall status.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFirewall();
  }, []);

  const handleToggle = async (rule: FirewallRule) => {
    setTogglingRuleId(rule.id);
    setBannerMessage(null);
    try {
      const nextState = !rule.enabled;
      await api.toggleFirewallRule(rule.id, nextState);
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, enabled: nextState } : r))
      );
      setBannerMessage({
        type: 'success',
        text: `Rule "${rule.name}" (${rule.ipVersion.toUpperCase()}) ${nextState ? 'enabled' : 'disabled'} successfully.`,
      });
    } catch (err: any) {
      setBannerMessage({
        type: 'error',
        text: err.message || `Failed to update rule "${rule.name}".`,
      });
    } finally {
      setTogglingRuleId(null);
    }
  };

  const handleOpenAddModal = (preset?: QuickSetPreset) => {
    setEditingRule(null);
    setFormData({
      name: preset ? preset.name : '',
      description: preset ? preset.description : '',
      port: preset ? preset.port : '',
      protocol: preset ? preset.protocol : 'tcp',
      ipVersion: 'both',
      sourceType: 'anywhere',
      customSource: '',
      enabled: true,
    });
    setFormError(null);
    setShowQuickSetDropdown(false);
    setShowModalQuickSetDropdown(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rule: FirewallRule) => {
    setEditingRule(rule);
    const isAnywhere = 
      rule.source.toLowerCase().includes('anywhere') || 
      rule.source === '0.0.0.0/0' || 
      rule.source === '::/0';

    setFormData({
      name: rule.name,
      description: rule.description,
      port: rule.port,
      protocol: rule.protocol,
      ipVersion: rule.ipVersion,
      sourceType: isAnywhere ? 'anywhere' : 'custom',
      customSource: isAnywhere ? '' : rule.source,
      enabled: rule.enabled,
    });
    setFormError(null);
    setShowModalQuickSetDropdown(false);
    setIsModalOpen(true);
  };

  const handleApplyQuickSetInModal = (qs: QuickSetPreset) => {
    setFormData((prev) => ({
      ...prev,
      name: qs.name,
      description: qs.description,
      port: qs.port,
      protocol: qs.protocol,
    }));
    setShowModalQuickSetDropdown(false);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Rule name or description is required.');
      return;
    }
    if (!formData.port.trim()) {
      setFormError('Port or port range is required.');
      return;
    }
    if (formData.sourceType === 'custom' && !formData.customSource.trim()) {
      setFormError('Please enter a valid source IP or CIDR subnet.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const source = formData.sourceType === 'custom' ? formData.customSource.trim() : 'Anywhere';

      if (editingRule) {
        const payload: UpdateFirewallRulePayload = {
          name: formData.name.trim(),
          description: formData.description.trim(),
          port: formData.port.trim(),
          protocol: formData.protocol,
          ipVersion: formData.ipVersion as FirewallIpVersion,
          source,
          enabled: formData.enabled,
        };
        const res = await api.updateFirewallRule(editingRule.id, payload);
        setRules((prev) => prev.map((r) => (r.id === editingRule.id ? res.rule : r)));
        setBannerMessage({
          type: 'success',
          text: `Firewall rule "${res.rule.name}" updated successfully.`,
        });
      } else {
        const payload: CreateFirewallRulePayload = {
          name: formData.name.trim(),
          description: formData.description.trim(),
          port: formData.port.trim(),
          protocol: formData.protocol,
          ipVersion: formData.ipVersion,
          source,
          enabled: formData.enabled,
        };
        const res = await api.createFirewallRule(payload);
        setRules((prev) => [...prev, ...res.rules]);
        setBannerMessage({
          type: 'success',
          text: `Created ${res.rules.length} firewall rule(s) successfully.`,
        });
      }
      setIsModalOpen(false);
      fetchFirewall(true);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save firewall rule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDelete = (rule: FirewallRule) => {
    setDeletingRule(rule);
    setDeleteConfirmationInput('');
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingRule) return;

    const isCore = deletingRule.isCore || deletingRule.name.toLowerCase() === 'zoompanel';
    if (isCore && deleteConfirmationInput.trim().toUpperCase() !== 'DELETE ZOOMPANEL') {
      setDeleteError('Please type "DELETE ZOOMPANEL" to confirm removal of the panel daemon port.');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteFirewallRule(deletingRule.id, isCore);
      setRules((prev) => prev.filter((r) => r.id !== deletingRule.id));
      setBannerMessage({
        type: 'success',
        text: `Rule "${deletingRule.name}" (${deletingRule.ipVersion.toUpperCase()}) removed successfully.`,
      });
      setDeletingRule(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete rule.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered Rules
  const filteredRules = rules.filter((r) => {
    if (ipFilter !== 'all' && r.ipVersion !== ipFilter) return false;
    if (statusFilter === 'enabled' && !r.enabled) return false;
    if (statusFilter === 'disabled' && r.enabled) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = r.name.toLowerCase().includes(q);
      const matchDesc = r.description.toLowerCase().includes(q);
      const matchPort = r.port.toLowerCase().includes(q);
      const matchSource = r.source.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchPort && !matchSource) return false;
    }
    return true;
  });

  const activeRulesCount = rules.filter((r) => r.enabled).length;

  const securitySections = [
    { id: 'port-rules' as const, label: 'Port Rules & Firewall', icon: Shield, count: rules.length },
    { id: 'ip-access' as const, label: 'IP Blacklist & Access', icon: Ban, count: 0 },
    { id: 'login-limits' as const, label: 'Login Restrictions & Lockout', icon: KeyRound, count: null },
    { id: 'bot-defense' as const, label: 'Bot Defense & Threats', icon: ShieldAlert, count: null },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 shadow-xs">
              <Shield className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Web Application Firewall</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Multi-layer security suite: Port filtering, IP address blocking, and brute-force protection.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls with Split UI Button */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchFirewall(true)}
            disabled={refreshing || loading}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
            title="Refresh Firewall Rules"
          >
            <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-brand-600' : ''}`} />
          </button>

          {/* Split UI Button for Adding Rules & Quick Sets */}
          <div className="relative inline-flex rounded-xl shadow-xs" ref={quickSetRef}>
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-l-xl transition-smooth focus:outline-none"
            >
              <Plus className="w-4 h-4" />
              <span>Add Rule</span>
            </button>
            <button
              type="button"
              onClick={() => setShowQuickSetDropdown((prev) => !prev)}
              className="px-2.5 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-r-xl border-l border-brand-500/50 transition-smooth focus:outline-none"
              title="Quick Sets presets"
              aria-label="Open Quick Sets menu"
            >
              <ChevronDown className="w-4 h-4" />
            </button>

            {/* Split Button Dropdown Menu */}
            {showQuickSetDropdown && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border border-slate-200/80 shadow-2xl z-50 py-2 animate-scale-in">
                <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Quick Sets</span>
                  <span className="text-[10px] text-brand-600 font-semibold">1-Click Setup</span>
                </div>
                <div className="max-h-64 overflow-y-auto p-1 space-y-0.5">
                  {quickSets.map((qs) => {
                    const Icon = qs.icon;
                    return (
                      <button
                        key={qs.id}
                        type="button"
                        onClick={() => handleOpenAddModal(qs)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-slate-50 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition-colors" />
                          <div>
                            <p className="text-xs font-bold text-slate-800 group-hover:text-brand-700">{qs.name}</p>
                            <p className="text-[10px] text-slate-400 line-clamp-1">{qs.description}</p>
                          </div>
                        </div>
                        <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {qs.port}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Banner Notifications */}
      {bannerMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-medium flex items-center justify-between border ${
            bannerMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : bannerMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {bannerMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
            {bannerMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
            {bannerMessage.type === 'info' && <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />}
            <span>{bannerMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="text-slate-400 hover:text-slate-600 text-xs ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* WAF Modular Section Navigation Tabs */}
      <div className="flex items-end border-b border-slate-200/80 gap-1 overflow-x-auto pb-0 min-h-[46px] no-scrollbar">
        {securitySections.map((sec) => {
          const Icon = sec.icon;
          const isActive = activeSecurityTab === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSecurityTab(sec.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-t-2xl text-xs font-bold transition-smooth relative shrink-0 ${
                isActive
                  ? 'text-brand-700 bg-white border-t border-x border-slate-200/80 shadow-sm -mb-[1px]'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
              <span>{sec.label}</span>
              {sec.count !== null && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {sec.count}
                </span>
              )}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-brand-600 rounded-t-full"></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Port Rules & Firewall Section */}
      {activeSecurityTab === 'port-rules' && (
        <div className="space-y-6 animate-fade-in">
          {/* Firewall Stats Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Firewall Status</span>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-2xl font-black text-slate-900">Active</span>
                <span className="text-xs font-semibold text-emerald-600">UFW Synced</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Native packet filtering active on host</p>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-5 space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Rules</span>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-2xl font-black text-brand-600">{activeRulesCount}</span>
                <span className="text-xs font-semibold text-slate-400">/ {rules.length} total rules</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {rules.length - activeRulesCount} rule(s) currently disabled
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">ZoomPanel Core GUI</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200/60">
                  Auto-Synced
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-2xl font-black font-mono text-slate-900">:{daemonPort}</span>
                <span className="text-xs font-semibold text-slate-500">IPv4 &amp; IPv6</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Guaranteed access to ZoomPanel interface</p>
            </div>
          </div>

          {/* Main Firewall Rules Container */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card overflow-hidden">
            {/* Table Controls / Filters Header */}
            <div className="p-5 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/50">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by rule name, port, description, or source..."
                  className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-smooth"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* IP Protocol Filter */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setIpFilter('all')}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      ipFilter === 'all' ? 'bg-slate-900 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Protocols
                  </button>
                  <button
                    type="button"
                    onClick={() => setIpFilter('ipv4')}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      ipFilter === 'ipv4' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    IPv4
                  </button>
                  <button
                    type="button"
                    onClick={() => setIpFilter('ipv6')}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      ipFilter === 'ipv6' ? 'bg-purple-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    IPv6
                  </button>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      statusFilter === 'all' ? 'bg-slate-900 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Status
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('enabled')}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      statusFilter === 'enabled' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Enabled
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('disabled')}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      statusFilter === 'disabled' ? 'bg-slate-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Disabled
                  </button>
                </div>
              </div>
            </div>

            {/* Table Content */}
            {loading ? (
              <div className="p-16 text-center space-y-3">
                <RotateCw className="w-7 h-7 text-brand-600 animate-spin mx-auto" />
                <p className="text-xs font-bold text-slate-700">Loading firewall policies &amp; rules...</p>
              </div>
            ) : filteredRules.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                  <Shield className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">No matching firewall rules found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                  Try adjusting your search criteria or add a new custom firewall rule using the button above.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3.5 px-6">Rule &amp; Description</th>
                      <th className="py-3.5 px-4">Port / Range</th>
                      <th className="py-3.5 px-4">Protocol</th>
                      <th className="py-3.5 px-4">IP Protocol</th>
                      <th className="py-3.5 px-4">Traffic Source</th>
                      <th className="py-3.5 px-4 text-center">Enabled</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredRules.map((rule) => {
                      const isCore = rule.isCore || rule.name.toLowerCase() === 'zoompanel';
                      const isToggling = togglingRuleId === rule.id;

                      return (
                        <tr
                          key={rule.id}
                          className={`transition-colors hover:bg-slate-50/70 ${
                            !rule.enabled ? 'opacity-60 bg-slate-50/30' : ''
                          }`}
                        >
                          {/* Name & Description */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                  isCore
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : rule.enabled
                                    ? 'bg-brand-50 text-brand-600 border border-brand-200/60'
                                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                                }`}
                              >
                                {isCore ? <Layers className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900">{rule.name}</span>
                                  {isCore && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                      <span>Core GUI</span>
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium line-clamp-1 mt-0.5">
                                  {rule.description || 'Firewall packet allow rule'}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Port / Port Range */}
                          <td className="py-4 px-4 font-mono font-bold text-slate-800">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-[11px]">
                              {rule.port}
                            </span>
                          </td>

                          {/* Protocol (TCP / UDP / ANY - No parenthesis description) */}
                          <td className="py-4 px-4">
                            <span className="uppercase font-bold text-[10px] px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-mono">
                              {rule.protocol.toUpperCase()}
                            </span>
                          </td>

                          {/* IP Protocol (IPv4 / IPv6) */}
                          <td className="py-4 px-4">
                            {rule.ipVersion === 'ipv4' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                IPv4
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                                IPv6
                              </span>
                            )}
                          </td>

                          {/* Source */}
                          <td className="py-4 px-4 text-slate-600 font-mono text-[11px]">
                            {rule.source.toLowerCase().includes('anywhere') ? (
                              <span className="text-slate-500 font-sans font-medium">Anywhere</span>
                            ) : (
                              <span className="font-bold text-slate-800">{rule.source}</span>
                            )}
                          </td>

                          {/* Enabled Toggle Switch (Directly before Actions) */}
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={rule.enabled}
                                disabled={isToggling}
                                onClick={() => handleToggle(rule)}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-40 disabled:cursor-not-allowed ${
                                  rule.enabled ? 'bg-brand-600' : 'bg-slate-300'
                                }`}
                                title={rule.enabled ? `Disable ${rule.name}` : `Enable ${rule.name}`}
                                aria-label={`Toggle ${rule.name} enabled`}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                    rule.enabled ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(rule)}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-brand-600 hover:bg-slate-50 transition-colors"
                                title="Edit Rule"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenDelete(rule)}
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  isCore
                                    ? 'border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300'
                                    : 'border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200'
                                }`}
                                title={isCore ? 'Delete Core Daemon Rule (Warning)' : 'Delete Rule'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer info banner */}
            <div className="p-4 bg-slate-50 border-t border-slate-200/80 text-[11px] text-slate-500 font-medium flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-brand-600">🛡️</span>
                <span>
                  All rule modifications take immediate effect and synchronize with Linux UFW packet filters.
                </span>
              </div>
              <span className="text-slate-400">
                Showing {filteredRules.length} of {rules.length} rule entries
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: IP Access Control & Blacklist Section (Extensible) */}
      {activeSecurityTab === 'ip-access' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">IP Blacklist &amp; Geoblocking</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Block specific malicious IP addresses, subnet ranges, or unwanted geographic origins.
                </p>
              </div>
              <button
                type="button"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-smooth shadow-xs flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Blocked IP</span>
              </button>
            </div>

            <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-3 bg-slate-50/50">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                <UserX className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No IP Addresses Currently Blocked</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
                You have zero blacklisted IPs. When bots or malicious crawlers are detected, add their IP or CIDR range here to drop all incoming packets at kernel level.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Login Restrictions & Rate Limits (Extensible) */}
      {activeSecurityTab === 'login-limits' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Brute Force Protection &amp; Login Restrictions</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Protect ZoomPanel administration accounts against automated password guessing and credential stuffing.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                  <KeyRound className="w-4 h-4 text-brand-600" />
                  <span>Max Failed Login Attempts</span>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <input
                    type="number"
                    defaultValue={5}
                    min={1}
                    max={20}
                    className="w-24 px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                  <span className="text-xs text-slate-500">attempts before temporary lockout</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                  <Clock className="w-4 h-4 text-brand-600" />
                  <span>Lockout Duration</span>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <input
                    type="number"
                    defaultValue={15}
                    min={5}
                    max={1440}
                    className="w-24 px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                  <span className="text-xs text-slate-500">minutes of access denial</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
              <div>
                <p className="text-xs font-bold text-slate-900">Enforce Rate Limiting for API Endpoints</p>
                <p className="text-[11px] text-slate-500">Limit unauthenticated clients to 100 requests per minute</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                Active
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Bot Defense & Threat Rules (Extensible) */}
      {activeSecurityTab === 'bot-defense' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Threat Defense &amp; Web Scraper Filtering</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Block known vulnerability scanners, malicious user agents, and unwanted automated scrapers.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
                <span className="text-xs font-bold text-slate-600">SQLi &amp; XSS Filter</span>
                <p className="text-sm font-bold text-emerald-600">Enabled</p>
                <p className="text-[11px] text-slate-400">Nginx pattern matching</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
                <span className="text-xs font-bold text-slate-600">Bad Bot Shield</span>
                <p className="text-sm font-bold text-emerald-600">Protected</p>
                <p className="text-[11px] text-slate-400">Common crawlers blocked</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
                <span className="text-xs font-bold text-slate-600">Hidden File Access</span>
                <p className="text-sm font-bold text-emerald-600">Denied</p>
                <p className="text-[11px] text-slate-400">.env, .git protected</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-lg w-full overflow-hidden animate-scale-in">
            {/* Modal Header with Compact Split Quick-Set Button */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 shadow-xs">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingRule ? `Edit Rule: ${editingRule.name}` : 'Add Firewall Rule'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {editingRule ? 'Modify rule parameters' : 'Define port, protocol, and IP policy'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Compact Split Quick Sets Dropdown inside Modal */}
                {!editingRule && (
                  <div className="relative" ref={modalQuickSetRef}>
                    <button
                      type="button"
                      onClick={() => setShowModalQuickSetDropdown((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors"
                      title="Load a preset"
                    >
                      <Zap className="w-3.5 h-3.5 text-brand-600" />
                      <span>Quick Sets</span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>

                    {showModalQuickSetDropdown && (
                      <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 py-1.5 animate-scale-in">
                        <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Select Preset
                        </div>
                        <div className="max-h-56 overflow-y-auto p-1 space-y-0.5">
                          {quickSets.map((qs) => (
                            <button
                              key={qs.id}
                              type="button"
                              onClick={() => handleApplyQuickSetInModal(qs)}
                              className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-left hover:bg-slate-50 transition-colors"
                            >
                              <span className="text-xs font-bold text-slate-800">{qs.name}</span>
                              <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                {qs.port}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveRule} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Rule Name & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Rule Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-smooth"
                    placeholder="e.g. ZoomPanel, HTTP, Custom API"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-smooth"
                    placeholder="e.g. Inbound web application traffic"
                  />
                </div>
              </div>

              {/* Port & Protocol (No descriptions under port or in protocol choices) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Port or Range <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.port}
                    onChange={(e) => setFormData((prev) => ({ ...prev, port: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-smooth"
                    placeholder="e.g. 80, 443, or 3000-3050"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Protocol
                  </label>
                  <select
                    value={formData.protocol}
                    onChange={(e) => setFormData((prev) => ({ ...prev, protocol: e.target.value as FirewallProtocol }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-smooth bg-white"
                  >
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                    <option value="any">ANY</option>
                  </select>
                </div>
              </div>

              {/* IP Version Policy */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  IP Protocol Version
                </label>
                {editingRule ? (
                  <select
                    value={formData.ipVersion}
                    onChange={(e) => setFormData((prev) => ({ ...prev, ipVersion: e.target.value as any }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-smooth bg-white"
                  >
                    <option value="ipv4">IPv4</option>
                    <option value="ipv6">IPv6</option>
                  </select>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, ipVersion: 'both' }))}
                      className={`p-3 rounded-2xl border text-center transition-colors ${
                        formData.ipVersion === 'both'
                          ? 'border-brand-600 bg-brand-50/50 text-brand-700 font-bold'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-bold">Both</div>
                      <div className="text-[10px] text-slate-400">IPv4 &amp; IPv6</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, ipVersion: 'ipv4' }))}
                      className={`p-3 rounded-2xl border text-center transition-colors ${
                        formData.ipVersion === 'ipv4'
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 font-bold'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-bold">IPv4 Only</div>
                      <div className="text-[10px] text-slate-400">32-bit addresses</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, ipVersion: 'ipv6' }))}
                      className={`p-3 rounded-2xl border text-center transition-colors ${
                        formData.ipVersion === 'ipv6'
                          ? 'border-purple-600 bg-purple-50/50 text-purple-700 font-bold'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-bold">IPv6 Only</div>
                      <div className="text-[10px] text-slate-400">128-bit addresses</div>
                    </button>
                  </div>
                )}
              </div>

              {/* Traffic Source */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Traffic Source
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, sourceType: 'anywhere' }))}
                    className={`p-3 rounded-2xl border text-left transition-colors ${
                      formData.sourceType === 'anywhere'
                        ? 'border-brand-600 bg-brand-50/50 text-brand-700 font-bold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold">Anywhere</div>
                    <div className="text-[10px] text-slate-400">0.0.0.0/0 &amp; ::/0</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, sourceType: 'custom' }))}
                    className={`p-3 rounded-2xl border text-left transition-colors ${
                      formData.sourceType === 'custom'
                        ? 'border-brand-600 bg-brand-50/50 text-brand-700 font-bold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold">Custom IP / CIDR</div>
                    <div className="text-[10px] text-slate-400">Specific IP or subnet</div>
                  </button>
                </div>

                {formData.sourceType === 'custom' && (
                  <div className="pt-1 space-y-1">
                    <input
                      type="text"
                      required
                      value={formData.customSource}
                      onChange={(e) => setFormData((prev) => ({ ...prev, customSource: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-smooth"
                      placeholder="e.g. 192.168.1.50 or 10.0.0.0/24 or 2001:db8::/32"
                    />
                  </div>
                )}
              </div>

              {/* Enabled Status */}
              <div className="pt-2 flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                <div>
                  <p className="text-xs font-bold text-slate-900">Enable rule immediately</p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Traffic will be allowed right after saving.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.enabled}
                  onClick={() => setFormData((prev) => ({ ...prev, enabled: !prev.enabled }))}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
                    formData.enabled ? 'bg-brand-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      formData.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Action buttons */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition-smooth disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Rule...</span>
                    </>
                  ) : (
                    <span>{editingRule ? 'Save Changes' : 'Create Rule'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Standard vs Core ZoomPanel Discouragement) */}
      {deletingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          {deletingRule.isCore || deletingRule.name.toLowerCase() === 'zoompanel' ? (
            /* STRONG DISCOURAGEMENT MODAL FOR ZOOMPANEL DAEMON PORT */
            <div className="bg-white rounded-3xl border-2 border-rose-300 shadow-2xl max-w-lg w-full overflow-hidden animate-scale-in">
              <div className="p-6 bg-rose-50/80 border-b border-rose-100 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-md animate-pulse">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-900">
                    CRITICAL WARNING: ZoomPanel Control Daemon Port
                  </h3>
                  <p className="text-xs text-rose-700 font-semibold mt-1">
                    Deleting this firewall rule will block access to the ZoomPanel GUI!
                  </p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {deleteError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                    <span>{deleteError}</span>
                  </div>
                )}

                <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                  <p>
                    You are attempting to delete the firewall rule for{' '}
                    <strong className="text-slate-900">{deletingRule.name}</strong> on port{' '}
                    <strong className="font-mono text-rose-600">:{deletingRule.port}</strong> (
                    <strong className="uppercase">{deletingRule.ipVersion}</strong>).
                  </p>
                  <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
                    ⚠️ <strong>Lockout Risk:</strong> If your host firewall is enabled, deleting this rule will immediately prevent your web browser from reaching ZoomPanel. You may be permanently locked out unless you have direct terminal or console access.
                  </p>
                  <p>
                    <strong>Recommended alternative:</strong> Keep the rule enabled, or toggle it off temporarily instead of deleting it.
                  </p>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-bold text-slate-700">
                    To proceed anyway, type <span className="font-mono font-black text-rose-600">DELETE ZOOMPANEL</span> below:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmationInput}
                    onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                    placeholder="Type DELETE ZOOMPANEL to unlock button"
                    className="w-full px-4 py-2.5 rounded-xl border border-rose-300 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 transition-smooth uppercase"
                  />
                </div>

                <div className="pt-3 flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setDeletingRule(null)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
                  >
                    Cancel &amp; Keep Safe
                  </button>
                  <button
                    type="button"
                    disabled={
                      isDeleting ||
                      deleteConfirmationInput.trim().toUpperCase() !== 'DELETE ZOOMPANEL'
                    }
                    onClick={handleConfirmDelete}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-smooth disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Removing...</span>
                      </>
                    ) : (
                      <span>I Understand the Risk, Force Delete</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* STANDARD DELETE MODAL FOR REGULAR RULES */
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200/60 flex items-center justify-center text-rose-600 shadow-xs">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Delete Firewall Rule</h3>
                    <p className="text-xs text-slate-500 font-medium">Remove packet allow entry</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDeletingRule(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {deleteError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                    <span>{deleteError}</span>
                  </div>
                )}

                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Are you sure you want to delete rule{' '}
                  <strong className="text-slate-900 font-bold">{deletingRule.name}</strong> on port{' '}
                  <span className="font-mono font-bold text-slate-800">:{deletingRule.port}</span> (
                  <span className="uppercase font-bold">{deletingRule.ipVersion}</span>)?
                  This will immediately remove packet allow rules from the firewall.
                </p>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDeletingRule(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleConfirmDelete}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-smooth disabled:opacity-50 flex items-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <span>Delete Rule</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
