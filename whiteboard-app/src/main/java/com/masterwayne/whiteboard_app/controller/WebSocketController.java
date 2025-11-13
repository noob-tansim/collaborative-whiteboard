package com.masterwayne.whiteboard_app.controller;

import com.masterwayne.whiteboard_app.dto.ChatPayload;
import com.masterwayne.whiteboard_app.model.DrawPayload;
import com.masterwayne.whiteboard_app.model.ChatMessage;
import com.masterwayne.whiteboard_app.service.WhiteboardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;
import org.springframework.messaging.handler.annotation.Payload; // <-- IMPORT THIS

@Controller
public class WebSocketController {
    private final WhiteboardService whiteboardService;

    @Autowired
    public WebSocketController(WhiteboardService whiteboardService) {
        this.whiteboardService = whiteboardService;
    }

    @MessageMapping("/draw/{sessionName}/{channelName}")
    @SendTo("/topic/whiteboard/{sessionName}/{channelName}")
    public DrawPayload handleDrawEvent(@DestinationVariable String sessionName,
                                       @DestinationVariable String channelName,
                                       @Payload DrawPayload payload) { // <-- THIS IS THE FIX
        whiteboardService.addShape(sessionName,channelName,payload);
         return payload;
    }

    @MessageMapping("/chat/{sessionName}/{channelName}")
    @SendTo("/topic/chat/{sessionName}/{channelName}")
    public ChatMessage handleChatMessage(@DestinationVariable String sessionName,
                                         @DestinationVariable String channelName,
                                         @Payload ChatPayload payload) { // <-- THIS IS THE FIX
        ChatMessage savedMessage = whiteboardService.postChatMessage(sessionName, channelName, payload);
        return savedMessage;
    }
}