import React, { useState } from 'react';
import './LoginPage.css';

function LoginPage({ onLogin, savedSession = null, onResumeSession = () => {}, onForgetSession = () => {} }) {
  const [sessionName, setSessionName] = useState('');
  const [userName, setUserName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [availableChannels, setAvailableChannels] = useState([]);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);

  const handleAction = async (e) => {
    e.preventDefault();
    setError('');

    if (!sessionName || !userName) {
      setError('Session name and user name are required.');
      return;
    }

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8081';
    const url = isJoining 
      ? `${apiUrl}/api/sessions/join` 
      : `${apiUrl}/api/sessions/create`;
    const body = isJoining
      ? { sessionName, userName }
      : { sessionName, managerName: userName };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const sessionData = await response.json();
        // Extract channels from response, default to 'general' if not available
        const channels = sessionData.channels?.map(c => c.channelName) || ['general'];
        const selectedChannel = channels.length > 0 ? channels[0] : 'general';
        
        onLogin({ sessionName, userName, channelName: selectedChannel });
      } else {
        const errorText = await response.text();
        setError(errorText || `Failed to ${isJoining ? 'join' : 'create'} session.`);
      }
    } catch (err) {
      setError('An error occurred. Is the backend server running?');
    }
  };

  const handleToggleMode = () => {
    setIsJoining(!isJoining);
    setError('');
    setAvailableChannels([]);
    setChannelName('');
  };

  // Fetch available channels for a session
  const fetchChannels = async (sName) => {
    if (!sName) return;
    
    setIsLoadingChannels(true);
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8081';
    
    try {
      const response = await fetch(
        `${apiUrl}/api/sessions/${sName}/channels`
      );
      if (response.ok) {
        const channels = await response.json();
        const channelNames = channels.map(c => c.channelName);
        setAvailableChannels(channelNames);
        // Auto-select first channel
        if (channelNames.length > 0 && !channelName) {
          setChannelName(channelNames[0]);
        }
      } else {
        console.warn('Could not fetch channels');
        setAvailableChannels([]);
      }
    } catch (err) {
      console.warn('Error fetching channels:', err);
      setAvailableChannels([]);
    } finally {
      setIsLoadingChannels(false);
    }
  };

  // Handle session name change - fetch channels if joining
  const handleSessionNameChange = (value) => {
    setSessionName(value);
    if (isJoining) {
      fetchChannels(value);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>{isJoining ? 'Join Session' : 'Create Session'}</h2>
        {savedSession && (
          <div className="saved-session-card">
            <div className="saved-session-details">
              <p className="saved-session-label">Continue where you left off?</p>
              <p className="saved-session-meta">
                Session: <strong>{savedSession.sessionName}</strong> · User: <strong>{savedSession.userName}</strong> · Channel:{' '}
                <strong>{savedSession.channelName || 'general'}</strong>
              </p>
            </div>
            <div className="saved-session-actions">
              <button type="button" className="btn-primary" onClick={onResumeSession}>
                Resume session
              </button>
              <button type="button" className="btn-text" onClick={onForgetSession}>
                Forget saved session
              </button>
            </div>
          </div>
        )}
        <form onSubmit={handleAction}>
          <div className="form-group">
            <label htmlFor="session-name">Session Name</label>
            <input
              id="session-name"
              type="text"
              value={sessionName}
              onChange={(e) => handleSessionNameChange(e.target.value)}
              placeholder="e.g., 'project-alpha'"
            />
          </div>
          <div className="form-group">
            <label htmlFor="user-name">Your Name</label>
            <input
              id="user-name"
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g., 'Tansim'"
            />
          </div>
          
          {/* Show channel selection when joining and channels are available */}
          {isJoining && availableChannels.length > 0 && (
            <div className="form-group">
              <label htmlFor="channel-select">Select Channel</label>
              <select
                id="channel-select"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
              >
                {availableChannels.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {isLoadingChannels && (
            <p className="info-message">Loading available channels...</p>
          )}
          
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="btn-primary">
            {isJoining ? 'Join' : 'Create'}
          </button>
        </form>
        <button
          onClick={handleToggleMode}
          className="btn-secondary"
        >
          {isJoining
            ? 'Need to create a session?'
            : 'Already have a session?'}
        </button>
      </div>
    </div>
  );
}

export default LoginPage;