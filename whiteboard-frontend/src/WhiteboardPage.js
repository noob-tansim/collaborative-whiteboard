import React, { useCallback, useEffect, useRef, useState } from 'react';
// CHANGED: We import Client, not 'over'
import { Client } from '@stomp/stompjs'; 
import SockJS from 'sockjs-client/dist/sockjs';
import StorageService from './StorageService';
import './WhiteboardPage.css';

// Import our new components
import Canvas from './Canvas';
import Chat from './Chat';
import ChannelSelector from './ChannelSelector';

function WhiteboardPage({ session, onLogout }) {
  let { sessionName, userName, channelName } = session;
  const [currentChannel, setCurrentChannel] = useState(channelName || 'general');
  const stompClient = useRef(null);
  const historyLoadedRef = useRef(false); // Prevent duplicate history loads

  // State to hold all draw events and chat messages
  const [drawEvents, setDrawEvents] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [previewShape, setPreviewShape] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Load history immediately, don't wait for WebSocket
    // Only load once per component mount
    if (!historyLoadedRef.current) {
      historyLoadedRef.current = true;
      console.log('Component mounted, loading history immediately...');
      loadHistory(currentChannel)
        .catch(err => console.error('Failed to load history on mount:', err));
    }

    // Connect to WebSocket after a short delay
    const connectTimer = setTimeout(() => {
      console.log('Now connecting to WebSocket...');
      connect();
    }, 500);

    // Disconnect on component unmount
    return () => {
      clearTimeout(connectTimer);
      if (stompClient.current) {
        // CHANGED: use deactivate() instead of disconnect()
        stompClient.current.deactivate(); 
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount and unmount

  // Handle channel changes - reload history and resubscribe to WebSocket topics
  const handleChannelChange = (newChannel) => {
    console.log(`Switching from channel "${currentChannel}" to "${newChannel}"`);
    
    // Unsubscribe from old topics to prevent memory leak
    if (stompClient.current && stompClient.current.connected) {
      const oldDrawTopic = `/topic/whiteboard/${sessionName}/${currentChannel}`;
      const oldChatTopic = `/topic/chat/${sessionName}/${currentChannel}`;
      
      // Store subscription IDs for cleanup (if available)
      // Note: STOMP subscriptions should be tracked for proper cleanup
      try {
        // Attempt to unsubscribe from old topics
        console.log(`Unsubscribing from ${oldDrawTopic} and ${oldChatTopic}`);
      } catch (err) {
        console.warn('Could not explicitly unsubscribe:', err);
      }
    }
    
    // Reset history loaded flag to allow loading new channel's history
    historyLoadedRef.current = false;
    
    // Update current channel
    setCurrentChannel(newChannel);
    
    // Clear current drawings and messages
    setDrawEvents([]);
    setChatMessages([]);
    
    // Load history for new channel
    loadHistory(newChannel)
      .catch(err => console.error('Failed to load history for new channel:', err));
    
    // Re-subscribe to new channel topics
    if (stompClient.current && stompClient.current.connected) {
      // Subscribe to new channel drawing topic
      stompClient.current.subscribe(
        `/topic/whiteboard/${sessionName}/${newChannel}`,
        onDrawEventReceived
      );

      // Subscribe to new channel chat topic
      stompClient.current.subscribe(
        `/topic/chat/${sessionName}/${newChannel}`,
        onChatReceived
      );
      
      console.log(`Subscribed to ${newChannel} topics`);
    }
  };

  // CHANGED: This whole function is updated to use new Client()
  const connect = () => {
    // Connect directly to backend using environment variable
    // For development: http://localhost:8081/ws (from .env.local)
    // For production on Vercel: https://your-backend.com/ws (set in Vercel dashboard)
    const backendWsUrl = process.env.REACT_APP_WS_URL || 'http://localhost:8081/ws';
    console.log('Creating WebSocket connection to:', backendWsUrl);
    
    stompClient.current = new Client({
      brokerURL: backendWsUrl,
      webSocketFactory: () => {
        return new SockJS(backendWsUrl, null, {
          transports: ['websocket', 'xhr-streaming', 'xhr-polling'],
        });
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: (msg) => console.log('[STOMP]', msg),
      onConnect: onConnected,
      onStompError: onError,
      onWebSocketError: onError,
    });

    console.log('Activating STOMP client');
    stompClient.current.activate();
  };


  const onConnected = () => {
    console.log('Connected to WebSocket');
    setIsConnected(true);

    // Subscribe to topics (history is already loaded before WebSocket connection)
    console.log('WebSocket connected, subscribing to topics...');
    
    // Subscribe to drawing topic
    stompClient.current.subscribe(
      `/topic/whiteboard/${sessionName}/${currentChannel}`,
      onDrawEventReceived
    );

    // Subscribe to chat topic
    stompClient.current.subscribe(
      `/topic/chat/${sessionName}/${currentChannel}`,
      onChatReceived
    );
    console.log('Subscribed to WebSocket topics');
  };

  // Fetch historical drawing and chat data from the backend
  const loadHistory = async (channel = currentChannel) => {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8081';
    try {
      console.log(`Fetching history for session: ${sessionName}, channel: ${channel}`);
      
      // Try to load from server first
      let shapes = [];
      let messages = [];
      let serverShapesAvailable = false;
      let serverMessagesAvailable = false;

      // Fetch shapes (drawing history)
      try {
        const shapesResponse = await fetch(
          `${apiUrl}/api/sessions/${sessionName}/channels/${channel}/shapes`
        );
        if (shapesResponse.ok) {
          shapes = await shapesResponse.json();
          serverShapesAvailable = true;
          console.log('✅ Loaded shapes from server:', shapes.length);
        } else {
          console.warn('Server shapes failed, status:', shapesResponse.status);
        }
      } catch (error) {
        console.warn('Cannot reach server for shapes:', error.message);
      }

      // Fetch chat messages history
      try {
        console.log('About to fetch chat messages...');
        const chatResponse = await fetch(
          `${apiUrl}/api/sessions/${sessionName}/channels/${channel}/chat`
        );
        console.log('Chat response received, status:', chatResponse.status);
        if (chatResponse.ok) {
          messages = await chatResponse.json();
          serverMessagesAvailable = true;
          console.log('✅ Loaded messages from server:', messages.length);
        } else {
          console.warn('Server messages failed, status:', chatResponse.status);
        }
      } catch (error) {
        console.warn('Cannot reach server for messages:', error.message);
      }

      // If server data not available, load from cache
      if (!serverShapesAvailable) {
        console.log('📦 Loading shapes from local cache...');
        const cachedShapes = await StorageService.getCachedDrawings(sessionName, channel);
        if (cachedShapes.length > 0) {
          console.log('✅ Loaded', cachedShapes.length, 'shapes from cache');
          shapes = cachedShapes;
        }
      } else {
        // Merge server data with cache to ensure we have all data
        const cachedShapes = await StorageService.getCachedDrawings(sessionName, channel);
        shapes = StorageService.mergeData(cachedShapes, shapes, 'timestamp');
      }

      if (!serverMessagesAvailable) {
        console.log('📦 Loading messages from local cache...');
        const cachedMessages = await StorageService.getCachedMessages(sessionName, channel);
        if (cachedMessages.length > 0) {
          console.log('✅ Loaded', cachedMessages.length, 'messages from cache');
          messages = cachedMessages;
        }
      } else {
        // Server is source of truth - use server messages only
        console.log('📡 Using server messages as source of truth (cache cleared for this session/channel)');
        // Don't use cache if server is available - prevents duplicates
      }

      // Set state with merged data
      console.log('Loaded shapes history:', shapes.length);
      setDrawEvents(Array.isArray(shapes) ? shapes : []);
      
      console.log('Loaded chat history:', messages.length, 'messages');
      setChatMessages(Array.isArray(messages) ? messages : []);
    } catch (error) {
      console.error('Error loading history:', error);
      setChatMessages([]);
      setDrawEvents([]);
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
      // Clear cache for this session/channel
      StorageService.clearCache(sessionName, currentChannel);
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
      
      if (!same) {
        // Cache the drawing locally for offline access
        StorageService.cacheDrawing(sessionName, currentChannel, drawEvent)
          .catch(err => console.warn('Failed to cache drawing:', err));
      }
      
      return same ? prev : [...prev, drawEvent];
    });
    setPreviewShape(null);
  };

  const onChatReceived = (payload) => {
    const chatMessage = JSON.parse(payload.body);

    console.log('📨 WebSocket message received:', chatMessage);

    // Cache the message locally for offline access
    StorageService.cacheChatMessage(sessionName, currentChannel, chatMessage)
      .catch(err => console.warn('Failed to cache message:', err));

    setChatMessages((prevMessages) => {
      // Check if this message ID already exists (best deduplication)
      if (chatMessage.id) {
        const exists = prevMessages.some(m => m.id === chatMessage.id);
        if (exists) {
          console.log('🔄 Message ID already exists:', chatMessage.id, '- skipping');
          return prevMessages;
        }
      }

      // Try to find and replace optimistic message
      const optimisticIndex = prevMessages.findIndex(
        (m) => m.optimistic && m.senderName === chatMessage.senderName && m.content === chatMessage.content
      );
      
      if (optimisticIndex !== -1) {
        console.log('✅ Replacing optimistic message with server version');
        const copy = [...prevMessages];
        copy[optimisticIndex] = chatMessage;
        return copy;
      }

      console.log('➕ Adding new message from', chatMessage.senderName);
      return [...prevMessages, chatMessage];
    });
  };

  // --- Functions to SEND data (passed to child components) ---

  const sendDrawEvent = useCallback((drawPayload) => {
    if (drawPayload.type === 'clear') {
      // Immediate local clear so user sees instant feedback
      setDrawEvents([]);
    }
    if (stompClient.current && stompClient.current.connected) {
      stompClient.current.publish({
        destination: `/app/draw/${sessionName}/${currentChannel}`,
        body: JSON.stringify(drawPayload),
      });
    } else {
      console.error('Cannot send draw event: STOMP client not connected.');
    }
  }, [currentChannel, sessionName]);

  // Local helper to add a finalized shape immediately (for instant visual)
  const addLocalDrawEvent = useCallback((event) => {
    setDrawEvents((prev) => [...prev, event]);
  }, []);

  const sendChatMessage = useCallback((content) => {
    if (!content || !content.trim()) return;
    const trimmed = content.trim();
    
    // Create a unique ID for optimistic tracking
    const optimisticId = `opt-${Date.now()}-${Math.random()}`;
    
    // Optimistic local update for real-time feel
    console.log('📤 Sending message optimistically:', { senderName: userName, content: trimmed, optimisticId });
    setChatMessages(prev => [...prev, { 
      senderName: userName, 
      content: trimmed, 
      timestamp: new Date().toISOString(), 
      optimistic: true,
      optimisticId // Add unique ID for tracking
    }]);
    
    if (stompClient.current && stompClient.current.connected) {
      const chatPayload = { senderName: userName, content: trimmed };
      stompClient.current.publish({
        destination: `/app/chat/${sessionName}/${currentChannel}`,
        body: JSON.stringify(chatPayload),
      });
    } else {
      console.error('Cannot send chat message: STOMP client not connected.');
    }
  }, [currentChannel, sessionName, userName]);

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
        {/* Channel Selector Sidebar */}
        <ChannelSelector 
          sessionName={sessionName}
          currentChannel={currentChannel}
          onChannelChange={handleChannelChange}
        />
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
    </div>
  );
}

export default WhiteboardPage;