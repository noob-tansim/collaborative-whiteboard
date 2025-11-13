import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './LoginPage';
import WhiteboardPage from './WhiteboardPage';
import './App.css';

function App() {
  // sessionData stores { sessionName, userName, channelName }
  const [sessionData, setSessionData] = useState(null);

  const handleLogin = (data) => {
    // We'll just use the "general" channel by default
    setSessionData({ ...data, channelName: 'general' });
  };

  const handleLogout = () => {
    setSessionData(null);
  };

  return (
    <BrowserRouter>
      <div className="App">
        <header className="App-header">
          <h1>Collaborative Whiteboard</h1>
        </header>
        <main className="App-main">
          <Routes>
            <Route
              path="/login"
              element={
                sessionData ? (
                  <Navigate to="/whiteboard" />
                ) : (
                  <LoginPage onLogin={handleLogin} />
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
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;