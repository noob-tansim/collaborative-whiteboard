package com.masterwayne.whiteboard_app.model;

import jakarta.persistence.Embeddable;
import lombok.Data;

import java.time.Instant;

@Data
@Embeddable
public class ChatMessage {
    private String senderName;
    private String content;
    private Instant timestamp;
}
