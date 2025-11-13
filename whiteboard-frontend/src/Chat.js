import React, { useState, useRef, useEffect } from 'react';
import './Chat.css';

function Chat({ chatMessages, sendChatMessage }) {
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

  return (
    <div className="chat-area">
      <h3 className="chat-title">Session Chat</h3>
      <div className="message-list">
        {chatMessages.length === 0 && (
          <div className="empty-chat">No messages yet.</div>
        )}
        {chatMessages.map((msg, index) => {
          const dt = msg.timestamp ? new Date(msg.timestamp) : new Date();
          const timeLabel = dt.toLocaleString([], {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
          });
          return (
            <div key={index} className={`chat-message${msg.optimistic ? ' optimistic' : ''}`}>
              <span className="sender-name">{msg.senderName}</span>
              <span className="timestamp">{timeLabel}</span>
              <span className="message-content">: {msg.content}</span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <form className="chat-input-form" onSubmit={handleSend}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="chat-input"
        />
        <button type="submit" className="chat-send-btn">
          Send
        </button>
      </form>
    </div>
  );
}

export default Chat;