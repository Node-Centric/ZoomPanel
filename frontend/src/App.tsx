import React, { useState, useEffect } from 'react';
import { Sidebar } from './layouts/Sidebar';
import { TopBar } from './layouts/TopBar';
import { Dashboard } from './pages/Dashboard';
import { Sites } from './pages/Sites';
import { SiteDetail } from './pages/SiteDetail';
import { FileManager } from './pages/FileManager';
import { Settings } from './pages/Settings';
import { SystemLogs } from './pages/SystemLogs';
import { Security } from './pages/Security';
import { DatabaseAdmin } from './pages/DatabaseAdmin';
import { CreateSiteModal } from './components/CreateSiteModal';
import { FileEditorModal } from './components/FileEditorModal';
import { SetupWizard } from './components/SetupWizard';
import { LoginScreen } from './components/LoginScreen';
import { api } from './services/api';
import type { Site, SystemStats, SiteDatabase, SafeUser, PanelSettings } from '../../shared/types.js';

export function App() {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'sites' | 'files' | 'logs' | 'security' | 'settings'>('dashboard');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [siteDetailTab, setSiteDetailTab] = useState<'overview' | 'vhost' | 'nginx' | 'databases' | 'files' | 'security' | 'ssl' | 'cron' | 'logs' | 'settings'>('overview');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateSiteOpen, setIsCreateSiteOpen] = useState(false);
  const [editingFilePath, setEditingFilePath] = useState<string | null>(null);

  // Authentication & Initialization State
  const [authChecked, setAuthChecked] = useState(false);
  const [isInitialized, setIsInitialized] = useState(true);
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(null);
  const [panelSettings, setPanelSettings] = useState<PanelSettings | null>(null);
  const [justConfigured, setJustConfigured] = useState(false);

  // Dedicated Database Admin mode (replaces the main screen)
  const [adminDatabaseContext, setAdminDatabaseContext] = useState<{
    site: Site;
    database: SiteDatabase;
    initialTable?: string | null;
    initialTab?: 'data' | 'structure' | 'sql' | 'info';
  } | null>(null);

  // Navigation helper ensuring clean URL formatting
  const navigateTo = (url: string, replace = false) => {
    if (replace) {
      window.history.replaceState(null, '', url);
    } else {
      window.history.pushState(null, '', url);
    }
    localStorage.setItem('zoompanel_route', url);
    syncFromLocation(sites);
  };

  // Route Synchronization Logic
  const syncFromLocation = async (availableSites: Site[] = sites) => {
    const pathname = window.location.pathname.replace(/\/$/, '') || '/';
    let hash = window.location.hash || '';

    // Handle root pathname "/"
    if (pathname === '/' || pathname === '') {
      // If no hash at all
      if (!hash || hash === '#' || hash === '#/') {
        const saved = localStorage.getItem('zoompanel_route');
        if (saved && saved !== '/' && saved !== '/#' && saved !== '/#/') {
          if (saved.startsWith('/site')) {
            window.history.replaceState(null, '', saved);
            syncFromLocation(availableSites);
            return;
          } else {
            const cleanSaved = saved.replace(/^\/#\/?/, '#');
            window.history.replaceState(null, '', `/#${cleanSaved}`);
            syncFromLocation(availableSites);
            return;
          }
        }
        window.history.replaceState(null, '', '/#dashboard');
        localStorage.setItem('zoompanel_route', '/#dashboard');
        setCurrentTab('dashboard');
        setSelectedSiteId(null);
        setAdminDatabaseContext(null);
        return;
      }

      // Check if legacy hash like "#/sites/demo-api-local..." or "#sites/demo-api-local"
      if (hash.startsWith('#/sites/') || hash.startsWith('#sites/')) {
        const remainder = hash.startsWith('#/sites/')
          ? hash.slice('#/sites/'.length)
          : hash.slice('#sites/'.length);
        const newUrl = `/site/#${remainder}`;
        window.history.replaceState(null, '', newUrl);
        localStorage.setItem('zoompanel_route', newUrl);
        syncFromLocation(availableSites);
        return;
      }

      // If hash starts with "#/", clean to "#" (e.g., "#/sites" -> "#sites")
      if (hash.startsWith('#/')) {
        const cleanHash = `#${hash.slice(2)}`;
        window.history.replaceState(null, '', `/${cleanHash}`);
        hash = cleanHash;
      }

      localStorage.setItem('zoompanel_route', `/${hash}`);

      const raw = hash.replace(/^#/, '');
      const [pathPart] = raw.split('?');
      const segments = pathPart.split('/').filter(Boolean);
      const tabName = segments[0] || 'dashboard';

      if (tabName === 'sites') {
        setCurrentTab('sites');
        setSelectedSiteId(null);
        setAdminDatabaseContext(null);
      } else if (tabName === 'files') {
        setCurrentTab('files');
        setSelectedSiteId(null);
        setAdminDatabaseContext(null);
      } else if (tabName === 'logs') {
        setCurrentTab('logs');
        setSelectedSiteId(null);
        setAdminDatabaseContext(null);
      } else if (tabName === 'security') {
        setCurrentTab('security');
        setSelectedSiteId(null);
        setAdminDatabaseContext(null);
      } else if (tabName === 'settings') {
        setCurrentTab('settings');
        setSelectedSiteId(null);
        setAdminDatabaseContext(null);
      } else {
        setCurrentTab('dashboard');
        setSelectedSiteId(null);
        setAdminDatabaseContext(null);
      }
    } 
    // Handle "/site" pathname
    else if (pathname === '/site') {
      let raw = hash.replace(/^#\/?/, '').trim();
      if (!raw) {
        // No site specified, redirect to /#sites
        navigateTo('/#sites', true);
        return;
      }

      const [pathPart, queryPart] = raw.split('?');
      const params = new URLSearchParams(queryPart || '');
      const segments = pathPart.split('/').filter(Boolean);

      const siteId = segments[0];

      // Check for database admin: /site/#siteId/database/:dbName
      if (segments.length >= 3 && segments[1] === 'database') {
        const dbName = decodeURIComponent(segments[2]);
        const tbl = params.get('table');
        const tab = params.get('tab') as 'data' | 'structure' | 'sql' | 'info' | null;

        let targetSite = availableSites.find((s) => s.id === siteId);
        if (!targetSite) {
          try {
            targetSite = await api.getSite(siteId);
          } catch {
            // fallback
          }
        }

        if (targetSite) {
          const db: SiteDatabase = targetSite.databases?.find((d) => d.name === dbName) || {
            id: dbName,
            siteId: targetSite.id,
            name: dbName,
            user: 'root',
            host: 'localhost',
            charset: 'utf8mb4_unicode_ci',
            port: 3306,
            createdAt: targetSite.createdAt,
          };
          setSelectedSiteId(siteId);
          setCurrentTab('sites');
          setAdminDatabaseContext({
            site: targetSite,
            database: db,
            initialTable: tbl,
            initialTab: tab || 'data',
          });
        }
      } else {
        // Standard Site Details with optional tab
        const subTab = segments[1] || 'overview';
        setSelectedSiteId(siteId);
        setSiteDetailTab(subTab as any);
        setCurrentTab('sites');
        setAdminDatabaseContext(null);

        const canonicalUrl = subTab === 'overview'
          ? `/site/#${siteId}`
          : `/site/#${siteId}/${subTab}`;
        localStorage.setItem('zoompanel_route', canonicalUrl);
      }
    } else {
      // Unknown pathname, redirect to root
      navigateTo('/#dashboard', true);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const status = await api.getAuthStatus();
      setIsInitialized(status.isInitialized);
      setCurrentUser(status.user || null);
      if (status.isInitialized) {
        api.getSettings().then(setPanelSettings).catch(() => {});
      }
      if (status.user) {
        fetchInitialData();
      }
    } catch (err) {
      console.error('Failed to get auth status', err);
    } finally {
      setAuthChecked(true);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
  };

  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(fetchStats, 5000);

    const onLocationChange = () => {
      syncFromLocation();
    };

    window.addEventListener('popstate', onLocationChange);
    window.addEventListener('hashchange', onLocationChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener('popstate', onLocationChange);
      window.removeEventListener('hashchange', onLocationChange);
    };
  }, [currentUser]);

  const fetchInitialData = async () => {
    setIsRefreshing(true);
    try {
      const [statsData, sitesData] = await Promise.all([
        api.getStats().catch(() => null),
        api.getSites().catch(() => []),
      ]);
      if (statsData) setStats(statsData);
      if (sitesData) {
        setSites(sitesData);
        syncFromLocation(sitesData);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchStats = async () => {
    try {
      const statsData = await api.getStats();
      setStats(statsData);
    } catch {
      // ignore
    }
  };

  const handleSelectTab = (tab: string) => {
    navigateTo(`/#${tab}`);
  };

  const handleSelectSite = (site: Site) => {
    navigateTo(`/site/#${site.id}`);
  };

  const handleSiteCreated = (newSite: Site) => {
    setSites((prev) => [...prev, newSite]);
    navigateTo(`/site/#${newSite.id}`);
  };

  const handleSiteUpdated = (updatedSite: Site) => {
    setSites((prev) => prev.map((s) => (s.id === updatedSite.id ? updatedSite : s)));
  };

  const handleSiteDeleted = (deletedId: string) => {
    setSites((prev) => prev.filter((s) => s.id !== deletedId));
    navigateTo('/#sites');
  };

  const handleDatabaseAdminViewChange = (table: string | null, tab: 'data' | 'structure' | 'sql' | 'info') => {
    if (!adminDatabaseContext) return;
    const q: string[] = [];
    if (table) q.push(`table=${encodeURIComponent(table)}`);
    if (tab) q.push(`tab=${tab}`);
    const qStr = q.length > 0 ? `?${q.join('&')}` : '';
    const newUrl = `/site/#${adminDatabaseContext.site.id}/database/${encodeURIComponent(adminDatabaseContext.database.name)}${qStr}`;
    window.history.replaceState(null, '', newUrl);
    localStorage.setItem('zoompanel_route', newUrl);
  };

  const getPageTitle = () => {
    if (selectedSiteId) return 'Site Details';
    switch (currentTab) {
      case 'dashboard': return 'Dashboard';
      case 'sites': return 'Sites';
      case 'files': return 'File Manager';
      case 'logs': return 'System Logs';
      case 'security': return 'Security';
      case 'settings': return 'Settings';
      default: return 'ZoomPanel';
    }
  };

  // Authentication / Setup Gates
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <SetupWizard
        onSetupSuccess={async () => {
          setIsInitialized(true);
          setJustConfigured(true);
        }}
      />
    );
  }

  if (!currentUser) {
    return (
      <LoginScreen
        justConfigured={justConfigured}
        onLoginSuccess={async (user) => {
          setCurrentUser(user);
          setJustConfigured(false);
          const settings = await api.getSettings().catch(() => null);
          if (settings) setPanelSettings(settings);
          fetchInitialData();
        }}
      />
    );
  }

  // If Database Admin is active, it replaces the entire ZoomPanel main workspace
  if (adminDatabaseContext) {
    return (
      <DatabaseAdmin
        site={adminDatabaseContext.site}
        database={adminDatabaseContext.database}
        initialTable={adminDatabaseContext.initialTable}
        initialTab={adminDatabaseContext.initialTab}
        onViewChange={handleDatabaseAdminViewChange}
        onClose={() => {
          navigateTo(`/site/#${adminDatabaseContext.site.id}/databases`);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={selectedSiteId ? 'sites' : currentTab}
        onSelectTab={handleSelectTab}
        serverHostname={stats?.os.hostname || 'ubuntu-vps'}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          title={getPageTitle()}
          subtitle="Server & Node.js Hosting Management"
          stats={stats}
          currentUser={currentUser}
          onRefresh={fetchInitialData}
          onOpenCreateSite={() => setIsCreateSiteOpen(true)}
          onOpenMyAccount={() => navigateTo('/#settings')}
          onLogout={handleLogout}
          isRefreshing={isRefreshing}
        />

        <main className="flex-1 overflow-y-auto">
          {selectedSiteId ? (
            <SiteDetail
              siteId={selectedSiteId}
              initialTab={siteDetailTab}
              timeZone={panelSettings?.timeZone}
              onTabChange={(tab) => {
                const newUrl = tab === 'overview' 
                  ? `/site/#${selectedSiteId}` 
                  : `/site/#${selectedSiteId}/${tab}`;
                navigateTo(newUrl, true);
              }}
              onBack={() => {
                navigateTo('/#sites');
              }}
              onSiteUpdated={handleSiteUpdated}
              onSiteDeleted={handleSiteDeleted}
              onOpenFileEditor={(path) => setEditingFilePath(path)}
              onOpenDatabaseAdmin={(site, db) => {
                navigateTo(`/site/#${site.id}/database/${encodeURIComponent(db.name)}`);
              }}
            />
          ) : currentTab === 'dashboard' ? (
            <Dashboard
              stats={stats}
              sites={sites}
              onSelectSite={handleSelectSite}
              onOpenCreateSite={() => setIsCreateSiteOpen(true)}
              onRefresh={fetchInitialData}
            />
          ) : currentTab === 'sites' ? (
            <Sites
              sites={sites}
              onSelectSite={handleSelectSite}
              onOpenCreateSite={() => setIsCreateSiteOpen(true)}
              onRefresh={fetchInitialData}
            />
          ) : currentTab === 'files' ? (
            <FileManager
              onOpenFileEditor={(path) => setEditingFilePath(path)}
            />
          ) : currentTab === 'logs' ? (
            <SystemLogs stats={stats} />
          ) : currentTab === 'security' ? (
            <Security />
          ) : (
            <Settings stats={stats} onRefresh={fetchInitialData} />
          )}
        </main>
      </div>

      {/* Create Site Wizard Modal */}
      <CreateSiteModal
        isOpen={isCreateSiteOpen}
        onClose={() => setIsCreateSiteOpen(false)}
        onSiteCreated={handleSiteCreated}
      />

      {/* Code / File Editor Modal */}
      <FileEditorModal
        filePath={editingFilePath}
        onClose={() => setEditingFilePath(null)}
        onSaved={fetchInitialData}
      />
    </div>
  );
}
