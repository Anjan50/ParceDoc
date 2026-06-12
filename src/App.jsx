import { useState, useEffect } from 'react';
import { ToastProvider } from './components/Toast';
import ApiKeyScreen from './components/ApiKeyScreen';
import Dashboard from './components/Dashboard';
import { getApiKey } from './services/storage';

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if API key exists in storage on mount
    const storedKey = getApiKey();
    if (storedKey) {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleApiKeySet = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner"></div>
        <p className="app-loading-text">Initializing ParceDoc...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <ApiKeyScreen onApiKeySet={handleApiKeySet} />;
  }

  return <Dashboard onLogout={handleLogout} />;
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
