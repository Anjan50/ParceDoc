import { FiAlertTriangle, FiX } from 'react-icons/fi';
import './ConfirmDialog.css';

export default function ConfirmDialog({
  isOpen,
  title = 'Are you sure?',
  message = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
}) {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div className="confirm-overlay" onClick={handleOverlayClick}>
      <div className="confirm-dialog">
        <button className="confirm-close" onClick={onCancel} aria-label="Close dialog">
          <FiX />
        </button>

        <div className={`confirm-icon-wrapper confirm-icon-${variant}`}>
          <FiAlertTriangle />
        </div>

        <h3 className="confirm-title">{title}</h3>
        {message && <p className="confirm-message">{message}</p>}

        <div className="confirm-actions">
          <button className="confirm-btn confirm-btn-cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={`confirm-btn confirm-btn-${variant}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
