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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.scheduling.annotation.Scheduled;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.annotation.PostConstruct;
import java.util.List;
import java.util.ArrayList;
import jakarta.annotation.PreDestroy;
import java.time.Instant;
import java.util.Collections;
import java.util.Optional;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class WhiteboardService {
    private final WhiteboardSessionRepository sessionRepository;
    private final PersistenceWorker persistenceWorker;
    private final FallbackStorage fallbackStorage;
    private final ObjectMapper objectMapper;
    @Value("${whiteboard.replay.enabled:true}")
    private boolean replayEnabled;
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

    @PostConstruct
    public void init() {
        persistenceWorker.start();
        log.info("WhiteboardService initialized with background persistence worker");
    }

    @PreDestroy
    public void destroy() {
        persistenceWorker.shutdown();
        log.info("WhiteboardService shut down");
    }

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

    @Transactional
    public WhiteboardSession joinSession(String sessionName, String userName) throws SessionException {
        try {
            long start = System.currentTimeMillis();
            
            WhiteboardSession session = loadSessionGraph(sessionName);

            List<Participant> participants = session.getParticipants();
            if (participants == null) {
                participants = new ArrayList<>();
                session.setParticipants(participants);
            }

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
            newParticipant.setSession(session);
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

    @Transactional
    public void addShape(String sessionName, String channelName, DrawPayload payload) {
        String type = payload.getType();

        if (type != null && (type.startsWith("shape-preview") || type.startsWith("line-segment-preview"))) {
            log.trace("Skipping preview event: type={}", type);
            return;
        }

        if ("clear".equals(type)) {
            log.debug("Clear event received for session='{}', channel='{}'", sessionName, channelName);
            clearShapes(sessionName, channelName);
            return;
        }

        // Ensure older DB schemas (created when some fields were primitives) don't reject newer
        // event types like 'text'/'text-move'/'text-delete' due to NOT NULL constraints.
        normalizeDrawPayloadForPersistence(payload);

        log.debug("Submitting shape for async persistence: session='{}', channel='{}', type='{}'",
                sessionName, channelName, payload.getType());
        
        boolean submitted = persistenceWorker.submitDrawEvent(sessionName, channelName, payload);
        if (!submitted) {
            log.error("Failed to submit draw event to persistence queue - queue may be full: session='{}', channel='{}'",
                    sessionName, channelName);
        }
    }

    private void normalizeDrawPayloadForPersistence(DrawPayload payload) {
        if (payload == null) return;

        // If DB schema was created when lineWidth was a primitive, it may be NOT NULL.
        if (payload.getLineWidth() == null) {
            payload.setLineWidth(1);
        }

        // Same idea for coordinates if schema was created with primitive doubles.
        if (payload.getX1() == null) payload.setX1(0.0);
        if (payload.getY1() == null) payload.setY1(0.0);
        if (payload.getX2() == null) payload.setX2(0.0);
        if (payload.getY2() == null) payload.setY2(0.0);
    }

    private void clearShapes(String sessionName, String channelName) {
        try {
            WhiteboardSession session = loadSessionGraph(sessionName);
            Map<String, Channel> channelMap = buildChannelMap(session);
            Channel channel = channelMap.get(channelName);

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

    @Transactional
    public ChatMessage postChatMessage(String sessionName, String channelName, ChatPayload payload) throws SessionException {
        try {
            WhiteboardSession session = loadSessionGraph(sessionName);

            Map<String, Channel> channelMap = buildChannelMap(session);
            if (!channelMap.containsKey(channelName)) {
                throw new SessionException("Channel '" + channelName + "' not found in session '" + sessionName + "'");
            }

            ChatMessage newMessage = new ChatMessage();
            newMessage.setSenderName(payload.getSenderName());
            newMessage.setContent(payload.getContent());
            newMessage.setMessageType(payload.getMessageType());
            newMessage.setAttachmentUrl(payload.getAttachmentUrl());
            newMessage.setAttachmentName(payload.getAttachmentName());
            newMessage.setAttachmentContentType(payload.getAttachmentContentType());
            newMessage.setAttachmentSize(payload.getAttachmentSize());
            newMessage.setTimestamp(Instant.now());

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

    @Transactional(readOnly = true)
    public Optional<WhiteboardSession> getSession(String sessionName) {
        // First load manager and channels
        Optional<WhiteboardSession> sessionOpt = sessionRepository.findCompleteSessionBySessionName(sessionName);
        
        if (sessionOpt.isPresent()) {
            WhiteboardSession session = sessionOpt.get();
            
            // Separately load participants to avoid multiple bags issue
            sessionRepository.findWithParticipantsBySessionName(sessionName)
                    .ifPresent(sess -> session.setParticipants(sess.getParticipants()));
            
            // Initialize channel collections
            if (session.getChannels() != null) {
                for (Channel channel : session.getChannels()) {
                    if (channel.getChatMessages() != null) {
                        channel.getChatMessages().size();
                    }
                    if (channel.getShapes() != null) {
                        channel.getShapes().size();
                    }
                }
            }
        }
        
        return sessionOpt;
    }

    @Transactional(readOnly = true)
    public java.util.List<ChatMessage> getChatMessages(String sessionName, String channelName) throws SessionException {
        try {
            WhiteboardSession session = loadSessionGraph(sessionName);

            List<Channel> channels = session.getChannels();
            if (channels == null) {
                throw new SessionException("Channel '" + channelName + "' not found in session '" + sessionName + "'");
            }
            
            Map<String, Channel> channelMap = channels.stream()
                    .collect(Collectors.toMap(Channel::getChannelName, Function.identity()));
            Channel channel = channelMap.get(channelName);
            if (channel == null) {
                throw new SessionException("Channel '" + channelName + "' not found in session '" + sessionName + "'");
            }
            
            List<ChatMessage> messages = channel.getChatMessages();
            return messages != null ? messages : new ArrayList<>();
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
            WhiteboardSession session = loadSessionGraph(sessionName);

            List<Channel> channels = session.getChannels();
            if (channels == null) {
                throw new SessionException("Channel '" + channelName + "' not found in session '" + sessionName + "'");
            }
            
            Map<String, Channel> channelMap = channels.stream()
                    .collect(Collectors.toMap(Channel::getChannelName, Function.identity()));
            Channel channel = channelMap.get(channelName);
            if (channel == null) {
                throw new SessionException("Channel '" + channelName + "' not found in session '" + sessionName + "'");
            }
            
            List<DrawPayload> shapes = channel.getShapes();
            return shapes != null ? shapes : new ArrayList<>();
        } catch (SessionException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error retrieving shapes", e);
            throw new SessionException("Failed to retrieve shapes: " + e.getMessage(), e);
        }
    }

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

    @Scheduled(initialDelayString = "${whiteboard.replay.initial-delay:60000}",
            fixedDelayString = "${whiteboard.replay.interval:60000}")
    @Transactional
    public void scheduledFallbackReplay() {
        if (!replayEnabled) {
            return;
        }
        long pendingEvents = fallbackStorage.getFallbackEventCount();
        if (pendingEvents == 0) {
            return;
        }
        try {
            int replayed = replayFallbackEvents();
            log.info("Scheduled fallback replay processed {} events", replayed);
        } catch (Exception e) {
            log.warn("Scheduled fallback replay failed", e);
        }
    }

    private void replayEvent(FallbackStorage.FallbackEvent event) throws Exception {
        if ("DRAW".equals(event.getEventType())) {
            DrawPayload payload = objectMapper.convertValue(event.getData(), DrawPayload.class);

            WhiteboardSession session = loadSessionGraph(event.getSessionName());

            Map<String, Channel> channelMap = buildChannelMap(session);
            Channel channel = channelMap.get(event.getChannelName());
            if (channel == null) {
                throw new SessionException("Channel '" + event.getChannelName() + "' not found during replay");
            }

            channel.getShapes().add(payload);
            sessionRepository.save(session);
            log.debug("Replayed draw event: session='{}', channel='{}', type='{}'", 
                    event.getSessionName(), event.getChannelName(), payload.getType());

        } else if ("CHAT".equals(event.getEventType())) {
            ChatMessage message = objectMapper.convertValue(event.getData(), ChatMessage.class);

            WhiteboardSession session = loadSessionGraph(event.getSessionName());

            Map<String, Channel> channelMap = buildChannelMap(session);
            Channel channel = channelMap.get(event.getChannelName());
            if (channel == null) {
                throw new SessionException("Channel '" + event.getChannelName() + "' not found during replay");
            }

            channel.getChatMessages().add(message);
            sessionRepository.save(session);
            log.debug("Replayed chat message: session='{}', channel='{}', sender='{}'", 
                    event.getSessionName(), event.getChannelName(), message.getSenderName());
        }
    }

    @NonNull
    private WhiteboardSession loadSessionGraph(String sessionName) throws SessionException {
        final WhiteboardSession session = Objects.requireNonNull(
                sessionRepository.findCompleteSessionBySessionName(sessionName)
                        .orElseThrow(() -> SessionException.sessionNotFound(sessionName))
        );
        
        if (session.getParticipants() != null) {
            session.getParticipants().size();
        }
        
        if (session.getChannels() != null) {
            for (Channel channel : session.getChannels()) {
                if (channel.getChatMessages() != null) {
                    channel.getChatMessages().size();
                }
                if (channel.getShapes() != null) {
                    channel.getShapes().size();
                }
            }
        }
        
        return session;
    }

    private Map<String, Channel> buildChannelMap(WhiteboardSession session) {
        if (session.getChannels() == null) {
            return Map.of();
        }
        return session.getChannels().stream()
                .collect(Collectors.toMap(
                        Channel::getChannelName,
                        Function.identity()
                ));
    }
}
