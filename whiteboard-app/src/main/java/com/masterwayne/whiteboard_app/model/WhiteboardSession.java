package com.masterwayne.whiteboard_app.model;

import jakarta.persistence.*;
import lombok.Data;
import java.util.List;

@Data
@Entity
@Table(name = "sessions")
public class WhiteboardSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "session_name", unique = true)
    private String sessionName;

    @Embedded
    @AttributeOverrides({
            @AttributeOverride(name = "name", column = @Column(name = "manager_name"))
    })
    private Participant manager;

    @ElementCollection
    @CollectionTable(name = "session_participants", joinColumns = @JoinColumn(name = "session_id"))
    private List<Participant> participants;

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Channel>  channels;
}
