package com.masterwayne.whiteboard_app.service;

import com.masterwayne.whiteboard_app.dto.ChatPayload;
import com.masterwayne.whiteboard_app.exception.SessionException;
import com.masterwayne.whiteboard_app.model.DrawPayload;
import com.masterwayne.whiteboard_app.model.Channel;
import com.masterwayne.whiteboard_app.model.ChatMessage;
import com.masterwayne.whiteboard_app.model.Participant;
import com.masterwayne.whiteboard_app.model.SessionManager;
import com.masterwayne.whiteboard_app.model.WhiteboardSession;
import com.masterwayne.whiteboard_app.persistence.PersistenceWorker;
import com.masterwayne.whiteboard_app.repository.WhiteboardSessionRepository;
import com.masterwayne.whiteboard_app.storage.FallbackStorage;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.annotation.PostConstruct;
import java.util.List;
import java.util.ArrayList;
import jakarta.annotation.PreDestroy;
import java.time.Instant;
import java.util.Collections;
import java.util.Optional;

/**
 * WhiteboardService orchestrates all whiteboard operations including session management,
 * drawing events, and chat messages. It integrates four key concepts:
 * 
 * 1. Exception Handling: Uses custom typed exceptions (SessionException, PersistenceException)
 *    with proper logging and meaningful error messages.
 * 
 * 2. File I/O: FallbackStorage writes events to JSON Lines files when DB persistence fails,
 *    enabling recovery after DB issues.
 * 
 * 3. Sockets: WebSocket integration is handled by WebSocketController and configured via WebSocketConfig.
 *    This service provides data persistence for events received over sockets.
 * 
 * 4. Threads: PersistenceWorker uses a background thread pool with BlockingQueue for async
 *    event persistence, keeping WebSocket handlers responsive.
 */
@Service
public class WhiteboardService {
    private final WhiteboardSessionRepository sessionRepository;
    private final PersistenceWorker persistenceWorker;
    private final FallbackStorage fallbackStorage;
    private final ObjectMapper objectMapper;
    private static final Logger log = LoggerFactory.getLogger(WhiteboardService.class);

    @Autowired
    public WhiteboardService(
            WhiteboardSessionRepository sessionRepository,
            PersistenceWorker persistenceWorker,
            FallbackStorage fallbackStorage,
            ObjectMapper objectMapper) {
        this.sessionRepository = sessionRepository;
        this.persistenceWorker = persistenceWorker;
        this.fallbackStorage = fallbackStorage;
        this.objectMapper = objectMapper;
    }

    /**
     * Lifecycle hook: start the background persistence worker.
     */
    @PostConstruct
    public void init() {
        persistenceWorker.start();
        log.info("WhiteboardService initialized with background persistence worker");
    }

    /**
     * Lifecycle hook: gracefully shutdown the persistence worker.
     */
    @PreDestroy
    public void destroy() {
        persistenceWorker.shutdown();
        log.info("WhiteboardService shut down");
    }

    /**
     * Creates a new whiteboard session with an initial "general" channel.
     * Throws SessionException if a session with the same name already exists.
     * 
     * @param sessionName unique session identifier
     * @param managerName name of the session creator
     * @return the newly created WhiteboardSession
     * @throws SessionException if session already exists
     */
    public WhiteboardSession createSession(String sessionName, String managerName) throws SessionException {
        try {
            Optional<WhiteboardSession> existingSession = sessionRepository.findBySessionName(sessionName);
            if (existingSession.isPresent()) {
                throw SessionException.sessionAlreadyExists(sessionName);
            }

            SessionManager manager = new SessionManager();
            manager.setName(managerName);

            Channel generalChannel = new Channel();
            generalChannel.setChannelName("general");
            generalChannel.setShapes(new ArrayList<>());
            generalChannel.setChatMessages(new ArrayList<>());

            WhiteboardSession newSession = new WhiteboardSession();
            newSession.setSessionName(sessionName);
            newSession.setManager(manager);
            newSession.setParticipants(new ArrayList<>());
            newSession.setChannels(new ArrayList<>(Collections.singletonList(generalChannel)));
            generalChannel.setSession(newSession);

            WhiteboardSession saved = sessionRepository.save(newSession);
            log.info("Session created successfully: session='{}', manager='{}'", sessionName, managerName);
            return saved;
        } catch (SessionException e) {
            log.warn("Session creation failed: {}", e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("Unexpected error during session creation", e);
            throw new SessionException("Failed to create session: " + e.getMessage(), e);
        }
    }

    /**
     * Joins a user to an existing whiteboard session.
     * Returns the session if the user is already in it (idempotent).
     * Throws SessionException if the session does not exist.
     * 
     * @param sessionName name of the session to join
     * @param userName name of the user joining
     * @return the WhiteboardSession with the new participant added
     * @throws SessionException if session not found
     */
    @Transactional
    public WhiteboardSession joinSession(String sessionName, String userName) throws SessionException {
        try {
            long start = System.currentTimeMillis();
            
            WhiteboardSession session = sessionRepository.findBySessionName(sessionName)
                    .orElseThrow(() -> SessionException.sessionNotFound(sessionName));

            // Eagerly initialize the participants collection while session is open
            List<Participant> participants = session.getParticipants();
            if (participants == null) {
                participants = new ArrayList<>();
                session.setParticipants(participants);
            } else {
                // Force initialization by calling size() on the lazy collection
                participants.size();
            }

            // Check if user is the manager or already a participant
            boolean isManager = session.getManager() != null && userName != null &&
                    session.getManager().getName().equalsIgnoreCase(userName);
            boolean alreadyParticipant = userName != null && !participants.isEmpty() &&
                    participants.stream().anyMatch(p -> userName.equalsIgnoreCase(p.getName()));

            if (alreadyParticipant) {
                throw SessionException.userAlreadyInSession(userName, sessionName);
            }
            
            if (isManager) {
                log.debug("Manager '{}' already in session '{}', returning existing session", userName, sessionName);
                return session;
            }

            Participant newParticipant = new Participant();
            newParticipant.setName(userName);
            newParticipant.setSession(session); // Set the back-reference to the session
            participants.add(newParticipant);
            WhiteboardSession saved = sessionRepository.save(session);
            
            long elapsed = System.currentTimeMillis() - start;
            log.info("User joined session: session='{}', user='{}', elapsedMs={}", sessionName, userName, elapsed);
            return saved;
        } catch (SessionException e) {
            log.warn("Join session failed: {}", e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("Unexpected error during join session", e);
            throw new SessionException("Failed to join session: " + e.getMessage(), e);
        }
    }

    /**
     * Handles draw events. Filters out preview events and delegates shape persistence to the background worker.
     * The actual DB write happens asynchronously via the PersistenceWorker thread.
     * 
     * @param sessionName session identifier
     * @param channelName channel identifier
     * @param payload the draw event (shape)
     */
    @Transactional
    public void addShape(String sessionName, String channelName, DrawPayload payload) {
        String type = payload.getType();

        // Skip ephemeral preview events - only persist final shapes
        if (type != null && (type.startsWith("shape-preview") || type.startsWith("line-segment-preview"))) {
            log.trace("Skipping preview event: type={}", type);
            return;
        }

        // Handle clear event immediately
        if ("clear".equals(type)) {
            log.debug("Clear event received for session='{}', channel='{}'", sessionName, channelName);
            clearShapes(sessionName, channelName);
            return;
        }

        // Submit final shape to background worker for async persistence
        log.debug("Submitting shape for async persistence: session='{}', channel='{}', type='{}'",
                sessionName, channelName, payload.getType());
        
        boolean submitted = persistenceWorker.submitDrawEvent(sessionName, channelName, payload);
        if (!submitted) {
            log.error("Failed to submit draw event to persistence queue - queue may be full: session='{}', channel='{}'",
                    sessionName, channelName);
        }
    }

    /**
     * Clears all shapes in a channel. Submitted to the background worker for async persistence.
     */
    private void clearShapes(String sessionName, String channelName) {
        try {
            Optional<WhiteboardSession> sessionOpt = sessionRepository.findBySessionName(sessionName);
            if (sessionOpt.isEmpty()) {
                log.warn("Session not found for clear operation: session='{}'", sessionName);
                return;
            }

            WhiteboardSession session = sessionOpt.get();
            var channel = session.getChannels().stream()
                    .filter(c -> c.getChannelName().equals(channelName))
                    .findFirst()
                    .orElse(null);

            if (channel != null) {
                channel.getShapes().clear();
                sessionRepository.save(session);
                log.info("Shapes cleared successfully: session='{}', channel='{}'", sessionName, channelName);
            } else {
                log.warn("Channel not found for clear operation: session='{}', channel='{}'", sessionName, channelName);
            }
        } catch (Exception e) {
            log.error("Error clearing shapes: session='{}', channel='{}'", sessionName, channelName, e);
        }
    }

    /**
     * Posts a chat message. Immediately returns the message object, but persists it asynchronously
     * via the background worker. On DB failure, automatically falls back to file storage.
     * 
     * @param sessionName session identifier
     * @param channelName channel identifier
     * @param payload chat message payload
     * @return the ChatMessage object (with timestamp)
     * @throws SessionException if session or channel not found
     */
    @Transactional
    public ChatMessage postChatMessage(String sessionName, String channelName, ChatPayload payload) throws SessionException {
        try {
            WhiteboardSession session = sessionRepository.findBySessionName(sessionName)
                    .orElseThrow(() -> SessionException.sessionNotFound(sessionName));

            // Verify channel exists
            session.getChannels().stream()
                    .filter(c -> c.getChannelName().equals(channelName))
                    .findFirst()
                    .orElseThrow(() -> new SessionException("Channel '" + channelName + "' not found in session '" + sessionName + "'"));

            // Create the message immediately (for frontend optimistic UI)
            ChatMessage newMessage = new ChatMessage();
            newMessage.setSenderName(payload.getSenderName());
            newMessage.setContent(payload.getContent());
            newMessage.setTimestamp(Instant.now());

            // Submit to background worker for async persistence
            log.debug("Submitting chat message for async persistence: session='{}', channel='{}', sender='{}'",
                    sessionName, channelName, payload.getSenderName());
            
            boolean submitted = persistenceWorker.submitChatMessage(sessionName, channelName, newMessage);
            if (!submitted) {
                log.error("Failed to submit chat message to persistence queue: session='{}', channel='{}'",
                        sessionName, channelName);
            }

            log.info("Chat message posted: session='{}', channel='{}', sender='{}', timestamp={}",
                    sessionName, channelName, payload.getSenderName(), newMessage.getTimestamp());
            
            return newMessage;
        } catch (SessionException e) {
            log.warn("Post chat message failed: {}", e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("Unexpected error posting chat message", e);
            throw new SessionException("Failed to post chat message: " + e.getMessage(), e);
        }
    }

    public Optional<WhiteboardSession> getSession(String sessionName) {
        return sessionRepository.findBySessionName(sessionName);
    }

    @Transactional(readOnly = true)
    public java.util.List<ChatMessage> getChatMessages(String sessionName, String channelName) throws SessionException {
        try {
            WhiteboardSession session = sessionRepository.findBySessionName(sessionName)
                    .orElseThrow(() -> SessionException.sessionNotFound(sessionName));

            return session.getChannels().stream()
                    .filter(c -> c.getChannelName().equals(channelName))
                    .findFirst()
                    .map(Channel::getChatMessages)
                    .orElseThrow(() -> new SessionException("Channel '" + channelName + "' not found in session '" + sessionName + "'"));
        } catch (SessionException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error retrieving chat messages", e);
            throw new SessionException("Failed to retrieve chat messages: " + e.getMessage(), e);
        }
    }

    @Transactional(readOnly = true)
    public java.util.List<DrawPayload> getShapes(String sessionName, String channelName) throws SessionException {
        try {
            WhiteboardSession session = sessionRepository.findBySessionName(sessionName)
                    .orElseThrow(() -> SessionException.sessionNotFound(sessionName));

            return session.getChannels().stream()
                    .filter(c -> c.getChannelName().equals(channelName))
                    .findFirst()
                    .map(Channel::getShapes)
                    .orElseThrow(() -> new SessionException("Channel '" + channelName + "' not found in session '" + sessionName + "'"));
        } catch (SessionException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error retrieving shapes", e);
            throw new SessionException("Failed to retrieve shapes: " + e.getMessage(), e);
        }
    }

    /**
     * Replays all fallback events back into the database.
     * Called during recovery when database becomes available again.
     * 
     * @return number of events successfully replayed
     */
    @Transactional
    public int replayFallbackEvents() {
        int successCount = 0;
        int failureCount = 0;

        log.info("Starting replay of fallback events...");
        fallbackStorage.backupFallbackFile();

        java.util.List<FallbackStorage.FallbackEvent> events = fallbackStorage.readFallbackEvents();
        log.info("Found {} fallback events to replay", events.size());

        for (FallbackStorage.FallbackEvent event : events) {
            try {
                replayEvent(event);
                successCount++;
            } catch (Exception e) {
                failureCount++;
                log.error("Failed to replay event: {}", event, e);
            }
        }

        if (successCount > 0) {
            try {
                fallbackStorage.clearFallbackFile();
                log.info("Fallback file cleared after successful replay");
            } catch (Exception e) {
                log.warn("Failed to clear fallback file", e);
            }
        }

        log.info("Fallback event replay completed: {} succeeded, {} failed", successCount, failureCount);
        return successCount;
    }

    /**
     * Replays a single fallback event back into the database.
     */
    private void replayEvent(FallbackStorage.FallbackEvent event) throws Exception {
        if ("DRAW".equals(event.getEventType())) {
            DrawPayload payload = objectMapper.convertValue(event.getData(), DrawPayload.class);

            WhiteboardSession session = sessionRepository.findBySessionName(event.getSessionName())
                    .orElseThrow(() -> new SessionException("Session '" + event.getSessionName() + "' not found during replay"));

            Channel channel = session.getChannels().stream()
                    .filter(c -> c.getChannelName().equals(event.getChannelName()))
                    .findFirst()
                    .orElseThrow(() -> new SessionException("Channel '" + event.getChannelName() + "' not found during replay"));

            channel.getShapes().add(payload);
            sessionRepository.save(session);
            log.debug("Replayed draw event: session='{}', channel='{}', type='{}'", 
                    event.getSessionName(), event.getChannelName(), payload.getType());

        } else if ("CHAT".equals(event.getEventType())) {
            ChatMessage message = objectMapper.convertValue(event.getData(), ChatMessage.class);

            WhiteboardSession session = sessionRepository.findBySessionName(event.getSessionName())
                    .orElseThrow(() -> new SessionException("Session '" + event.getSessionName() + "' not found during replay"));

            Channel channel = session.getChannels().stream()
                    .filter(c -> c.getChannelName().equals(event.getChannelName()))
                    .findFirst()
                    .orElseThrow(() -> new SessionException("Channel '" + event.getChannelName() + "' not found during replay"));

            channel.getChatMessages().add(message);
            sessionRepository.save(session);
            log.debug("Replayed chat message: session='{}', channel='{}', sender='{}'", 
                    event.getSessionName(), event.getChannelName(), message.getSenderName());
        }
    }
}