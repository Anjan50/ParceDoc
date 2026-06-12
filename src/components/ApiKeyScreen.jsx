import { useState } from 'react';
import { FiKey, FiShield, FiCheck, FiAlertCircle, FiLoader, FiArrowRight, FiEye, FiEyeOff, FiDatabase } from 'react-icons/fi';
import { testConnection } from '../services/claudeApi';
import { setApiKey as storeApiKey } from '../services/storage';
import './ApiKeyScreen.css';

export default function ApiKeyScreen({ onApiKeySet }) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!apiKey.trim() || testing) return;

    setTesting(true);
    setStatus(null);
    setErrorMessage('');

    try {
      await testConnection(apiKey.trim());
      setStatus('success');
      setTimeout(() => {
        storeApiKey(apiKey.trim());
        onApiKeySet();
      }, 1000);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Failed to connect. Please check your API key.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="apikey-screen">
      <div className="apikey-layout">
        {/* Branding Side */}
        <div className="apikey-branding">
          <div className="apikey-brand-content">
            <div className="apikey-logo">
              <span className="apikey-logo-cross">✚</span>
              <span className="apikey-logo-doc">⬡</span>
            </div>
            <h1 className="apikey-title">ParceDoc</h1>
            <p className="apikey-tagline">Clinical Data Intelligence Platform</p>

            <div className="apikey-features">
              <div className="apikey-feature">
                <div className="apikey-feature-icon">
                  <FiShield />
                </div>
                <div className="apikey-feature-text">
                  <h3>HIPAA-Aware Processing</h3>
                  <p>Client-side document analysis with secure API integration</p>
                </div>
              </div>

              <div className="apikey-feature">
                <div className="apikey-feature-icon">
                  <FiCheck />
                </div>
                <div className="apikey-feature-text">
                  <h3>Multi-Vendor Support</h3>
                  <p>Extract data from Epic, Cerner, Meditech, and any clinical format</p>
                </div>
              </div>

              <div className="apikey-feature">
                <div className="apikey-feature-icon">
                  <FiDatabase />
                </div>
                <div className="apikey-feature-text">
                  <h3>Smart Data Management</h3>
                  <p>Automated extraction, editing, and export capabilities</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Side */}
        <div className="apikey-form-side">
          <form className="apikey-card" onSubmit={handleSubmit}>
            <h2 className="apikey-card-title">Connect Your AI Engine</h2>
            <p className="apikey-card-subtitle">
              Enter your Anthropic Claude API key to enable intelligent document processing
            </p>

            <div className="apikey-input-group">
              <div className="apikey-input-wrapper">
                <FiKey className="apikey-input-icon" />
                <input
                  type={showKey ? 'text' : 'password'}
                  className="apikey-input"
                  placeholder="sk-ant-api03-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                  spellCheck="false"
                />
                <button
                  type="button"
                  className="apikey-toggle-vis"
                  onClick={() => setShowKey(!showKey)}
                  tabIndex={-1}
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                >
                  {showKey ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              <p className="apikey-help-text">
                <FiShield className="apikey-help-icon" />
                Your API key is stored locally and never sent to any server other than Anthropic.
              </p>
            </div>

            <button
              type="submit"
              className={`apikey-submit ${status === 'success' ? 'apikey-submit-success' : ''}`}
              disabled={!apiKey.trim() || testing}
            >
              {testing ? (
                <>
                  <FiLoader className="apikey-spinner" />
                  Verifying...
                </>
              ) : status === 'success' ? (
                <>
                  <FiCheck />
                  Connected!
                </>
              ) : (
                <>
                  Verify &amp; Connect
                  <FiArrowRight />
                </>
              )}
            </button>

            {status === 'error' && (
              <div className="apikey-status apikey-status-error">
                <FiAlertCircle />
                <span>{errorMessage}</span>
              </div>
            )}

            {status === 'success' && (
              <div className="apikey-status apikey-status-success">
                <FiCheck />
                <span>API key verified successfully. Redirecting...</span>
              </div>
            )}

            <a
              href="https://console.anthropic.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="apikey-get-key-link"
            >
              Get an API key at console.anthropic.com →
            </a>
          </form>
        </div>
      </div>
    </div>
  );
}
