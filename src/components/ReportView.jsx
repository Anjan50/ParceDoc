import { useState, useCallback, useMemo } from 'react';
import {
  FiFileText, FiDownload, FiTrash2, FiEdit3, FiCheck, FiX,
  FiChevronDown, FiChevronUp, FiUser, FiCalendar, FiMapPin,
  FiActivity, FiClipboard, FiAlertTriangle, FiPrinter,
} from 'react-icons/fi';
import { exportReportToCSV, exportReportToJSON, generateReportPDF } from '../utils/dataHelpers';
import './ReportView.css';

const DOC_TYPE_LABELS = {
  lab_report: 'Laboratory Report',
  radiology_report: 'Radiology Report',
  pathology_report: 'Pathology Report',
  prescription: 'Prescription',
  discharge_summary: 'Discharge Summary',
  clinical_notes: 'Clinical Notes',
  other: 'Clinical Document',
  unknown: 'Clinical Document',
};

const DOC_TYPE_COLORS = {
  lab_report: '#06b6d4',
  radiology_report: '#8b5cf6',
  pathology_report: '#f59e0b',
  prescription: '#10b981',
  discharge_summary: '#3b82f6',
  clinical_notes: '#ec4899',
  other: '#94a3b8',
  unknown: '#94a3b8',
};

function formatFieldLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getResultsArray(report) {
  const cd = report.clinical_data;
  if (cd?.results && Array.isArray(cd.results) && cd.results.length > 0) return cd.results;
  // Try nested clinical_data.clinical_data.results
  if (cd?.clinical_data?.results && Array.isArray(cd.clinical_data.results)) return cd.clinical_data.results;
  return [];
}

function getResultColumns(results) {
  if (!results.length) return [];
  const priority = ['test_name', 'test_code', 'result_value', 'result_unit', 'reference_range', 'abnormal_flag', 'medication_name', 'dosage', 'frequency', 'route'];
  const allKeys = new Set();
  results.forEach((r) => Object.keys(r).forEach((k) => allKeys.add(k)));
  const ordered = [];
  priority.forEach((k) => { if (allKeys.has(k)) { ordered.push(k); allKeys.delete(k); } });
  allKeys.forEach((k) => ordered.push(k));
  return ordered;
}

function buildInfoFields(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj).filter(([, v]) => v != null && v !== '');
}

export default function ReportView({ report, onUpdate, onDelete }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editingResultCell, setEditingResultCell] = useState(null);
  const [editResultValue, setEditResultValue] = useState('');

  const results = useMemo(() => getResultsArray(report), [report]);
  const resultColumns = useMemo(() => getResultColumns(results), [results]);
  const patientFields = useMemo(() => buildInfoFields(report.patient_info), [report.patient_info]);
  const facilityFields = useMemo(() => buildInfoFields(report.facility_info), [report.facility_info]);
  const metadataFields = useMemo(() => buildInfoFields(report.metadata), [report.metadata]);
  const docTypeLabel = DOC_TYPE_LABELS[report.document_type] || DOC_TYPE_LABELS.other;
  const docTypeColor = DOC_TYPE_COLORS[report.document_type] || DOC_TYPE_COLORS.other;

  // --- Editable info fields ---
  const startEditField = useCallback((section, key, value) => {
    setEditingField({ section, key });
    setEditValue(value || '');
  }, []);

  const saveField = useCallback(() => {
    if (!editingField) return;
    const { section, key } = editingField;
    const sectionData = { ...(report[section] || {}) };
    sectionData[key] = editValue;
    onUpdate(report.id, { [section]: sectionData });
    setEditingField(null);
    setEditValue('');
  }, [editingField, editValue, report, onUpdate]);

  const cancelField = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  // --- Editable result cells ---
  const startEditResult = useCallback((rowIdx, col, value) => {
    setEditingResultCell({ rowIdx, col });
    setEditResultValue(value || '');
  }, []);

  const saveResult = useCallback(() => {
    if (!editingResultCell) return;
    const { rowIdx, col } = editingResultCell;
    const updatedResults = results.map((r, i) =>
      i === rowIdx ? { ...r, [col]: editResultValue } : r
    );
    const updatedClinicalData = { ...(report.clinical_data || {}), results: updatedResults };
    onUpdate(report.id, { clinical_data: updatedClinicalData });
    setEditingResultCell(null);
    setEditResultValue('');
  }, [editingResultCell, editResultValue, results, report, onUpdate]);

  const cancelResult = useCallback(() => {
    setEditingResultCell(null);
    setEditResultValue('');
  }, []);

  const handleKeyDown = useCallback((e, saveFn, cancelFn) => {
    if (e.key === 'Enter') saveFn();
    else if (e.key === 'Escape') cancelFn();
  }, []);

  // --- Renders ---
  const renderEditableField = (section, key, value) => {
    const isEditing = editingField?.section === section && editingField?.key === key;
    if (isEditing) {
      return (
        <div className="rv-field-edit">
          <input
            className="rv-field-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, saveField, cancelField)}
            autoFocus
          />
          <button className="rv-field-btn rv-field-save" onClick={saveField}><FiCheck /></button>
          <button className="rv-field-btn rv-field-cancel" onClick={cancelField}><FiX /></button>
        </div>
      );
    }
    return (
      <div
        className="rv-field-value"
        onDoubleClick={() => startEditField(section, key, value)}
        title="Double-click to edit"
      >
        {value || '—'}
        <FiEdit3 className="rv-field-edit-icon" />
      </div>
    );
  };

  const getFlagClass = (flag) => {
    if (!flag) return '';
    const f = String(flag).toUpperCase();
    if (f === 'HIGH' || f === 'H' || f === 'CRITICAL' || f === 'ABNORMAL') return 'rv-flag-high';
    if (f === 'LOW' || f === 'L') return 'rv-flag-low';
    return '';
  };

  return (
    <div className="rv-report">
      {/* Report Header */}
      <div className="rv-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="rv-header-left">
          <span className="rv-type-badge" style={{ backgroundColor: docTypeColor + '22', color: docTypeColor, borderColor: docTypeColor + '44' }}>
            {docTypeLabel}
          </span>
          <span className="rv-vendor-badge">{report.vendor}</span>
          <span className="rv-source-file">
            <FiFileText /> {report.source_file}
          </span>
        </div>
        <div className="rv-header-right">
          <span className="rv-date">{new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
        </div>
      </div>

      {isExpanded && (
        <div className="rv-body">
          {/* Info Cards */}
          <div className="rv-info-grid">
            {/* Patient Info */}
            {patientFields.length > 0 && (
              <div className="rv-info-card">
                <div className="rv-info-card-header">
                  <FiUser className="rv-info-icon" />
                  <h3 className="rv-info-title">Patient Information</h3>
                </div>
                <div className="rv-info-fields">
                  {patientFields.map(([key, value]) => (
                    <div key={key} className="rv-field">
                      <label className="rv-field-label">{formatFieldLabel(key)}</label>
                      {renderEditableField('patient_info', key, value)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Facility Info */}
            {facilityFields.length > 0 && (
              <div className="rv-info-card">
                <div className="rv-info-card-header">
                  <FiMapPin className="rv-info-icon" />
                  <h3 className="rv-info-title">Facility</h3>
                </div>
                <div className="rv-info-fields">
                  {facilityFields.map(([key, value]) => (
                    <div key={key} className="rv-field">
                      <label className="rv-field-label">{formatFieldLabel(key)}</label>
                      {renderEditableField('facility_info', key, value)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            {metadataFields.length > 0 && (
              <div className="rv-info-card">
                <div className="rv-info-card-header">
                  <FiCalendar className="rv-info-icon" />
                  <h3 className="rv-info-title">Report Details</h3>
                </div>
                <div className="rv-info-fields">
                  {metadataFields.map(([key, value]) => (
                    <div key={key} className="rv-field">
                      <label className="rv-field-label">{formatFieldLabel(key)}</label>
                      {renderEditableField('metadata', key, value)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Results Table */}
          {results.length > 0 && (
            <div className="rv-results-section">
              <div className="rv-results-header">
                <div className="rv-results-title-row">
                  <FiActivity className="rv-results-icon" />
                  <h3 className="rv-results-title">
                    {report.document_type === 'prescription' ? 'Medications' : 'Test Results'}
                  </h3>
                  <span className="rv-results-count">{results.length} items</span>
                </div>
              </div>

              <div className="rv-table-scroll">
                <table className="rv-table">
                  <thead>
                    <tr>
                      <th className="rv-th rv-th-num">#</th>
                      {resultColumns.map((col) => (
                        <th key={col} className="rv-th">{formatFieldLabel(col)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row, rowIdx) => (
                      <tr key={rowIdx} className="rv-tr">
                        <td className="rv-td rv-td-num">{rowIdx + 1}</td>
                        {resultColumns.map((col) => {
                          const isEditing = editingResultCell?.rowIdx === rowIdx && editingResultCell?.col === col;
                          const val = row[col] != null ? String(row[col]) : '';
                          const flagClass = col === 'abnormal_flag' ? getFlagClass(val) : '';

                          return (
                            <td
                              key={col}
                              className={`rv-td ${flagClass} ${isEditing ? 'rv-td-editing' : ''}`}
                              onDoubleClick={() => !isEditing && startEditResult(rowIdx, col, val)}
                            >
                              {isEditing ? (
                                <div className="rv-cell-edit">
                                  <input
                                    className="rv-cell-input"
                                    value={editResultValue}
                                    onChange={(e) => setEditResultValue(e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, saveResult, cancelResult)}
                                    autoFocus
                                  />
                                  <button className="rv-cell-btn" onClick={saveResult}><FiCheck /></button>
                                  <button className="rv-cell-btn rv-cell-btn-cancel" onClick={cancelResult}><FiX /></button>
                                </div>
                              ) : (
                                <span className="rv-cell-text" title="Double-click to edit">
                                  {col === 'abnormal_flag' && val ? (
                                    <span className="rv-flag-pill">
                                      {(val === 'HIGH' || val === 'H') && <FiAlertTriangle />}
                                      {val}
                                    </span>
                                  ) : (
                                    val || '—'
                                  )}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Non-tabular clinical data for radiology, notes, etc. */}
          {results.length === 0 && report.clinical_data && (
            <div className="rv-clinical-notes">
              <div className="rv-results-header">
                <div className="rv-results-title-row">
                  <FiClipboard className="rv-results-icon" />
                  <h3 className="rv-results-title">Clinical Details</h3>
                </div>
              </div>
              <div className="rv-notes-content">
                {Object.entries(report.clinical_data)
                  .filter(([, v]) => v != null && v !== '' && typeof v !== 'object')
                  .map(([key, value]) => (
                    <div key={key} className="rv-field rv-field-wide">
                      <label className="rv-field-label">{formatFieldLabel(key)}</label>
                      {renderEditableField('clinical_data', key, String(value))}
                    </div>
                  ))}
                {/* Handle nested objects in clinical_data */}
                {Object.entries(report.clinical_data)
                  .filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v))
                  .map(([key, obj]) => (
                    <div key={key} className="rv-notes-subsection">
                      <h4 className="rv-notes-subheading">{formatFieldLabel(key)}</h4>
                      {Object.entries(obj)
                        .filter(([, v]) => v != null && v !== '' && typeof v !== 'object')
                        .map(([k, v]) => (
                          <div key={k} className="rv-field rv-field-wide">
                            <label className="rv-field-label">{formatFieldLabel(k)}</label>
                            <div className="rv-field-value">{String(v)}</div>
                          </div>
                        ))}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Export / Action Bar */}
          <div className="rv-actions">
            <div className="rv-actions-left">
              <button className="rv-action-btn rv-action-export" onClick={() => exportReportToCSV(report)}>
                <FiDownload /> CSV
              </button>
              <button className="rv-action-btn rv-action-export" onClick={() => exportReportToJSON(report)}>
                <FiDownload /> JSON
              </button>
              <button className="rv-action-btn rv-action-pdf" onClick={() => generateReportPDF(report)}>
                <FiPrinter /> PDF Report
              </button>
            </div>
            <div className="rv-actions-right">
              <button className="rv-action-btn rv-action-delete" onClick={() => onDelete(report.id)}>
                <FiTrash2 /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
