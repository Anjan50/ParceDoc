import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  FiX, FiSend, FiTrash2, FiLoader,
  FiAlertCircle, FiZap, FiCpu, FiFileText,
} from 'react-icons/fi';
import { TbStethoscope } from 'react-icons/tb';
import { chatWithAssistant } from '../services/claudeApi';
import { getApiKey } from '../services/storage';
import './MedicalAssistant.css';

const QUICK_ACTIONS = [
  { icon: '⚠️', label: 'Flag abnormal values', prompt: 'List all abnormal/flagged values across all reports. For each, explain the clinical significance and potential concerns.' },
  { icon: '💊', label: 'Medication check', prompt: 'List all medications found in the reports. Check for any potential drug interactions or concerns.' },
  { icon: '📋', label: 'Recommended follow-ups', prompt: 'Based on the clinical data, what follow-up tests or specialist referrals would typically be recommended?' },
];

/* =========================================================================
   Markdown Renderer — handles bold, code, lists, tables, headings, <br>
   ========================================================================= */

function renderInline(str, keyPrefix = '') {
  // Replace <br> and <br/> with newline markers first
  const cleaned = str.replace(/<br\s*\/?>/gi, '\n');
  const parts = [];
  // Match **bold**, `code`, and newlines
  const regex = /\*\*(.+?)\*\*|`(.+?)`|\n/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      parts.push(cleaned.slice(lastIndex, match.index));
    }
    if (match[0] === '\n') {
      parts.push(<br key={`${keyPrefix}br${match.index}`} />);
    } else if (match[1]) {
      parts.push(<strong key={`${keyPrefix}b${match.index}`}>{match[1]}</strong>);
    } else if (match[2]) {
      parts.push(<code key={`${keyPrefix}c${match.index}`} className="ma-md-code">{match[2]}</code>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < cleaned.length) parts.push(cleaned.slice(lastIndex));
  return parts.length > 0 ? parts : cleaned;
}

function isTableSeparator(line) {
  return /^\|?[\s-:|]+\|[\s-:|]+\|?$/.test(line.trim());
}

function isTableRow(line) {
  return line.trim().startsWith('|') && line.trim().endsWith('|');
}

function parseTableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function MarkdownContent({ text }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // --- Table detection ---
    if (isTableRow(trimmed) && i + 1 < lines.length && isTableSeparator(lines[i + 1]?.trim())) {
      const headerCells = parseTableRow(trimmed);
      i += 2; // skip header + separator
      const bodyRows = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        bodyRows.push(parseTableRow(lines[i]));
        i++;
      }
      elements.push(
        <div key={`tbl-${elements.length}`} className="ma-md-table-wrap">
          <table className="ma-md-table">
            <thead>
              <tr>{headerCells.map((c, ci) => <th key={ci}>{renderInline(c, `th${ci}`)}</th>)}</tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri}>{row.map((c, ci) => <td key={ci}>{renderInline(c, `td${ri}${ci}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // --- Horizontal rule ---
    if (/^[-*_]{3,}\s*$/.test(trimmed)) {
      elements.push(<hr key={`hr-${i}`} className="ma-md-hr" />);
      i++;
      continue;
    }

    // --- Lists ---
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)) {
      const items = [];
      while (i < lines.length) {
        const lt = lines[i].trim();
        if (lt.startsWith('- ') || lt.startsWith('* ') || /^\d+\.\s/.test(lt)) {
          const content = lt.replace(/^[-*]\s|^\d+\.\s/, '');
          items.push(<li key={`li-${i}`}>{renderInline(content, `li${i}`)}</li>);
          i++;
        } else {
          break;
        }
      }
      elements.push(<ul key={`ul-${elements.length}`} className="ma-md-list">{items}</ul>);
      continue;
    }

    // --- Empty line ---
    if (!trimmed) {
      i++;
      continue;
    }

    // --- Headings ---
    if (trimmed.startsWith('### ')) {
      elements.push(<h4 key={`h4-${i}`} className="ma-md-h4">{renderInline(trimmed.slice(4), `h4${i}`)}</h4>);
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(<h3 key={`h3-${i}`} className="ma-md-h3">{renderInline(trimmed.slice(3), `h3${i}`)}</h3>);
      i++;
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(<h2 key={`h2-${i}`} className="ma-md-h2">{renderInline(trimmed.slice(2), `h2${i}`)}</h2>);
      i++;
      continue;
    }

    // --- Paragraph ---
    elements.push(<p key={`p-${i}`} className="ma-md-p">{renderInline(trimmed, `p${i}`)}</p>);
    i++;
  }

  return <>{elements}</>;
}

/* =========================================================================
   Main Component
   ========================================================================= */

export default function MedicalAssistant({ reports }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { if (isOpen && inputRef.current) inputRef.current.focus(); }, [isOpen]);

  const reportsContext = useMemo(() => {
    if (!reports || reports.length === 0) return '';
    return reports.map((r, i) => {
      const clean = { ...r };
      delete clean.raw;
      delete clean.id;
      return `--- Report ${i + 1}: ${r.source_file} ---\n${JSON.stringify(clean, null, 2)}`;
    }).join('\n\n');
  }, [reports]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isStreaming) return;
    setError(null);
    abortRef.current = false;

    const apiKey = getApiKey();
    if (!apiKey) { setError('API key not found. Please reconnect.'); return; }

    const userMsg = { role: 'user', content: text.trim() };
    const assistantMsg = { role: 'assistant', content: '' };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);

    const apiMessages = [...messages, userMsg].map(({ role, content }) => ({ role, content }));

    const result = await chatWithAssistant(apiKey, apiMessages, reportsContext, (chunk) => {
      if (abortRef.current) return;
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === 'assistant') {
          updated[updated.length - 1] = { ...last, content: last.content + chunk };
        }
        return updated;
      });
    });

    if (!result.success) {
      setError(result.error || 'Failed to get response.');
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[updated.length - 1]?.role === 'assistant' && !updated[updated.length - 1].content) {
          updated.pop();
        }
        return updated;
      });
    }
    setIsStreaming(false);
  }, [isStreaming, messages, reportsContext]);

  const handleSubmit = useCallback((e) => { e.preventDefault(); sendMessage(input); }, [input, sendMessage]);
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }, [input, sendMessage]);

  const clearChat = useCallback(() => {
    abortRef.current = true;
    setMessages([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  const reportCount = reports?.length || 0;

  // Build per-report quick buttons
  const reportButtons = useMemo(() => {
    if (!reports || reports.length === 0) return [];
    return reports.map((r) => {
      const patientName = r.patient_info?.patient_name || 'Unknown Patient';
      const docType = (r.document_type || 'document').replace(/_/g, ' ');
      return {
        id: r.id,
        label: patientName,
        subLabel: docType,
        sourceFile: r.source_file,
        prompt: `Analyze the report from file "${r.source_file}" for patient "${patientName}". Give me:
1. A clear clinical summary
2. All abnormal/flagged values with their clinical significance
3. Key findings and diagnoses
4. Any recommended follow-up actions
Format your response with clear sections and use bullet points.`,
      };
    });
  }, [reports]);

  return (
    <>
      {/* Floating Button */}
      <button
        className={`ma-fab ${isOpen ? 'ma-fab-hidden' : ''}`}
        onClick={() => setIsOpen(true)}
        title="Medical Data Assistant"
      >
        <TbStethoscope className="ma-fab-icon" />
        {reportCount > 0 && <span className="ma-fab-badge">{reportCount}</span>}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="ma-panel">
          {/* Header */}
          <div className="ma-header">
            <div className="ma-header-left">
              <div className="ma-header-icon"><FiCpu /></div>
              <div>
                <h3 className="ma-header-title">Medical Data Assistant</h3>
                <p className="ma-header-subtitle">
                  {reportCount > 0 ? `${reportCount} report${reportCount > 1 ? 's' : ''} loaded` : 'No reports loaded'}
                </p>
              </div>
            </div>
            <div className="ma-header-actions">
              {messages.length > 0 && (
                <button className="ma-header-btn" onClick={clearChat} title="Clear chat"><FiTrash2 /></button>
              )}
              <button className="ma-header-btn" onClick={() => setIsOpen(false)} title="Close"><FiX /></button>
            </div>
          </div>

          {/* Messages */}
          <div className="ma-messages">
            {messages.length === 0 ? (
              <div className="ma-welcome">
                <div className="ma-welcome-icon"><TbStethoscope /></div>
                <h4 className="ma-welcome-title">How can I help?</h4>
                <p className="ma-welcome-text">
                  Analyze individual reports, flag abnormal values, and get clinical insights from your data.
                </p>

                {/* Per-report buttons */}
                {reportButtons.length > 0 && (
                  <div className="ma-section">
                    <p className="ma-section-label">Analyze a Report</p>
                    <div className="ma-quick-prompts">
                      {reportButtons.map((rb) => (
                        <button
                          key={rb.id}
                          className="ma-quick-btn ma-report-btn"
                          onClick={() => sendMessage(rb.prompt)}
                          disabled={isStreaming}
                        >
                          <FiFileText className="ma-quick-file-icon" />
                          <div className="ma-report-btn-info">
                            <span className="ma-report-btn-name">{rb.label}</span>
                            <span className="ma-report-btn-type">{rb.subLabel} · {rb.sourceFile}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* General quick actions */}
                <div className="ma-section">
                  <p className="ma-section-label">Quick Actions</p>
                  <div className="ma-quick-prompts">
                    {QUICK_ACTIONS.map((qp, i) => (
                      <button
                        key={i}
                        className="ma-quick-btn"
                        onClick={() => sendMessage(qp.prompt)}
                        disabled={isStreaming}
                      >
                        <span className="ma-quick-icon">{qp.icon}</span>
                        {qp.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`ma-msg ma-msg-${msg.role}`}>
                  {msg.role === 'assistant' && (
                    <div className="ma-msg-avatar"><FiZap /></div>
                  )}
                  <div className={`ma-msg-bubble ma-msg-bubble-${msg.role}`}>
                    {msg.role === 'assistant' ? (
                      msg.content ? (
                        <MarkdownContent text={msg.content} />
                      ) : (
                        <div className="ma-typing">
                          <span></span><span></span><span></span>
                        </div>
                      )
                    ) : (
                      <p className="ma-msg-text">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))
            )}

            {error && (
              <div className="ma-error"><FiAlertCircle /> {error}</div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form className="ma-input-area" onSubmit={handleSubmit}>
            <div className="ma-input-wrapper">
              <textarea
                ref={inputRef}
                className="ma-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your clinical data..."
                rows={1}
                disabled={isStreaming}
              />
              <button
                type="submit"
                className="ma-send-btn"
                disabled={!input.trim() || isStreaming}
              >
                {isStreaming ? <FiLoader className="ma-spinner" /> : <FiSend />}
              </button>
            </div>
            <p className="ma-disclaimer">AI analysis is for informational purposes only. Always consult a healthcare provider.</p>
          </form>
        </div>
      )}
    </>
  );
}
