import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  FiEdit2, FiTrash2, FiCheck, FiX, FiSearch, FiDownload,
  FiPlus, FiChevronUp, FiChevronDown, FiCopy, FiColumns,
  FiMoreVertical, FiCheckSquare, FiSquare,
  FiChevronsLeft, FiChevronsRight, FiChevronLeft, FiChevronRight,
} from 'react-icons/fi';
import { searchRecords, sortRecords, exportToCSV, exportToJSON, copyToClipboard } from '../utils/dataHelpers';
import './DataTable.css';

function formatColumnName(col) {
  return col
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DataTable({
  records,
  columns,
  onUpdateRecord,
  onDeleteRecord,
  onDeleteRecords,
  onAddRecord,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [visibleColumns, setVisibleColumns] = useState(new Set(columns));
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const editInputRef = useRef(null);
  const columnPickerRef = useRef(null);
  const exportMenuRef = useRef(null);

  // Sync visibleColumns when columns change
  useEffect(() => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      columns.forEach((c) => {
        if (!prev.has(c) && prev.size === 0) next.add(c);
      });
      // For fresh data, show all columns
      if (prev.size === 0) return new Set(columns);
      // Add any new columns
      columns.forEach((c) => {
        if (!next.has(c)) next.add(c);
      });
      return next;
    });
  }, [columns]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target)) {
        setShowColumnPicker(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Focus edit input
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Computed
  const filteredRecords = useMemo(
    () => searchRecords(records, searchQuery),
    [records, searchQuery]
  );

  const sortedRecords = useMemo(
    () => sortRecords(filteredRecords, sortField, sortDirection),
    [filteredRecords, sortField, sortDirection]
  );

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / rowsPerPage));

  // Clamp current page
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedRecords = useMemo(
    () => sortedRecords.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage),
    [sortedRecords, currentPage, rowsPerPage]
  );

  const allSelected =
    paginatedRecords.length > 0 &&
    paginatedRecords.every((r) => selectedRows.has(r.id));

  // Handlers
  const handleSort = useCallback((field) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortDirection('asc');
      return field;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        paginatedRecords.forEach((r) => next.delete(r.id));
      } else {
        paginatedRecords.forEach((r) => next.add(r.id));
      }
      return next;
    });
  }, [allSelected, paginatedRecords]);

  const handleSelectRow = useCallback((id) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const startEditing = useCallback((recordId, field, currentValue) => {
    setEditingCell({ recordId, field });
    setEditValue(currentValue || '');
  }, []);

  const saveEdit = useCallback(() => {
    if (editingCell) {
      onUpdateRecord(editingCell.recordId, { [editingCell.field]: editValue });
      setEditingCell(null);
      setEditValue('');
    }
  }, [editingCell, editValue, onUpdateRecord]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') saveEdit();
      else if (e.key === 'Escape') cancelEdit();
    },
    [saveEdit, cancelEdit]
  );

  const handleBulkDelete = useCallback(() => {
    onDeleteRecords([...selectedRows]);
    setSelectedRows(new Set());
  }, [selectedRows, onDeleteRecords]);

  const handleExportCSV = useCallback(() => {
    const visibleCols = columns.filter((c) => visibleColumns.has(c));
    exportToCSV(sortedRecords, visibleCols);
    setShowExportMenu(false);
  }, [sortedRecords, columns, visibleColumns]);

  const handleExportJSON = useCallback(() => {
    exportToJSON(sortedRecords);
    setShowExportMenu(false);
  }, [sortedRecords]);

  const handleCopyData = useCallback(() => {
    const visibleCols = columns.filter((c) => visibleColumns.has(c));
    const header = visibleCols.map(formatColumnName).join('\t');
    const rows = sortedRecords.map((r) => visibleCols.map((c) => r[c] || '').join('\t'));
    copyToClipboard([header, ...rows].join('\n'));
    setShowExportMenu(false);
  }, [sortedRecords, columns, visibleColumns]);

  const toggleColumn = useCallback((col) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) {
        if (next.size > 1) next.delete(col);
      } else {
        next.add(col);
      }
      return next;
    });
  }, []);

  const displayedColumns = columns.filter((c) => visibleColumns.has(c));

  const startRecord = (currentPage - 1) * rowsPerPage + 1;
  const endRecord = Math.min(currentPage * rowsPerPage, sortedRecords.length);

  // Page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="dt-container">
      {/* Toolbar */}
      <div className="dt-toolbar">
        <div className="dt-toolbar-left">
          <div className="dt-search-wrapper">
            <FiSearch className="dt-search-icon" />
            <input
              type="text"
              className="dt-search-input"
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchQuery && (
              <button className="dt-search-clear" onClick={() => setSearchQuery('')}>
                <FiX />
              </button>
            )}
          </div>
        </div>

        <div className="dt-toolbar-right">
          {/* Column Picker */}
          <div className="dt-dropdown" ref={columnPickerRef}>
            <button
              className="dt-toolbar-btn"
              onClick={() => {
                setShowColumnPicker(!showColumnPicker);
                setShowExportMenu(false);
              }}
              title="Toggle columns"
            >
              <FiColumns />
            </button>
            {showColumnPicker && (
              <div className="dt-dropdown-menu dt-column-picker">
                <p className="dt-dropdown-title">Visible Columns</p>
                {columns.map((col) => (
                  <label key={col} className="dt-column-option">
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(col)}
                      onChange={() => toggleColumn(col)}
                    />
                    <span>{formatColumnName(col)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Export */}
          <div className="dt-dropdown" ref={exportMenuRef}>
            <button
              className="dt-toolbar-btn"
              onClick={() => {
                setShowExportMenu(!showExportMenu);
                setShowColumnPicker(false);
              }}
              title="Export data"
            >
              <FiDownload />
            </button>
            {showExportMenu && (
              <div className="dt-dropdown-menu">
                <button className="dt-dropdown-item" onClick={handleExportCSV}>
                  <FiDownload /> Export CSV
                </button>
                <button className="dt-dropdown-item" onClick={handleExportJSON}>
                  <FiDownload /> Export JSON
                </button>
                <button className="dt-dropdown-item" onClick={handleCopyData}>
                  <FiCopy /> Copy to Clipboard
                </button>
              </div>
            )}
          </div>

          {/* Add Row */}
          <button className="dt-toolbar-btn dt-toolbar-btn-accent" onClick={onAddRecord} title="Add record">
            <FiPlus />
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedRows.size > 0 && (
        <div className="dt-bulk-bar">
          <span className="dt-bulk-count">{selectedRows.size} selected</span>
          <button className="dt-bulk-btn dt-bulk-btn-danger" onClick={handleBulkDelete}>
            <FiTrash2 /> Delete
          </button>
          <button className="dt-bulk-btn" onClick={() => setSelectedRows(new Set())}>
            Deselect All
          </button>
        </div>
      )}

      {/* Table */}
      <div className="dt-table-wrapper">
        {records.length === 0 ? (
          <div className="dt-empty">
            <FiSearch className="dt-empty-icon" />
            <p className="dt-empty-title">No records yet</p>
            <p className="dt-empty-text">Upload clinical documents to extract and view data here.</p>
          </div>
        ) : sortedRecords.length === 0 ? (
          <div className="dt-empty">
            <FiSearch className="dt-empty-icon" />
            <p className="dt-empty-title">No matching records</p>
            <p className="dt-empty-text">Try adjusting your search query.</p>
          </div>
        ) : (
          <div className="dt-scroll">
            <table className="dt-table">
              <thead>
                <tr>
                  <th className="dt-th dt-th-checkbox">
                    <button className="dt-checkbox-btn" onClick={handleSelectAll} aria-label="Select all">
                      {allSelected ? <FiCheckSquare /> : <FiSquare />}
                    </button>
                  </th>
                  {displayedColumns.map((col) => (
                    <th key={col} className="dt-th" onClick={() => handleSort(col)}>
                      <span className="dt-th-content">
                        {formatColumnName(col)}
                        <span className="dt-sort-icons">
                          {sortField === col ? (
                            sortDirection === 'asc' ? <FiChevronUp /> : <FiChevronDown />
                          ) : (
                            <FiChevronUp className="dt-sort-inactive" />
                          )}
                        </span>
                      </span>
                    </th>
                  ))}
                  <th className="dt-th dt-th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map((record) => {
                  const isSelected = selectedRows.has(record.id);
                  return (
                    <tr
                      key={record.id}
                      className={`dt-row ${isSelected ? 'dt-row-selected' : ''}`}
                    >
                      <td className="dt-td dt-td-checkbox">
                        <button
                          className="dt-checkbox-btn"
                          onClick={() => handleSelectRow(record.id)}
                          aria-label={`Select row ${record.id}`}
                        >
                          {isSelected ? <FiCheckSquare /> : <FiSquare />}
                        </button>
                      </td>
                      {displayedColumns.map((col) => {
                        const isEditing =
                          editingCell?.recordId === record.id &&
                          editingCell?.field === col;

                        return (
                          <td
                            key={col}
                            className={`dt-td ${isEditing ? 'dt-td-editing' : ''}`}
                            onDoubleClick={() =>
                              !isEditing && startEditing(record.id, col, record[col])
                            }
                          >
                            {isEditing ? (
                              <div className="dt-edit-cell">
                                <input
                                  ref={editInputRef}
                                  className="dt-edit-input"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={handleKeyDown}
                                />
                                <button className="dt-edit-btn dt-edit-save" onClick={saveEdit}>
                                  <FiCheck />
                                </button>
                                <button className="dt-edit-btn dt-edit-cancel" onClick={cancelEdit}>
                                  <FiX />
                                </button>
                              </div>
                            ) : (
                              <span className="dt-cell-text" title={record[col] || ''}>
                                {record[col] || '—'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="dt-td dt-td-actions">
                        <div className="dt-action-btns">
                          <button
                            className="dt-action-btn"
                            onClick={() => {
                              const firstCol = displayedColumns[0];
                              if (firstCol) startEditing(record.id, firstCol, record[firstCol]);
                            }}
                            title="Edit"
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            className="dt-action-btn dt-action-btn-danger"
                            onClick={() => onDeleteRecord(record.id)}
                            title="Delete"
                          >
                            <FiTrash2 />
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
      </div>

      {/* Pagination */}
      {sortedRecords.length > 0 && (
        <div className="dt-pagination">
          <div className="dt-pagination-info">
            Showing {startRecord} to {endRecord} of {sortedRecords.length} records
          </div>

          <div className="dt-pagination-controls">
            <select
              className="dt-per-page"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>

            <div className="dt-page-btns">
              <button
                className="dt-page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                title="First page"
              >
                <FiChevronsLeft />
              </button>
              <button
                className="dt-page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                title="Previous page"
              >
                <FiChevronLeft />
              </button>

              {getPageNumbers().map((page) => (
                <button
                  key={page}
                  className={`dt-page-btn ${page === currentPage ? 'dt-page-btn-active' : ''}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}

              <button
                className="dt-page-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                title="Next page"
              >
                <FiChevronRight />
              </button>
              <button
                className="dt-page-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                title="Last page"
              >
                <FiChevronsRight />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
