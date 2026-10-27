import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Database, 
  Table as TableIcon, 
  Search, 
  Terminal, 
  Plus, 
  Trash2, 
  Key, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp,
  ArrowUpDown,
  Ban,
  RefreshCw, 
  Play, 
  Check, 
  AlertCircle, 
  Layers, 
  Info,
  X,
  Pencil,
  Copy,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  CheckCircle2,
  Lock,
  Sparkles,
  Code2
} from 'lucide-react';
import { api } from '../services/api';
import type { 
  Site, 
  SiteDatabase, 
  DatabaseTableInfo, 
  DatabaseTableColumn, 
  DatabaseTableDataResponse, 
  DatabaseQueryResult 
} from '../../../shared/types.js';

interface DatabaseAdminProps {
  site: Site;
  database: SiteDatabase;
  initialTable?: string | null;
  initialTab?: 'data' | 'structure' | 'sql' | 'info';
  onClose: () => void;
  onViewChange?: (table: string | null, tab: 'data' | 'structure' | 'sql' | 'info') => void;
}

interface InlineEditState {
  rowIndex: number;
  rowPk: any;
  colName: string;
  row: Record<string, any>;
  rect: { top: number; left: number; width: number; height: number };
  value: string;
  isNull: boolean;
  isFloating: boolean;
}

interface SqlSuggestion {
  type: 'table' | 'column' | 'keyword' | 'function';
  label: string;
  insertText: string;
  detail?: string;
}

export const DatabaseAdmin: React.FC<DatabaseAdminProps> = ({
  site,
  database,
  initialTable,
  initialTab,
  onClose,
  onViewChange,
}) => {
  const [tables, setTables] = useState<DatabaseTableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(initialTable || null);
  const [activeTab, setActiveTab] = useState<'data' | 'structure' | 'sql' | 'info'>(initialTab || 'data');

  useEffect(() => {
    onViewChange?.(selectedTable, activeTab);
  }, [selectedTable, activeTab]);
  const [tableSearch, setTableSearch] = useState('');
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  const [tableColumns, setTableColumns] = useState<Record<string, DatabaseTableColumn[]>>({});
  const [loadingTables, setLoadingTables] = useState(true);

  // Sidebar toggle state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Table Data view states
  const [tableData, setTableData] = useState<DatabaseTableDataResponse | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dataPage, setDataPage] = useState(1);
  const [dataSearch, setDataSearch] = useState('');

  // Column Sorting state
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Table Structure states
  const [structure, setStructure] = useState<DatabaseTableColumn[]>([]);
  const [loadingStructure, setLoadingStructure] = useState(false);

  // SQL Console states
  const [sqlQuery, setSqlQuery] = useState('');
  const [queryResult, setQueryResult] = useState<DatabaseQueryResult | null>(null);
  const [isExecutingSql, setIsExecutingSql] = useState(false);
  const [sqlSuggestions, setSqlSuggestions] = useState<SqlSuggestion[]>([]);
  const [showSqlSuggestions, setShowSqlSuggestions] = useState(false);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(0);
  const [suggestionCoords, setSuggestionCoords] = useState<{ top: number; left: number }>({ top: 35, left: 16 });
  const sqlTextareaRef = useRef<HTMLTextAreaElement>(null);
  const sqlPreRef = useRef<HTMLPreElement>(null);

  // Full-Size Row Editor state (replaces content section)
  const [editingFullRow, setEditingFullRow] = useState<Record<string, any> | null>(null);
  const [editingRowForm, setEditingRowForm] = useState<Record<string, any>>({});
  const [isSavingFullRow, setIsSavingFullRow] = useState(false);
  const [fullRowSaveError, setFullRowSaveError] = useState<string | null>(null);
  const [fullRowSuccess, setFullRowSuccess] = useState(false);

  // Inline Cell Floating Window Editor state
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);
  const [isSavingInline, setIsSavingInline] = useState(false);
  const inlineInputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Insert Row Modal
  const [showInsertModal, setShowInsertModal] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, string>>({});
  const [isInserting, setIsInserting] = useState(false);
  const [insertError, setInsertError] = useState<string | null>(null);

  useEffect(() => {
    loadTables();
  }, [database.name]);

  const loadTables = async () => {
    setLoadingTables(true);
    try {
      const data = await api.getDatabaseTables(database.name);
      setTables(data);
      if (data.length > 0 && !selectedTable) {
        const found = initialTable && data.find((t) => t.name === initialTable);
        setSelectedTable(found ? found.name : data[0].name);
      }
    } catch {
      // ignore
    } finally {
      setLoadingTables(false);
    }
  };

  // Load table data and structure when selectedTable changes
  useEffect(() => {
    if (!selectedTable) return;
    setEditingFullRow(null);
    setInlineEdit(null);
    setDataPage(1);
    setSortCol(null);
    setSortDir('asc');
    setSqlQuery(`SELECT * FROM \`${selectedTable}\` LIMIT 50;`);
    loadTableData(selectedTable, 1, null, 'asc');
    loadTableStructure(selectedTable);
  }, [selectedTable]);

  const loadTableData = async (
    tblName: string,
    page = 1,
    col: string | null = sortCol,
    dir: 'asc' | 'desc' = sortDir
  ) => {
    setLoadingData(true);
    try {
      const data = await api.getTableData(database.name, tblName, page, 50, col || undefined, dir);
      setTableData(data);
      setDataPage(page);
    } catch {
      // ignore
    } finally {
      setLoadingData(false);
    }
  };

  const handleSort = (colName: string) => {
    if (!selectedTable) return;
    let nextDir: 'asc' | 'desc' = 'asc';
    if (sortCol === colName) {
      nextDir = sortDir === 'asc' ? 'desc' : 'asc';
      setSortDir(nextDir);
    } else {
      setSortCol(colName);
      setSortDir('asc');
      nextDir = 'asc';
    }
    loadTableData(selectedTable, dataPage, colName, nextDir);
  };

  const loadTableStructure = async (tblName: string) => {
    setLoadingStructure(true);
    try {
      const data = await api.getTableStructure(database.name, tblName);
      setStructure(data);
      setTableColumns((prev) => ({ ...prev, [tblName]: data }));
    } catch {
      // ignore
    } finally {
      setLoadingStructure(false);
    }
  };

  const toggleExpandTable = async (tblName: string) => {
    const nextState = !expandedTables[tblName];
    setExpandedTables((prev) => ({ ...prev, [tblName]: nextState }));
    if (nextState && !tableColumns[tblName]) {
      try {
        const cols = await api.getTableStructure(database.name, tblName);
        setTableColumns((prev) => ({ ...prev, [tblName]: cols }));
      } catch {
        // ignore
      }
    }
  };

  const handleRunQuery = async () => {
    if (!sqlQuery.trim()) return;
    setIsExecutingSql(true);
    try {
      const res = await api.executeDatabaseQuery(database.name, sqlQuery);
      setQueryResult(res);
      loadTables();
      if (selectedTable) {
        loadTableData(selectedTable, dataPage);
      }
    } catch (err: any) {
      setQueryResult({
        columns: [],
        rows: [],
        executionTimeMs: 0,
        error: err.message || 'Execution failed',
      });
    } finally {
      setIsExecutingSql(false);
    }
  };

  // Context-aware SQL Autocomplete calculation
  const updateSqlSuggestions = (value: string, cursorPos: number) => {
    const textBefore = value.slice(0, cursorPos);
    const match = textBefore.match(/([a-zA-Z0-9_`.]+)$/);
    const currentWord = match ? match[1].replace(/`/g, '') : '';

    const textBeforeWord = textBefore.slice(0, textBefore.length - (match ? match[0].length : 0)).trim();
    const tokens = textBeforeWord.split(/\s+/).filter(Boolean);
    const lastKeyword = tokens.length > 0 ? tokens[tokens.length - 1].toUpperCase() : '';
    const secondLastKeyword = tokens.length > 1 ? tokens[tokens.length - 2].toUpperCase() : '';

    const isTableContext =
      lastKeyword === 'FROM' ||
      lastKeyword === 'JOIN' ||
      lastKeyword === 'INTO' ||
      lastKeyword === 'UPDATE' ||
      lastKeyword === 'TABLE' ||
      (secondLastKeyword === 'DELETE' && lastKeyword === 'FROM');

    const isColumnContext =
      lastKeyword === 'SELECT' ||
      lastKeyword === 'WHERE' ||
      lastKeyword === 'AND' ||
      lastKeyword === 'OR' ||
      lastKeyword === 'ON' ||
      lastKeyword === 'SET' ||
      lastKeyword === 'BY' ||
      currentWord.includes('.');

    let nextSuggestions: SqlSuggestion[] = [];

    if (isTableContext) {
      // Suggest all tables in the current database
      const filtered = tables.filter((t) =>
        t.name.toLowerCase().includes(currentWord.toLowerCase())
      );
      nextSuggestions = filtered.map((t) => ({
        type: 'table',
        label: t.name,
        insertText: `\`${t.name}\``,
        detail: `${t.rowCount || 0} rows`,
      }));
    } else if (isColumnContext) {
      // Suggest columns from active table or table structure
      const cols: DatabaseTableColumn[] = structure || [];
      const filtered = cols.filter((c) =>
        c.name.toLowerCase().includes(currentWord.toLowerCase())
      );
      nextSuggestions = filtered.map((c) => ({
        type: 'column',
        label: c.name,
        insertText: `\`${c.name}\``,
        detail: c.type + (c.isPrimaryKey ? ' • PK' : ''),
      }));
    } else if (currentWord.length >= 1) {
      // General keywords and tables matching what user is typing
      const SQL_KW_LIST = [
        'SELECT', 'FROM', 'WHERE', 'ORDER BY', 'GROUP BY', 'LIMIT', 'OFFSET',
        'INSERT INTO', 'UPDATE', 'DELETE FROM', 'JOIN', 'LEFT JOIN', 'INNER JOIN',
        'HAVING', 'DISTINCT', 'COUNT(*)', 'SUM', 'AVG', 'MIN', 'MAX',
        'AND', 'OR', 'NOT', 'IN', 'LIKE', 'IS NULL', 'IS NOT NULL', 'AS'
      ];
      const matchingKw = SQL_KW_LIST.filter((k) =>
        k.toLowerCase().startsWith(currentWord.toLowerCase())
      ).map((k) => ({
        type: 'keyword' as const,
        label: k,
        insertText: k,
        detail: 'SQL Keyword',
      }));

      const matchingTables = tables.filter((t) =>
        t.name.toLowerCase().includes(currentWord.toLowerCase())
      ).map((t) => ({
        type: 'table' as const,
        label: t.name,
        insertText: `\`${t.name}\``,
        detail: 'Table',
      }));

      nextSuggestions = [...matchingKw, ...matchingTables];
    }

    if (nextSuggestions.length > 0) {
      const lines = textBefore.split('\n');
      const currentLineIdx = lines.length - 1;
      const currentLineLen = lines[currentLineIdx].length;
      const top = Math.min((currentLineIdx + 1) * 22 + 16, 160);
      const left = Math.min(Math.max(currentLineLen * 7.2 + 16, 20), 400);

      setSuggestionCoords({ top, left });
      setSqlSuggestions(nextSuggestions.slice(0, 8));
      setSelectedSuggestionIdx(0);
      setShowSqlSuggestions(true);
    } else {
      setShowSqlSuggestions(false);
      setSqlSuggestions([]);
    }
  };

  const applySqlSuggestion = (suggestion: SqlSuggestion) => {
    if (!sqlTextareaRef.current) return;
    const cursorPos = sqlTextareaRef.current.selectionStart;
    const textBefore = sqlQuery.slice(0, cursorPos);
    const textAfter = sqlQuery.slice(cursorPos);

    const match = textBefore.match(/([a-zA-Z0-9_`.]+)$/);
    const replaceLen = match ? match[0].length : 0;
    const beforeWord = textBefore.slice(0, textBefore.length - replaceLen);

    const insertText = suggestion.insertText;
    const newSqlQuery = beforeWord + insertText + ' ' + textAfter;
    setSqlQuery(newSqlQuery);
    setShowSqlSuggestions(false);

    const newCursorPos = beforeWord.length + insertText.length + 1;
    setTimeout(() => {
      if (sqlTextareaRef.current) {
        sqlTextareaRef.current.focus();
        sqlTextareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleSqlEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSqlSuggestions && sqlSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIdx((prev) => (prev + 1) % sqlSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIdx((prev) => (prev - 1 + sqlSuggestions.length) % sqlSuggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applySqlSuggestion(sqlSuggestions[selectedSuggestionIdx]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSqlSuggestions(false);
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      setShowSqlSuggestions(false);
      handleRunQuery();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newVal = sqlQuery.substring(0, start) + '  ' + sqlQuery.substring(end);
      setSqlQuery(newVal);
      setTimeout(() => {
        if (sqlTextareaRef.current) {
          sqlTextareaRef.current.selectionStart = sqlTextareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const renderHighlightedSql = (code: string) => {
    if (!code) {
      return <span className="text-slate-400 italic">-- Write SQL query here (e.g. SELECT * FROM users)...</span>;
    }

    const tokenRegex = /(--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'\\]|\\.)*'|"(?:""|[^"\\]|\\.)*"|`[^`]+`|\b\d+(?:\.\d+)?\b|\b(?:SELECT|FROM|WHERE|AND|OR|NOT|IN|LIKE|IS|NULL|ORDER\s+BY|GROUP\s+BY|HAVING|LIMIT|OFFSET|INSERT\s+INTO|INSERT|INTO|VALUES|UPDATE|SET|DELETE\s+FROM|DELETE|JOIN|INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|CROSS\s+JOIN|ON|AS|DISTINCT|COUNT|SUM|AVG|MIN|MAX|CREATE\s+TABLE|CREATE|TABLE|DROP\s+TABLE|DROP|ALTER\s+TABLE|ALTER|ADD|COLUMN|MODIFY|PRIMARY\s+KEY|FOREIGN\s+KEY|REFERENCES|DATABASE|SHOW|DESCRIBE|EXPLAIN|TRUNCATE|BEGIN|COMMIT|ROLLBACK|CASCADE|DEFAULT|AUTO_INCREMENT|UNIQUE|INDEX|ASC|DESC|BY|UNION|ALL|EXISTS|BETWEEN|CASE|WHEN|THEN|ELSE|END)\b|[^\s\w]+|\s+|\w+)/gi;

    const SQL_KEYWORDS = new Set([
      'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'IS', 'NULL',
      'ORDER', 'GROUP', 'BY', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET',
      'INSERT', 'INTO', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'DELETE FROM',
      'JOIN', 'INNER', 'LEFT', 'RIGHT', 'CROSS', 'ON', 'AS', 'DISTINCT',
      'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'CROSS JOIN',
      'CREATE', 'TABLE', 'CREATE TABLE', 'DROP', 'DROP TABLE', 'ALTER', 'ALTER TABLE',
      'ADD', 'COLUMN', 'MODIFY', 'PRIMARY', 'KEY', 'PRIMARY KEY', 'FOREIGN', 'REFERENCES',
      'DATABASE', 'SHOW', 'DESCRIBE', 'EXPLAIN', 'TRUNCATE', 'ASC', 'DESC',
      'UNION', 'ALL', 'EXISTS', 'BETWEEN', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
      'DEFAULT', 'AUTO_INCREMENT', 'UNIQUE'
    ]);

    const SQL_FUNCTIONS = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CONCAT', 'COALESCE', 'NOW', 'DATE']);

    const parts: React.ReactNode[] = [];
    let match: RegExpExecArray | null;
    let idx = 0;

    while ((match = tokenRegex.exec(code)) !== null) {
      const text = match[0];
      const upper = text.toUpperCase();

      if (text.startsWith('--') || text.startsWith('/*')) {
        parts.push(<span key={idx++} className="text-slate-400 italic">{text}</span>);
      } else if (text.startsWith("'") || text.startsWith('"')) {
        parts.push(<span key={idx++} className="text-emerald-600 font-semibold">{text}</span>);
      } else if (text.startsWith('`')) {
        parts.push(<span key={idx++} className="text-indigo-600 font-bold">{text}</span>);
      } else if (/^\d+(?:\.\d+)?$/.test(text)) {
        parts.push(<span key={idx++} className="text-amber-600 font-bold">{text}</span>);
      } else if (SQL_FUNCTIONS.has(upper)) {
        parts.push(<span key={idx++} className="text-violet-600 font-bold">{text}</span>);
      } else if (SQL_KEYWORDS.has(upper)) {
        parts.push(<span key={idx++} className="text-blue-600 font-extrabold tracking-wide">{text}</span>);
      } else if (/^[=<>!+\-*/]+$/.test(text)) {
        parts.push(<span key={idx++} className="text-pink-600 font-bold">{text}</span>);
      } else {
        parts.push(<span key={idx++} className="text-slate-800 font-medium">{text}</span>);
      }
    }

    return parts;
  };

  // Row Action 1: Open Full-Size Row Editor
  const handleStartEditRow = (row: Record<string, any>) => {
    setEditingFullRow(row);
    setEditingRowForm({ ...row });
    setFullRowSaveError(null);
    setFullRowSuccess(false);
  };

  // Row Action 2: Duplicate Row
  const handleDuplicateRow = async (row: Record<string, any>) => {
    if (!selectedTable) return;
    const pkCol = structure.find((c) => c.isPrimaryKey);
    const duplicateData = { ...row };
    // If auto_increment PK exists, delete it so backend auto-assigns next ID
    if (pkCol && pkCol.extra?.includes('auto_increment')) {
      delete duplicateData[pkCol.name];
    } else if (pkCol) {
      duplicateData[pkCol.name] = `${duplicateData[pkCol.name]}_copy`;
    }

    try {
      await api.insertTableRow(database.name, selectedTable, duplicateData);
      loadTableData(selectedTable, dataPage);
      loadTables();
    } catch (err: any) {
      alert(err.message || 'Failed to duplicate row');
    }
  };

  // Row Action 3: Delete Row
  const handleDeleteRow = async (row: Record<string, any>) => {
    if (!selectedTable) return;
    const pkCol = structure.find((c) => c.isPrimaryKey) || structure[0];
    if (!pkCol) return;
    const pkVal = row[pkCol.name];

    if (!confirm(`Delete row where ${pkCol.name} = '${pkVal}'?`)) return;

    try {
      await api.deleteTableRow(database.name, selectedTable, pkCol.name, pkVal);
      loadTableData(selectedTable, dataPage);
      loadTables();
    } catch (err: any) {
      alert(err.message || 'Failed to delete row');
    }
  };

  // Save changes from Full-Size Row Editor
  const handleSaveFullRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable || !editingFullRow) return;
    const pkCol = structure.find((c) => c.isPrimaryKey) || structure[0];
    if (!pkCol) return;

    setIsSavingFullRow(true);
    setFullRowSaveError(null);

    try {
      await api.updateTableRow(
        database.name,
        selectedTable,
        pkCol.name,
        editingFullRow[pkCol.name],
        editingRowForm
      );
      setFullRowSuccess(true);
      loadTableData(selectedTable, dataPage);
      loadTables();
      setTimeout(() => {
        setEditingFullRow(null);
      }, 700);
    } catch (err: any) {
      setFullRowSaveError(err.message || 'Failed to save row changes');
    } finally {
      setIsSavingFullRow(false);
    }
  };

  // Open Inline Floating Editor or Compact Cell Editor on Cell Double-Click
  const handleCellDoubleClick = (
    e: React.MouseEvent<HTMLTableCellElement>,
    row: Record<string, any>,
    rowIndex: number,
    colName: string
  ) => {
    const cell = e.currentTarget;
    const rect = cell.getBoundingClientRect();
    const rawVal = row[colName];
    const strVal = rawVal === null || rawVal === undefined ? '' : String(rawVal);

    const pkCol = structure.find((c) => c.isPrimaryKey) || structure[0];
    const rowPk = pkCol ? row[pkCol.name] : rowIndex;

    // Check if the current value exceeds the cell width:
    // 1. Text is overflowing cell horizontally (scrollWidth > clientWidth)
    // 2. Multiline text containing newlines
    // 3. String length in pixels (~7.5px per char) exceeds available cell width (rect.width - 24)
    const isExceedingWidth =
      cell.scrollWidth > cell.clientWidth + 2 ||
      strVal.includes('\n') ||
      strVal.length * 7.5 > (rect.width - 24);

    const colDef = structure.find((c) => c.name === colName);
    const isLargeTextType =
      colDef?.type.toLowerCase().includes('text') ||
      colDef?.type.toLowerCase().includes('blob') ||
      colDef?.type.toLowerCase().includes('json');

    const useFloatingWindow = Boolean(isExceedingWidth || (isLargeTextType && strVal.length > 30));

    setInlineEdit({
      rowIndex,
      rowPk,
      colName,
      row,
      rect: {
        top: Math.max(10, rect.top),
        left: Math.max(10, rect.left),
        width: Math.max(280, rect.width + 40),
        height: rect.height,
      },
      value: strVal,
      isNull: rawVal === null,
      isFloating: useFloatingWindow,
    });
  };

  // Save Inline Editor (both floating and compact)
  const handleSaveInline = async () => {
    if (!inlineEdit || !selectedTable) return;
    const pkCol = structure.find((c) => c.isPrimaryKey) || structure[0];
    if (!pkCol) return;

    setIsSavingInline(true);
    const finalValue = inlineEdit.isNull ? null : inlineEdit.value;

    try {
      await api.updateTableRow(
        database.name,
        selectedTable,
        pkCol.name,
        inlineEdit.row[pkCol.name],
        { [inlineEdit.colName]: finalValue }
      );
      // Update local state immediately
      setTableData((prev) => {
        if (!prev) return prev;
        const newRows = [...prev.rows];
        const targetRow = newRows.find(
          (r) => String(r[pkCol.name]) === String(inlineEdit.row[pkCol.name])
        );
        if (targetRow) {
          targetRow[inlineEdit.colName] = finalValue;
        }
        return { ...prev, rows: newRows };
      });
      setInlineEdit(null);
    } catch (err: any) {
      alert(err.message || 'Failed to save cell');
    } finally {
      setIsSavingInline(false);
    }
  };

  // Set field to NULL from compact icon-only button
  const handleSetNullInline = async () => {
    if (!inlineEdit || !selectedTable) return;
    const pkCol = structure.find((c) => c.isPrimaryKey) || structure[0];
    if (!pkCol) return;

    setIsSavingInline(true);
    try {
      await api.updateTableRow(
        database.name,
        selectedTable,
        pkCol.name,
        inlineEdit.row[pkCol.name],
        { [inlineEdit.colName]: null }
      );
      // Update local state immediately
      setTableData((prev) => {
        if (!prev) return prev;
        const newRows = [...prev.rows];
        const targetRow = newRows.find(
          (r) => String(r[pkCol.name]) === String(inlineEdit.row[pkCol.name])
        );
        if (targetRow) {
          targetRow[inlineEdit.colName] = null;
        }
        return { ...prev, rows: newRows };
      });
      setInlineEdit(null);
    } catch (err: any) {
      alert(err.message || 'Failed to set value to NULL');
    } finally {
      setIsSavingInline(false);
    }
  };

  // Insert Row Modal submit
  const handleInsertRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable) return;
    setInsertError(null);
    setIsInserting(true);

    try {
      await api.insertTableRow(database.name, selectedTable, newRowData);
      setShowInsertModal(false);
      setNewRowData({});
      loadTableData(selectedTable, 1);
      loadTables();
    } catch (err: any) {
      setInsertError(err.message || 'Failed to insert row');
    } finally {
      setIsInserting(false);
    }
  };

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(tableSearch.toLowerCase())
  );

  const filteredRows = React.useMemo(() => {
    let list = (tableData?.rows || []).filter((row) => {
      if (!dataSearch.trim()) return true;
      return Object.values(row).some((val) =>
        String(val).toLowerCase().includes(dataSearch.toLowerCase())
      );
    });

    if (sortCol) {
      list = [...list].sort((a, b) => {
        const valA = a[sortCol];
        const valB = b[sortCol];
        if (valA === null || valA === undefined) return sortDir === 'asc' ? 1 : -1;
        if (valB === null || valB === undefined) return sortDir === 'asc' ? -1 : 1;

        const numA = Number(valA);
        const numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB) && typeof valA !== 'boolean' && typeof valB !== 'boolean') {
          return sortDir === 'asc' ? numA - numB : numB - numA;
        }

        return sortDir === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return list;
  }, [tableData?.rows, dataSearch, sortCol, sortDir]);

  const selectedTableInfo = tables.find((t) => t.name === selectedTable);

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] select-none relative">
      {/* TOP NAVIGATION BAR */}
      <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-30 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3">
          {/* Back button with text "Back" */}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-smooth"
            title="Return to Site Details"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          {/* Icon-only toggle button for Sidebar Collapse/Expand */}
          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className={`p-1.5 rounded-xl border transition-smooth ${
              isSidebarOpen
                ? 'border-slate-200 text-slate-600 hover:bg-slate-100'
                : 'border-brand-200 bg-brand-50 text-brand-600 shadow-xs'
            }`}
            title={isSidebarOpen ? 'Collapse Table Sidebar' : 'Expand Table Sidebar'}
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeftOpen className="w-4 h-4" />
            )}
          </button>

          <div className="h-4 w-px bg-slate-200"></div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900 font-mono tracking-tight">
                  {database.name}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {database.charset}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Connected</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {site.domain} • localhost:{database.port}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditingFullRow(null);
              setActiveTab('sql');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-smooth ${
              activeTab === 'sql' && !editingFullRow
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>SQL Console</span>
          </button>

          <button
            onClick={loadTables}
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
            title="Refresh Database Schema"
          >
            <RefreshCw className={`w-4 h-4 ${loadingTables ? 'animate-spin text-brand-600' : ''}`} />
          </button>
        </div>
      </header>

      {/* WORKSPACE: LEFT SIDEBAR + MAIN AREA */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR: DATABASE TABLES TREEVIEW (COLLAPSIBLE) */}
        {isSidebarOpen && (
          <aside className="w-72 bg-white border-r border-slate-200/80 flex flex-col h-full shadow-[1px_0_6px_rgba(0,0,0,0.01)] transition-all duration-200">
            {/* Search bar & count */}
            <div className="p-3 border-b border-slate-100 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Filter tables..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-smooth"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 px-1">
                <span>TABLES</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px]">
                  {tables.length}
                </span>
              </div>
            </div>

            {/* Treeview list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {loadingTables ? (
                <div className="p-6 text-center text-xs text-slate-400">Loading tables...</div>
              ) : filteredTables.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No tables found</div>
              ) : (
                filteredTables.map((tbl) => {
                  const isSelected = selectedTable === tbl.name;
                  const isExpanded = Boolean(expandedTables[tbl.name]);
                  const cols = tableColumns[tbl.name] || tbl.columns || [];

                  return (
                    <div key={tbl.name} className="rounded-xl overflow-hidden">
                      <div
                        className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-mono cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/60'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div
                          onClick={() => {
                            setEditingFullRow(null);
                            setSelectedTable(tbl.name);
                          }}
                          className="flex items-center gap-2 min-w-0 flex-1"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpandTable(tbl.name);
                            }}
                            className="text-slate-400 hover:text-slate-700 p-0.5 rounded"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <TableIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{tbl.name}</span>
                        </div>

                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 ml-2">
                          {tbl.rowCount}
                        </span>
                      </div>

                      {/* Expanded Columns Tree */}
                      {isExpanded && (
                        <div className="pl-7 pr-2 py-1 space-y-1 bg-slate-50/50 rounded-b-xl border-l-2 border-slate-200 ml-4 my-1">
                          {cols.length === 0 ? (
                            <div className="text-[10px] text-slate-400 py-1">Loading columns...</div>
                          ) : (
                            cols.map((col) => (
                              <div
                                key={col.name}
                                className="flex items-center justify-between text-[11px] font-mono text-slate-600 py-0.5"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {col.isPrimaryKey ? (
                                    <Key className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                  ) : (
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                  )}
                                  <span className={`truncate ${col.isPrimaryKey ? 'font-bold text-slate-800' : ''}`}>
                                    {col.name}
                                  </span>
                                </div>
                                <span className="text-[9px] text-slate-400 font-sans truncate ml-1">
                                  {col.type.split('(')[0]}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}

        {/* MAIN WORKSPACE CONTENT */}
        <main className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* CONDITIONAL RENDER: FULL-SIZE ROW EDITOR (REPLACES CONTENT SECTION) */}
          {editingFullRow ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
              {/* Full Editor Header */}
              <div className="px-8 py-4 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setEditingFullRow(null)}
                    className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white transition-colors"
                    title="Back to Table View"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 font-mono">
                        Edit Row in {selectedTable}
                      </h2>
                      {structure.find((c) => c.isPrimaryKey) && (
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Key className="w-3 h-3" />
                          <span>
                            {structure.find((c) => c.isPrimaryKey)?.name} = {editingFullRow[structure.find((c) => c.isPrimaryKey)!.name]}
                          </span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      Modify fields and click Save Changes below.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingFullRow(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveFullRow}
                    disabled={isSavingFullRow}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition-smooth disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingFullRow ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>

              {/* Full Editor Form Body */}
              <div className="flex-1 overflow-y-auto p-8 max-w-4xl">
                {fullRowSaveError && (
                  <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{fullRowSaveError}</span>
                  </div>
                )}

                {fullRowSuccess && (
                  <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Row successfully updated!</span>
                  </div>
                )}

                <form onSubmit={handleSaveFullRow} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {structure.map((col) => {
                      const isPk = col.isPrimaryKey;
                      const isAuto = col.extra?.includes('auto_increment');
                      const currentVal = editingRowForm[col.name];
                      const isNull = currentVal === null;

                      return (
                        <div
                          key={col.name}
                          className={`p-4 rounded-2xl border transition-all ${
                            isPk
                              ? 'bg-amber-50/20 border-amber-200/80'
                              : 'bg-white border-slate-200/80 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              {isPk && <Key className="w-3.5 h-3.5 text-amber-500" />}
                              <span className="font-mono text-xs font-bold text-slate-800">
                                {col.name}
                              </span>
                              {isAuto && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-500">
                                  AUTO
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 font-mono">
                                {col.type}
                              </span>
                              {col.nullable && !isAuto && (
                                <label className="flex items-center gap-1 text-[11px] text-slate-500 font-medium cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isNull}
                                    onChange={(e) =>
                                      setEditingRowForm((prev) => ({
                                        ...prev,
                                        [col.name]: e.target.checked ? null : '',
                                      }))
                                    }
                                    className="rounded border-slate-300 text-brand-600 focus:ring-0"
                                  />
                                  <span>NULL</span>
                                </label>
                              )}
                            </div>
                          </div>

                          {isAuto ? (
                            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100/70 border border-slate-200 text-xs font-mono text-slate-500">
                              <Lock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{String(currentVal ?? '')} (Primary Key)</span>
                            </div>
                          ) : isNull ? (
                            <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-400 italic">
                              NULL
                            </div>
                          ) : col.type.includes('text') ? (
                            <textarea
                              rows={3}
                              value={currentVal ?? ''}
                              onChange={(e) =>
                                setEditingRowForm((prev) => ({
                                  ...prev,
                                  [col.name]: e.target.value,
                                }))
                              }
                              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                            />
                          ) : (
                            <input
                              type="text"
                              value={currentVal ?? ''}
                              onChange={(e) =>
                                setEditingRowForm((prev) => ({
                                  ...prev,
                                  [col.name]: e.target.value,
                                }))
                              }
                              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingFullRow(null)}
                      className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingFullRow}
                      className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition-smooth disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingFullRow ? 'Saving Changes...' : 'Save Changes'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : selectedTable ? (
            <>
              {/* Table Sub-header & Tabs */}
              <div className="px-8 pt-5 pb-0 border-b border-slate-200/80 bg-slate-50/50 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200/80 flex items-center justify-center text-brand-600 font-bold">
                      <TableIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900 font-mono tracking-tight">
                          {selectedTable}
                        </h2>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {selectedTableInfo?.rowCount || 0} rows
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Table in {database.name} • {selectedTableInfo?.engine || 'InnoDB'} • {selectedTableInfo?.collation || 'utf8mb4_unicode_ci'}
                      </p>
                    </div>
                  </div>

                  {activeTab === 'data' && (
                    <button
                      onClick={() => {
                        const initial: Record<string, string> = {};
                        structure.forEach((c) => {
                          if (!c.extra?.includes('auto_increment')) {
                            initial[c.name] = '';
                          }
                        });
                        setNewRowData(initial);
                        setShowInsertModal(true);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition-smooth"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Insert Row</span>
                    </button>
                  )}
                </div>

                {/* Sub-tabs */}
                <div className="flex gap-1 overflow-x-auto">
                  {[
                    { id: 'data', label: 'Browse Data', icon: TableIcon },
                    { id: 'structure', label: 'Table Structure', icon: Layers },
                    { id: 'sql', label: 'SQL Query Console', icon: Terminal },
                    { id: 'info', label: 'Table Information', icon: Info },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-xs font-bold transition-smooth relative ${
                          isActive
                            ? 'text-brand-700 bg-white border-t border-x border-slate-200/80 shadow-xs -mb-[1px]'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                        <span>{tab.label}</span>
                        {isActive && (
                          <div className="absolute top-0 left-0 right-0 h-0.5 bg-brand-600 rounded-t-full"></div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* TAB CONTENT */}
              <div className="flex-1 overflow-auto p-6">
                {/* 1. BROWSE DATA TAB */}
                {activeTab === 'data' && (
                  <div className="space-y-4">
                    {/* Filter bar */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="relative w-72">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={dataSearch}
                          onChange={(e) => setDataSearch(e.target.value)}
                          placeholder="Search records in table..."
                          className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                        />
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <span>Showing {filteredRows.length} of {tableData?.total || 0} rows</span>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            disabled={dataPage <= 1}
                            onClick={() => loadTableData(selectedTable, dataPage - 1)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 font-semibold"
                          >
                            Prev
                          </button>
                          <span className="px-2 font-mono font-bold">{dataPage}</span>
                          <button
                            disabled={(tableData?.rows.length || 0) < 50}
                            onClick={() => loadTableData(selectedTable, dataPage + 1)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 font-semibold"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Data Grid */}
                    <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
                      {loadingData ? (
                        <div className="p-12 text-center text-xs text-slate-400">Loading table records...</div>
                      ) : filteredRows.length === 0 ? (
                        <div className="p-12 text-center text-xs text-slate-400">No records found. Click '+ Insert Row' to add data.</div>
                      ) : (
                        <div className="overflow-x-auto max-h-[calc(100vh-320px)]">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-mono text-[11px]">
                              <tr>
                                <th className="p-2.5 pl-4 w-12 text-slate-400">#</th>
                                {structure.map((col) => {
                                  const isSorted = sortCol === col.name;
                                  return (
                                    <th
                                      key={col.name}
                                      onClick={() => handleSort(col.name)}
                                      className="p-2.5 font-bold whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors select-none group/th"
                                      title={`Sort by ${col.name}`}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-500 shrink-0" />}
                                        <span className={isSorted ? 'text-brand-600 font-extrabold' : ''}>
                                          {col.name}
                                        </span>
                                        <span className="text-slate-400">
                                          {isSorted ? (
                                            sortDir === 'asc' ? (
                                              <ChevronUp className="w-3.5 h-3.5 text-brand-600" />
                                            ) : (
                                              <ChevronDown className="w-3.5 h-3.5 text-brand-600" />
                                            )
                                          ) : (
                                            <ArrowUpDown className="w-3 h-3 opacity-0 group-hover/th:opacity-60 transition-opacity" />
                                          )}
                                        </span>
                                      </div>
                                    </th>
                                  );
                                })}
                                <th className="p-2.5 pr-4 text-right w-24">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                              {filteredRows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/70 transition-colors group">
                                  <td className="p-2.5 pl-4 text-slate-400 select-none">
                                    {(dataPage - 1) * 50 + idx + 1}
                                  </td>
                                  {structure.map((col) => {
                                    const val = row[col.name];
                                    const pkCol = structure.find((c) => c.isPrimaryKey) || structure[0];
                                    const currentRowPk = pkCol ? row[pkCol.name] : idx;
                                    const isEditingCompact =
                                      inlineEdit &&
                                      !inlineEdit.isFloating &&
                                      inlineEdit.rowPk === currentRowPk &&
                                      inlineEdit.colName === col.name;

                                    if (isEditingCompact) {
                                      return (
                                        <td
                                          key={col.name}
                                          className="p-1 text-slate-800 align-middle bg-brand-50/20 max-w-xs overflow-hidden"
                                        >
                                          <div className="relative flex items-center w-full min-w-0">
                                            <input
                                              type="text"
                                              autoFocus
                                              value={inlineEdit.value}
                                              onChange={(e) =>
                                                setInlineEdit((prev) =>
                                                  prev ? { ...prev, value: e.target.value, isNull: false } : null
                                                )
                                              }
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  handleSaveInline();
                                                } else if (e.key === 'Escape') {
                                                  e.preventDefault();
                                                  setInlineEdit(null);
                                                }
                                              }}
                                              className="w-full min-w-0 h-7 pl-2 pr-6 py-0.5 text-xs font-mono rounded-lg border-2 border-brand-500 bg-white shadow-xs focus:outline-none text-slate-900"
                                            />
                                            <button
                                              type="button"
                                              onMouseDown={(e) => e.preventDefault()}
                                              onClick={() => handleSetNullInline()}
                                              title="Set NULL"
                                              className="absolute right-1 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-rose-600 transition-colors shrink-0"
                                            >
                                              <Ban className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </td>
                                      );
                                    }

                                    return (
                                      <td
                                        key={col.name}
                                        onDoubleClick={(e) => handleCellDoubleClick(e, row, idx, col.name)}
                                        className="p-2.5 text-slate-800 max-w-xs truncate cursor-cell hover:bg-brand-50/40 transition-colors relative"
                                        title={val !== null && val !== undefined ? String(val) : 'NULL'}
                                      >
                                        {val === null || val === undefined ? (
                                          <span className="text-slate-400 italic">NULL</span>
                                        ) : typeof val === 'boolean' ? (
                                          val ? 'true' : 'false'
                                        ) : (
                                          String(val)
                                        )}
                                      </td>
                                    );
                                  })}
                                  {/* Row Actions: Edit (left), Duplicate (center), Delete (right) */}
                                  <td className="p-2.5 pr-4 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {/* Icon-only Edit button */}
                                      <button
                                        onClick={() => handleStartEditRow(row)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                                        title="Edit Row (Full Editor)"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      {/* Icon-only Duplicate button */}
                                      <button
                                        onClick={() => handleDuplicateRow(row)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                        title="Duplicate Row"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                      {/* Icon-only Delete button */}
                                      <button
                                        onClick={() => handleDeleteRow(row)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                        title="Delete Row"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. TABLE STRUCTURE TAB */}
                {activeTab === 'structure' && (
                  <div className="space-y-4">
                    <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
                      <table className="w-full text-left border-collapse text-xs font-mono">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px]">
                          <tr>
                            <th className="p-3 pl-4">Column Name</th>
                            <th className="p-3">Data Type</th>
                            <th className="p-3">Nullable</th>
                            <th className="p-3">Key</th>
                            <th className="p-3">Default</th>
                            <th className="p-3 pr-4">Extra</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px]">
                          {structure.map((col) => (
                            <tr key={col.name} className="hover:bg-slate-50/70">
                              <td className="p-3 pl-4 font-bold text-slate-900 flex items-center gap-2">
                                {col.isPrimaryKey && <Key className="w-3.5 h-3.5 text-amber-500" />}
                                <span>{col.name}</span>
                              </td>
                              <td className="p-3 text-slate-600">{col.type}</td>
                              <td className="p-3">
                                {col.nullable ? (
                                  <span className="text-emerald-600 font-semibold">YES</span>
                                ) : (
                                  <span className="text-slate-400">NO</span>
                                )}
                              </td>
                              <td className="p-3">
                                {col.isPrimaryKey ? (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                                    PRIMARY
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="p-3 text-slate-500">{col.defaultValue || 'NULL'}</td>
                              <td className="p-3 pr-4 text-slate-500">{col.extra || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. SQL CONSOLE TAB */}
                {activeTab === 'sql' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">SQL Query Editor</span>
                          <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200/60">
                            Context-Aware Autocomplete
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">Press Ctrl+Enter to execute • Tab / Enter to complete</span>
                      </div>

                      {/* Main Editor Card */}
                      <div className="rounded-2xl overflow-hidden border border-slate-200/90 shadow-xs bg-slate-50/50 relative focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all">
                        {/* Editor Canvas (Twin Layer: pre for highlighting + textarea for input) */}
                        <div className="relative min-h-[140px] max-h-[300px] overflow-hidden bg-white">
                          {/* Syntax Highlighting Layer */}
                          <pre
                            ref={sqlPreRef}
                            aria-hidden="true"
                            className="absolute inset-0 p-4 font-mono text-xs leading-[22px] whitespace-pre-wrap break-words pointer-events-none overflow-hidden select-none bg-transparent m-0 border-0"
                          >
                            {renderHighlightedSql(sqlQuery)}
                          </pre>

                          {/* Transparent Interactive Textarea Layer */}
                          <textarea
                            ref={sqlTextareaRef}
                            value={sqlQuery}
                            onChange={(e) => {
                              setSqlQuery(e.target.value);
                              updateSqlSuggestions(e.target.value, e.target.selectionStart);
                            }}
                            onClick={(e) => updateSqlSuggestions(sqlQuery, e.currentTarget.selectionStart)}
                            onKeyUp={(e) => {
                              if (!['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
                                updateSqlSuggestions(sqlQuery, e.currentTarget.selectionStart);
                              }
                            }}
                            onKeyDown={handleSqlEditorKeyDown}
                            onScroll={(e) => {
                              if (sqlPreRef.current) {
                                sqlPreRef.current.scrollTop = e.currentTarget.scrollTop;
                                sqlPreRef.current.scrollLeft = e.currentTarget.scrollLeft;
                              }
                            }}
                            rows={6}
                            spellCheck={false}
                            className="relative w-full h-full min-h-[140px] p-4 font-mono text-xs leading-[22px] bg-transparent text-transparent caret-brand-600 outline-none resize-y whitespace-pre-wrap break-words z-10"
                            placeholder="SELECT * FROM table_name LIMIT 50;"
                          />

                          {/* Floating Context-Aware Autocomplete Menu */}
                          {showSqlSuggestions && sqlSuggestions.length > 0 && (
                            <div
                              style={{ top: `${suggestionCoords.top}px`, left: `${suggestionCoords.left}px` }}
                              className="absolute z-30 bg-white border border-slate-200 rounded-xl shadow-modal py-1 min-w-[210px] max-w-sm animate-fade-in"
                            >
                              <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                                <span>Suggestions</span>
                                <span className="font-mono text-[9px] text-slate-400">↑↓ to pick • Tab/Enter</span>
                              </div>
                              <div className="max-h-48 overflow-y-auto">
                                {sqlSuggestions.map((s, idx) => (
                                  <button
                                    key={s.label + idx}
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      applySqlSuggestion(s);
                                    }}
                                    className={`w-full px-2.5 py-1.5 flex items-center justify-between text-left text-xs transition-colors ${
                                      idx === selectedSuggestionIdx
                                        ? 'bg-brand-50 text-brand-700 font-bold'
                                        : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {s.type === 'table' ? (
                                        <span className="w-5 h-5 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                                          <TableIcon className="w-3 h-3" />
                                        </span>
                                      ) : s.type === 'column' ? (
                                        <span className="w-5 h-5 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                                          <Key className="w-3 h-3" />
                                        </span>
                                      ) : s.type === 'function' ? (
                                        <span className="w-5 h-5 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                                          <Code2 className="w-3 h-3" />
                                        </span>
                                      ) : (
                                        <span className="w-5 h-5 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                                          <Sparkles className="w-3 h-3" />
                                        </span>
                                      )}
                                      <span className="font-mono text-xs truncate">{s.label}</span>
                                    </div>
                                    {s.detail && (
                                      <span className="text-[10px] text-slate-400 font-normal pl-2 shrink-0">
                                        {s.detail}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Editor Footer Bar */}
                        <div className="bg-slate-50/80 px-4 py-2.5 flex items-center justify-between border-t border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500 font-mono">
                              Database: <strong className="text-slate-700">{database.name}</strong>
                            </span>
                            {selectedTable && (
                              <button
                                type="button"
                                onClick={() => {
                                  const q = `SELECT * FROM \`${selectedTable}\` LIMIT 50;`;
                                  setSqlQuery(q);
                                  setShowSqlSuggestions(false);
                                }}
                                className="text-[11px] font-semibold text-brand-600 hover:text-brand-800 hover:underline ml-2"
                              >
                                Select * from {selectedTable}
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSqlQuery('');
                                setQueryResult(null);
                                setShowSqlSuggestions(false);
                              }}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                              Clear
                            </button>
                            <button
                              onClick={handleRunQuery}
                              disabled={isExecutingSql}
                              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition-smooth disabled:opacity-50"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>{isExecutingSql ? 'Executing...' : 'Run Query'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Query Results */}
                    {queryResult && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-3 text-xs">
                          <span className="font-bold text-slate-800">Query Result</span>
                          {queryResult.error ? (
                            <span className="text-rose-600 font-medium flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Error in query execution</span>
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-medium flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>Executed in {queryResult.executionTimeMs}ms • {queryResult.rows.length} row(s) returned</span>
                            </span>
                          )}
                        </div>

                        {queryResult.error ? (
                          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-mono text-xs">
                            {queryResult.error}
                          </div>
                        ) : queryResult.columns.length > 0 ? (
                          <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs max-h-80 overflow-auto">
                            <table className="w-full text-left border-collapse text-xs font-mono text-[11px]">
                              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                                <tr>
                                  {queryResult.columns.map((c) => (
                                    <th key={c} className="p-2.5 font-bold">{c}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {queryResult.rows.map((r, i) => (
                                  <tr key={i} className="hover:bg-slate-50">
                                    {queryResult.columns.map((c) => (
                                      <td key={c} className="p-2.5 text-slate-800">{String(r[c] ?? 'NULL')}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs">
                            Query executed successfully. Affected rows: {queryResult.affectedRows || 0}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. TABLE INFO TAB */}
                {activeTab === 'info' && selectedTableInfo && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/70">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Engine</span>
                      <p className="text-base font-bold text-slate-800 mt-1">{selectedTableInfo.engine}</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/70">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Collation</span>
                      <p className="text-base font-bold text-slate-800 mt-1 font-mono text-xs">{selectedTableInfo.collation}</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/70">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Rows</span>
                      <p className="text-base font-bold text-slate-800 mt-1">{selectedTableInfo.rowCount}</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/70">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Data Size</span>
                      <p className="text-base font-bold text-slate-800 mt-1">{Math.round(selectedTableInfo.dataSize / 1024)} KB</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center h-full">
              <Database className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-700">Select a table to begin</p>
              <p className="text-xs text-slate-400 mt-1">Choose a table from the sidebar treeview to browse data, edit schema, or run SQL queries.</p>
            </div>
          )}
        </main>
      </div>

      {/* FLOATING INLINE CELL EDITOR PINNED TO CELL UPPER-LEFT BOUNDARY */}
      {inlineEdit && inlineEdit.isFloating && (
        <div
          style={{
            top: `${inlineEdit.rect.top}px`,
            left: `${inlineEdit.rect.left}px`,
            minWidth: `${inlineEdit.rect.width}px`
          }}
          className="fixed z-50 bg-white rounded-2xl border-2 border-brand-600 shadow-modal p-3 space-y-2 animate-fade-in"
        >
          {/* Header */}
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pb-1 border-b border-slate-100">
            <span className="font-bold text-slate-800">{inlineEdit.colName}</span>
            <button
              onClick={() => setInlineEdit(null)}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Input or Textarea */}
          {inlineEdit.isNull ? (
            <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-400 italic">
              NULL Value
            </div>
          ) : inlineEdit.value.length > 50 || inlineEdit.value.includes('\n') ? (
            <textarea
              ref={inlineInputRef as any}
              rows={4}
              autoFocus
              value={inlineEdit.value}
              onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveInline();
                } else if (e.key === 'Escape') {
                  setInlineEdit(null);
                }
              }}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 resize-y"
            />
          ) : (
            <input
              ref={inlineInputRef as any}
              type="text"
              autoFocus
              value={inlineEdit.value}
              onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveInline();
                } else if (e.key === 'Escape') {
                  setInlineEdit(null);
                }
              }}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
            />
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
            <label className="flex items-center gap-1 text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={inlineEdit.isNull}
                onChange={(e) => setInlineEdit({ ...inlineEdit, isNull: e.target.checked })}
                className="rounded border-slate-300 text-brand-600 focus:ring-0 w-3.5 h-3.5"
              />
              <span>Set NULL</span>
            </label>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setInlineEdit(null)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveInline}
                disabled={isSavingInline}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold transition-smooth"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSERT ROW MODAL */}
      {showInsertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-modal w-full max-w-lg border border-slate-200/80 p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900 font-mono">
                  Insert Row into {selectedTable}
                </h3>
              </div>
              <button
                onClick={() => setShowInsertModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {insertError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {insertError}
              </div>
            )}

            <form onSubmit={handleInsertRow} className="space-y-3 overflow-y-auto flex-1 pr-1">
              {structure.map((col) => {
                const isAuto = col.extra?.includes('auto_increment');
                return (
                  <div key={col.name}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-mono font-bold text-slate-700">
                        {col.name} {col.isPrimaryKey && <span className="text-amber-500">(PK)</span>}
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">{col.type}</span>
                    </div>
                    {isAuto ? (
                      <input
                        type="text"
                        disabled
                        value="(Auto Generated)"
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono bg-slate-50 text-slate-400 cursor-not-allowed"
                      />
                    ) : (
                      <input
                        type="text"
                        value={newRowData[col.name] ?? ''}
                        onChange={(e) =>
                          setNewRowData((prev) => ({ ...prev, [col.name]: e.target.value }))
                        }
                        placeholder={col.defaultValue ? `Default: ${col.defaultValue}` : col.nullable ? 'NULL' : 'Value'}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
                      />
                    )}
                  </div>
                );
              })}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInsertModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInserting}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-smooth disabled:opacity-50"
                >
                  {isInserting ? 'Inserting...' : 'Insert Row'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
