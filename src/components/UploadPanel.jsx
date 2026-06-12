import { useState, useRef, useCallback } from 'react';
import { FiUploadCloud, FiFile, FiImage, FiFileText, FiX, FiCheck, FiLoader } from 'react-icons/fi';
import { validateFile, fileToBase64, getFileCategory, formatFileSize, detectRealMimeType } from '../utils/fileProcessor';
import { extractClinicalData } from '../services/claudeApi';
import { getApiKey } from '../services/storage';
import './UploadPanel.css';

const FILE_ICONS = {
  image: FiImage,
  document: FiFileText,
  default: FiFile,
};

export default function UploadPanel({ onDataExtracted, onError }) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  const updateFileStatus = useCallback((index, updates) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...updates } : f))
    );
  }, []);

  const processFile = useCallback(
    async (fileEntry, index) => {
      updateFileStatus(index, { status: 'processing' });

      try {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error('API key not found. Please reconnect.');

        const base64 = await fileToBase64(fileEntry.file);
        const realMimeType = await detectRealMimeType(fileEntry.file);
        const result = await extractClinicalData(apiKey, base64, realMimeType, fileEntry.file.name);

        if (!result.success) {
          throw new Error(result.error || 'Extraction failed');
        }

        updateFileStatus(index, { status: 'done', result: result.data });
        onDataExtracted({ rawData: result.data, fileName: fileEntry.file.name });
      } catch (err) {
        const msg = err.message || 'Failed to process file';
        updateFileStatus(index, { status: 'error', error: msg });
        onError?.(msg);
      }
    },
    [onDataExtracted, onError, updateFileStatus]
  );

  const handleFiles = useCallback(
    async (fileList) => {
      const newFiles = [];

      for (const file of fileList) {
        const validation = validateFile(file);
        if (!validation.valid) {
          onError?.(`${file.name}: ${validation.error}`);
          continue;
        }
        newFiles.push({ file, status: 'pending', progress: 0, result: null, error: null });
      }

      if (newFiles.length === 0) return;

      const startIndex = files.length;
      setFiles((prev) => [...prev, ...newFiles]);
      setIsProcessing(true);

      for (let i = 0; i < newFiles.length; i++) {
        await processFile(newFiles[i], startIndex + i);
      }

      setIsProcessing(false);
    },
    [files.length, onError, processFile]
  );

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      const droppedFiles = e.dataTransfer?.files;
      if (droppedFiles?.length) {
        handleFiles(droppedFiles);
      }
    },
    [handleFiles]
  );

  const handleInputChange = useCallback(
    (e) => {
      const selectedFiles = e.target.files;
      if (selectedFiles?.length) {
        handleFiles(selectedFiles);
      }
      e.target.value = '';
    },
    [handleFiles]
  );

  const removeFile = useCallback((index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const getIcon = (file) => {
    const category = getFileCategory(file);
    const Icon = FILE_ICONS[category] || FILE_ICONS.default;
    return <Icon />;
  };

  return (
    <div className="upload-panel">
      <div className="upload-header">
        <FiUploadCloud className="upload-header-icon" />
        <div>
          <h2 className="upload-title">Upload Clinical Documents</h2>
          <p className="upload-subtitle">
            Drag &amp; drop files or click to browse. Supports lab reports, radiology, pathology, prescriptions, and more.
          </p>
        </div>
      </div>

      <div
        className={`upload-dropzone ${isDragging ? 'upload-dropzone-active' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
      >
        <FiUploadCloud className={`upload-dropzone-icon ${isDragging ? 'upload-dropzone-icon-active' : ''}`} />
        <p className="upload-dropzone-text">
          {isDragging ? 'Drop files here' : 'Click to browse or drag files here'}
        </p>
        <p className="upload-dropzone-meta">
          JPG, PNG, WEBP, GIF, PDF &middot; 20MB per file
        </p>
        <input
          ref={fileInputRef}
          type="file"
          className="upload-input-hidden"
          multiple
          accept="image/*,.pdf"
          onChange={handleInputChange}
        />
      </div>

      {files.length > 0 && (
        <div className="upload-queue">
          <h3 className="upload-queue-title">Processing Queue</h3>
          <div className="upload-queue-list">
            {files.map((entry, index) => (
              <div key={index} className={`upload-queue-item upload-queue-item-${entry.status}`}>
                <div className="upload-queue-icon">
                  {getIcon(entry.file)}
                </div>
                <div className="upload-queue-info">
                  <p className="upload-queue-name">{entry.file.name}</p>
                  <p className="upload-queue-size">{formatFileSize(entry.file.size)}</p>
                </div>
                <div className="upload-queue-status">
                  {entry.status === 'pending' && (
                    <span className="upload-status-text upload-status-pending">Pending</span>
                  )}
                  {entry.status === 'processing' && (
                    <span className="upload-status-text upload-status-processing">
                      <FiLoader className="upload-spinner" /> Analyzing...
                    </span>
                  )}
                  {entry.status === 'done' && (
                    <span className="upload-status-text upload-status-done">
                      <FiCheck /> Extracted
                    </span>
                  )}
                  {entry.status === 'error' && (
                    <span className="upload-status-text upload-status-error" title={entry.error}>
                      <FiX /> Failed
                    </span>
                  )}
                </div>
                <button
                  className="upload-queue-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  aria-label={`Remove ${entry.file.name}`}
                >
                  <FiX />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
