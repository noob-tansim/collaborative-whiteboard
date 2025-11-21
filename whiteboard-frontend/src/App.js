import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SessionPersistence from './SessionPersistence';
import ErrorBoundary from './ErrorBoundary';
import './App.css';

// Lazy load page components for code splitting
const LoginPage = lazy(() => import('./LoginPage'));
const WhiteboardPage = lazy(() => import('./WhiteboardPage'));

const shouldClearSavedSession = process.env.REACT_APP_CLEAR_SAVED_SESSION === 'true';

// Loading fallback component
const LoadingFallback = () => (
  <div className="App">
    <p>Loading...</p>
  </div>
);

function App() {
  // sessionData stores { sessionName, userName, channelName }
  const [sessionData, setSessionData] = useState(null);
  const [savedSession, setSavedSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // On app load, check if there's a saved session but ask user before resuming
  useEffect(() => {
    if (shouldClearSavedSession) {
      SessionPersistence.clearSession();
      setSavedSession(null);
      setSessionData(null);
      console.log('🧹 Cleared saved session per REACT_APP_CLEAR_SAVED_SESSION');
      setIsLoading(false);
      return;
    }

    const restoredSession = SessionPersistence.getSession();
    if (restoredSession?.sessionName && restoredSession?.userName) {
      console.log('� Saved session found:', restoredSession.sessionName);
      setSavedSession(restoredSession);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (data) => {
    // Save session with channel info
    const { sessionName, userName, channelName } = data;
    SessionPersistence.saveSession(sessionName, userName, channelName);
    setSavedSession({ sessionName, userName, channelName });
    setSessionData(data);
  };

  const handleResumeSession = () => {
    if (savedSession) {
      console.log('➡️ Resuming saved session:', savedSession.sessionName);
      setSessionData(savedSession);
    }
  };

  const handleForgetSession = () => {
    SessionPersistence.clearSession();
    setSavedSession(null);
  };

  const handleLogout = () => {
    SessionPersistence.clearSession();
    setSessionData(null);
    setSavedSession(null);
  };

  if (isLoading) {
    return <div className="App"><p>Loading...</p></div>;
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="App">
          <header className="App-header">
            <h1>Collaborative Whiteboard</h1>
          </header>
          <main className="App-main">
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route
                  path="/login"
                  element={
                    sessionData ? (
                      <Navigate to="/whiteboard" />
                    ) : (
                      <LoginPage
                        onLogin={handleLogin}
                        savedSession={savedSession}
                        onResumeSession={handleResumeSession}
                        onForgetSession={handleForgetSession}
                      />
                    )
                  }
                />
                <Route
                  path="/whiteboard"
                  element={
                    sessionData ? (
                      <WhiteboardPage 
                        session={sessionData} 
                        onLogout={handleLogout} 
                      />
                    ) : (
                      <Navigate to="/login" />
                    )
                  }
                />
                <Route path="*" element={<Navigate to="/login" />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;