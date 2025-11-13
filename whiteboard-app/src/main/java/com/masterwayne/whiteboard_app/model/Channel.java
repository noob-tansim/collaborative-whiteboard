package com.masterwayne.whiteboard_app.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;

import java.util.List;

@Data
@Entity
@Table(name = "channels")
public class Channel {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Use standard camelCase for field names to avoid JPA/Jackson issues
    private String channelName;

    @ElementCollection
    @CollectionTable(name = "channel_shapes", joinColumns = @JoinColumn(name = "channel_id"))
    private List<DrawPayload> shapes;

    @ElementCollection
    @CollectionTable(name = "channel_chat_messages", joinColumns = @JoinColumn(name = "channel_id"))
    private List<ChatMessage> chatMessages;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id")
    @JsonIgnore
    private WhiteboardSession session;
}
