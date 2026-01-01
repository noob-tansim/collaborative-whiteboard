package com.masterwayne.whiteboard_app.dto;

import lombok.Data;

@Data
public class ChatPayload {
    private String senderName;
    private String content;

    /** Optional: 'text' | 'image' | 'file' */
    private String messageType;
    private String attachmentUrl;
    private String attachmentName;
    private String attachmentContentType;
    private Long attachmentSize;
}
