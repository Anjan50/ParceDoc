import { useState, useEffect, useCallback } from 'react';
import {
  FiFileText, FiDatabase, FiClock, FiActivity, FiSettings,
  FiLogOut, FiMenu, FiX, FiTrash2,
} from 'react-icons/fi';
import { TbReportMedical } from 'react-icons/tb';
import {
  getReports, addReport as storeReport, updateReportById,
  deleteReportById, clearAllReports,
  getUploadHistory, addToUploadHistory,
  clearApiKey, getStorageSize,
} from '../services/storage';
import UploadPanel from './UploadPanel';
import ReportView from './ReportView';
import MedicalAssistant from './MedicalAssistant';
import ConfirmDialog from './ConfirmDialog';
import { useToast } from './Toast';
import './Dashboard.css';

function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Dashboard({ onLogout }) {
  const [reports, setReports] = useState([]);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [storageInfo, setStorageInfo] = useState({ used: 0, total: 5 * 1024 * 1024, percentage: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { addToast } = useToast();

  useEffect(() => {
    setReports(getReports());
    setUploadHistory(getUploadHistory());
    setStorageInfo(getStorageSize());
  }, []);

  const refreshStorage = useCallback(() => {
    setStorageInfo(getStorageSize());
  }, []);

  // Called by UploadPanel with raw Claude data
  const handleDataExtracted = useCallback(
    ({ rawData, fileName }) => {
      const updatedReports = storeReport(rawData, fileName);
      setReports(updatedReports);

      const history = addToUploadHistory({
        name: fileName,
        processedAt: new Date().toISOString(),
        document_type: rawData.document_type || 'unknown',
      });
      setUploadHistory(history);
      refreshStorage();

      const resultsCount = rawData.clinical_data?.results?.length || 1;
      addToast('success', 'Data Extracted', `${resultsCount} record(s) extracted from ${fileName}`);
    },
    [addToast, refreshStorage]
  );

  const handleUploadError = useCallback(
    (message) => {
      addToast('error', 'Upload Error', message);
    },
    [addToast]
  );

  const handleUpdateReport = useCallback(
    (id, updates) => {
      const updated = updateReportById(id, updates);
      setReports(updated);
      addToast('success', 'Saved', 'Report updated successfully.');
    },
    [addToast]
  );

  const handleDeleteReport = useCallback(
    (id) => {
      const updated = deleteReportById(id);
      setReports(updated);
      refreshStorage();
      addToast('info', 'Deleted', 'Report removed.');
    },
    [addToast, refreshStorage]
  );

  const handleClearAll = useCallback(() => {
    clearAllReports();
    setReports([]);
    setShowClearConfirm(false);
    refreshStorage();
    addToast('warning', 'Data Cleared', 'All reports have been removed.');
  }, [addToast, refreshStorage]);

  const handleLogout = useCallback(() => {
    clearApiKey();
    onLogout();
  }, [onLogout]);

  const lastUpload = uploadHistory.length > 0
    ? uploadHistory[0].processedAt || uploadHistory[0].timestamp
    : null;

  const totalResults = reports.reduce((sum, r) => {
    const results = r.clinical_data?.results;
    return sum + (Array.isArray(results) ? results.length : 1);
  }, 0);

  const storagePct = Math.min(100, storageInfo.percentage);

  return (
    <div className="dash">
      {/* Header */}
      <header className="dash-header">
        <div className="dash-header-left">
          <TbReportMedical className="dash-logo-icon" />
          <span className="dash-logo-text">ParceDoc</span>
          <span className="dash-badge">Clinical AI</span>
        </div>

        <div className="dash-header-right">
          <div className="dash-storage-indicator" title={`Storage: ${storagePct.toFixed(1)}%`}>
            <div className="dash-storage-bar">
              <div
                className="dash-storage-fill"
                style={{ width: `${storagePct}%` }}
              />
            </div>
          </div>

          <button
            className="dash-header-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <FiSettings />
          </button>
          <button className="dash-header-btn" onClick={handleLogout} title="Change API Key">
            <FiLogOut />
          </button>
          <button
            className="dash-header-btn dash-mobile-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </header>

      <div className="dash-body">
        {/* Stats */}
        <div className="dash-stats">
          <div className="dash-stat-card">
            <div className="dash-stat-icon dash-stat-icon-purple">
              <FiDatabase />
            </div>
            <div className="dash-stat-info">
              <p className="dash-stat-value">{reports.length}</p>
              <p className="dash-stat-label">Reports</p>
            </div>
          </div>

          <div className="dash-stat-card">
            <div className="dash-stat-icon dash-stat-icon-blue">
              <FiFileText />
            </div>
            <div className="dash-stat-info">
              <p className="dash-stat-value">{totalResults}</p>
              <p className="dash-stat-label">Total Records</p>
            </div>
          </div>

          <div className="dash-stat-card">
            <div className="dash-stat-icon dash-stat-icon-green">
              <FiActivity />
            </div>
            <div className="dash-stat-info">
              <p className="dash-stat-value">{uploadHistory.length}</p>
              <p className="dash-stat-label">Documents Processed</p>
            </div>
          </div>

          <div className="dash-stat-card">
            <div className="dash-stat-icon dash-stat-icon-amber">
              <FiClock />
            </div>
            <div className="dash-stat-info">
              <p className="dash-stat-value">{timeAgo(lastUpload)}</p>
              <p className="dash-stat-label">Last Upload</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="dash-content">
          <div className="dash-upload-section">
            <UploadPanel onDataExtracted={handleDataExtracted} onError={handleUploadError} />
          </div>

          <div className="dash-reports-section">
            {reports.length === 0 ? (
              <div className="dash-empty-reports">
                <FiFileText className="dash-empty-icon" />
                <h3 className="dash-empty-title">No reports yet</h3>
                <p className="dash-empty-text">Upload clinical documents to extract and view structured data here.</p>
              </div>
            ) : (
              <div className="dash-reports-list">
                <div className="dash-reports-header">
                  <h2 className="dash-reports-heading">
                    Extracted Reports
                    <span className="dash-reports-count">{reports.length}</span>
                  </h2>
                </div>
                {reports.map((report) => (
                  <ReportView
                    key={report.id}
                    report={report}
                    onUpdate={handleUpdateReport}
                    onDelete={handleDeleteReport}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <>
          <div className="dash-settings-overlay" onClick={() => setShowSettings(false)} />
          <aside className="dash-settings">
            <div className="dash-settings-header">
              <h3 className="dash-settings-title">Settings</h3>
              <button
                className="dash-settings-close"
                onClick={() => setShowSettings(false)}
              >
                <FiX />
              </button>
            </div>

            <div className="dash-settings-section">
              <h4 className="dash-settings-section-title">Storage</h4>
              <div className="dash-settings-storage">
                <div className="dash-settings-storage-bar">
                  <div
                    className="dash-settings-storage-fill"
                    style={{ width: `${storagePct}%` }}
                  />
                </div>
                <p className="dash-settings-storage-text">
                  {(storageInfo.used / 1024).toFixed(1)} KB used of {(storageInfo.total / (1024 * 1024)).toFixed(0)} MB
                </p>
              </div>
            </div>

            <div className="dash-settings-section">
              <h4 className="dash-settings-section-title">Danger Zone</h4>
              <button
                className="dash-settings-danger-btn"
                onClick={() => setShowClearConfirm(true)}
              >
                <FiTrash2 /> Clear All Data
              </button>
            </div>

            <div className="dash-settings-section">
              <h4 className="dash-settings-section-title">About</h4>
              <div className="dash-settings-about">
                <p><strong>ParceDoc</strong> v0.2.0</p>
                <p>Clinical Data Intelligence Platform</p>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear All Data?"
        message="This will permanently delete all extracted reports and upload history. This action cannot be undone."
        confirmText="Clear Everything"
        cancelText="Cancel"
        onConfirm={handleClearAll}
        onCancel={() => setShowClearConfirm(false)}
        variant="danger"
      />

      {/* Medical Data Assistant */}
      <MedicalAssistant reports={reports} />
    </div>
  );
}
