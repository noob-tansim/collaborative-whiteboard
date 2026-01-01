package com.masterwayne.whiteboard_app.controller;

import com.masterwayne.whiteboard_app.dto.CreateSessionRequest;
import com.masterwayne.whiteboard_app.dto.JoinSessionRequest;
import com.masterwayne.whiteboard_app.dto.SessionResponseDTO;
import com.masterwayne.whiteboard_app.dto.ChannelDTO;
import com.masterwayne.whiteboard_app.exception.SessionException;
import com.masterwayne.whiteboard_app.model.ChatMessage;
import com.masterwayne.whiteboard_app.model.DrawPayload;
import com.masterwayne.whiteboard_app.model.WhiteboardSession;
import com.masterwayne.whiteboard_app.service.WhiteboardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for session management operations.
 * Handles creation, joining, and retrieval of whiteboard sessions.
 * Exceptions are automatically handled by RestExceptionhandler for JSON error responses.
 */
@RestController
@RequestMapping("/api/sessions")
// @CrossOrigin annotation is no longer needed as frontend and backend are served from the same origin.
public class SessionController {
    private final WhiteboardService whiteboardService;

    @Autowired
    public SessionController(WhiteboardService whiteboardService) {
        this.whiteboardService = whiteboardService;
    }

    @PostMapping("/create")
    public ResponseEntity<SessionResponseDTO> createSession(@RequestBody CreateSessionRequest request) throws SessionException {
        WhiteboardSession newSession=whiteboardService.createSession(request.getSessionName(), request.getManagerName());
        SessionResponseDTO response = convertToDTO(newSession);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @PostMapping("/join")
    public ResponseEntity<SessionResponseDTO> joinSession(@RequestBody JoinSessionRequest request) throws SessionException {
        WhiteboardSession updatedSession=whiteboardService.joinSession(request.getSessionName(),request.getUserName());
        SessionResponseDTO response = convertToDTO(updatedSession);
        return ResponseEntity.ok(response);
    }

    /**
     * Convert WhiteboardSession to SessionResponseDTO
     */
    private SessionResponseDTO convertToDTO(WhiteboardSession session) {
        SessionResponseDTO dto = new SessionResponseDTO();
        dto.setId(session.getId());
        dto.setSessionName(session.getSessionName());
        dto.setManagerName(session.getManager().getName());
        
        if (session.getParticipants() != null) {
            dto.setParticipantNames(session.getParticipants().stream()
                    .map(p -> p.getName())
                    .collect(java.util.stream.Collectors.toList()));
        }
        
        if (session.getChannels() != null) {
            dto.setChannels(session.getChannels().stream()
                    .map(channel -> new ChannelDTO(
                            channel.getId(),
                            channel.getChannelName(),
                            channel.getChatMessages() != null ? channel.getChatMessages().size() : 0,
                            channel.getShapes() != null ? channel.getShapes().size() : 0
                    ))
                    .collect(java.util.stream.Collectors.toList()));
        }
        
        return dto;
    }

    @GetMapping("/{sessionName}")
    public ResponseEntity<SessionResponseDTO> getSession(@PathVariable String sessionName) throws SessionException {
        return whiteboardService.getSession(sessionName)
                .map(session -> ResponseEntity.ok(convertToDTO(session)))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get all channels in a session
     */
    @GetMapping("/{sessionName}/channels")
    public ResponseEntity<java.util.List<ChannelDTO>> getChannels(@PathVariable String sessionName) throws SessionException {
        java.util.Optional<WhiteboardSession> sessionOpt = whiteboardService.getSession(sessionName);
        if (sessionOpt.isPresent()) {
            WhiteboardSession session = sessionOpt.get();
            if (session.getChannels() != null) {
                java.util.List<ChannelDTO> channels = session.getChannels().stream()
                        .map(channel -> new ChannelDTO(
                                channel.getId(),
                                channel.getChannelName(),
                                channel.getChatMessages() != null ? channel.getChatMessages().size() : 0,
                                channel.getShapes() != null ? channel.getShapes().size() : 0
                        ))
                        .collect(java.util.stream.Collectors.toList());
                return ResponseEntity.ok(channels);
            }
            return ResponseEntity.ok(java.util.Collections.emptyList());
        }
        return ResponseEntity.notFound().build();
    }

    // Convenience endpoints to inspect persisted data per channel
    @GetMapping("/{sessionName}/channels/{channelName}/chat")
    public ResponseEntity<java.util.List<ChatMessage>> getChat(
            @PathVariable String sessionName,
            @PathVariable String channelName) throws SessionException {
        return ResponseEntity.ok(whiteboardService.getChatMessages(sessionName, channelName));
    }

    @GetMapping("/{sessionName}/channels/{channelName}/shapes")
    public ResponseEntity<java.util.List<DrawPayload>> getShapes(
            @PathVariable String sessionName,
            @PathVariable String channelName) throws SessionException {
        return ResponseEntity.ok(whiteboardService.getShapes(sessionName, channelName));
    }

    @PostMapping("/{sessionName}/channels/{channelName}/chat")
    public ResponseEntity<ChatMessage> postChatMessage(
            @PathVariable String sessionName,
            @PathVariable String channelName,
            @RequestBody com.masterwayne.whiteboard_app.dto.ChatPayload payload) throws SessionException {
        ChatMessage message = whiteboardService.postChatMessage(sessionName, channelName, payload);
        return ResponseEntity.ok(message);
    }
}
