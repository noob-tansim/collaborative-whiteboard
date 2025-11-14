package com.masterwayne.whiteboard_app.controller;

import com.masterwayne.whiteboard_app.dto.CreateSessionRequest;
import com.masterwayne.whiteboard_app.dto.JoinSessionRequest;
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
    public ResponseEntity<WhiteboardSession> createSession(@RequestBody CreateSessionRequest request) throws SessionException {
        WhiteboardSession newSession=whiteboardService.createSession(request.getSessionName(), request.getManagerName());
        return new ResponseEntity<>(newSession, HttpStatus.CREATED);
    }

    @PostMapping("/join")
    public ResponseEntity<WhiteboardSession> joinSession(@RequestBody JoinSessionRequest request) throws SessionException {
        WhiteboardSession updatedSession=whiteboardService.joinSession(request.getSessionName(),request.getUserName());
        return ResponseEntity.ok(updatedSession);
    }

    @GetMapping("/{sessionName}")
    public ResponseEntity<WhiteboardSession> getSession(@PathVariable String sessionName) throws SessionException {
        return whiteboardService.getSession(sessionName)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
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
}
