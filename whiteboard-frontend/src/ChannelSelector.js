import React, { useState, useEffect, useCallback } from 'react';
import './ChannelSelector.css';

function ChannelSelector({ sessionName, currentChannel, onChannelChange }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8081';
    
    try {
      const response = await fetch(
        `${apiUrl}/api/sessions/${sessionName}/channels`
      );
      if (response.ok) {
        const channelList = await response.json();
        setChannels(channelList);
      }
    } catch (err) {
      console.error('Error fetching channels:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionName]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const handleChannelSelect = (channel) => {
    onChannelChange(channel.channelName);
    setShowDropdown(false);
  };

  const currentChannelData = channels.find(c => c.channelName === currentChannel);

  return (
    <div className="channel-selector-container">
      <div className="channel-header">
        <div className="channel-info">
          <h3>Channel</h3>
          <div className="channel-dropdown-trigger" onClick={() => setShowDropdown(!showDropdown)}>
            <span className="channel-name">{currentChannel}</span>
            {currentChannelData && (
              <span className="channel-stats">
                {currentChannelData.messageCount} msgs • {currentChannelData.shapeCount} shapes
              </span>
            )}
            <span className={`dropdown-arrow ${showDropdown ? 'open' : ''}`}>▼</span>
          </div>
        </div>
      </div>

      {showDropdown && (
        <div className="channel-dropdown">
          {loading ? (
            <div className="channel-list-item loading">Loading channels...</div>
          ) : channels.length === 0 ? (
            <div className="channel-list-item empty">No channels available</div>
          ) : (
            <div className="channel-list">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className={`channel-list-item ${
                    channel.channelName === currentChannel ? 'active' : ''
                  }`}
                  onClick={() => handleChannelSelect(channel)}
                >
                  <div className="channel-name-in-list">{channel.channelName}</div>
                  <div className="channel-stats-in-list">
                    {channel.messageCount} msgs • {channel.shapeCount} shapes
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ChannelSelector;
