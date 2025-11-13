package com.masterwayne.whiteboard_app;

import com.masterwayne.whiteboard_app.model.WhiteboardSession;
import com.masterwayne.whiteboard_app.repository.WhiteboardSessionRepository;
import com.masterwayne.whiteboard_app.service.WhiteboardService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("dev")
@DataJpaTest
public class WhiteboardServiceTests {

    @Autowired
    private WhiteboardSessionRepository repository;

    private WhiteboardService service;

    @BeforeEach
    void setUp() {
        service = new WhiteboardService(repository);
    }

    @Test
    void createSession_success() {
        WhiteboardSession s = service.createSession("alpha", "manager1");
        assertNotNull(s.getId());
        assertEquals("alpha", s.getSessionName());
        assertEquals("manager1", s.getManager().getName());
        assertEquals(0, s.getParticipants().size());
        assertEquals(1, s.getChannels().size());
        assertEquals("general", s.getChannels().get(0).getChannelName());
    }

    @Test
    void createSession_duplicateNameThrows() {
        service.createSession("dup", "manager1");
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> service.createSession("dup", "manager2"));
        assertTrue(ex.getMessage().contains("already exists"));
    }

    @Test
    void joinSession_success() {
        service.createSession("beta", "manager1");
        WhiteboardSession updated = service.joinSession("beta", "userA");
        assertEquals(1, updated.getParticipants().size());
        assertEquals("userA", updated.getParticipants().get(0).getName());
    }

    @Test
    void joinSession_duplicateUserThrows() {
        service.createSession("gamma", "manager1");
        service.joinSession("gamma", "userA");
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> service.joinSession("gamma", "userA"));
        assertTrue(ex.getMessage().contains("already in the session"));
    }
}
