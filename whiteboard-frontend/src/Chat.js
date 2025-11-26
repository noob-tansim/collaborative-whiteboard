import React, { useState, useRef, useEffect } from 'react';
import './Chat.css';

function Chat({ chatMessages, sendChatMessage, channelName }) {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to the bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (message.trim()) {
      sendChatMessage(message.trim());
      setMessage('');
    }
  };

  // Group messages by sender and timestamp proximity
  const shouldShowHeader = (currentMsg, prevMsg, index) => {
    if (index === 0) return true;
    if (currentMsg.senderName !== prevMsg.senderName) return true;
    
    // Show header if messages are more than 5 minutes apart
    const currentTime = currentMsg.timestamp ? new Date(currentMsg.timestamp).getTime() : 0;
    const prevTime = prevMsg.timestamp ? new Date(prevMsg.timestamp).getTime() : 0;
    const timeDiff = currentTime - prevTime;
    
    return timeDiff > 300000; // 5 minutes
  };

  return (
    <div className="chat-area">
      <div className="chat-header">
        <span className="chat-hash">#</span>
        <h3 className="chat-title">{channelName || 'channel'}</h3>
      </div>
      <div className="message-list">
        {chatMessages.length === 0 && (
          <div className="empty-chat">
            <div className="empty-icon">#</div>
            <h3>Welcome to #{channelName || 'channel'}!</h3>
            <p>This is the beginning of the #{channelName || 'channel'} channel.</p>
          </div>
        )}
        {chatMessages.map((msg, index) => {
          const showHeader = shouldShowHeader(msg, chatMessages[index - 1], index);
          const dt = msg.timestamp ? new Date(msg.timestamp) : new Date();
          const timeLabel = dt.toLocaleString([], {
            hour: '2-digit', 
            minute: '2-digit'
          });
          const dateLabel = dt.toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });

          return (
            <div 
              key={index} 
              className={`chat-message-wrapper${msg.optimistic ? ' optimistic' : ''}${showHeader ? ' show-header' : ''}`}
            >
              {showHeader ? (
                <div className="chat-message-group">
                  <div className="message-avatar">
                    {msg.senderName.charAt(0).toUpperCase()}
                  </div>
                  <div className="message-content-wrapper">
                    <div className="message-header">
                      <span className="sender-name">{msg.senderName}</span>
                      <span className="timestamp">{dateLabel} at {timeLabel}</span>
                    </div>
                    <div className="message-content">{msg.content}</div>
                  </div>
                </div>
              ) : (
                <div className="chat-message-group compact">
                  <div className="message-timestamp-hover">{timeLabel}</div>
                  <div className="message-content-wrapper">
                    <div className="message-content">{msg.content}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <form className="chat-input-form" onSubmit={handleSend}>
        <div className="chat-input-container">
          <button type="button" className="chat-plus-btn">+</button>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Message #${channelName || 'channel'}`}
            className="chat-input"
          />
          <div className="chat-input-actions">
            <button type="button" className="input-action-btn">😊</button>
            <button type="button" className="input-action-btn">GIF</button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default Chat;