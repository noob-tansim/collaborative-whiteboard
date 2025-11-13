package com.masterwayne.whiteboard_app;

import com.masterwayne.whiteboard_app.dto.CreateSessionRequest;
import com.masterwayne.whiteboard_app.dto.JoinSessionRequest;
import com.masterwayne.whiteboard_app.model.WhiteboardSession;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("dev")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class SessionControllerIntegrationTests {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate rest;

    private String baseUrl() { return "http://localhost:" + port + "/api/sessions"; }

    @Test
    void create_and_join_session() {
        // Create session
        CreateSessionRequest create = new CreateSessionRequest();
        create.setSessionName("itest-session");
        create.setManagerName("managerX");

    ResponseEntity<WhiteboardSession> created = rest.postForEntity(baseUrl() + "/create", create, WhiteboardSession.class);
    assertEquals(HttpStatus.CREATED, created.getStatusCode());
    WhiteboardSession createdBody = created.getBody();
    assertNotNull(createdBody);
    assertEquals("itest-session", createdBody.getSessionName());

        // Join session
        JoinSessionRequest join = new JoinSessionRequest();
        join.setSessionName("itest-session");
        join.setUserName("userY");

    ResponseEntity<WhiteboardSession> joined = rest.postForEntity(baseUrl() + "/join", join, WhiteboardSession.class);
    assertEquals(HttpStatus.OK, joined.getStatusCode());
    WhiteboardSession joinedBody = joined.getBody();
    assertNotNull(joinedBody);
    assertEquals(1, joinedBody.getParticipants().size());
    assertEquals("userY", joinedBody.getParticipants().get(0).getName());
    }
}
