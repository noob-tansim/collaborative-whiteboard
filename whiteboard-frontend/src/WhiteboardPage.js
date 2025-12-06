import React, { useEffect, useRef, useState } from 'react';
// CHANGED: We import Client, not 'over'
import { Client } from '@stomp/stompjs'; 
import SockJS from 'sockjs-client/dist/sockjs';
import './WhiteboardPage.css';
import { FaSun, FaMoon } from 'react-icons/fa';

// Import our components
import Canvas from './Canvas';
import Chat from './Chat';
import ChannelManager from './ChannelManager';

function WhiteboardPage({ session, onLogout, onSessionUpdate }) {
  const { sessionName, userName, channelName } = session;
  const stompClient = useRef(null);

  // State to hold all draw events and chat messages
  const [drawEvents, setDrawEvents] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [previewShape, setPreviewShape] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  // Channel management state
  const [channels, setChannels] = useState([
    { name: 'general', logo: '💬', type: 'public' },
    { name: 'design', logo: '🎨', type: 'public' },
    { name: 'development', logo: '💻', type: 'public' }
  ]);
  const [currentChannel, setCurrentChannel] = useState(channelName);

  useEffect(() => {
    // Cleanup function to deactivate on unmount or channel change
    return () => {
      if (stompClient.current && stompClient.current.active) {
        console.log('Deactivating STOMP client');
        stompClient.current.deactivate();
      }
    };
  }, []);

  useEffect(() => {
    // Connect to WebSocket when channel changes
    connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChannel]);

  // CHANGED: This whole function is updated to use new Client()
  const connect = () => {
    // Deactivate existing connection if any
    if (stompClient.current && stompClient.current.active) {
      stompClient.current.deactivate();
    }

    // Create a new Client instance
    const sockJsUrl = process.env.REACT_APP_WS_URL || '/ws';
    
    stompClient.current = new Client({
      webSocketFactory: () => new SockJS(sockJsUrl),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: onConnected,
      onStompError: onError,
      onWebSocketError: onError,
      onWebSocketClose: () => {
        console.log('WebSocket connection closed');
        setIsConnected(false);
      },
      debug: (str) => {
        console.log('STOMP Debug:', str);
      }
    });

    // Activate the client
    try {
      stompClient.current.activate();
    } catch (error) {
      console.error('Error activating STOMP client:', error);
      setIsConnected(false);
    }
  };


  const onConnected = () => {
    console.log('Connected to WebSocket for channel:', currentChannel);
    setIsConnected(true);

    // Check if client is connected before subscribing
    if (!stompClient.current || !stompClient.current.connected) {
      console.error('STOMP client not connected');
      return;
    }

    try {
      // Subscribe to drawing topic
      const drawSub = stompClient.current.subscribe(
        `/topic/whiteboard/${sessionName}/${currentChannel}`,
        onDrawEventReceived
      );
      console.log('Subscribed to whiteboard topic:', drawSub.id);

      // Subscribe to chat topic
      const chatSub = stompClient.current.subscribe(
        `/topic/chat/${sessionName}/${currentChannel}`,
        onChatReceived
      );
      console.log('Subscribed to chat topic:', chatSub.id);

      // Load historical data AFTER subscribing
      loadHistory().catch(err => 
        console.error('Failed to load history, continuing anyway:', err)
      );
    } catch (error) {
      console.error('Error subscribing to topics:', error);
    }
  };

  // Fetch historical drawing and chat data from the backend
  const loadHistory = async () => {
    try {
      console.log(`Fetching history for session: ${sessionName}, channel: ${currentChannel}`);
      
      // Fetch shapes (drawing history)
      const shapesResponse = await fetch(
        `/api/sessions/${sessionName}/channels/${currentChannel}/shapes`
      );
      if (shapesResponse.ok) {
        const shapes = await shapesResponse.json();
        console.log('Loaded shapes history:', shapes.length, shapes);
        setDrawEvents(shapes || []);
      } else {
        console.warn('Failed to load shapes, status:', shapesResponse.status);
      }

      // Fetch chat messages history
      const chatResponse = await fetch(
        `/api/sessions/${sessionName}/channels/${currentChannel}/chat`
      );
      if (chatResponse.ok) {
        const messages = await chatResponse.json();
        console.log('Loaded chat history:', messages.length, messages);
        setChatMessages(messages || []);
      } else {
        console.warn('Failed to load chat messages, status:', chatResponse.status);
      }
    } catch (error) {
      console.error('Error loading history:', error);
      // Don't throw - let the app continue even if history fails
    }
  };

  const onError = (err) => {
    console.error('WebSocket connection error:', err);
    setIsConnected(false);
    // client will automatically try to reconnect
  };

  const onDrawEventReceived = (payload) => {
    const drawEvent = JSON.parse(payload.body);
    const t = drawEvent.type || '';

    if (t === 'clear') {
      setDrawEvents([]);
      setPreviewShape(null);
      return;
    }
    if (t.startsWith('shape-preview')) {
      // Remote live preview: do NOT push to history; just show overlay
      setPreviewShape(drawEvent);
      return;
    }
    // Finalized draw event: add to history if not a duplicate and clear any preview overlay
    setDrawEvents((prev) => {
      const last = prev.length ? prev[prev.length - 1] : null;
      const same = last &&
        last.type === drawEvent.type &&
        last.x1 === drawEvent.x1 && last.y1 === drawEvent.y1 &&
        last.x2 === drawEvent.x2 && last.y2 === drawEvent.y2 &&
        last.color === drawEvent.color && last.lineWidth === drawEvent.lineWidth;
      return same ? prev : [...prev, drawEvent];
    });
    setPreviewShape(null);
  };

  const onChatReceived = (payload) => {
    const chatMessage = JSON.parse(payload.body);

    // If we previously added an optimistic message locally, replace it
    // with the authoritative message from the server instead of
    // appending a duplicate. We match on senderName + content which
    // is sufficient for this app's simple chat flow.
    setChatMessages((prevMessages) => {
      const optimisticIndex = prevMessages.findIndex(
        (m) => m.optimistic && m.senderName === chatMessage.senderName && m.content === chatMessage.content
      );
      if (optimisticIndex !== -1) {
        const copy = [...prevMessages];
        copy[optimisticIndex] = chatMessage; // replace optimistic with server message
        return copy;
      }
      return [...prevMessages, chatMessage];
    });
  };

  // --- Functions to SEND data (passed to child components) ---

  const sendDrawEvent = (drawPayload) => {
    if (drawPayload.type === 'clear') {
      // Immediate local clear so user sees instant feedback
      setDrawEvents([]);
    }
    
    if (!stompClient.current || !stompClient.current.connected) {
      console.error('Cannot send draw event: STOMP client not connected.');
      return;
    }
    
    try {
      stompClient.current.publish({
        destination: `/app/draw/${sessionName}/${currentChannel}`,
        body: JSON.stringify(drawPayload),
      });
    } catch (error) {
      console.error('Error sending draw event:', error);
    }
  };

  // Local helper to add a finalized shape immediately (for instant visual)
  const addLocalDrawEvent = (event) => {
    setDrawEvents((prev) => [...prev, event]);
  };

  const sendChatMessage = (content) => {
    if (!content || !content.trim()) return;
    
    const trimmed = content.trim();
    
    if (!stompClient.current || !stompClient.current.connected) {
      console.error('Cannot send chat message: STOMP client not connected.');
      // Still add to local state for better UX
      setChatMessages(prev => [...prev, { 
        senderName: userName, 
        content: trimmed, 
        timestamp: new Date().toISOString(), 
        optimistic: true,
        error: true 
      }]);
      return;
    }
    
    // Optimistic local update for real-time feel
    setChatMessages(prev => [...prev, { 
      senderName: userName, 
      content: trimmed, 
      timestamp: new Date().toISOString(), 
      optimistic: true 
    }]);
    
    try {
      const chatPayload = { senderName: userName, content: trimmed };
      stompClient.current.publish({
        destination: `/app/chat/${sessionName}/${currentChannel}`,
        body: JSON.stringify(chatPayload),
      });
    } catch (error) {
      console.error('Error sending chat message:', error);
    }
  };

  // Channel management functions
  const handleChannelSelect = (channelName) => {
    setCurrentChannel(channelName);
    // Update the session state
    onSessionUpdate({ sessionName, userName, channelName });
    // Clear current data to show loading state
    setDrawEvents([]);
    setChatMessages([]);
    // Disconnect and reconnect to new channel
    if (stompClient.current) {
      stompClient.current.deactivate();
    }
  };

  const handleChannelCreate = (channelData) => {
    // Add new channel to the list
    setChannels(prev => [...prev, channelData]);
    // Switch to the new channel
    handleChannelSelect(channelData.name);
  };

  return (
    <div className={`whiteboard-container ${darkMode ? 'dark-mode' : ''}`}>
      <ChannelManager
        sessionName={sessionName}
        userName={userName}
        currentChannel={currentChannel}
        channels={channels}
        onChannelSelect={handleChannelSelect}
        onChannelCreate={handleChannelCreate}
        onLogout={onLogout}
        darkMode={darkMode}
      />

      <div className="main-content">
        <div className="channel-header">
          <div className="channel-info">
            <span className="channel-icon">
              {channels.find(c => c.name === currentChannel)?.logo || '📝'}
            </span>
            <h2 className="channel-title">{currentChannel}</h2>
          </div>
          <div className="header-actions">
            <div className="connection-status">
              <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
              <span className="status-text">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <button 
              className="dark-mode-toggle" 
              onClick={() => setDarkMode(!darkMode)}
              title="Toggle Dark Mode"
            >
              {darkMode ? <FaSun /> : <FaMoon />}
            </button>
            <button className="logout-btn-header" onClick={onLogout}>
              <span className="logout-icon">⏏</span>
              <span className="logout-text">Logout</span>
            </button>
          </div>
        </div>

        <div className="content-area">
          <div className="whiteboard-area">
            {/* Render the Canvas component */}
            <Canvas 
              drawEvents={drawEvents} 
              sendDrawEvent={sendDrawEvent}
              previewShape={previewShape}
              addLocalDrawEvent={addLocalDrawEvent}
            />
          </div>
          
          <div className="chat-column">
            {/* Render the Chat component */}
            <Chat 
              chatMessages={chatMessages} 
              sendChatMessage={sendChatMessage}
              channelName={currentChannel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default WhiteboardPage;