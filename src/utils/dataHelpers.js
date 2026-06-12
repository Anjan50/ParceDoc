/**
 * Data Manipulation Utilities
 *
 * Export, search, sort, and transform helpers for clinical data records.
 */

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

/**
 * Escape a cell value for CSV output.
 * Wraps in double-quotes if the value contains commas, quotes, or newlines.
 * @param {*} value
 * @returns {string}
 */
function escapeCSVCell(value) {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Trigger a browser file download with the given content.
 * @param {string} content  - file body
 * @param {string} fileName - suggested filename
 * @param {string} mimeType - MIME type for the blob
 */
function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate a CSV file from records and trigger a browser download.
 *
 * @param {object[]} records - array of flat record objects
 * @param {string[]} columns - ordered column keys to include
 */
export function exportToCSV(records, columns) {
  if (!records?.length || !columns?.length) return;

  const headerRow = columns.map(escapeCSVCell).join(',');

  const dataRows = records.map((record) =>
    columns.map((col) => escapeCSVCell(record[col])).join(','),
  );

  const csv = [headerRow, ...dataRows].join('\n');
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadFile(csv, `parcedoc_export_${timestamp}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Pretty-print records as JSON and trigger a browser download.
 *
 * @param {object[]} records
 */
export function exportToJSON(records) {
  if (!records?.length) return;
  const json = JSON.stringify(records, null, 2);
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadFile(json, `parcedoc_export_${timestamp}.json`, 'application/json');
}

// ---------------------------------------------------------------------------
// Report-level exports
// ---------------------------------------------------------------------------

function formatLabel(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Export a single report's results as CSV.
 */
export function exportReportToCSV(report) {
  const results = report.clinical_data?.results;
  if (!results?.length) return;
  const cols = Object.keys(results[0]);
  const header = cols.map(escapeCSVCell).join(',');
  const rows = results.map((r) => cols.map((c) => escapeCSVCell(r[c])).join(','));
  const csv = [header, ...rows].join('\n');
  const name = (report.patient_info?.patient_name || 'report').replace(/\s+/g, '_');
  downloadFile(csv, `${name}_results.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Export a single report as JSON.
 */
export function exportReportToJSON(report) {
  const clean = { ...report };
  delete clean.raw;
  delete clean.id;
  const json = JSON.stringify(clean, null, 2);
  const name = (report.patient_info?.patient_name || 'report').replace(/\s+/g, '_');
  downloadFile(json, `${name}_report.json`, 'application/json');
}

/**
 * Generate a professional clinical PDF report by opening a styled HTML document
 * in a new window and triggering the browser print dialog.
 */
export function generateReportPDF(report) {
  const patientName = report.patient_info?.patient_name || 'Unknown Patient';
  const facility = report.facility_info?.facility_name || report.vendor || 'Clinical Facility';
  const facilityAddr = report.facility_info?.facility_address || '';
  const docType = (report.document_type || 'clinical_document').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const results = report.clinical_data?.results || [];
  const resultCols = results.length > 0 ? Object.keys(results[0]) : [];

  // Patient fields
  const patientFields = Object.entries(report.patient_info || {})
    .filter(([, v]) => v != null && v !== '');
  const metaFields = Object.entries(report.metadata || {})
    .filter(([, v]) => v != null && v !== '');

  // Build results table rows
  const resultRows = results.map((row, i) => {
    const cells = resultCols.map((col) => {
      const val = row[col] != null ? String(row[col]) : '';
      const flag = String(row.abnormal_flag || '').toUpperCase();
      const isFlag = col === 'abnormal_flag';
      const isValue = col === 'result_value';
      let style = '';
      if (isFlag && (flag === 'HIGH' || flag === 'H')) style = 'color:#dc2626;font-weight:700;';
      else if (isFlag && (flag === 'LOW' || flag === 'L')) style = 'color:#2563eb;font-weight:700;';
      else if (isValue && (flag === 'HIGH' || flag === 'H' || flag === 'LOW' || flag === 'L')) style = 'font-weight:600;';
      return `<td style="${style}">${val}</td>`;
    }).join('');
    return `<tr><td style="text-align:center;color:#94a3b8;">${i + 1}</td>${cells}</tr>`;
  }).join('');

  // Non-tabular clinical data for non-lab reports
  let clinicalNotes = '';
  if (results.length === 0 && report.clinical_data) {
    const entries = Object.entries(report.clinical_data)
      .filter(([, v]) => v != null && typeof v !== 'object');
    if (entries.length > 0) {
      clinicalNotes = entries.map(([k, v]) =>
        `<div style="margin-bottom:12px;">
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;">${formatLabel(k)}</div>
          <div style="font-size:13px;color:#1e293b;">${v}</div>
        </div>`
      ).join('');
    }
    // Nested objects
    Object.entries(report.clinical_data)
      .filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v))
      .forEach(([key, obj]) => {
        clinicalNotes += `<h4 style="margin:16px 0 8px;font-size:13px;color:#0891b2;">${formatLabel(key)}</h4>`;
        Object.entries(obj).filter(([, v]) => v != null && typeof v !== 'object').forEach(([k, v]) => {
          clinicalNotes += `<div style="margin-bottom:8px;">
            <span style="font-size:10px;color:#64748b;text-transform:uppercase;">${formatLabel(k)}:</span>
            <span style="font-size:13px;color:#1e293b;margin-left:6px;">${v}</span>
          </div>`;
        });
      });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${patientName} — ${docType}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; padding: 0; }
  .page { max-width: 800px; margin: 0 auto; padding: 40px 48px; }

  /* Header */
  .header { border-bottom: 3px solid #0891b2; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header-left { }
  .facility-name { font-size: 22px; font-weight: 700; color: #0891b2; margin-bottom: 2px; }
  .facility-addr { font-size: 12px; color: #64748b; }
  .header-right { text-align: right; }
  .doc-type-badge { display: inline-block; padding: 4px 14px; background: #f0fdfa; color: #0891b2; border: 1px solid #99f6e4; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .report-date { font-size: 11px; color: #94a3b8; margin-top: 6px; }

  /* Sections */
  .section { margin-bottom: 24px; }
  .section-title { font-size: 11px; font-weight: 700; color: #0891b2; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }

  /* Info grid */
  .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 24px; }
  .info-field { }
  .info-label { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 1px; }
  .info-value { font-size: 13px; font-weight: 500; color: #1e293b; }

  /* Results table */
  .results-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 4px; }
  .results-table th { background: #f1f5f9; text-align: left; padding: 8px 12px; font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0; }
  .results-table td { padding: 7px 12px; border-bottom: 1px solid #f1f5f9; }
  .results-table tr:hover { background: #f8fafc; }
  .results-table tr:nth-child(even) { background: #fafbfc; }

  /* Footer */
  .footer { margin-top: 40px; border-top: 2px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; align-items: center; }
  .footer-left { font-size: 10px; color: #94a3b8; }
  .footer-right { font-size: 10px; color: #94a3b8; }
  .footer-logo { font-weight: 700; color: #0891b2; font-size: 12px; }

  .confidential { text-align: center; font-size: 9px; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 20px; }

  @media print {
    body { padding: 0; }
    .page { padding: 24px 32px; max-width: none; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <div class="facility-name">${facility}</div>
      ${facilityAddr ? `<div class="facility-addr">${facilityAddr}</div>` : ''}
    </div>
    <div class="header-right">
      <div class="doc-type-badge">${docType}</div>
      <div class="report-date">Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
    </div>
  </div>

  <!-- Patient Information -->
  ${patientFields.length > 0 ? `
  <div class="section">
    <div class="section-title">Patient Information</div>
    <div class="info-grid">
      ${patientFields.map(([k, v]) => `
        <div class="info-field">
          <div class="info-label">${formatLabel(k)}</div>
          <div class="info-value">${v}</div>
        </div>
      `).join('')}
    </div>
  </div>` : ''}

  <!-- Report Details -->
  ${metaFields.length > 0 ? `
  <div class="section">
    <div class="section-title">Report Details</div>
    <div class="info-grid">
      ${metaFields.map(([k, v]) => `
        <div class="info-field">
          <div class="info-label">${formatLabel(k)}</div>
          <div class="info-value">${v}</div>
        </div>
      `).join('')}
    </div>
  </div>` : ''}

  <!-- Results -->
  ${results.length > 0 ? `
  <div class="section">
    <div class="section-title">${report.document_type === 'prescription' ? 'Medications' : 'Test Results'} (${results.length})</div>
    <table class="results-table">
      <thead>
        <tr>
          <th style="width:32px;text-align:center">#</th>
          ${resultCols.map((c) => `<th>${formatLabel(c)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${resultRows}
      </tbody>
    </table>
  </div>` : ''}

  <!-- Clinical Notes (non-tabular) -->
  ${clinicalNotes ? `
  <div class="section">
    <div class="section-title">Clinical Details</div>
    ${clinicalNotes}
  </div>` : ''}

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      <span class="footer-logo">ParceDoc</span> — Clinical Data Intelligence Platform<br>
      Source: ${report.source_file || 'N/A'} · Vendor: ${report.vendor || 'Unknown'}
    </div>
    <div class="footer-right">
      Report ID: ${report.id || 'N/A'}<br>
      Extracted: ${report.created_at ? new Date(report.created_at).toLocaleString() : 'N/A'}
    </div>
  </div>

  <div class="confidential">Confidential — Protected Health Information — HIPAA Compliant</div>

  <!-- Print Button (hidden on print) -->
  <div class="no-print" style="text-align:center;margin-top:24px;">
    <button onclick="window.print()" style="padding:10px 32px;background:#0891b2;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;">
      Print / Save as PDF
    </button>
  </div>
</div>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

// ---------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------

/**
 * Copy text to the clipboard.
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for older browsers / non-secure contexts
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

// ---------------------------------------------------------------------------
// Search & Sort
// ---------------------------------------------------------------------------

/**
 * Case-insensitive full-text search across all string fields of each record.
 *
 * @param {object[]} records
 * @param {string}   query
 * @returns {object[]} filtered array
 */
export function searchRecords(records, query) {
  if (!query?.trim()) return records;
  const lowerQuery = query.toLowerCase();

  return records.filter((record) =>
    Object.values(record).some((value) => {
      if (value == null) return false;
      return String(value).toLowerCase().includes(lowerQuery);
    }),
  );
}

/**
 * Sort records by a given field.
 *
 * @param {object[]} records
 * @param {string}   field     - record key to sort by
 * @param {'asc'|'desc'} direction
 * @returns {object[]} new sorted array (does not mutate input)
 */
export function sortRecords(records, field, direction = 'asc') {
  const dir = direction === 'desc' ? -1 : 1;

  return [...records].sort((a, b) => {
    let va = a[field] ?? '';
    let vb = b[field] ?? '';

    // Attempt numeric comparison
    const numA = Number(va);
    const numB = Number(vb);
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
      return (numA - numB) * dir;
    }

    // Fall back to locale-aware string comparison
    va = String(va).toLowerCase();
    vb = String(vb).toLowerCase();
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Format a date string into "MMM DD, YYYY".
 * Returns the original string unchanged if parsing fails.
 *
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr; // unparseable → pass through
  const month = MONTH_NAMES[d.getMonth()];
  const day = String(d.getDate()).padStart(2, '0');
  return `${month} ${day}, ${d.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// Data flattening
// ---------------------------------------------------------------------------

/**
 * Recursively flatten a nested object into a single-level object.
 * Nested keys are joined with underscores.
 *
 * @param {object} obj
 * @param {string} [prefix='']
 * @returns {Record<string, *>}
 */
function flattenObject(obj, prefix = '') {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}_${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, fullKey));
    } else if (Array.isArray(value)) {
      // Store primitive arrays as a joined string; object arrays are handled
      // elsewhere (results array).
      const allPrimitive = value.every(
        (v) => v == null || typeof v !== 'object',
      );
      if (allPrimitive) {
        result[fullKey] = value.join(', ');
      } else {
        result[fullKey] = JSON.stringify(value);
      }
    } else {
      result[fullKey] = value;
    }
  }

  return result;
}

/**
 * Transform the nested JSON object returned by Claude into flat tabular rows
 * suitable for a data-table component.
 *
 * @param {object} extractedData - parsed JSON from the API
 * @param {string} [sourceFile]  - original filename (added to each row)
 * @returns {{ columns: string[], rows: object[] }}
 */
export function flattenClinicalData(extractedData, sourceFile = '') {
  if (!extractedData || typeof extractedData !== 'object') {
    return { columns: [], rows: [] };
  }

  // Gather shared fields that should appear on every row.
  const shared = {};

  if (extractedData.document_type) {
    shared.document_type = extractedData.document_type;
  }
  if (extractedData.vendor) {
    shared.vendor = extractedData.vendor;
  }
  if (sourceFile) {
    shared.source_file = sourceFile;
  }

  // Flatten patient_info, facility_info, metadata into shared fields.
  if (extractedData.patient_info) {
    Object.assign(shared, flattenObject(extractedData.patient_info));
  }
  if (extractedData.facility_info) {
    Object.assign(shared, flattenObject(extractedData.facility_info));
  }
  if (extractedData.metadata) {
    Object.assign(shared, flattenObject(extractedData.metadata));
  }

  let rows = [];

  // If clinical_data.results is an array, each item becomes its own row.
  const results = extractedData.clinical_data?.results;
  if (Array.isArray(results) && results.length > 0) {
    rows = results.map((result) => {
      const flatResult = flattenObject(result);
      return { ...shared, ...flatResult };
    });
  } else {
    // No results array – flatten everything into a single row.
    const clinicalFlat = extractedData.clinical_data
      ? flattenObject(extractedData.clinical_data)
      : {};
    rows = [{ ...shared, ...clinicalFlat }];
  }

  // Derive column list from the union of all row keys (stable insertion order).
  const columnSet = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      columnSet.add(key);
    }
  }

  return { columns: [...columnSet], rows };
}

/**
 * Merge new column names into an existing ordered column list without
 * introducing duplicates. Existing order is preserved; new columns are
 * appended.
 *
 * @param {string[]} existingColumns
 * @param {string[]} newColumns
 * @returns {string[]} merged array
 */
export function mergeColumns(existingColumns, newColumns) {
  const set = new Set(existingColumns);
  const merged = [...existingColumns];

  for (const col of newColumns) {
    if (!set.has(col)) {
      set.add(col);
      merged.push(col);
    }
  }

  return merged;
}
