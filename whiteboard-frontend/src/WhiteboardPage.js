import React, { useEffect, useRef, useState } from 'react';
// CHANGED: We import Client, not 'over'
import { Client } from '@stomp/stompjs'; 
import SockJS from 'sockjs-client/dist/sockjs';
import './WhiteboardPage.css';

// Import our new components
import Canvas from './Canvas';
import Chat from './Chat';

function WhiteboardPage({ session, onLogout }) {
  const { sessionName, userName, channelName } = session;
  const stompClient = useRef(null);

  // State to hold all draw events and chat messages
  const [drawEvents, setDrawEvents] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [previewShape, setPreviewShape] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {

    // Connect to WebSocket
    connect();

    // Disconnect on component unmount
    return () => {
      if (stompClient.current) {
        // CHANGED: use deactivate() instead of disconnect()
        stompClient.current.deactivate(); 
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount and unmount

  // CHANGED: This whole function is updated to use new Client()
  const connect = () => {
    // Create a new Client instance
    stompClient.current = new Client({
      webSocketFactory: () => new SockJS('/ws'), // Your backend WebSocket endpoint
      reconnectDelay: 5000,
      onConnect: onConnected,
      onStompError: onError,
      onWebSocketError: onError,
    });

    // Activate the client
    stompClient.current.activate();
  };


  const onConnected = () => {
    console.log('Connected to WebSocket');
    setIsConnected(true);

    // Load historical data FIRST, then subscribe
    loadHistory()
      .catch(err => console.error('Failed to load history, continuing anyway:', err))
      .finally(() => {
        // Subscribe to drawing topic AFTER history is loaded (or failed)
        stompClient.current.subscribe(
          `/topic/whiteboard/${sessionName}/${channelName}`,
          onDrawEventReceived
        );

        // Subscribe to chat topic AFTER history is loaded (or failed)
        stompClient.current.subscribe(
          `/topic/chat/${sessionName}/${channelName}`,
          onChatReceived
        );
        console.log('Subscribed to WebSocket topics');
      });
  };

  // Fetch historical drawing and chat data from the backend
  const loadHistory = async () => {
    try {
      console.log(`Fetching history for session: ${sessionName}, channel: ${channelName}`);
      
      // Fetch shapes (drawing history)
      const shapesResponse = await fetch(
        `/api/sessions/${sessionName}/channels/${channelName}/shapes`
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
        `/api/sessions/${sessionName}/channels/${channelName}/chat`
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
    if (stompClient.current && stompClient.current.connected) {
      stompClient.current.publish({
        destination: `/app/draw/${sessionName}/${channelName}`,
        body: JSON.stringify(drawPayload),
      });
    } else {
      console.error('Cannot send draw event: STOMP client not connected.');
    }
  };

  // Local helper to add a finalized shape immediately (for instant visual)
  const addLocalDrawEvent = (event) => {
    setDrawEvents((prev) => [...prev, event]);
  };

  const sendChatMessage = (content) => {
    if (!content || !content.trim()) return;
    const trimmed = content.trim();
    // Optimistic local update for real-time feel
    setChatMessages(prev => [...prev, { senderName: userName, content: trimmed, timestamp: new Date().toISOString(), optimistic: true }]);
    if (stompClient.current && stompClient.current.connected) {
      const chatPayload = { senderName: userName, content: trimmed };
      stompClient.current.publish({
        destination: `/app/chat/${sessionName}/${channelName}`,
        body: JSON.stringify(chatPayload),
      });
    } else {
      console.error('Cannot send chat message: STOMP client not connected.');
    }
  };

  return (
    <div className="whiteboard-container">
      <header className="whiteboard-header">
        <h3>
          Session: <span>{sessionName}</span>
        </h3>
        <h3>
          User: <span>{userName}</span>
        </h3>
        <div className="connection-status">
            Status: 
            <span className={isConnected ? 'connected' : 'disconnected'}>
                {isConnected ? ' Connected' : ' Disconnected'}
            </span>
        </div>
        <button onClick={onLogout} className="btn-logout">
          Logout
        </button>
      </header>

      <div className="main-content">
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
          />
        </div>
      </div>
    </div>
  );
}

export default WhiteboardPage;