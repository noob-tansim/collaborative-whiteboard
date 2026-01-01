package com.masterwayne.whiteboard_app.model;

import jakarta.persistence.Embeddable;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Embeddable
public class ChatMessage {
    private String id = UUID.randomUUID().toString(); // Unique ID for each message
    private String senderName;
    private String content;
    private String messageType;
    private String attachmentUrl;
    private String attachmentName;
    private String attachmentContentType;
    private Long attachmentSize;
    private Instant timestamp;
}
