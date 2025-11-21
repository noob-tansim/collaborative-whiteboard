package com.masterwayne.whiteboard_app.repository;

import com.masterwayne.whiteboard_app.model.WhiteboardSession;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WhiteboardSessionRepository extends JpaRepository<WhiteboardSession, Long> {
    Optional<WhiteboardSession> findBySessionName(String sessionName);

    @EntityGraph(attributePaths = {"manager"})
    Optional<WhiteboardSession> findWithManagerBySessionName(String sessionName);

    @EntityGraph(attributePaths = {"participants"})
    Optional<WhiteboardSession> findWithParticipantsById(Long id);

    @EntityGraph(attributePaths = {"channels"})
    Optional<WhiteboardSession> findWithChannelsById(Long id);

    @EntityGraph(attributePaths = {"manager", "channels"})
    Optional<WhiteboardSession> findCompleteSessionBySessionName(String sessionName);

    @EntityGraph(attributePaths = {"participants"})
    Optional<WhiteboardSession> findWithParticipantsBySessionName(String sessionName);
}
