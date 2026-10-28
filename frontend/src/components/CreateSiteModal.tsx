import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Shield, Globe, CheckCircle2, AlertCircle, Database, HelpCircle } from 'lucide-react';
import { SiteTypeSelector } from './SiteTypeSelector';
import { api } from '../services/api';
import type { SiteType, CreateSitePayload, Site } from '../../../shared/types.js';

interface CreateSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSiteCreated: (site: Site) => void;
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

export const CreateSiteModal: React.FC<CreateSiteModalProps> = ({
  isOpen,
  onClose,
  onSiteCreated,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [siteType, setSiteType] = useState<SiteType>('nodejs');
  const [domain, setDomain] = useState('');
  const [aliases, setAliases] = useState('');
  const [nodeVersion, setNodeVersion] = useState('v26.13.0');
  const [port, setPort] = useState<number | ''>(3000);
  const [entryFile, setEntryFile] = useState('server.js');
  const [enableSSL, setEnableSSL] = useState(true);
  const [sslType, setSslType] = useState<'self-signed' | 'letsencrypt'>('self-signed');
  const [enableDatabases, setEnableDatabases] = useState(false);
  const [siteUser, setSiteUser] = useState('');
  const [sitePassword, setSitePassword] = useState('');
  const [userManuallyEdited, setUserManuallyEdited] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Used ports tracking & live collision detection
  const [usedPorts, setUsedPorts] = useState<{ port: number; siteId?: string; domain?: string }[]>([]);
  const [portError, setPortError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setError(null);
      setPortError(null);
      setSiteUser('');
      setSitePassword('');
      setUserManuallyEdited(false);
      // Fetch used ports & next available port starting from 3000
      api.getUsedPorts().then((ports) => {
        setUsedPorts(ports);
      }).catch(() => {});

      api.getNextPort().then((next) => {
        setPort(next);
      }).catch(() => {
        setPort(3000);
      });
    }
  }, [isOpen]);

  // Live validate port whenever it changes
  useEffect(() => {
    if (port === '') {
      setPortError('Application port is required.');
      return;
    }
    const num = Number(port);
    if (isNaN(num)) {
      setPortError('Port must be a valid numeric value.');
      return;
    }
    if (num === 8443) {
      setPortError('Port 8443 is reserved for the ZoomPanel daemon. Please choose another port.');
      return;
    }
    if (num < 1024 || num > 65535) {
      setPortError('Port must be between 1024 and 65535.');
      return;
    }
    const conflict = usedPorts.find((u) => u.port === num);
    if (conflict) {
      setPortError(`Port ${num} is already in use by '${conflict.domain || 'another site'}'. Every Node.js site must have a unique application port.`);
      return;
    }
    setPortError(null);
  }, [port, usedPorts]);

  if (!isOpen) return null;

  const handleNext = () => {
    setError(null);
    if (step === 2) {
      if (!domain.trim()) {
        setError('Please enter a valid domain name (e.g. myapp.com)');
        return;
      }
      if (!siteUser.trim() || siteUser.trim().length < 3) {
        setError('Site User is required and must be at least 3 characters.');
        return;
      }
      if (!sitePassword.trim() || sitePassword.trim().length < 6) {
        setError('Site Password is required and must be at least 6 characters.');
        return;
      }
      if (portError) {
        setError('Please resolve the port conflict before continuing.');
        return;
      }
    }
    setStep((prev) => (prev < 3 ? ((prev + 1) as any) : prev));
  };

  const handleBack = () => {
    setError(null);
    setStep((prev) => (prev > 1 ? ((prev - 1) as any) : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (portError) {
      setError('Please resolve the port conflict before creating the site.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const aliasArray = aliases
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);

      const payload: CreateSitePayload = {
        domain: domain.trim(),
        aliases: aliasArray,
        type: siteType,
        siteUser: siteUser.trim(),
        sitePassword: sitePassword.trim(),
        nodeVersion,
        port: port ? Number(port) : undefined,
        entryFile: entryFile.trim() || 'server.js',
        enableSSL,
        sslType,
        enableDatabases,
      };

      const createdSite = await api.createSite(payload);
      onSiteCreated(createdSite);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while creating site');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStep2Invalid = step === 2 && (Boolean(portError) || !domain.trim() || !siteUser.trim() || siteUser.trim().length < 3 || !sitePassword.trim() || sitePassword.trim().length < 6);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-modal w-full max-w-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 font-bold text-sm">
              {step}/3
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Create New Site</h2>
              <p className="text-xs text-slate-500 font-medium">
                {step === 1 && 'Step 1: Choose Runtime Environment'}
                {step === 2 && 'Step 2: Domain, Port & Configuration'}
                {step === 3 && 'Step 3: SSL Certificate Security'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-8 overflow-y-auto flex-1">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-medium flex items-center gap-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Site Type Selector */}
          {step === 1 && (
            <SiteTypeSelector
              selectedType={siteType}
              onSelectType={(t) => setSiteType(t)}
            />
          )}

          {/* STEP 2: Domain & Configuration */}
          {step === 2 && (
            <div className="space-y-5 max-w-lg mx-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Primary Domain Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDomain(val);
                      if (!userManuallyEdited) {
                        const suggested = val.trim().toLowerCase().split('.')[0].replace(/[^a-z0-9_]/g, '').slice(0, 20);
                        setSiteUser(suggested);
                      }
                    }}
                    placeholder="example.com or api.example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-smooth"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  The primary domain NGINX will listen for.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Aliases (Optional)
                </label>
                <input
                  type="text"
                  value={aliases}
                  onChange={(e) => setAliases(e.target.value)}
                  placeholder="www.example.com, test.example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-smooth"
                />
              </div>

              {/* Site User & Site Password (Required) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Site User <span className="text-rose-500">*</span>
                    </label>
                    <DelayedTooltip text="The dedicated Linux system user account created on the server for this site. It provides process isolation and serves as the login username for SSH terminal access and SFTP file transfers.">
                      <button type="button" className="text-slate-400 hover:text-slate-600 focus:outline-none transition-colors">
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </DelayedTooltip>
                  </div>
                  <input
                    type="text"
                    required
                    value={siteUser}
                    onChange={(e) => {
                      setUserManuallyEdited(true);
                      setSiteUser(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                    }}
                    placeholder="e.g. site_user"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-smooth"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Isolated system account on server.
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Site Password <span className="text-rose-500">*</span>
                    </label>
                    <DelayedTooltip text="The authentication password for this site's system user. Used to securely authenticate SFTP file connections and SSH terminal sessions.">
                      <button type="button" className="text-slate-400 hover:text-slate-600 focus:outline-none transition-colors">
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </DelayedTooltip>
                  </div>
                  <input
                    type="password"
                    required
                    value={sitePassword}
                    onChange={(e) => setSitePassword(e.target.value)}
                    placeholder="Enter user password"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-smooth"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    For SFTP & SSH authentication.
                  </p>
                </div>
              </div>

              {/* Application Port with Conflict Enforcement */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Node.js Application Port <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">Starts at 3000 • Must be unique</span>
                </div>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value ? Number(e.target.value) : '')}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-smooth font-mono text-xs ${
                    portError
                      ? 'border-rose-400 bg-rose-50/30 text-rose-900 focus:ring-2 focus:ring-rose-400/20'
                      : 'border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600'
                  }`}
                />
                
                {/* Port Validation Error Alert */}
                {portError ? (
                  <div className="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-rose-700 text-xs animate-shake">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
                    <span>{portError}</span>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    PM2 binds to 127.0.0.1:{port} and NGINX reverse proxies all public traffic to it.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Node.js Version
                  </label>
                  <select
                    value={nodeVersion}
                    onChange={(e) => setNodeVersion(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-smooth"
                  >
                    <option value="v26.13.0">Node.js 26.13.0 (Latest)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Entry Script
                  </label>
                  <input
                    type="text"
                    value={entryFile}
                    onChange={(e) => setEntryFile(e.target.value)}
                    placeholder="server.js"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-smooth font-mono text-xs"
                  />
                </div>
              </div>

              {/* Database Toggle Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 flex-shrink-0">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Enable Database Support</h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Enables the Databases tab on this site where you can create and manage databases, users, and credentials.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={enableDatabases}
                    onChange={(e) => setEnableDatabases(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                </label>
              </div>
            </div>
          )}

          {/* STEP 3: SSL Option */}
          {step === 3 && (
            <div className="space-y-4 max-w-lg mx-auto">
              <div className="text-center mb-6">
                <h3 className="text-base font-semibold text-slate-900">Configure SSL Certificate</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Secure your site with TLS/HTTPS. All certificates are managed automatically by ZoomPanel.
                </p>
              </div>

              {/* Option 1: Self-Signed Certificate */}
              <div
                onClick={() => setSslType('self-signed')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-smooth flex items-start gap-4 ${
                  sslType === 'self-signed'
                    ? 'border-brand-600 bg-brand-50/20 ring-4 ring-brand-500/10'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 flex-shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-900">Self-Signed Certificate</h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">
                      Initial Option
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Instantly generates a 2048-bit OpenSSL certificate on your VPS. Immediate HTTPS access without needing DNS propagation or domain validation.
                  </p>
                </div>
              </div>

              {/* Option 2: Let's Encrypt */}
              <div
                onClick={() => setSslType('letsencrypt')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-smooth flex items-start gap-4 ${
                  sslType === 'letsencrypt'
                    ? 'border-brand-600 bg-brand-50/20 ring-4 ring-brand-500/10'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-900">Let's Encrypt SSL</h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      Standard TLS
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Free, trusted SSL certificate signed by Let's Encrypt with auto-renewal. Requires your domain's DNS to already point to this server IP.
                  </p>
                </div>
              </div>

              {/* Summary of actions */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1.5 mt-4">
                <div className="font-semibold text-slate-800">What happens on creation:</div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-600"></div>
                  <span>Directory initialized at <code>/var/www/{domain || 'example.com'}</code></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-600"></div>
                  <span>Bound to application port <code>{port}</code> (Reverse proxied by NGINX)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-600"></div>
                  <span>OpenSSL self-signed certificate installed</span>
                </div>
                {enableDatabases && (
                  <div className="flex items-center gap-2 text-sky-700 font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-600"></div>
                    <span>Database management enabled</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div></div>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={isStep2Invalid}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-smooth ${
                isStep2Invalid
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-brand-600 hover:bg-brand-700 text-white'
              }`}
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || Boolean(portError)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-sm transition-smooth disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Provisioning Site...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Create Site</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
