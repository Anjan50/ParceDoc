/**
 * LocalStorage Management Service
 *
 * Centralises all reads/writes to localStorage behind a clean API so the rest
 * of the app never touches localStorage directly.
 */

const KEYS = {
  API_KEY: 'parcedoc_api_key',
  RECORDS: 'parcedoc_records',
  COLUMNS: 'parcedoc_columns',
  REPORTS: 'parcedoc_reports',
  SETTINGS: 'parcedoc_settings',
  UPLOAD_HISTORY: 'parcedoc_upload_history',
};

const MAX_HISTORY = 50;
const ASSUMED_MAX_STORAGE = 5 * 1024 * 1024; // 5 MB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely parse a JSON string, returning `fallback` on failure.
 */
function safeParse(raw, fallback = null) {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Generate a unique record ID.
 * @returns {string} e.g. "rec_1718193600000_a3f9c2"
 */
export function generateId() {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `rec_${ts}_${rand}`;
}

// ---------------------------------------------------------------------------
// API Key
// ---------------------------------------------------------------------------

/** Retrieve the stored API key (decoded from base64). */
export function getApiKey() {
  const encoded = localStorage.getItem(KEYS.API_KEY);
  if (!encoded) return null;
  try {
    return atob(encoded);
  } catch {
    return null;
  }
}

/** Persist an API key (base64-encoded for minimal obfuscation). */
export function setApiKey(key) {
  if (!key) return;
  localStorage.setItem(KEYS.API_KEY, btoa(key));
}

/** Remove the stored API key. */
export function clearApiKey() {
  localStorage.removeItem(KEYS.API_KEY);
}

// ---------------------------------------------------------------------------
// Records CRUD
// ---------------------------------------------------------------------------

/** Return all saved records (array). */
export function getRecords() {
  return safeParse(localStorage.getItem(KEYS.RECORDS), []);
}

/** Overwrite the full records array. */
export function saveRecords(records) {
  localStorage.setItem(KEYS.RECORDS, JSON.stringify(records));
}

/**
 * Append a single record. An `id` and `created_at` timestamp are added
 * automatically if not already present.
 * @param {object} record
 * @returns {object[]} updated records list
 */
export function addRecord(record) {
  const records = getRecords();
  const enriched = {
    ...record,
    id: record.id ?? generateId(),
    created_at: record.created_at ?? new Date().toISOString(),
  };
  records.push(enriched);
  saveRecords(records);
  return records;
}

/**
 * Bulk-add multiple records, each receiving a unique ID and timestamp.
 * @param {object[]} newRecords
 * @returns {object[]} updated records list
 */
export function addRecords(newRecords) {
  const records = getRecords();
  const enriched = newRecords.map((r) => ({
    ...r,
    id: r.id ?? generateId(),
    created_at: r.created_at ?? new Date().toISOString(),
  }));
  records.push(...enriched);
  saveRecords(records);
  return records;
}

/**
 * Update a record in-place by its `id`.
 * @param {string} id
 * @param {object} updates - fields to merge
 * @returns {object[]} updated records list
 */
export function updateRecord(id, updates) {
  const records = getRecords();
  const idx = records.findIndex((r) => r.id === id);
  if (idx !== -1) {
    records[idx] = { ...records[idx], ...updates, id }; // prevent id overwrite
  }
  saveRecords(records);
  return records;
}

/**
 * Delete a single record by `id`.
 * @param {string} id
 * @returns {object[]} updated records list
 */
export function deleteRecord(id) {
  const records = getRecords().filter((r) => r.id !== id);
  saveRecords(records);
  return records;
}

/**
 * Bulk-delete records whose ids are in the supplied array.
 * @param {string[]} ids
 * @returns {object[]} updated records list
 */
export function deleteRecords(ids) {
  const idSet = new Set(ids);
  const records = getRecords().filter((r) => !idSet.has(r.id));
  saveRecords(records);
  return records;
}

/** Remove every record. */
export function clearAllRecords() {
  saveRecords([]);
}

// ---------------------------------------------------------------------------
// Reports (structured document storage)
// ---------------------------------------------------------------------------

/** Return all saved reports. */
export function getReports() {
  return safeParse(localStorage.getItem(KEYS.REPORTS), []);
}

/** Overwrite the full reports array. */
export function saveReports(reports) {
  localStorage.setItem(KEYS.REPORTS, JSON.stringify(reports));
}

/**
 * Add a new report from Claude extraction.
 * @param {object} rawData - Raw Claude extraction JSON
 * @param {string} sourceFile - Original filename
 * @returns {object[]} updated reports list
 */
export function addReport(rawData, sourceFile) {
  const reports = getReports();
  const report = {
    id: `rpt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    source_file: sourceFile,
    created_at: new Date().toISOString(),
    document_type: rawData.document_type || 'unknown',
    vendor: rawData.vendor || 'Unknown',
    patient_info: rawData.patient_info || {},
    facility_info: rawData.facility_info || {},
    metadata: rawData.metadata || {},
    clinical_data: rawData.clinical_data || {},
    raw: rawData,
  };
  reports.unshift(report);
  saveReports(reports);
  return reports;
}

/**
 * Update a report's fields.
 * @param {string} id
 * @param {object} updates - fields to merge at top level
 * @returns {object[]} updated reports list
 */
export function updateReportById(id, updates) {
  const reports = getReports();
  const idx = reports.findIndex((r) => r.id === id);
  if (idx !== -1) {
    reports[idx] = { ...reports[idx], ...updates, id };
  }
  saveReports(reports);
  return reports;
}

/**
 * Delete a report by id.
 * @param {string} id
 * @returns {object[]} updated reports list
 */
export function deleteReportById(id) {
  const reports = getReports().filter((r) => r.id !== id);
  saveReports(reports);
  return reports;
}

/** Remove all reports. */
export function clearAllReports() {
  saveReports([]);
}

// ---------------------------------------------------------------------------
// Column management
// ---------------------------------------------------------------------------

/** Return the persisted column configuration, or null if none saved. */
export function getColumns() {
  return safeParse(localStorage.getItem(KEYS.COLUMNS), null);
}

/** Persist a column configuration array. */
export function saveColumns(columns) {
  localStorage.setItem(KEYS.COLUMNS, JSON.stringify(columns));
}

// ---------------------------------------------------------------------------
// Upload history
// ---------------------------------------------------------------------------

/** Return the upload history array (most recent first). */
export function getUploadHistory() {
  return safeParse(localStorage.getItem(KEYS.UPLOAD_HISTORY), []);
}

/**
 * Record an upload event. The list is capped at the most recent entries.
 * @param {object} entry
 */
export function addToUploadHistory(entry) {
  const history = getUploadHistory();
  history.unshift({
    ...entry,
    timestamp: entry.timestamp ?? new Date().toISOString(),
  });
  // Keep only the most recent entries
  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY;
  }
  localStorage.setItem(KEYS.UPLOAD_HISTORY, JSON.stringify(history));
  return history;
}

/** Clear all upload history. */
export function clearUploadHistory() {
  localStorage.removeItem(KEYS.UPLOAD_HISTORY);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS = {
  theme: 'light',
  autoSave: true,
  maxRecords: 1000,
  dateFormat: 'MMM DD, YYYY',
};

/** Return the current settings, merged with defaults for any missing keys. */
export function getSettings() {
  const stored = safeParse(localStorage.getItem(KEYS.SETTINGS), {});
  return { ...DEFAULT_SETTINGS, ...stored };
}

/** Persist settings (merged with existing). */
export function saveSettings(settings) {
  const current = getSettings();
  localStorage.setItem(
    KEYS.SETTINGS,
    JSON.stringify({ ...current, ...settings }),
  );
}

// ---------------------------------------------------------------------------
// Storage info
// ---------------------------------------------------------------------------

/**
 * Calculate how much localStorage space the ParceDoc keys occupy.
 * @returns {{ used: number, usedFormatted: string, percentage: number }}
 */
export function getStorageSize() {
  let totalBytes = 0;

  for (const key of Object.values(KEYS)) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      // Each JS char is stored as UTF-16 → 2 bytes per char
      totalBytes += (key.length + value.length) * 2;
    }
  }

  const percentage = Math.round((totalBytes / ASSUMED_MAX_STORAGE) * 100);

  return {
    used: totalBytes,
    total: ASSUMED_MAX_STORAGE,
    usedFormatted: formatBytes(totalBytes),
    percentage: Math.min(percentage, 100),
  };
}

/**
 * Format a byte count into a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, i);
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${units[i]}`;
}
