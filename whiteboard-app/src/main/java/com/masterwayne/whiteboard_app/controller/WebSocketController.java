package com.masterwayne.whiteboard_app.controller;

import com.masterwayne.whiteboard_app.dto.ChatPayload;
import com.masterwayne.whiteboard_app.model.DrawPayload;
import com.masterwayne.whiteboard_app.model.ChatMessage;
import com.masterwayne.whiteboard_app.service.WhiteboardService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;
import org.springframework.messaging.handler.annotation.Payload;

/**
 * WebSocket controller for real-time drawing and chat communication.
 * Uses STOMP message mapping to handle incoming messages and broadcast to subscribers.
 * Exceptions are caught and logged; fallback storage is triggered on persistence failures.
 */
@Controller
public class WebSocketController {
    private static final Logger logger = LoggerFactory.getLogger(WebSocketController.class);
    private final WhiteboardService whiteboardService;

    @Autowired
    public WebSocketController(WhiteboardService whiteboardService) {
        this.whiteboardService = whiteboardService;
    }

    @MessageMapping("/draw/{sessionName}/{channelName}")
    @SendTo("/topic/whiteboard/{sessionName}/{channelName}")
    public DrawPayload handleDrawEvent(@DestinationVariable String sessionName,
                                       @DestinationVariable String channelName,
                                       @Payload DrawPayload payload) {
        try {
            whiteboardService.addShape(sessionName, channelName, payload);
            return payload;
        } catch (Exception ex) {
            logger.error("Unexpected error handling draw event", ex);
            throw new RuntimeException("Unexpected error: " + ex.getMessage());
        }
    }

    @MessageMapping("/chat/{sessionName}/{channelName}")
    @SendTo("/topic/chat/{sessionName}/{channelName}")
    public ChatMessage handleChatMessage(@DestinationVariable String sessionName,
                                         @DestinationVariable String channelName,
                                         @Payload ChatPayload payload) {
        try {
            ChatMessage savedMessage = whiteboardService.postChatMessage(sessionName, channelName, payload);
            return savedMessage;
        } catch (Exception ex) {
            logger.error("Error handling chat message: {}", ex.getMessage(), ex);
            throw new RuntimeException("Failed to persist chat message: " + ex.getMessage());
        }
    }
}