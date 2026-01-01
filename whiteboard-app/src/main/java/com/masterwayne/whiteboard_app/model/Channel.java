package com.masterwayne.whiteboard_app.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Index;
import lombok.Data;
import org.hibernate.annotations.BatchSize;

import java.util.List;

@Data
@Entity
@Table(name = "channels", indexes = {
    @Index(name = "idx_channel_name", columnList = "channelName"),
    @Index(name = "idx_channel_session", columnList = "session_id"),
    @Index(name = "idx_channel_name_session", columnList = "channelName,session_id")
})
public class Channel {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Use standard camelCase for field names to avoid JPA/Jackson issues
    private String channelName;

    @ElementCollection
    @CollectionTable(
        name = "channel_shapes",
        joinColumns = @JoinColumn(name = "channel_id"),
        indexes = {
            @Index(name = "idx_channel_shapes_channel", columnList = "channel_id"),
            @Index(name = "idx_channel_shapes_type", columnList = "type")
        }
    )
    @BatchSize(size = 50)
    @JsonIgnore
    private List<DrawPayload> shapes;

    @ElementCollection
    @CollectionTable(
        name = "channel_chat_messages",
        joinColumns = @JoinColumn(name = "channel_id"),
        indexes = {
            @Index(name = "idx_channel_chat_channel", columnList = "channel_id"),
            @Index(name = "idx_channel_chat_timestamp", columnList = "timestamp")
        }
    )
    @BatchSize(size = 50)
    @JsonIgnore
    private List<ChatMessage> chatMessages;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id")
    @JsonIgnore
    private WhiteboardSession session;
}
