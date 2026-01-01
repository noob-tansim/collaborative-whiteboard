import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './HomePage';
import SessionForm from './SessionForm';
import WhiteboardPage from './WhiteboardPage';
import './App.css';

function App() {
  // sessionData stores { sessionName, userName, channelName }
  const [sessionData, setSessionData] = useState(null);

  const handleLogin = (data) => {
    // Start with the "general" channel by default
    setSessionData({ ...data, channelName: 'general' });
  };

  const handleLogout = () => {
    setSessionData(null);
  };

  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          {/* Home/Landing Page */}
          <Route
            path="/"
            element={
              sessionData ? (
                <Navigate to="/whiteboard" />
              ) : (
                <HomePage />
              )
            }
          />
          
          {/* Session Form Page */}
          <Route
            path="/session-form"
            element={
              sessionData ? (
                <Navigate to="/whiteboard" />
              ) : (
                <SessionForm onLogin={handleLogin} />
              )
            }
          />
          
          {/* Whiteboard Page */}
          <Route
            path="/whiteboard"
            element={
              sessionData ? (
                <WhiteboardPage 
                  session={sessionData} 
                  onLogout={handleLogout}
                  onSessionUpdate={setSessionData}
                />
              ) : (
                <Navigate to="/" />
              )
            }
          />
          
          {/* Fallback to home */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;