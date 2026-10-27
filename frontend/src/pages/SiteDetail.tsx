import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  ArrowLeft, 
  Play, 
  Square, 
  RotateCw, 
  FolderTree, 
  Terminal, 
  FileCode, 
  ShieldCheck, 
  ExternalLink,
  Trash2,
  Check,
  Copy,
  Edit3,
  Database,
  Plus,
  Settings as SettingsIcon,
  Key,
  Eye,
  EyeOff,
  AlertCircle,
  HelpCircle,
  Info,
  X,
  Table as TableIcon,
  Clock,
  FolderPlus,
  FilePlus,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronDown,
  Home,
  Pencil,
  TextCursor,
  Folder,
  FolderOpen,
  FolderInput,
  RotateCcw,
  Save,
  Lock,
  Upload,
  Shield,
  User,
  Server,
  Hash
} from 'lucide-react';
import { api } from '../services/api';
import type { Site, FileItem, SiteDatabase } from '../../../shared/types.js';

export function formatModifiedDate(dateStr: string, timeZone?: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const formatted = new Intl.DateTimeFormat('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timeZone || undefined,
    }).format(d);
    return formatted.replace(/,\s*/, ' ');
  } catch {
    return dateStr;
  }
}

export function getSiteHomeDirectory(s?: Site | null): string {
  if (!s) return '';
  if (s.homeDirectory) return s.homeDirectory;
  if (s.siteUser) {
    const norm = (s.rootDirectory || '').replace(/\\/g, '/');
    const wwwIdx = norm.toLowerCase().indexOf('/www/');
    if (wwwIdx !== -1) {
      return norm.slice(0, wwwIdx);
    }
  }
  return s.rootDirectory || '';
}

export function getDisplayWebRoot(fullPath: string): string {
  if (!fullPath) return '—';
  const norm = fullPath.replace(/\\/g, '/');
  const homeIdx = norm.toLowerCase().indexOf('/home/');
  if (homeIdx !== -1) {
    return norm.slice(homeIdx);
  }
  const homeStartIdx = norm.toLowerCase().indexOf('home/');
  if (homeStartIdx !== -1) {
    return '/' + norm.slice(homeStartIdx);
  }
  return norm;
}

interface SiteDetailProps {
  siteId: string;
  initialTab?: 'overview' | 'vhost' | 'nginx' | 'databases' | 'files' | 'security' | 'ssl' | 'cron' | 'logs' | 'settings';
  timeZone?: string;
  onBack: () => void;
  onSiteUpdated: (site: Site) => void;
  onSiteDeleted: (siteId: string) => void;
  onOpenFileEditor: (filePath: string) => void;
  onOpenDatabaseAdmin: (site: Site, database: SiteDatabase) => void;
  onTabChange?: (tab: string) => void;
}

export const SiteDetail: React.FC<SiteDetailProps> = ({
  siteId,
  initialTab,
  timeZone,
  onBack,
  onSiteUpdated,
  onSiteDeleted,
  onOpenFileEditor,
  onOpenDatabaseAdmin,
  onTabChange,
}) => {
  const normalizeTab = (tab?: string): 'overview' | 'vhost' | 'databases' | 'files' | 'security' | 'cron' | 'logs' | 'settings' => {
    if (tab === 'nginx') return 'vhost';
    if (tab === 'ssl') return 'security';
    return (tab as any) || 'overview';
  };

  const [site, setSite] = useState<Site | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'vhost' | 'databases' | 'files' | 'security' | 'cron' | 'logs' | 'settings'>(normalizeTab(initialTab));

  useEffect(() => {
    if (initialTab) {
      const normalized = normalizeTab(initialTab);
      if (normalized !== activeTab) {
        setActiveTab(normalized);
      }
    }
  }, [initialTab]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Tab states
  const [logs, setLogs] = useState<string>('');
  const [nginxConfig, setNginxConfig] = useState<string>('');
  const [originalNginxConfig, setOriginalNginxConfig] = useState<string>('');
  const [isSavingNginx, setIsSavingNginx] = useState<boolean>(false);
  const [isResettingNginx, setIsResettingNginx] = useState<boolean>(false);
  const [nginxSaveMessage, setNginxSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // File Manager states (Sandboxed to site root)
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [fileSearch, setFileSearch] = useState('');
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [itemToRename, setItemToRename] = useState<FileItem | null>(null);
  const [renameNewName, setRenameNewName] = useState('');
  const [itemsToDelete, setItemsToDelete] = useState<FileItem[] | null>(null);
  const [isDeletingFileItem, setIsDeletingFileItem] = useState(false);

  // Multi-selection & Shift+Click state
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // Move Modal & Overwrite state
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveModalDest, setMoveModalDest] = useState<string>('');
  const [moveModalExpanded, setMoveModalExpanded] = useState<Set<string>>(new Set());
  const [isMoving, setIsMoving] = useState(false);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [moveConflicts, setMoveConflicts] = useState<string[]>([]);

  // Sidebar Resizing state
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  // Column Resizing state (Percentages sum to 100%, zero horizontal scroll)
  const [colPercents, setColPercents] = useState<Record<string, number>>({
    name: 40,
    size: 12,
    permissions: 14,
    date: 20,
    actions: 14,
  });
  const [isResizing, setIsResizing] = useState(false);

  // Treeview & Folder navigation state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [treeSubfolders, setTreeSubfolders] = useState<Record<string, FileItem[]>>({});
  const [showNewDropdown, setShowNewDropdown] = useState(false);

  // Database Management states
  const [databases, setDatabases] = useState<SiteDatabase[]>([]);
  const [showCreateDbModal, setShowCreateDbModal] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  const [newDbUser, setNewDbUser] = useState('');
  const [newDbPass, setNewDbPass] = useState('');
  const [isCreatingDb, setIsCreatingDb] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Site Settings Tab states
  const [toggleDbError, setToggleDbError] = useState<string | null>(null);
  const [isTogglingDb, setIsTogglingDb] = useState(false);
  const [sitePort, setSitePort] = useState<number | ''>(3000);
  const [portError, setPortError] = useState<string | null>(null);
  const [usedPorts, setUsedPorts] = useState<{ port: number; siteId?: string; domain?: string }[]>([]);
  const [isSavingPort, setIsSavingPort] = useState(false);
  const [portSaveSuccess, setPortSaveSuccess] = useState(false);

  // Certificate states
  const [showCertActionsDropdown, setShowCertActionsDropdown] = useState(false);
  const [showLetsEncryptModal, setShowLetsEncryptModal] = useState(false);
  const [letsEncryptEmail, setLetsEncryptEmail] = useState('');
  const [showImportCertModal, setShowImportCertModal] = useState(false);
  const [customCertContent, setCustomCertContent] = useState('');
  const [customKeyContent, setCustomKeyContent] = useState('');
  const [certActionLoading, setCertActionLoading] = useState(false);
  const [certActionMessage, setCertActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Access & SSH states
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [newSitePassword, setNewSitePassword] = useState('');
  const [showNewSitePassword, setShowNewSitePassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);

  const [showAddSshKeyModal, setShowAddSshKeyModal] = useState(false);
  const [newSshKey, setNewSshKey] = useState('');
  const [isAddingSshKey, setIsAddingSshKey] = useState(false);
  const [sshKeyError, setSshKeyError] = useState<string | null>(null);

  const [accessActionMessage, setAccessActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedAccessField, setCopiedAccessField] = useState<string | null>(null);

  const normalizePath = (p: string) => (p || '').replace(/\\/g, '/').replace(/\/$/, '');

  useEffect(() => {
    loadSite();
  }, [siteId]);

  const loadSite = async () => {
    setLoading(true);
    try {
      const data = await api.getSite(siteId);
      setSite(data);
      setSitePort(data.port);
      const baseDir = data.homeDirectory || getSiteHomeDirectory(data) || data.rootDirectory;
      setCurrentPath(baseDir);
      if (data.databasesEnabled) {
        loadDatabases(data.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDatabases = async (id: string) => {
    try {
      const list = await api.getDatabases(id);
      setDatabases(list);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!site) return;
    if (activeTab === 'logs') {
      api.getSiteLogs(site.id).then(setLogs).catch(() => {});
    } else if (activeTab === 'vhost') {
      api.getNginxConfig(site.id).then((cfg) => {
        setNginxConfig(cfg);
        setOriginalNginxConfig(cfg);
      }).catch(() => {});
    } else if (activeTab === 'files') {
      const baseRoot = site.homeDirectory || getSiteHomeDirectory(site) || site.rootDirectory;
      const root = normalizePath(baseRoot);
      setExpandedFolders((prev) => new Set([...prev, root]));
      fetchTreeSubfolders(root);
      loadFiles(currentPath || root);
    } else if (activeTab === 'databases' && site.databasesEnabled) {
      loadDatabases(site.id);
    } else if (activeTab === 'settings') {
      api.getUsedPorts().then(setUsedPorts).catch(() => {});
    }
  }, [activeTab, site]);

  // Click outside to close split button dropdown & Esc to clear selection
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#fm-new-split-btn')) {
        setShowNewDropdown(false);
      }
      if (!target.closest('#cert-actions-split-btn')) {
        setShowCertActionsDropdown(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedPaths(new Set());
        setLastSelectedIndex(null);
        setShowNewDropdown(false);
        setShowCertActionsDropdown(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Port Validation Effect
  useEffect(() => {
    if (!site) return;
    if (sitePort === '') {
      setPortError('Application port is required.');
      return;
    }
    const num = Number(sitePort);
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
    const conflict = usedPorts.find((u) => u.port === num && u.siteId !== site.id);
    if (conflict) {
      setPortError(`Port ${num} is already in use by '${conflict.domain || 'another site'}'. Every Node.js site must have a unique application port.`);
      return;
    }
    setPortError(null);
  }, [sitePort, usedPorts, site]);

  const handleUpdatePort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!site || portError || sitePort === '' || Number(sitePort) === site.port) return;
    setIsSavingPort(true);
    setPortSaveSuccess(false);
    try {
      const updated = await api.updateSitePort(site.id, Number(sitePort));
      setSite(updated);
      onSiteUpdated(updated);
      setPortSaveSuccess(true);
      setTimeout(() => setPortSaveSuccess(false), 4000);
    } catch (err: any) {
      setPortError(err.message || 'Failed to update port');
    } finally {
      setIsSavingPort(false);
    }
  };

  const handleSaveNginxConfig = async () => {
    if (!site) return;
    setIsSavingNginx(true);
    setNginxSaveMessage(null);
    try {
      const res = await api.saveNginxConfig(site.id, nginxConfig);
      setOriginalNginxConfig(nginxConfig);
      setNginxSaveMessage({ type: 'success', text: res.message || 'Virtual host updated and NGINX reloaded successfully.' });
      setTimeout(() => setNginxSaveMessage(null), 5000);
    } catch (err: any) {
      setNginxSaveMessage({ type: 'error', text: err.message || 'Failed to save virtual host config' });
    } finally {
      setIsSavingNginx(false);
    }
  };

  const handleResetNginxConfig = async () => {
    if (!site) return;
    if (!window.confirm('Are you sure you want to reset this Virtual Host to default? Any custom modifications will be replaced with the default template.')) return;
    setIsResettingNginx(true);
    setNginxSaveMessage(null);
    try {
      const cfg = await api.resetNginxConfig(site.id);
      setNginxConfig(cfg);
      setOriginalNginxConfig(cfg);
      setNginxSaveMessage({ type: 'success', text: 'Virtual host configuration reset to default template.' });
      setTimeout(() => setNginxSaveMessage(null), 5000);
    } catch (err: any) {
      setNginxSaveMessage({ type: 'error', text: err.message || 'Failed to reset virtual host config' });
    } finally {
      setIsResettingNginx(false);
    }
  };

  const fileBaseDir = site ? (site.homeDirectory || getSiteHomeDirectory(site) || site.rootDirectory) : '';
  const siteRoot = normalizePath(fileBaseDir);
  const currentNorm = normalizePath(currentPath || siteRoot);
  const isAtRoot = currentNorm === siteRoot;

  const selectedItems = files.filter((f) => selectedPaths.has(f.path));
  const singleSelectedItem = selectedItems.length === 1 ? selectedItems[0] : null;

  const fetchTreeSubfolders = async (folderPath: string) => {
    if (!site) return [];
    const norm = normalizePath(folderPath);
    try {
      const res = await api.listFiles(folderPath, fileBaseDir);
      const dirs = res.items.filter((i) => i.isDirectory);
      setTreeSubfolders((prev) => ({
        ...prev,
        [norm]: dirs,
      }));
      return dirs;
    } catch {
      return [];
    }
  };

  const loadFiles = async (dirPath?: string) => {
    if (!site) return;
    setFilesLoading(true);
    setFilesError(null);
    setSelectedPaths(new Set());
    setLastSelectedIndex(null);
    try {
      let target = dirPath || currentPath || fileBaseDir;
      const normTarget = normalizePath(target);
      const normRoot = normalizePath(fileBaseDir);
      if (!normTarget.startsWith(normRoot)) {
        target = fileBaseDir;
      }
      const res = await api.listFiles(target, fileBaseDir);
      setFiles(res.items);
      setCurrentPath(res.path);

      const normCurrent = normalizePath(res.path);
      const dirs = res.items.filter((i) => i.isDirectory);
      setTreeSubfolders((prev) => ({
        ...prev,
        [normCurrent]: dirs,
      }));

      // Auto-expand all ancestors up to root
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.add(normRoot);
        let curr = normCurrent;
        while (curr.length > normRoot.length && curr.startsWith(normRoot)) {
          next.add(curr);
          const lastSlash = curr.lastIndexOf('/');
          if (lastSlash === -1) break;
          curr = curr.slice(0, lastSlash);
        }
        return next;
      });
    } catch (err: any) {
      setFilesError(err.message || 'Failed to list directory');
    } finally {
      setFilesLoading(false);
    }
  };

  const handleNavigateUp = () => {
    if (!site || isAtRoot) return;
    const normCur = normalizePath(currentPath);
    const normRoot = normalizePath(fileBaseDir);
    if (!normCur.startsWith(normRoot)) {
      loadFiles(fileBaseDir);
      return;
    }
    const relative = normCur.slice(normRoot.length).replace(/^\//, '');
    const parts = relative.split('/').filter(Boolean);
    parts.pop();
    const newRelative = parts.join('/');
    const target = newRelative ? `${fileBaseDir}/${newRelative}` : fileBaseDir;
    loadFiles(target);
  };

  const getBreadcrumbs = () => {
    if (!site) return [];
    const normCur = normalizePath(currentPath);
    const normRoot = normalizePath(fileBaseDir);
    if (!normCur.startsWith(normRoot)) {
      return [{ name: 'Home', path: fileBaseDir }];
    }
    const relative = normCur.slice(normRoot.length).replace(/^\//, '');
    const segments = relative.split('/').filter(Boolean);
    const crumbs = [{ name: 'Home', path: fileBaseDir }];
    let acc = fileBaseDir;
    for (const seg of segments) {
      acc = `${acc}/${seg}`;
      crumbs.push({ name: seg, path: acc });
    }
    return crumbs;
  };

  const renderTreeItem = (folderPath: string, folderName: string, depth = 0): React.ReactNode => {
    if (!site) return null;
    const norm = normalizePath(folderPath);
    const normRoot = normalizePath(fileBaseDir);
    const isRoot = norm === normRoot;
    const isSelected = norm === normalizePath(currentPath);
    const isExpanded = expandedFolders.has(norm);
    const children = treeSubfolders[norm];

    const handleToggleExpand = async (e: React.MouseEvent) => {
      e.stopPropagation();
      const next = new Set(expandedFolders);
      if (isExpanded) {
        next.delete(norm);
      } else {
        next.add(norm);
        if (!treeSubfolders[norm]) {
          await fetchTreeSubfolders(folderPath);
        }
      }
      setExpandedFolders(next);
    };

    const handleSelectFolder = (e: React.MouseEvent) => {
      e.stopPropagation();
      loadFiles(folderPath);
      const next = new Set(expandedFolders);
      next.add(norm);
      setExpandedFolders(next);
    };

    return (
      <div key={norm} className="select-none">
        <div
          onClick={handleSelectFolder}
          className={`group flex items-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
            isSelected
              ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/80 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
          }`}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <button
            type="button"
            onClick={handleToggleExpand}
            className={`p-0.5 rounded hover:bg-slate-200/60 transition-colors flex-shrink-0 ${
              children && children.length === 0 ? 'invisible w-4' : 'text-slate-400 hover:text-slate-700'
            }`}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>

          {isRoot ? (
            <Home className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-brand-600' : 'text-slate-400'}`} />
          ) : isExpanded ? (
            <FolderOpen className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-brand-600' : 'text-amber-500'}`} />
          ) : (
            <Folder className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-brand-600' : 'text-amber-500'}`} />
          )}

          <span className="truncate flex-1 font-mono text-[11px]">{folderName}</span>
        </div>

        {isExpanded && children && children.length > 0 && (
          <div className="space-y-0.5 mt-0.5">
            {children.map((child) => renderTreeItem(child.path, child.name, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!site || !newFileName.trim()) return;
    const cleanName = newFileName.trim().replace(/[/\\]/g, '');
    const fullPath = `${currentPath}/${cleanName}`;
    try {
      await api.saveFile(fullPath, '', fileBaseDir);
      setShowNewFileModal(false);
      setNewFileName('');
      await loadFiles(currentPath);
      onOpenFileEditor(fullPath);
    } catch (err: any) {
      alert(err.message || 'Failed to create file');
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!site || !newFolderName.trim()) return;
    const cleanName = newFolderName.trim().replace(/[/\\]/g, '');
    const fullPath = `${currentPath}/${cleanName}`;
    try {
      await api.createDirectory(fullPath, fileBaseDir);
      setShowNewFolderModal(false);
      setNewFolderName('');
      await loadFiles(currentPath);
    } catch (err: any) {
      alert(err.message || 'Failed to create directory');
    }
  };

  const handleRenameItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!site || !itemToRename || !renameNewName.trim()) return;
    const cleanName = renameNewName.trim().replace(/[/\\]/g, '');
    const oldNorm = normalizePath(itemToRename.path);
    const lastSlash = oldNorm.lastIndexOf('/');
    const parentDir = lastSlash !== -1 ? oldNorm.slice(0, lastSlash) : fileBaseDir;
    const newPath = `${parentDir}/${cleanName}`;
    try {
      await api.renameFile(itemToRename.path, newPath, fileBaseDir);
      setItemToRename(null);
      setRenameNewName('');
      await loadFiles(currentPath);
    } catch (err: any) {
      alert(err.message || 'Failed to rename item');
    }
  };

  const handleDeleteFileItem = (e: React.MouseEvent, item: FileItem) => {
    e.stopPropagation();
    setItemsToDelete([item]);
  };

  const handleDeleteSelected = () => {
    if (selectedPaths.size === 0) return;
    const selectedList = files.filter((f) => selectedPaths.has(f.path));
    setItemsToDelete(selectedList);
  };

  const confirmDeleteFileItem = async () => {
    if (!site || !itemsToDelete || itemsToDelete.length === 0) return;
    setIsDeletingFileItem(true);
    try {
      if (itemsToDelete.length === 1) {
        await api.deleteFile(itemsToDelete[0].path, fileBaseDir);
      } else {
        await api.bulkDeleteFiles(itemsToDelete.map((f) => f.path), fileBaseDir);
      }
      const deletedSet = new Set(itemsToDelete.map((f) => f.path));
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        deletedSet.forEach((p) => next.delete(p));
        return next;
      });
      setLastSelectedIndex(null);
      setItemsToDelete(null);
      await loadFiles(currentPath);
      fetchTreeSubfolders(currentPath);
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    } finally {
      setIsDeletingFileItem(false);
    }
  };

  // Sidebar Resizing Logic
  const handleStartSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = sidebarWidth;
    setIsResizingSidebar(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(160, Math.min(480, startW + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  type ResizableCol = 'name' | 'size' | 'permissions' | 'date';
  const adjacentColMap: Record<ResizableCol, 'size' | 'permissions' | 'date' | 'actions'> = {
    name: 'size',
    size: 'permissions',
    permissions: 'date',
    date: 'actions',
  };

  // Adjacent Column Resizing Logic: Dragging right border grows/shrinks adjacent column (NO horizontal scroll)
  const handleStartResize = (
    col: ResizableCol,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const nextCol = adjacentColMap[col];
    const startX = e.clientX;
    const startPercentA = colPercents[col];
    const startPercentB = colPercents[nextCol];

    const tableEl = (e.currentTarget as HTMLElement).closest('[data-file-table]');
    const tableWidth = tableEl ? tableEl.getBoundingClientRect().width - 40 : 800;

    setIsResizing(true);

    const minPercents: Record<string, number> = {
      name: 15,
      size: 7,
      permissions: 8,
      date: 10,
      actions: 10,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaPx = moveEvent.clientX - startX;
      const deltaPercent = (deltaPx / tableWidth) * 100;

      const minA = minPercents[col] || 7;
      const minB = minPercents[nextCol] || 7;

      const clampedDelta = Math.max(minA - startPercentA, Math.min(startPercentB - minB, deltaPercent));

      setColPercents((prev) => ({
        ...prev,
        [col]: startPercentA + clampedDelta,
        [nextCol]: startPercentB - clampedDelta,
      }));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Row and Checkbox selection with Shift + Click support
  const handleRowClick = (
    e: React.MouseEvent,
    file: FileItem,
    index: number,
    filteredFiles: FileItem[]
  ) => {
    if ((e.target as HTMLElement).closest('button, input[type="checkbox"]')) {
      return;
    }

    if (e.shiftKey) {
      e.preventDefault();
      const newSelected = new Set(selectedPaths);
      const start = Math.min(lastSelectedIndex ?? index, index);
      const end = Math.max(lastSelectedIndex ?? index, index);
      for (let i = start; i <= end; i++) {
        newSelected.add(filteredFiles[i].path);
      }
      setSelectedPaths(newSelected);
    } else {
      setSelectedPaths(new Set([file.path]));
      setLastSelectedIndex(index);
    }
  };

  const handleCheckboxClick = (
    e: React.MouseEvent,
    file: FileItem,
    index: number,
    filteredFiles: FileItem[]
  ) => {
    e.stopPropagation();
    if (e.shiftKey) {
      const newSelected = new Set(selectedPaths);
      const start = Math.min(lastSelectedIndex ?? index, index);
      const end = Math.max(lastSelectedIndex ?? index, index);
      for (let i = start; i <= end; i++) {
        newSelected.add(filteredFiles[i].path);
      }
      setSelectedPaths(newSelected);
    } else {
      const next = new Set(selectedPaths);
      if (next.has(file.path)) {
        next.delete(file.path);
      } else {
        next.add(file.path);
      }
      setSelectedPaths(next);
      setLastSelectedIndex(index);
    }
  };

  const handleSelectAll = (filteredFiles: FileItem[]) => {
    const allSelected = filteredFiles.length > 0 && filteredFiles.every((f) => selectedPaths.has(f.path));
    if (allSelected) {
      setSelectedPaths(new Set());
      setLastSelectedIndex(null);
    } else {
      setSelectedPaths(new Set(filteredFiles.map((f) => f.path)));
    }
  };

  // Move Modal handlers
  const handleOpenMoveModal = () => {
    if (selectedPaths.size === 0 || !site) return;
    setMoveModalDest(currentPath);
    const rootNorm = normalizePath(fileBaseDir);
    const currNorm = normalizePath(currentPath);
    setMoveModalExpanded(new Set([...expandedFolders, rootNorm, currNorm]));
    setShowMoveModal(true);
  };

  const handleInitiateMove = async () => {
    if (!site || selectedPaths.size === 0 || !moveModalDest) return;
    const sources = Array.from(selectedPaths);
    setIsMoving(true);
    try {
      const res = await api.checkMoveConflicts(sources, moveModalDest, fileBaseDir);
      if (res.conflicts && res.conflicts.length > 0) {
        setMoveConflicts(res.conflicts);
        setShowOverwriteModal(true);
        return;
      }
      await executeMove(false);
    } catch (err: any) {
      alert(err.message || 'Failed to check conflicts');
    } finally {
      setIsMoving(false);
    }
  };

  const executeMove = async (overwrite: boolean) => {
    if (!site || selectedPaths.size === 0 || !moveModalDest) return;
    setIsMoving(true);
    try {
      const sources = Array.from(selectedPaths);
      await api.moveFiles(sources, moveModalDest, overwrite, fileBaseDir);
      setShowMoveModal(false);
      setShowOverwriteModal(false);
      setMoveConflicts([]);
      setSelectedPaths(new Set());
      setLastSelectedIndex(null);
      await loadFiles(currentPath);
      fetchTreeSubfolders(currentPath);
      if (normalizePath(moveModalDest) !== normalizePath(currentPath)) {
        fetchTreeSubfolders(moveModalDest);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to move items');
    } finally {
      setIsMoving(false);
    }
  };

  const renderMoveModalTreeItem = (folderPath: string, folderName: string, depth = 0): React.ReactNode => {
    if (!site) return null;
    const norm = normalizePath(folderPath);
    const normRoot = normalizePath(fileBaseDir);
    const isRoot = norm === normRoot;
    const isSelected = norm === normalizePath(moveModalDest);
    const isExpanded = moveModalExpanded.has(norm);
    const children = treeSubfolders[norm];

    const isBeingMoved =
      selectedPaths.has(folderPath) ||
      Array.from(selectedPaths).some((src) => {
        const normSrc = normalizePath(src);
        return norm === normSrc || norm.startsWith(normSrc + '/');
      });

    const handleToggleExpand = async (e: React.MouseEvent) => {
      e.stopPropagation();
      const next = new Set(moveModalExpanded);
      if (isExpanded) {
        next.delete(norm);
      } else {
        next.add(norm);
        if (!treeSubfolders[norm]) {
          await fetchTreeSubfolders(folderPath);
        }
      }
      setMoveModalExpanded(next);
    };

    const handleSelectFolder = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isBeingMoved) return;
      setMoveModalDest(folderPath);
    };

    return (
      <div key={norm} className="select-none">
        <div
          onClick={handleSelectFolder}
          className={`group flex items-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-medium transition-colors ${
            isBeingMoved
              ? 'opacity-40 cursor-not-allowed bg-slate-100/50 text-slate-400'
              : isSelected
              ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/80 shadow-xs cursor-pointer'
              : 'hover:bg-slate-100/80 text-slate-700 cursor-pointer'
          }`}
          style={{ paddingLeft: `${Math.max(depth * 14 + 8, 8)}px` }}
        >
          <button
            type="button"
            onClick={handleToggleExpand}
            className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
          >
            <ChevronRight
              className={`w-3.5 h-3.5 transition-transform duration-150 ${
                isExpanded ? 'rotate-90 text-brand-600' : ''
              }`}
            />
          </button>

          {isRoot ? (
            <Home className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
          ) : isExpanded ? (
            <FolderOpen className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          )}

          <span className="truncate flex-1">{folderName}</span>
          {isBeingMoved && (
            <span className="text-[10px] text-slate-400 italic font-normal">Source item</span>
          )}
        </div>

        {isExpanded && children && children.length > 0 && (
          <div className="space-y-0.5 mt-0.5">
            {children.map((sub) => renderMoveModalTreeItem(sub.path, sub.name, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const handleStatusChange = async (status: 'running' | 'stopped' | 'restarting') => {
    if (!site) return;
    setActionLoading(true);
    try {
      const updated = await api.updateSiteStatus(site.id, status);
      setSite(updated);
      onSiteUpdated(updated);
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!site) return;
    if (!confirm(`Are you sure you want to delete ${site.domain}? This will stop PM2, remove NGINX config, and remove any associated databases.`)) {
      return;
    }
    try {
      await api.deleteSite(site.id);
      onSiteDeleted(site.id);
      onBack();
    } catch (err: any) {
      alert(err.message || 'Failed to delete site');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleDatabases = async (newVal: boolean) => {
    if (!site) return;
    setToggleDbError(null);
    setIsTogglingDb(true);

    try {
      const updated = await api.toggleDatabases(site.id, newVal);
      setSite(updated);
      onSiteUpdated(updated);
      if (!newVal && activeTab === 'databases') {
        setActiveTab('overview');
      }
    } catch (err: any) {
      setToggleDbError(err.message || 'Failed to toggle databases');
    } finally {
      setIsTogglingDb(false);
    }
  };

  const handleCreateDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!site) return;
    setDbError(null);
    setIsCreatingDb(true);

    try {
      await api.createDatabase({
        siteId: site.id,
        name: newDbName,
        user: newDbUser || newDbName,
        password: newDbPass || undefined,
        charset: 'utf8mb4',
      });
      setShowCreateDbModal(false);
      setNewDbName('');
      setNewDbUser('');
      setNewDbPass('');
      loadDatabases(site.id);
    } catch (err: any) {
      setDbError(err.message || 'Failed to create database');
    } finally {
      setIsCreatingDb(false);
    }
  };

  const handleDeleteDatabase = async (dbId: string, dbName: string) => {
    if (!site) return;
    if (!confirm(`Are you sure you want to delete database "${dbName}"? This action cannot be undone.`)) return;

    try {
      await api.deleteDatabase(site.id, dbId);
      loadDatabases(site.id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete database');
    }
  };

  const handleAddSelfSigned = async () => {
    if (!site) return;
    setCertActionLoading(true);
    setCertActionMessage(null);
    try {
      const res = await api.addSelfSignedCert(site.id);
      setSite(res.site);
      onSiteUpdated?.(res.site);
      setCertActionMessage({
        type: 'success',
        text: 'Self-signed certificate generated and installed successfully.',
      });
    } catch (err: any) {
      setCertActionMessage({
        type: 'error',
        text: err.message || 'Failed to generate self-signed certificate.',
      });
    } finally {
      setCertActionLoading(false);
    }
  };

  const handleAddLetsEncrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!site) return;
    setCertActionLoading(true);
    setCertActionMessage(null);
    try {
      const res = await api.addLetsEncryptCert(site.id, letsEncryptEmail);
      setSite(res.site);
      onSiteUpdated?.(res.site);
      setShowLetsEncryptModal(false);
      setLetsEncryptEmail('');
      setCertActionMessage({
        type: 'success',
        text: "Let's Encrypt certificate issued and installed successfully.",
      });
    } catch (err: any) {
      setCertActionMessage({
        type: 'error',
        text: err.message || "Failed to issue Let's Encrypt certificate.",
      });
    } finally {
      setCertActionLoading(false);
    }
  };

  const handleImportCustomCert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!site) return;
    if (!customCertContent.trim() || !customKeyContent.trim()) {
      setCertActionMessage({
        type: 'error',
        text: 'Both Certificate and Private Key contents are required.',
      });
      return;
    }
    setCertActionLoading(true);
    setCertActionMessage(null);
    try {
      const res = await api.importCustomCert(site.id, customCertContent.trim(), customKeyContent.trim());
      setSite(res.site);
      onSiteUpdated?.(res.site);
      setShowImportCertModal(false);
      setCustomCertContent('');
      setCustomKeyContent('');
      setCertActionMessage({
        type: 'success',
        text: 'Custom certificate imported and installed successfully.',
      });
    } catch (err: any) {
      setCertActionMessage({
        type: 'error',
        text: err.message || 'Failed to import custom certificate.',
      });
    } finally {
      setCertActionLoading(false);
    }
  };

  const handleDeleteCert = async () => {
    if (!site) return;
    if (!confirm('Are you sure you want to remove this certificate? HTTPS will be disabled.')) return;
    setCertActionLoading(true);
    setCertActionMessage(null);
    try {
      const res = await api.deleteSiteSsl(site.id);
      setSite(res.site);
      onSiteUpdated?.(res.site);
      setCertActionMessage({
        type: 'success',
        text: 'Certificate removed successfully.',
      });
    } catch (err: any) {
      setCertActionMessage({
        type: 'error',
        text: err.message || 'Failed to remove certificate.',
      });
    } finally {
      setCertActionLoading(false);
    }
  };

  const handleCopyAccessField = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAccessField(fieldId);
    setTimeout(() => setCopiedAccessField(null), 2000);
  };

  const handleResetSiteUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!site || !newSitePassword.trim()) return;
    setIsResettingPassword(true);
    setResetPasswordError(null);
    try {
      const res = await api.resetSiteUserPassword(site.id, newSitePassword.trim());
      setAccessActionMessage({ type: 'success', text: res.message || 'Site user password updated successfully.' });
      setShowResetPasswordModal(false);
      setNewSitePassword('');
      setTimeout(() => setAccessActionMessage(null), 5000);
    } catch (err: any) {
      setResetPasswordError(err.message || 'Failed to update user password');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleAddSshKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!site || !newSshKey.trim()) return;
    setIsAddingSshKey(true);
    setSshKeyError(null);
    try {
      const res = await api.addSshKey(site.id, newSshKey.trim());
      if (res.site) {
        setSite(res.site);
        onSiteUpdated?.(res.site);
      } else {
        const updated = { ...site, sshKeys: res.sshKeys };
        setSite(updated);
        onSiteUpdated?.(updated);
      }
      setAccessActionMessage({ type: 'success', text: 'SSH public key added successfully.' });
      setShowAddSshKeyModal(false);
      setNewSshKey('');
      setTimeout(() => setAccessActionMessage(null), 5000);
    } catch (err: any) {
      setSshKeyError(err.message || 'Failed to add SSH key');
    } finally {
      setIsAddingSshKey(false);
    }
  };

  const handleRemoveSshKey = async (key: string) => {
    if (!site) return;
    if (!window.confirm('Are you sure you want to remove this authorized SSH key?')) return;
    try {
      const res = await api.removeSshKey(site.id, key);
      if (res.site) {
        setSite(res.site);
        onSiteUpdated?.(res.site);
      } else {
        const updated = { ...site, sshKeys: res.sshKeys };
        setSite(updated);
        onSiteUpdated?.(updated);
      }
      setAccessActionMessage({ type: 'success', text: 'SSH key removed successfully.' });
      setTimeout(() => setAccessActionMessage(null), 5000);
    } catch (err: any) {
      setAccessActionMessage({ type: 'error', text: err.message || 'Failed to remove SSH key' });
      setTimeout(() => setAccessActionMessage(null), 5000);
    }
  };

  if (loading || !site) {
    return (
      <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">Loading site details...</p>
      </div>
    );
  }

  // Define tabs dynamically based on whether databases are enabled!
  // Desired order: Overview, Virtual Host, Databases, Files, Security, Cron, Logs, Settings
  const tabs: { id: string; label: string; icon: any; badge?: string }[] = [
    { id: 'overview', label: 'Overview', icon: Globe },
    { id: 'vhost', label: 'Virtual Host', icon: FileCode },
    ...(site.databasesEnabled ? [{ id: 'databases', label: 'Databases', icon: Database }] : []),
    { id: 'files', label: 'Files', icon: FolderTree },
    { id: 'security', label: 'Security', icon: ShieldCheck },
    { id: 'cron', label: 'Cron', icon: Clock },
    { id: 'logs', label: 'Logs', icon: Terminal },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors py-1 px-2 -ml-2 rounded-lg hover:bg-slate-100"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Sites</span>
        </button>
      </div>

      {/* Site Header Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shadow-sm flex-shrink-0">
            <Globe className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{site.domain}</h2>
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
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-1">
              <span>Node.js ({site.nodeVersion})</span>
              <span>•</span>
              <span className="font-mono font-semibold text-slate-700">Port :{site.port}</span>
              <span>•</span>
              <a
                href={`https://${site.domain}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-brand-600 hover:underline font-semibold"
              >
                <span>Visit Site</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Process Actions */}
        <div className="flex items-center gap-2.5">
          {site.status === 'running' ? (
            <button
              onClick={() => handleStatusChange('stopped')}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-rose-600 transition-smooth"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              onClick={() => handleStatusChange('running')}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm transition-smooth"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start</span>
            </button>
          )}

          <button
            onClick={() => handleStatusChange('restarting')}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-smooth"
          >
            <RotateCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
            <span>Restart</span>
          </button>

          <button
            onClick={handleDelete}
            className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-2"
            title="Delete Site"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
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
              onClick={() => {
                setActiveTab(tab.id as any);
                onTabChange?.(tab.id);
              }}
              className={`flex items-center gap-2 px-5 py-3 rounded-t-2xl text-xs font-bold transition-smooth relative shrink-0 ${
                isActive
                  ? 'text-brand-700 bg-white border-t border-x border-slate-200/80 shadow-sm -mb-[1px]'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-100 text-sky-800 font-bold">
                  {tab.badge}
                </span>
              )}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-brand-600 rounded-t-full"></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className={
        activeTab === 'files'
          ? 'bg-white rounded-3xl border border-slate-200/80 shadow-card p-0 overflow-hidden'
          : activeTab === 'security'
          ? 'space-y-6'
          : 'bg-white rounded-3xl border border-slate-200/80 shadow-card p-6'
      }>
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/70">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">PM2 Process</span>
                <p className="text-base font-bold text-slate-900 mt-1 font-mono">zoom-{site.id}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>PID: {site.pm2.pid || 12345}</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/70">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">App Port (Internal)</span>
                <p className="text-base font-bold text-slate-900 mt-1 font-mono">127.0.0.1:{site.port}</p>
                <p className="text-xs text-slate-500 font-medium mt-2">Dedicated port • NGINX Reverse Proxy</p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/70">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Database Support</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <Database className="w-4 h-4 text-sky-600" />
                  <span className="text-base font-bold text-slate-900">
                    {site.databasesEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-2">
                  {site.databasesEnabled ? `${databases.length} database(s) created` : 'Enable via Site Settings tab'}
                </p>
              </div>
            </div>

            <div className="border border-slate-200/80 rounded-2xl p-5 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Deployment Paths</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                <div>
                  <span className="text-slate-400">Application Root Directory:</span>
                  <div className="font-mono bg-slate-100/70 p-2 rounded-xl mt-1 text-slate-800 select-all">
                    {site.rootDirectory}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Main Entry Script:</span>
                  <div className="font-mono bg-slate-100/70 p-2 rounded-xl mt-1 text-slate-800 select-all">
                    {site.entryFile}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIRTUAL HOST TAB (Editable Configuration) */}
        {activeTab === 'vhost' && (
          <div className="space-y-4">
            {nginxSaveMessage && (
              <div
                className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between gap-2.5 animate-fade-in ${
                  nginxSaveMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {nginxSaveMessage.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{nginxSaveMessage.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setNginxSaveMessage(null)}
                  className="text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-800">
                  Virtual Host Configuration
                </span>
                <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  /etc/nginx/sites-available/{site.domain}.conf
                </span>
                {nginxConfig !== originalNginxConfig && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                    Unsaved Changes
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleResetNginxConfig}
                  disabled={isResettingNginx || isSavingNginx}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  title="Reset to generated default"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isResettingNginx ? 'animate-spin' : ''}`} />
                  <span>Reset to Default</span>
                </button>

                <button
                  type="button"
                  onClick={() => copyToClipboard(nginxConfig)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveNginxConfig}
                  disabled={isSavingNginx || nginxConfig === originalNginxConfig}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 active:scale-[0.98] text-white text-xs font-bold shadow-sm shadow-brand-600/30 transition-smooth"
                >
                  {isSavingNginx ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>{isSavingNginx ? 'Saving...' : 'Save & Reload'}</span>
                </button>
              </div>
            </div>

            {/* Code Editor Area */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-md bg-slate-950">
              <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between text-[11px] text-slate-400 font-mono select-none">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  nginx.conf — Editable Virtual Host
                </span>
                <span>{nginxConfig.split('\n').length} lines</span>
              </div>
              <textarea
                value={nginxConfig}
                onChange={(e) => setNginxConfig(e.target.value)}
                spellCheck={false}
                className="w-full p-4 font-mono text-xs leading-relaxed text-slate-200 bg-slate-950 focus:outline-none min-h-[460px] resize-y scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950"
                placeholder="# Enter NGINX Virtual Host configuration..."
              />
            </div>

            <p className="text-[11px] text-slate-400 font-medium">
              Note: Configuration syntax will be verified with <code className="font-mono text-slate-600">nginx -t</code> prior to applying. If validation fails, changes will be safely reverted.
            </p>
          </div>
        )}

        {/* DATABASES TAB */}
        {activeTab === 'databases' && site.databasesEnabled && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">Databases</h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Manage databases, users, and credentials dedicated to {site.domain}.
                </p>
              </div>

              <button
                onClick={() => {
                  setNewDbName(`${site.id.replace(/-/g, '_')}_db`);
                  setNewDbUser(`${site.id.replace(/-/g, '_')}_usr`);
                  setNewDbPass(Math.random().toString(36).slice(-8) + 'A9!');
                  setShowCreateDbModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition-smooth"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create Database</span>
              </button>
            </div>

            {databases.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 mx-auto">
                  <Database className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">No Databases Created Yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Create a MariaDB database for this site. ZoomPanel will provision the database, grant user privileges, and generate credentials.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {databases.map((db) => {
                  const isPassVisible = showPasswords[db.id];
                  return (
                    <div key={db.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <Database className="w-4 h-4 text-sky-600" />
                          <span className="font-bold text-sm text-slate-900 font-mono">{db.name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {db.charset}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono">
                          <span>User: <strong className="text-slate-800">{db.user}</strong></span>
                          <span>•</span>
                          <span>Host: <strong className="text-slate-800">{db.host}:{db.port}</strong></span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            Password: 
                            <strong className="text-slate-800">
                              {isPassVisible ? db.password : '••••••••••••'}
                            </strong>
                            <button
                              onClick={() => setShowPasswords((prev) => ({ ...prev, [db.id]: !prev[db.id] }))}
                              className="text-slate-400 hover:text-slate-700 ml-1"
                            >
                              {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onOpenDatabaseAdmin(site, db)}
                          className="p-2 rounded-xl bg-brand-50 border border-brand-200/80 text-brand-700 hover:bg-brand-600 hover:text-white transition-smooth shadow-xs"
                          title="Open Database Admin"
                        >
                          <TableIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => copyToClipboard(`mysql://${db.user}:${db.password}@${db.host}:${db.port}/${db.name}`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy URL</span>
                        </button>
                        <button
                          onClick={() => handleDeleteDatabase(db.id, db.name)}
                          className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete Database"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* FILES TAB (Sidebar Treeview + Main Area + Context Aware Toolbar) */}
        {activeTab === 'files' && (
          <div className="flex flex-col min-h-[580px] w-full">
            {filesError && (
              <div className="m-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                <span>{filesError}</span>
              </div>
            )}

            <div className="flex-1 flex flex-col lg:flex-row w-full overflow-hidden">
              {/* Left Sidebar: Folder Treeview */}
              <div
                className="bg-slate-50/50 flex flex-col flex-shrink-0 select-none border-r border-slate-200/80"
                style={{ width: `${sidebarWidth}px` }}
              >
                {/* Folders Header: Matches right toolbar height (h-[53px]) and border-b */}
                <div className="h-[53px] px-4 flex items-center justify-between border-b border-slate-200/80 bg-slate-50/50">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <FolderTree className="w-4 h-4 text-brand-600" />
                    <span>Folders</span>
                  </div>
                  <button
                    onClick={() => {
                      const root = normalizePath(fileBaseDir);
                      fetchTreeSubfolders(root);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
                    title="Refresh folder tree"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-0.5 max-h-[560px]">
                  {renderTreeItem(fileBaseDir, 'Home', 0)}
                </div>
              </div>

              {/* Sidebar Resizing Drag Handler: unchanged visually, hand cursor */}
              <div
                onMouseDown={handleStartSidebarResize}
                className="relative w-0 flex-shrink-0 select-none"
                style={{ cursor: isResizingSidebar ? 'grabbing' : 'grab' }}
                title="Drag to resize Folders sidebar"
              >
                <div
                  className="absolute top-0 bottom-0 -left-1.5 w-3 z-20"
                  style={{ cursor: isResizingSidebar ? 'grabbing' : 'grab' }}
                />
              </div>

              {/* Right Content Area: Toolbar + Breadcrumbs + Files Table */}
              <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
                {/* Context-Aware Toolbar (h-[53px] matches Folders header) */}
                <div className="h-[53px] px-4 border-b border-slate-200/80 bg-slate-50/40 flex items-center justify-between gap-3">
                  {/* Left: Split button + Context actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Split Button: New */}
                    <div id="fm-new-split-btn" className="relative inline-flex items-stretch rounded-xl shadow-xs overflow-visible bg-brand-600">
                      <button
                        type="button"
                        onClick={() => setShowNewFileModal(true)}
                        className="h-8 flex items-center gap-1.5 px-3 rounded-l-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-smooth"
                        title="Create new file"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowNewDropdown((prev) => !prev);
                        }}
                        className="h-8 w-7 flex items-center justify-center rounded-r-xl bg-brand-600 hover:bg-brand-700 border-l border-brand-500 text-white text-xs font-bold transition-smooth"
                        title="New options"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Split button dropdown */}
                      {showNewDropdown && (
                        <div className="absolute left-0 top-full mt-1.5 w-44 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-40 animate-fade-in text-xs font-semibold">
                          <button
                            onClick={() => {
                              setShowNewFolderModal(true);
                              setShowNewDropdown(false);
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-brand-700 transition-colors text-left"
                          >
                            <FolderPlus className="w-4 h-4 text-amber-500" />
                            <span>New Folder</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowNewFileModal(true);
                              setShowNewDropdown(false);
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-brand-700 transition-colors text-left"
                          >
                            <FilePlus className="w-4 h-4 text-brand-600" />
                            <span>New File</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Context-aware actions when item(s) selected */}
                    {selectedPaths.size > 0 && (
                      <>
                        <div className="h-4 w-[1px] bg-slate-200 mx-0.5" />

                        {/* Selection count badge - NO X clear button (blank area click deselects) */}
                        <div className="h-8 flex items-center px-2.5 rounded-xl bg-brand-50 border border-brand-200/80 text-[11px] text-brand-800 font-semibold shadow-2xs">
                          <span>{selectedPaths.size} {selectedPaths.size === 1 ? 'item' : 'items'} selected</span>
                        </div>

                        {/* Single item actions */}
                        {singleSelectedItem && (
                          <>
                            {singleSelectedItem.isDirectory ? (
                              <button
                                onClick={() => loadFiles(singleSelectedItem.path)}
                                className="h-8 flex items-center gap-1.5 px-3 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-brand-700 transition-smooth shadow-xs"
                                title="Open selected folder"
                              >
                                <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                                <span>Open Folder</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => onOpenFileEditor(singleSelectedItem.path)}
                                className="h-8 flex items-center gap-1.5 px-3 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-brand-700 transition-smooth shadow-xs"
                                title="Edit selected file"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-brand-600" />
                                <span>Edit File</span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setItemToRename(singleSelectedItem);
                                setRenameNewName(singleSelectedItem.name);
                              }}
                              className="h-8 flex items-center gap-1.5 px-3 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-smooth shadow-xs"
                              title="Rename selected item"
                            >
                              <TextCursor className="w-3.5 h-3.5 text-slate-500" />
                              <span>Rename</span>
                            </button>
                          </>
                        )}

                        {/* Move action (single and bulk) */}
                        <button
                          onClick={handleOpenMoveModal}
                          className="h-8 flex items-center gap-1.5 px-3 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-brand-700 transition-smooth shadow-xs"
                          title="Move selected item(s)"
                        >
                          <FolderInput className="w-3.5 h-3.5 text-brand-600" />
                          <span>Move{selectedPaths.size > 1 ? ` (${selectedPaths.size})` : ''}</span>
                        </button>

                        {/* Delete action (single and bulk) */}
                        <button
                          onClick={handleDeleteSelected}
                          className="h-8 flex items-center gap-1.5 px-3 rounded-xl bg-white border border-rose-200 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-smooth shadow-xs"
                          title="Delete selected item(s)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete{selectedPaths.size > 1 ? ` (${selectedPaths.size})` : ''}</span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Right: Refresh & Search Filter */}
                  <div className="flex items-center gap-2">
                    <div className="relative w-36 sm:w-48">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={fileSearch}
                        onChange={(e) => setFileSearch(e.target.value)}
                        placeholder="Filter files..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-smooth"
                      />
                    </div>

                    <button
                      onClick={() => loadFiles(currentPath)}
                      disabled={filesLoading}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-smooth shadow-xs"
                      title="Refresh current folder"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${filesLoading ? 'animate-spin text-brand-600' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Breadcrumbs Navigation Bar */}
                <div className="px-4 py-2 border-b border-slate-100 bg-white flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-slate-500 font-mono overflow-x-auto no-scrollbar">
                    <button
                      onClick={handleNavigateUp}
                      disabled={isAtRoot}
                      className={`p-1 rounded-lg transition-colors mr-1 ${
                        isAtRoot ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                      title={isAtRoot ? 'Root level reached' : 'Up one folder'}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>

                    {getBreadcrumbs().map((crumb, idx, arr) => {
                      const isLast = idx === arr.length - 1;
                      return (
                        <React.Fragment key={crumb.path}>
                          {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />}
                          <button
                            onClick={() => loadFiles(crumb.path)}
                            className={`hover:text-brand-600 transition-colors flex items-center gap-1 truncate ${
                              isLast ? 'text-brand-700 font-bold' : 'text-slate-600'
                            }`}
                          >
                            {idx === 0 && <Home className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />}
                            <span className="truncate">{crumb.name}</span>
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  <div className="text-[11px] text-slate-400 font-medium shrink-0 ml-2">
                    {files.length} {files.length === 1 ? 'item' : 'items'}
                  </div>
                </div>

                {(() => {
                  const filteredFiles = files.filter((f) =>
                    f.name.toLowerCase().includes(fileSearch.toLowerCase())
                  );
                  const allSelected =
                    filteredFiles.length > 0 &&
                    filteredFiles.every((f) => selectedPaths.has(f.path));
                  const someSelected =
                    filteredFiles.some((f) => selectedPaths.has(f.path)) && !allSelected;

                  return (
                    <div data-file-table="true" className="w-full flex flex-col flex-1 min-w-0 overflow-hidden">
                      {/* Column Headers with Adjacent Resizable handles (No visible vertical border, hand cursor, 100% total width) */}
                      <div className="w-full px-4 py-2 border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center select-none bg-slate-50/50">
                        {/* Selection Checkbox Header */}
                        <div className="w-9 shrink-0 flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someSelected;
                            }}
                            onChange={() => handleSelectAll(filteredFiles)}
                            className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/20 cursor-pointer"
                            title={allSelected ? 'Deselect all' : 'Select all'}
                          />
                        </div>

                        {/* Name Column Header */}
                        <div
                          className="relative flex items-center pr-2 select-none"
                          style={{ width: `${colPercents.name}%`, minWidth: 0 }}
                        >
                          <span className="truncate">Name</span>
                          {/* Invisible hit-area with hand cursor, NO border */}
                          <div
                            onMouseDown={(e) => handleStartResize('name', e)}
                            className="absolute -right-2 top-0 bottom-0 w-4 z-20 cursor-grab active:cursor-grabbing select-none"
                            style={{ cursor: isResizing ? 'grabbing' : 'grab' }}
                            title="Drag to resize Name column"
                          />
                        </div>

                        {/* Size Column Header */}
                        <div
                          className="relative flex items-center justify-end px-2 select-none"
                          style={{ width: `${colPercents.size}%`, minWidth: 0 }}
                        >
                          <span className="truncate">Size</span>
                          <div
                            onMouseDown={(e) => handleStartResize('size', e)}
                            className="absolute -right-2 top-0 bottom-0 w-4 z-20 cursor-grab active:cursor-grabbing select-none"
                            style={{ cursor: isResizing ? 'grabbing' : 'grab' }}
                            title="Drag to resize Size column"
                          />
                        </div>

                        {/* Permissions Column Header */}
                        <div
                          className="relative flex items-center justify-center px-2 select-none"
                          style={{ width: `${colPercents.permissions}%`, minWidth: 0 }}
                        >
                          <span className="truncate">Permissions</span>
                          <div
                            onMouseDown={(e) => handleStartResize('permissions', e)}
                            className="absolute -right-2 top-0 bottom-0 w-4 z-20 cursor-grab active:cursor-grabbing select-none"
                            style={{ cursor: isResizing ? 'grabbing' : 'grab' }}
                            title="Drag to resize Permissions column"
                          />
                        </div>

                        {/* Date Modified Column Header */}
                        <div
                          className="relative flex items-center justify-end px-2 select-none"
                          style={{ width: `${colPercents.date}%`, minWidth: 0 }}
                        >
                          <span className="truncate">Modified</span>
                          <div
                            onMouseDown={(e) => handleStartResize('date', e)}
                            className="absolute -right-2 top-0 bottom-0 w-4 z-20 cursor-grab active:cursor-grabbing select-none"
                            style={{ cursor: isResizing ? 'grabbing' : 'grab' }}
                            title="Drag to resize Modified column"
                          />
                        </div>

                        {/* Actions Column Header (Centered horizontally) */}
                        <div
                          className="flex items-center justify-center px-1 select-none text-center"
                          style={{ width: `${colPercents.actions}%`, minWidth: 0 }}
                        >
                          <span className="truncate">Actions</span>
                        </div>
                      </div>

                      {/* Content Area: Files List (Zero horizontal scroll) */}
                      <div
                        className="flex-1 overflow-y-auto overflow-x-hidden min-h-[350px] w-full"
                        onClick={(e) => {
                          // Clicking in blank area deselects any selected items unless shift is held
                          if (!(e.target as HTMLElement).closest('[data-file-row]')) {
                            if (!e.shiftKey) {
                              setSelectedPaths(new Set());
                              setLastSelectedIndex(null);
                            }
                          }
                        }}
                      >
                        {filesLoading ? (
                          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
                            <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                            <p>Loading files...</p>
                          </div>
                        ) : files.length === 0 ? (
                          <div className="p-12 m-4 text-center space-y-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                              <FolderTree className="w-6 h-6" />
                            </div>
                            <p className="text-xs font-bold text-slate-700">This folder is empty</p>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setShowNewFileModal(true)}
                                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                              >
                                + New File
                              </button>
                              <button
                                onClick={() => setShowNewFolderModal(true)}
                                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                              >
                                + New Folder
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full">
                            {filteredFiles.map((file, index) => {
                              const isSelected = selectedPaths.has(file.path);
                              return (
                                <div
                                  key={file.path}
                                  data-file-row="true"
                                  onClick={(e) => handleRowClick(e, file, index, filteredFiles)}
                                  onDoubleClick={() => {
                                    if (file.isDirectory) {
                                      loadFiles(file.path);
                                    } else {
                                      onOpenFileEditor(file.path);
                                    }
                                  }}
                                  className={`w-full px-4 py-2.5 flex items-center border-b border-slate-100 last:border-b-0 cursor-pointer transition-colors group select-none ${
                                    isSelected
                                      ? 'bg-brand-50/80 text-brand-900 font-medium'
                                      : 'hover:bg-slate-50/80 text-slate-700'
                                  }`}
                                >
                                  {/* Selection Checkbox */}
                                  <div className="w-9 shrink-0 flex items-center justify-center">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {}}
                                      onClick={(e) => handleCheckboxClick(e, file, index, filteredFiles)}
                                      className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/20 cursor-pointer"
                                    />
                                  </div>

                                  {/* Name column */}
                                  <div
                                    className="flex items-center gap-2.5 pr-2 min-w-0"
                                    style={{ width: `${colPercents.name}%` }}
                                  >
                                    {file.isDirectory ? (
                                      <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 flex-shrink-0">
                                        <Folder className="w-4 h-4" />
                                      </div>
                                    ) : (
                                      <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-500 flex-shrink-0 group-hover:text-brand-600 group-hover:bg-brand-50/50">
                                        <FileCode className="w-4 h-4" />
                                      </div>
                                    )}
                                    <span
                                      className={`text-xs font-semibold font-mono truncate ${
                                        isSelected ? 'text-brand-900 font-bold' : 'text-slate-800 group-hover:text-brand-700'
                                      }`}
                                    >
                                      {file.name}
                                    </span>
                                  </div>

                                  {/* Size column (Folder cell is BLANK, no '-') */}
                                  <div
                                    className="text-right font-mono text-[11px] text-slate-500 px-2 min-w-0"
                                    style={{ width: `${colPercents.size}%` }}
                                  >
                                    {file.isDirectory ? null : `${(file.size / 1024).toFixed(1)} KB`}
                                  </div>

                                  {/* Permissions column */}
                                  <div
                                    className="text-center font-mono text-[11px] text-slate-600 px-2 min-w-0"
                                    style={{ width: `${colPercents.permissions}%` }}
                                  >
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                      {file.permissions ? `0${file.permissions}` : '0644'}
                                    </span>
                                  </div>

                                  {/* Date modified column: format M/D/YYYY H:MM TT */}
                                  <div
                                    className="text-right font-mono text-[11px] text-slate-500 px-2 min-w-0"
                                    style={{ width: `${colPercents.date}%` }}
                                  >
                                    {formatModifiedDate(file.modifiedAt, timeZone)}
                                  </div>

                                  {/* Actions column (Centered horizontally header & buttons) */}
                                  <div
                                    className="flex items-center justify-center gap-1 px-1 min-w-0"
                                    style={{ width: `${colPercents.actions}%` }}
                                  >
                                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {!file.isDirectory && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenFileEditor(file.path);
                                          }}
                                          className="p-1 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                                          title="Edit file"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setItemToRename(file);
                                          setRenameNewName(file.name);
                                        }}
                                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                        title="Rename"
                                      >
                                        <TextCursor className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={(e) => handleDeleteFileItem(e, file)}
                                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                        title="Delete"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* SECURITY TAB (Certificates & Access Cards) */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* CERTIFICATES SECTION (Independent White Background Section) */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 space-y-6">
              {certActionMessage && (
                <div
                  className={`p-4 rounded-2xl text-xs font-medium flex items-center justify-between ${
                    certActionMessage.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {certActionMessage.type === 'success' ? (
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    )}
                    <span>{certActionMessage.text}</span>
                  </div>
                  <button
                    onClick={() => setCertActionMessage(null)}
                    className="text-slate-400 hover:text-slate-600 text-xs ml-4"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Header with Split Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">Certificates</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    SSL/TLS certificates configured for {site.domain}.
                  </p>
                </div>

                {/* Split UI Button: Actions */}
                <div id="cert-actions-split-btn" className="relative inline-flex items-stretch rounded-xl shadow-xs overflow-visible bg-brand-600 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setShowCertActionsDropdown((prev) => !prev)}
                    disabled={certActionLoading}
                    className="h-9 flex items-center gap-2 px-4 rounded-l-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-smooth disabled:opacity-50"
                    title="Certificate Actions"
                  >
                    {certActionLoading ? (
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    <span>Actions</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCertActionsDropdown((prev) => !prev);
                    }}
                    disabled={certActionLoading}
                    className="h-9 w-8 flex items-center justify-center rounded-r-xl bg-brand-600 hover:bg-brand-700 border-l border-brand-500 text-white text-xs font-bold transition-smooth disabled:opacity-50"
                    title="More options"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Split Button Choices Dropdown */}
                  {showCertActionsDropdown && (
                    <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-40 animate-fade-in text-xs font-semibold">
                      {site.ssl?.type !== 'self-signed' && (
                        <button
                          onClick={() => {
                            setShowCertActionsDropdown(false);
                            handleAddSelfSigned();
                          }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-brand-700 transition-colors text-left"
                        >
                          <ShieldCheck className="w-4 h-4 text-brand-600" />
                          <span>Add Self-Signed Certificate</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setShowCertActionsDropdown(false);
                          setShowLetsEncryptModal(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-brand-700 transition-colors text-left"
                      >
                        <Lock className="w-4 h-4 text-emerald-600" />
                        <span>Add Let's Encrypt Certificate</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowCertActionsDropdown(false);
                          setShowImportCertModal(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-brand-700 transition-colors text-left"
                      >
                        <Upload className="w-4 h-4 text-indigo-600" />
                        <span>Import Certificate</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Certificates Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Domains</th>
                      <th className="py-3 px-4">Expiration</th>
                      <th className="py-3 px-4">Installed</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {site.ssl && site.ssl.type !== 'none' ? (
                      <tr className="hover:bg-slate-50/60 transition-colors">
                        {/* Type Column */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {site.ssl.type === 'letsencrypt' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Lock className="w-3 h-3 text-emerald-600" />
                              <span>Let's Encrypt</span>
                            </span>
                          ) : site.ssl.type === 'custom' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <Upload className="w-3 h-3 text-indigo-600" />
                              <span>Custom</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200">
                              <ShieldCheck className="w-3 h-3 text-brand-600" />
                              <span>Self-Signed</span>
                            </span>
                          )}
                        </td>

                        {/* Domains Column */}
                        <td className="py-3.5 px-4 font-mono text-slate-800">
                          {site.ssl.domains && site.ssl.domains.length > 0
                            ? site.ssl.domains.join(', ')
                            : site.domain}
                        </td>

                        {/* Expiration Column */}
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {site.ssl.expiresAt ? (
                            <span>{new Intl.DateTimeFormat('en-US', {
                              timeZone: timeZone || undefined,
                              month: 'numeric',
                              day: 'numeric',
                              year: 'numeric',
                            }).format(new Date(site.ssl.expiresAt))}</span>
                          ) : (
                            '—'
                          )}
                        </td>

                        {/* Installed Column */}
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {site.ssl.issuedAt ? (
                            <span>{new Intl.DateTimeFormat('en-US', {
                              timeZone: timeZone || undefined,
                              month: 'numeric',
                              day: 'numeric',
                              year: 'numeric',
                            }).format(new Date(site.ssl.issuedAt))}</span>
                          ) : (
                            '—'
                          )}
                        </td>

                        {/* Actions Column */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleAddSelfSigned}
                              disabled={certActionLoading}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-brand-600 hover:bg-brand-50 hover:border-brand-200 transition-colors"
                              title="Renew / Reissue Certificate"
                            >
                              <RotateCw className={`w-3.5 h-3.5 ${certActionLoading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                              type="button"
                              onClick={handleDeleteCert}
                              disabled={certActionLoading}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                              title="Remove Certificate"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <Shield className="w-8 h-8 text-slate-300" />
                            <p className="text-xs font-semibold text-slate-600">No certificates installed</p>
                            <p className="text-[11px] text-slate-400 max-w-sm">
                              Use the Actions button above to add a Self-Signed certificate, Let's Encrypt, or import your own.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ACCESS SECTION (Independent White Background Section) */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 space-y-6">
              {accessActionMessage && (
                <div
                  className={`p-4 rounded-2xl text-xs font-medium flex items-center justify-between ${
                    accessActionMessage.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {accessActionMessage.type === 'success' ? (
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    )}
                    <span>{accessActionMessage.text}</span>
                  </div>
                  <button
                    onClick={() => setAccessActionMessage(null)}
                    className="text-slate-400 hover:text-slate-600 text-xs ml-4"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Access Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">Access</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    SSH and SFTP credentials for managing site files, deployment, and terminal access.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setShowResetPasswordModal(true)}
                    className="h-9 inline-flex items-center gap-2 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-smooth shadow-xs"
                  >
                    <Key className="w-3.5 h-3.5 text-slate-500" />
                    <span>Reset Password</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddSshKeyModal(true)}
                    className="h-9 inline-flex items-center gap-2 px-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-smooth shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add SSH Key</span>
                  </button>
                </div>
              </div>

              {/* Connection Parameters Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Host */}
                <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-xs space-y-1 relative group">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-slate-400" />
                      Host / Server
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyAccessField(window.location.hostname || site.domain, 'host')}
                      className="p-1 rounded-md text-slate-400 hover:text-brand-600 hover:bg-slate-50 transition-colors"
                      title="Copy Host"
                    >
                      {copiedAccessField === 'host' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-800 truncate" title={window.location.hostname || site.domain}>
                    {window.location.hostname || site.domain}
                  </div>
                  <div className="text-[10px] text-slate-400">Server hostname or IP</div>
                </div>

                {/* Port */}
                <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-xs space-y-1 relative group">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-slate-400" />
                      Port
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyAccessField('22', 'port')}
                      className="p-1 rounded-md text-slate-400 hover:text-brand-600 hover:bg-slate-50 transition-colors"
                      title="Copy Port"
                    >
                      {copiedAccessField === 'port' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-800">
                    22
                  </div>
                  <div className="text-[10px] text-slate-400">Standard SSH & SFTP port</div>
                </div>

                {/* Site User */}
                <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-xs space-y-1 relative group">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      Site User
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyAccessField(site.siteUser || '—', 'user')}
                      className="p-1 rounded-md text-slate-400 hover:text-brand-600 hover:bg-slate-50 transition-colors"
                      title="Copy User"
                    >
                      {copiedAccessField === 'user' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-800 truncate" title={site.siteUser || 'Not configured'}>
                    {site.siteUser || '—'}
                  </div>
                  <div className="text-[10px] text-slate-400">Dedicated system account</div>
                </div>

                {/* Web Root */}
                <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-xs space-y-1 relative group">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Folder className="w-3.5 h-3.5 text-slate-400" />
                      Web Root
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyAccessField(site.rootDirectory, 'root')}
                      className="p-1 rounded-md text-slate-400 hover:text-brand-600 hover:bg-slate-50 transition-colors"
                      title="Copy Root Directory"
                    >
                      {copiedAccessField === 'root' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-800 truncate" title={site.rootDirectory}>
                    {getDisplayWebRoot(site.rootDirectory)}
                  </div>
                  <div className="text-[10px] text-slate-400">Site document root directory</div>
                </div>
              </div>

              {/* Authorized SSH Keys Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Authorized SSH Public Keys</h4>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {site.sshKeys?.length || 0} key{site.sshKeys?.length === 1 ? '' : 's'} configured
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Public Key / Comment</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {site.sshKeys && site.sshKeys.length > 0 ? (
                        site.sshKeys.map((key, idx) => {
                          const parts = key.trim().split(/\s+/);
                          const keyType = parts[0] || 'ssh-key';
                          const comment = parts.length > 2 ? parts.slice(2).join(' ') : '';
                          return (
                            <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  <Terminal className="w-3 h-3 text-slate-500" />
                                  <span>{keyType}</span>
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-700 max-w-md">
                                <div className="truncate font-semibold text-slate-900" title={key}>
                                  {comment || keyType}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate" title={key}>
                                  {key}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyAccessField(key, `key-${idx}`)}
                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-brand-600 hover:bg-brand-50 hover:border-brand-200 transition-colors"
                                    title="Copy Public Key"
                                  >
                                    {copiedAccessField === `key-${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSshKey(key)}
                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                                    title="Remove SSH Key"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-slate-400">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <Key className="w-8 h-8 text-slate-300" />
                              <p className="text-xs font-semibold text-slate-600">No authorized SSH keys</p>
                              <p className="text-[11px] text-slate-400 max-w-sm">
                                Add an SSH public key for instant passwordless SSH and SFTP access as <span className="font-mono text-slate-700">{site.siteUser || 'the site user'}</span>.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CRON TAB (Placeholder / Empty for now) */}
        {activeTab === 'cron' && (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto">
              <Clock className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">Scheduled Tasks (Cron)</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No cron jobs scheduled for this site yet.
            </p>
          </div>
        )}

        {/* LOGS TAB */}
        {activeTab === 'logs' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Live Process Standard Output & Error</span>
              <button
                onClick={() => copyToClipboard(logs)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Logs'}</span>
              </button>
            </div>
            <pre className="p-4 rounded-2xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto max-h-[450px] leading-relaxed">
              {logs || 'No logs generated yet.'}
            </pre>
          </div>
        )}

        {/* SITE SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Site Configuration & Features</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Enable or configure runtime services for {site.domain}.
              </p>
            </div>

            {toggleDbError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                <span>{toggleDbError}</span>
              </div>
            )}

            {/* Application Port Configuration */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-brand-600" />
                    <h4 className="text-sm font-bold text-slate-900">Application Port (Internal Loopback)</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
                    Internal loopback port where the Node.js PM2 process listens. NGINX will automatically update its reverse proxy upstream to forward all web requests to this port.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200 font-mono">
                    Active: 127.0.0.1:{site.port}
                  </span>
                </div>
              </div>

              {portSaveSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Application port updated successfully! NGINX reverse proxy reloaded and PM2 restarted.</span>
                </div>
              )}

              <form onSubmit={handleUpdatePort} className="space-y-3 pt-2 border-t border-slate-200/60">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 max-w-xs">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      New Port (1024 - 65535)
                    </label>
                    <input
                      type="number"
                      value={sitePort}
                      onChange={(e) => setSitePort(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 3000"
                      className={`w-full px-3.5 py-2 rounded-xl border text-xs font-mono font-bold focus:outline-none focus:ring-2 transition-smooth ${
                        portError
                          ? 'border-rose-300 bg-rose-50/50 text-rose-900 focus:ring-rose-500/20 focus:border-rose-500'
                          : 'border-slate-200 bg-white text-slate-800 focus:ring-brand-500/20 focus:border-brand-600'
                      }`}
                    />
                  </div>

                  <div className="sm:self-end">
                    <button
                      type="submit"
                      disabled={!!portError || sitePort === '' || Number(sitePort) === site.port || isSavingPort}
                      className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-smooth disabled:opacity-40 disabled:cursor-not-allowed shadow-xs flex items-center gap-1.5"
                    >
                      {isSavingPort ? (
                        <>
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving & Restarting...</span>
                        </>
                      ) : (
                        <span>Update Port</span>
                      )}
                    </button>
                  </div>
                </div>

                {portError && (
                  <div className="flex items-start gap-1.5 text-xs text-rose-600 font-medium">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
                    <span>{portError}</span>
                  </div>
                )}
                {!portError && Number(sitePort) !== site.port && sitePort !== '' && (
                  <p className="text-[11px] text-slate-500 font-medium">
                    Port {sitePort} is valid and available. Click "Update Port" to apply changes.
                  </p>
                )}
              </form>
            </div>

            {/* Database Support Toggle with Constraint Enforcement */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-sky-600" />
                  <h4 className="text-sm font-bold text-slate-900">Database Support</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
                  Enables or disables the dedicated Databases tab for this site. If enabled, this site can provision databases and users.
                </p>
                {site.databasesEnabled && databases.length > 0 && (
                  <p className="text-[11px] text-amber-700 font-semibold flex items-center gap-1 mt-1">
                    <Info className="w-3.5 h-3.5" />
                    <span>Cannot be turned off while {databases.length} active database(s) exist for this site.</span>
                  </p>
                )}
              </div>

              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={site.databasesEnabled}
                  disabled={isTogglingDb}
                  onChange={(e) => handleToggleDatabases(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* CREATE DATABASE MODAL */}
      {showCreateDbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-modal w-full max-w-md border border-slate-200/80 p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Create Database</h3>
                </div>
              </div>
              <button
                onClick={() => setShowCreateDbModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {dbError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {dbError}
              </div>
            )}

            <form onSubmit={handleCreateDatabase} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Database Name</label>
                <input
                  type="text"
                  value={newDbName}
                  onChange={(e) => setNewDbName(e.target.value)}
                  required
                  placeholder="e.g. app_production"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Database Username</label>
                <input
                  type="text"
                  value={newDbUser}
                  onChange={(e) => setNewDbUser(e.target.value)}
                  required
                  placeholder="e.g. app_user"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                <input
                  type="text"
                  value={newDbPass}
                  onChange={(e) => setNewDbPass(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateDbModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingDb}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-smooth disabled:opacity-50"
                >
                  {isCreatingDb ? 'Provisioning...' : 'Create Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE FILE MODAL */}
      {showNewFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-modal w-full max-w-sm border border-slate-200/80 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FilePlus className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900">New File</h3>
              </div>
              <button onClick={() => setShowNewFileModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">File Name</label>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="e.g. app.js, index.html"
                  required
                  autoFocus
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewFileModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-smooth"
                >
                  Create & Edit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE FOLDER MODAL */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-modal w-full max-w-sm border border-slate-200/80 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900">New Folder</h3>
              </div>
              <button onClick={() => setShowNewFolderModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Folder Name</label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. assets, src, public"
                  required
                  autoFocus
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-smooth"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME ITEM MODAL */}
      {itemToRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-modal w-full max-w-sm border border-slate-200/80 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <TextCursor className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Rename {itemToRename.isDirectory ? 'Folder' : 'File'}
                </h3>
              </div>
              <button onClick={() => setItemToRename(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenameItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Name</label>
                <input
                  type="text"
                  value={renameNewName}
                  onChange={(e) => setRenameNewName(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setItemToRename(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-smooth"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IN-APP DELETE CONFIRMATION MODAL (Single & Bulk) */}
      {itemsToDelete && itemsToDelete.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-modal w-full max-w-sm border border-slate-200/80 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-slate-900">
                  {itemsToDelete.length === 1
                    ? `Delete ${itemsToDelete[0].isDirectory ? 'Folder' : 'File'}`
                    : `Delete ${itemsToDelete.length} Items`}
                </h3>
                {itemsToDelete.length === 1 ? (
                  <p className="text-xs text-slate-500 font-mono truncate">
                    {itemsToDelete[0].name}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Bulk delete confirmation
                  </p>
                )}
              </div>
              <button 
                onClick={() => setItemsToDelete(null)}
                disabled={isDeletingFileItem}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {itemsToDelete.length === 1 ? (
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to delete this {itemsToDelete[0].isDirectory ? 'folder and all of its contents' : 'file'}? This action cannot be undone.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to delete these {itemsToDelete.length} selected items? This action cannot be undone.
                </p>
                <div className="max-h-28 overflow-y-auto p-2 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1 font-mono text-[11px] text-slate-700">
                  {itemsToDelete.map((item) => (
                    <div key={item.path} className="truncate">
                      • {item.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeletingFileItem}
                onClick={() => setItemsToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-smooth"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingFileItem}
                onClick={confirmDeleteFileItem}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-smooth shadow-sm flex items-center gap-1.5"
              >
                {isDeletingFileItem ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{isDeletingFileItem ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOVE MODAL WITH SITE FOLDER TREEVIEW */}
      {showMoveModal && site && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-modal w-full max-w-md border border-slate-200/80 p-6 space-y-4 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-200/80 flex items-center justify-center text-brand-600">
                  <FolderInput className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Move {selectedPaths.size} {selectedPaths.size === 1 ? 'Item' : 'Items'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Select a destination directory from the folder tree
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMoveModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selected items list */}
            <div className="shrink-0 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs text-slate-600 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Items to move:</span>
              <div className="max-h-20 overflow-y-auto font-mono text-[11px] text-slate-700 flex flex-wrap gap-1.5">
                {Array.from(selectedPaths).map((p) => {
                  const name = p.replace(/\\/g, '/').split('/').pop() || p;
                  return (
                    <span key={p} className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800">
                      {name}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Treeview container */}
            <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[300px] p-2 rounded-2xl border border-slate-200 bg-slate-50/40">
              {renderMoveModalTreeItem(fileBaseDir, 'Home', 0)}
            </div>

            {/* Destination indicator */}
            <div className="shrink-0 text-xs text-slate-600 flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/70">
              <span className="font-semibold text-slate-500">Destination:</span>
              <span className="font-mono font-bold text-brand-700 truncate max-w-[240px]">
                {normalizePath(moveModalDest) === normalizePath(fileBaseDir)
                  ? 'Home (User Home)'
                  : `Home/${normalizePath(moveModalDest).replace(normalizePath(fileBaseDir), '').replace(/^\//, '')}`}
              </span>
            </div>

            {normalizePath(moveModalDest) === normalizePath(currentPath) && (
              <p className="text-[11px] text-amber-600 font-medium">
                Note: Selected item(s) are already inside this folder.
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setShowMoveModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-smooth"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isMoving || normalizePath(moveModalDest) === normalizePath(currentPath)}
                onClick={handleInitiateMove}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-smooth shadow-sm flex items-center gap-1.5"
              >
                {isMoving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderInput className="w-3.5 h-3.5" />}
                <span>{isMoving ? 'Moving...' : 'Move Here'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERWRITE CONFIRMATION MODAL */}
      {showOverwriteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-modal w-full max-w-md border border-slate-200/80 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-slate-900">
                  Confirm File Overwrite
                </h3>
                <p className="text-xs text-slate-500">
                  Destination already contains {moveConflicts.length} conflicting item{moveConflicts.length > 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setShowOverwriteModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              The destination directory already contains file(s) with matching names:
            </p>

            <div className="max-h-36 overflow-y-auto p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1 font-mono text-xs text-slate-700">
              {moveConflicts.map((c) => (
                <div key={c} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">{c}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-rose-600 font-semibold">
              Overwriting will permanently replace existing destination files. Are you sure you want to proceed?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isMoving}
                onClick={() => setShowOverwriteModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-smooth"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isMoving}
                onClick={() => executeMove(true)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-smooth shadow-sm flex items-center gap-1.5"
              >
                {isMoving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>{isMoving ? 'Moving...' : 'Overwrite & Move'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Let's Encrypt Certificate Modal */}
      {showLetsEncryptModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Add Let's Encrypt Certificate</h3>
              </div>
              <button
                onClick={() => setShowLetsEncryptModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddLetsEncrypt} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Domain</label>
                <input
                  type="text"
                  readOnly
                  value={site.domain}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-700 select-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact / Recovery Email
                </label>
                <input
                  type="email"
                  value={letsEncryptEmail}
                  onChange={(e) => setLetsEncryptEmail(e.target.value)}
                  placeholder={`admin@${site.domain}`}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Used by Let's Encrypt for certificate expiry notices and key recovery.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60 text-[11px] text-slate-600 leading-relaxed">
                Automated ACME verification will issue and install a trusted 90-day SSL/TLS certificate with auto-renewal enabled.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLetsEncryptModal(false)}
                  disabled={certActionLoading}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-smooth"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={certActionLoading}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-smooth shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {certActionLoading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{certActionLoading ? 'Issuing...' : 'Issue Certificate'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Certificate Modal */}
      {showImportCertModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Import Custom Certificate</h3>
              </div>
              <button
                onClick={() => setShowImportCertModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleImportCustomCert} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Certificate (PEM / CRT)
                </label>
                <textarea
                  required
                  rows={4}
                  value={customCertContent}
                  onChange={(e) => setCustomCertContent(e.target.value)}
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10 leading-normal"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Private Key (KEY)
                </label>
                <textarea
                  required
                  rows={4}
                  value={customKeyContent}
                  onChange={(e) => setCustomKeyContent(e.target.value)}
                  placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10 leading-normal"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowImportCertModal(false)}
                  disabled={certActionLoading}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-smooth"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={certActionLoading}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-smooth shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {certActionLoading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>{certActionLoading ? 'Installing...' : 'Import & Install'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Site User Password Modal */}
      {showResetPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Reset Site User Password</h3>
                  <p className="text-[11px] text-slate-500">Account: <span className="font-mono font-semibold text-slate-800">{site.siteUser}</span></p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setResetPasswordError(null);
                  setNewSitePassword('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {resetPasswordError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{resetPasswordError}</span>
              </div>
            )}

            <form onSubmit={handleResetSiteUserPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewSitePassword ? 'text' : 'password'}
                    required
                    value={newSitePassword}
                    onChange={(e) => setNewSitePassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewSitePassword(!showNewSitePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewSitePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Changes the Linux user password for SSH and SFTP authentication.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPasswordModal(false);
                    setResetPasswordError(null);
                    setNewSitePassword('');
                  }}
                  disabled={isResettingPassword}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-smooth"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword || !newSitePassword.trim()}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-smooth shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isResettingPassword ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                  <span>{isResettingPassword ? 'Updating...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add SSH Key Modal */}
      {showAddSshKeyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add Authorized SSH Key</h3>
                  <p className="text-[11px] text-slate-500">Authorize access for <span className="font-mono font-semibold text-slate-800">{site.siteUser}</span></p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddSshKeyModal(false);
                  setSshKeyError(null);
                  setNewSshKey('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {sshKeyError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{sshKeyError}</span>
              </div>
            )}

            <form onSubmit={handleAddSshKey} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Public Key (OpenSSH format)
                </label>
                <textarea
                  required
                  rows={4}
                  value={newSshKey}
                  onChange={(e) => setNewSshKey(e.target.value)}
                  placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... user@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10 leading-normal"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Paste your public key (e.g., from <code className="text-slate-600">~/.ssh/id_ed25519.pub</code> or <code className="text-slate-600">id_rsa.pub</code>).
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSshKeyModal(false);
                    setSshKeyError(null);
                    setNewSshKey('');
                  }}
                  disabled={isAddingSshKey}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-smooth"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingSshKey || !newSshKey.trim()}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-smooth shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isAddingSshKey ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{isAddingSshKey ? 'Adding...' : 'Add Key'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
