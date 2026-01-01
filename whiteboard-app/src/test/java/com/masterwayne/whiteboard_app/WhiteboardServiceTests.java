package com.masterwayne.whiteboard_app;

import com.masterwayne.whiteboard_app.exception.SessionException;
import com.masterwayne.whiteboard_app.model.WhiteboardSession;
import com.masterwayne.whiteboard_app.service.WhiteboardService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for WhiteboardService.
 * Tests exception handling, session creation, joining, and error scenarios.
 */
@SpringBootTest
@ActiveProfiles("dev")
public class WhiteboardServiceTests {

    @Autowired
    private WhiteboardService service;

    @Test
    void createSession_success() throws SessionException {
        String sessionName = "test-session-" + System.currentTimeMillis();
        WhiteboardSession s = service.createSession(sessionName, "manager1");
        assertNotNull(s.getId());
        assertEquals(sessionName, s.getSessionName());
        assertEquals("manager1", s.getManager().getName());
        assertEquals(0, s.getParticipants().size());
        assertEquals(1, s.getChannels().size());
        assertEquals("general", s.getChannels().get(0).getChannelName());
    }

    @Test
    void createSession_duplicateNameThrows() throws SessionException {
        String sessionName = "dup-" + System.currentTimeMillis();
        service.createSession(sessionName, "manager1");
        SessionException ex = assertThrows(SessionException.class, () -> service.createSession(sessionName, "manager2"));
        assertTrue(ex.getMessage().contains("already exists"));
    }

    @Test
    void joinSession_success() throws SessionException {
        String sessionName = "beta-" + System.currentTimeMillis();
        service.createSession(sessionName, "manager1");
        WhiteboardSession updated = service.joinSession(sessionName, "userA");
        assertEquals(1, updated.getParticipants().size());
        assertEquals("userA", updated.getParticipants().get(0).getName());
    }

    @Test
    void joinSession_duplicateUserThrows() throws SessionException {
        String sessionName = "gamma-" + System.currentTimeMillis();
        service.createSession(sessionName, "manager1");
        service.joinSession(sessionName, "userA");
        SessionException ex = assertThrows(SessionException.class, () -> service.joinSession(sessionName, "userA"));
        assertTrue(ex.getMessage().contains("already in the session"));
    }
}
