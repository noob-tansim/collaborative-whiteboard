package com.masterwayne.whiteboard_app.repository;

import com.masterwayne.whiteboard_app.model.WhiteboardSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WhiteboardSessionRepository extends JpaRepository<WhiteboardSession, Long> {
    Optional<WhiteboardSession> findBySessionName(String sessionName);
}
