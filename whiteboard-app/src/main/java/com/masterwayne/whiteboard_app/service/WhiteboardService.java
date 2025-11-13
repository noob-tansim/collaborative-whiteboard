package com.masterwayne.whiteboard_app.service;

import com.masterwayne.whiteboard_app.dto.ChatPayload;
import com.masterwayne.whiteboard_app.model.DrawPayload;
import com.masterwayne.whiteboard_app.model.Channel;
import com.masterwayne.whiteboard_app.model.ChatMessage;
import com.masterwayne.whiteboard_app.model.Participant;
import com.masterwayne.whiteboard_app.model.WhiteboardSession;
import com.masterwayne.whiteboard_app.repository.WhiteboardSessionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Optional;

@Service
public class WhiteboardService {
    private final WhiteboardSessionRepository sessionRepository;
    private static final Logger log = LoggerFactory.getLogger(WhiteboardService.class);

    @Autowired
    public WhiteboardService(WhiteboardSessionRepository sessionRepository) {
        this.sessionRepository = sessionRepository;
    }

    public WhiteboardSession createSession(String sessionName,String managerName) {
        Optional<WhiteboardSession> existingSession = sessionRepository.findBySessionName(sessionName);
        if(existingSession.isPresent()) {
            throw new IllegalStateException("A session with the name '" + sessionName + "' already exists.");
        }
        Participant manager = new Participant();
        manager.setName(managerName);

    Channel generalChannel = new Channel();
    generalChannel.setChannelName("general");
    generalChannel.setShapes(new ArrayList<>());
    generalChannel.setChatMessages(new ArrayList<>());

    WhiteboardSession newSession = new WhiteboardSession();
    newSession.setSessionName(sessionName);
    newSession.setManager(manager);
    newSession.setParticipants(new ArrayList<>());
    // Use mutable list so Hibernate can manage (clear/replace) the collection
    newSession.setChannels(new ArrayList<>(Collections.singletonList(generalChannel)));
        generalChannel.setSession(newSession);

        WhiteboardSession saved = sessionRepository.save(newSession);
        // Avoid heavy logging but give a hint if needed
        log.info("createSession session='{}' manager='{}'", sessionName, managerName);
        return saved;
    }

    public WhiteboardSession joinSession(String sessionName,String userName) {
        long start = System.currentTimeMillis();
        WhiteboardSession session = sessionRepository.findBySessionName(sessionName)
                .orElseThrow(() -> new IllegalStateException("Session with the name '" + sessionName + "' does not exist."));

        // Idempotent join: if the user already exists (manager or participant), just return the session
        boolean isManager = session.getManager() != null && userName != null &&
                session.getManager().getName().equalsIgnoreCase(userName);
        boolean alreadyParticipant = userName != null && session.getParticipants() != null &&
                session.getParticipants().stream().anyMatch(p -> userName.equalsIgnoreCase(p.getName()));
        if (isManager || alreadyParticipant) {
            return session; // allow re-join without error
        }

        Participant newParticipant = new Participant();
        newParticipant.setName(userName);
        session.getParticipants().add(newParticipant);
        WhiteboardSession saved = sessionRepository.save(session);
        long elapsed = System.currentTimeMillis() - start;
        log.info("joinSession session='{}' user='{}' elapsedMs={}", sessionName, userName, elapsed);
        return saved;
    }

    // Non-blocking shape persistence - doesn't save previews, only final shapes
    public void addShape(String sessionName, String channelName, DrawPayload payload) {
        String type = payload.getType();
        
        // Skip ephemeral preview events - don't save to DB
        if (type != null && (type.startsWith("shape-preview") || type.startsWith("line-segment"))) {
            return; // Don't persist intermediate drawing states
        }
        
        // Handle clear event separately
        if ("clear".equals(type)) {
            clearShapes(sessionName, channelName);
            return;
        }
        
        // For final shapes only - use new transaction to avoid locking
        persistShapeAsync(sessionName, channelName, payload);
    }
    
    // Runs in separate transaction, non-blocking
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void persistShapeAsync(String sessionName, String channelName, DrawPayload payload) {
        try {
            Optional<WhiteboardSession> sessionOpt = sessionRepository.findBySessionName(sessionName);
            if (sessionOpt.isEmpty()) {
                return;
            }
            
            WhiteboardSession session = sessionOpt.get();
            Channel channel = session.getChannels().stream()
                    .filter(c -> c.getChannelName().equals(channelName))
                    .findFirst()
                    .orElse(null);
            
            if (channel != null) {
                channel.getShapes().add(payload);
                sessionRepository.save(session);
            }
        } catch (Exception e) {
            // Silent fail - real-time drawing works regardless
            log.debug("Shape persistence skipped for '{}': {}", sessionName, e.getMessage());
        }
    }
    
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void clearShapes(String sessionName, String channelName) {
        try {
            Optional<WhiteboardSession> sessionOpt = sessionRepository.findBySessionName(sessionName);
            if (sessionOpt.isEmpty()) {
                return;
            }
            
            WhiteboardSession session = sessionOpt.get();
            Channel channel = session.getChannels().stream()
                    .filter(c -> c.getChannelName().equals(channelName))
                    .findFirst()
                    .orElse(null);
            
            if (channel != null) {
                channel.getShapes().clear();
                sessionRepository.save(session);
            }
        } catch (Exception e) {
            log.debug("Clear shapes failed for '{}': {}", sessionName, e.getMessage());
        }
    }

    @Transactional // <-- THIS IS THE FIX
    public ChatMessage postChatMessage(String sessionName, String channelName, ChatPayload payload) {
        WhiteboardSession session = sessionRepository.findBySessionName(sessionName)
                .orElseThrow(() -> new IllegalStateException("Session not found: " + sessionName));

        Channel channel = session.getChannels().stream()
                .filter(c -> c.getChannelName().equals(channelName))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Channel not found: " + channelName));

        ChatMessage newMessage = new ChatMessage();
        newMessage.setSenderName(payload.getSenderName());
        newMessage.setContent(payload.getContent());
        newMessage.setTimestamp(Instant.now());
        channel.getChatMessages().add(newMessage);
        sessionRepository.save(session);

        return newMessage;
    }

    public Optional<WhiteboardSession> getSession(String sessionName) {
        return sessionRepository.findBySessionName(sessionName);
    }

    @Transactional(readOnly = true)
    public java.util.List<ChatMessage> getChatMessages(String sessionName, String channelName) {
        WhiteboardSession session = sessionRepository.findBySessionName(sessionName)
                .orElseThrow(() -> new IllegalStateException("Session not found: " + sessionName));
        return session.getChannels().stream()
                .filter(c -> c.getChannelName().equals(channelName))
                .findFirst()
                .map(Channel::getChatMessages)
                .orElseThrow(() -> new IllegalStateException("Channel not found: " + channelName));
    }

    @Transactional(readOnly = true)
    public java.util.List<DrawPayload> getShapes(String sessionName, String channelName) {
        WhiteboardSession session = sessionRepository.findBySessionName(sessionName)
                .orElseThrow(() -> new IllegalStateException("Session not found: " + sessionName));
        return session.getChannels().stream()
                .filter(c -> c.getChannelName().equals(channelName))
                .findFirst()
                .map(Channel::getShapes)
                .orElseThrow(() -> new IllegalStateException("Channel not found: " + channelName));
    }
}