import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { FiCheck, FiX, FiAlertTriangle, FiInfo, FiAlertCircle } from 'react-icons/fi';
import './Toast.css';

const ToastContext = createContext(null);

const ICONS = {
  success: FiCheck,
  error: FiAlertCircle,
  warning: FiAlertTriangle,
  info: FiInfo,
};

let toastId = 0;

function Toast({ toast, onRemove }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef(null);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  }, [onRemove, toast.id]);

  useEffect(() => {
    if (toast.duration > 0) {
      timerRef.current = setTimeout(dismiss, toast.duration);
    }
    return () => clearTimeout(timerRef.current);
  }, [dismiss, toast.duration]);

  const Icon = ICONS[toast.type] || FiInfo;

  return (
    <div className={`toast toast-${toast.type} ${exiting ? 'toast-exit' : 'toast-enter'}`}>
      <div className="toast-icon">
        <Icon />
      </div>
      <div className="toast-body">
        {toast.title && <p className="toast-title">{toast.title}</p>}
        {toast.message && <p className="toast-message">{toast.message}</p>}
      </div>
      <button className="toast-close" onClick={dismiss} aria-label="Dismiss notification">
        <FiX />
      </button>
      {toast.duration > 0 && (
        <div
          className="toast-progress"
          style={{ animationDuration: `${toast.duration}ms` }}
        />
      )}
    </div>
  );
}

function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type, title, message, duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, title, message, duration }]);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
